import { DbManager } from './db.js';
import { CodebaseIndexer } from './code_intel.js';
import * as FileSystem from './file_system.js';
import * as Editor from './editor.js';
import * as UI from './ui.js';
import { ChatService } from './chat_service.js';
import { UndoManager } from './undo_manager.js';
import { ToolLogger } from './tool_logger.js';
import { syntaxValidator } from './syntax_validator.js';
import { codeComprehension } from './code_comprehension.js';
import { preciseEditor } from './precise_editor.js';
import { backgroundIndexer } from './background_indexer.js';
import { taskManager, TaskTools } from './task_manager.js';

// --- Helper Functions ---

function stripMarkdownCodeBlock(content) {
   if (typeof content !== 'string') {
       return content;
   }
   // Use a regular expression to match the code block format (e.g., ```javascript ... ```)
   const match = content.match(/^```(?:\w+)?\n([\s\S]+)\n```$/);
   // If it matches, return the captured group (the actual code). Otherwise, return the original content.
   return match ? match[1] : content;
}

// Enhanced syntax validation using the new validator
async function validateSyntaxBeforeWrite(filename, content) {
    const validation = await syntaxValidator.validateSyntax(filename, content);

    if (validation.warnings && validation.warnings.length > 0) {
        console.warn(`Syntax warnings found in ${filename}:`, validation.warnings);
    }

    if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `Line ${e.line}: ${e.message}`).join('\n');
        const suggestionMessages = validation.suggestions ? `\n\nSuggestions:\n- ${validation.suggestions.join('\n- ')}` : '';
        
        // This error will now be caught by the main tool execution logic,
        // preventing the file from being written.
        throw new Error(`Syntax validation failed for ${filename}:\n${errorMessages}${suggestionMessages}`);
    }

    console.log(`Syntax validation passed for ${filename}.`);
    return true;
}

// Streaming file processing for large files
async function streamFileUpdate(filename, content, chunkSize = 50000) {
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push(content.slice(i, i + chunkSize));
    }
    
    let result = '';
    for (let i = 0; i < chunks.length; i++) {
        result += chunks[i];
        
        // Yield control to prevent UI blocking
        if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Update progress for large files
        if (chunks.length > 10) {
            const progress = Math.round((i / chunks.length) * 100);
            console.log(`Processing large file: ${progress}%`);
        }
    }
    
    return result;
}

// Streaming edit for very large files (>500KB)
async function _streamingEditFile({ filename, edits, fileHandle, file }) {
    console.log(`Using streaming edit for large file: ${filename} (${file.size} bytes)`);
    
    // Read file in chunks to avoid memory issues
    const chunkSize = 1024 * 1024; // 1MB chunks
    const fileSize = file.size;
    let currentPos = 0;
    let lineNumber = 1;
    let lines = [];
    
    // Read file in chunks and split into lines
    while (currentPos < fileSize) {
        const chunk = await file.slice(currentPos, Math.min(currentPos + chunkSize, fileSize)).text();
        const chunkLines = chunk.split(/\r?\n/);
        
        if (lines.length > 0) {
            // Merge last line from previous chunk with first line of current chunk
            lines[lines.length - 1] += chunkLines[0];
            lines.push(...chunkLines.slice(1));
        } else {
            lines.push(...chunkLines);
        }
        
        currentPos += chunkSize;
        
        // Yield control periodically
        if (currentPos % (chunkSize * 5) === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    const originalLineCount = lines.length;
    console.log(`Streaming edit: Loaded ${originalLineCount} lines`);
    
    // Validate edits
    for (const edit of edits) {
        if (edit.type === 'replace_lines') {
            const { start_line, end_line } = edit;
            if (start_line < 1 || end_line < 1 || start_line > originalLineCount || end_line > originalLineCount) {
                throw new Error(`Invalid line range: ${start_line}-${end_line} (file has ${originalLineCount} lines)`);
            }
        }
    }
    
    // Apply edits in reverse order
    const sortedEdits = [...edits].sort((a, b) => b.start_line - a.start_line);
    
    for (const edit of sortedEdits) {
        if (edit.type === 'replace_lines') {
            const { start_line, end_line, new_content } = edit;
            const cleanContent = stripMarkdownCodeBlock(new_content || '');
            const newLines = cleanContent.split(/\r?\n/);
            
            const before = lines.slice(0, start_line - 1);
            const after = lines.slice(end_line);
            lines = [...before, ...newLines, ...after];
        }
    }
    
    // Write file in chunks to avoid memory issues
    const writable = await fileHandle.createWritable();
    const writeChunkSize = 100000; // 100KB write chunks
    
    for (let i = 0; i < lines.length; i += writeChunkSize) {
        const chunk = lines.slice(i, i + writeChunkSize).join('\n');
        await writable.write(chunk);
        
        if (i + writeChunkSize < lines.length) {
            await writable.write('\n');
        }
        
        // Yield control during writes
        if (i % (writeChunkSize * 2) === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    await writable.close();
    
    console.log(`Streaming edit completed: ${originalLineCount} -> ${lines.length} lines`);
    
    return {
        message: `Streaming edit applied to '${filename}' successfully. ${edits.length} edit(s) applied.`,
        details: {
            originalLines: originalLineCount,
            finalLines: lines.length,
            editsApplied: edits.length,
            processingMethod: 'streaming',
            fileSize: file.size
        }
    };
}

// --- Tool Handlers ---

function unescapeHtmlEntities(text) {
    if (typeof text !== 'string') {
        return text;
    }
    // Use a temporary textarea element to decode entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    let decoded = textarea.value;

    // Additionally, handle JavaScript-style hex escapes that might not be covered
    try {
        decoded = decoded.replace(/\\x([0-9A-Fa-f]{2})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        });
    } catch (e) {
        console.error("Error decoding hex escapes", e);
    }
    
    return decoded;
}

async function _getProjectStructure(params, rootHandle) {
    const ignorePatterns = await FileSystem.getIgnorePatterns(rootHandle);
    const tree = await FileSystem.buildStructureTree(rootHandle, ignorePatterns);
    const structure = FileSystem.formatTreeToString(tree);
    return { structure };
}

async function _readFile({ filename }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for read_file.");
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    const file = await fileHandle.getFile();

    const MAX_CONTEXT_BYTES = 256000; // 256KB threshold

    await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
    document.getElementById('chat-input').focus();

    if (file.size > MAX_CONTEXT_BYTES) {
        return {
            status: "Success",
            message: "File is too large to be returned in full.",
            filename: filename,
            file_size: file.size,
            truncated: true,
            guidance: "The file content was not returned to prevent exceeding the context window. The file has been opened in the editor. Use 'edit_file' with targeted 'edits' array to modify specific sections efficiently."
        };
    }

    const content = await file.text();
    const cleanContent = unescapeHtmlEntities(content);
    // There seems to be an issue with the return value being mutated.
    // Creating a new object explicitly can prevent this.
    const result = { content: cleanContent };
    return result;
}

async function _readFileLines({ filename, start_line, end_line }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (typeof start_line !== 'number' || typeof end_line !== 'number') {
        throw new Error("The 'start_line' and 'end_line' parameters must be numbers.");
    }
    if (start_line > end_line) {
        throw new Error("The 'start_line' must not be after the 'end_line'.");
    }

    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    const file = await fileHandle.getFile();
    const content = await file.text();
    const lines = content.split('\n');
    
    // Clamp the line numbers to the file's bounds
    const clampedStart = Math.max(1, start_line);
    const clampedEnd = Math.min(lines.length, end_line);

    if (clampedStart > clampedEnd) {
        return { content: '' }; // Return empty if the range is invalid after clamping
    }

    const selectedLines = lines.slice(clampedStart - 1, clampedEnd);
    return { content: selectedLines.join('\n') };
}

async function _searchInFile({ filename, pattern, context = 2 }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!pattern) throw new Error("The 'pattern' (string or regex) parameter is required.");

    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    const file = await fileHandle.getFile();
    const content = await file.text();
    const lines = content.split('\n');
    
    const searchResults = [];
    const regex = new RegExp(pattern, 'g');

    lines.forEach((line, index) => {
        if (line.match(regex)) {
            const start = Math.max(0, index - context);
            const end = Math.min(lines.length, index + context + 1);
            const contextLines = lines.slice(start, end).map((contextLine, contextIndex) => {
                const lineNumber = start + contextIndex + 1;
                return `${lineNumber}: ${contextLine}`;
            });
            
            searchResults.push({
                line_number: index + 1,
                line_content: line,
                context: contextLines.join('\n')
            });
        }
    });

    if (searchResults.length === 0) {
        return { message: "No matches found." };
    }

    return { results: searchResults };
}

async function _readMultipleFiles({ filenames }, rootHandle) {
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
        throw new Error("The 'filenames' parameter is required and must be a non-empty array of strings.");
    }

    const MAX_CONTEXT_BYTES = 256000; // 256KB threshold per file
    let combinedContent = '';

    for (const filename of filenames) {
        try {
            const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
            const file = await fileHandle.getFile();
            
            combinedContent += `--- START OF FILE: ${filename} ---\n`;

            if (file.size > MAX_CONTEXT_BYTES) {
                combinedContent += `File is too large to be included in the context (Size: ${file.size} bytes).\n`;
                combinedContent += `Guidance: The file has been opened in the editor. Use surgical tools to modify it.\n`;
            } else {
                let content = await file.text();
                combinedContent += content + '\n';
            }
            
            combinedContent += `--- END OF FILE: ${filename} ---\n\n`;

            await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
        } catch (error) {
            combinedContent += `--- ERROR READING FILE: ${filename} ---\n`;
            combinedContent += `${error.message}\n`;
            combinedContent += `--- END OF ERROR ---\n\n`;
        }
    }
    
    document.getElementById('chat-input').focus();
    return { combined_content: combinedContent };
}

async function _createFile({ filename, content }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for create_file.");
    const cleanContent = stripMarkdownCodeBlock(content);
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename, { create: true });
    if (!await FileSystem.verifyAndRequestPermission(fileHandle, true)) {
        throw new Error('Permission to write to the file was denied.');
    }
    
    // Track for undo - save empty content since this is a new file creation
    UndoManager.push(filename, '');
    
    const writable = await fileHandle.createWritable();
    await writable.write(cleanContent);
    await writable.close();
    await new Promise(resolve => setTimeout(resolve, 100)); // Mitigate race condition
    await UI.refreshFileTree(rootHandle, (filePath) => {
        const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
        Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
    });
    await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
    document.getElementById('chat-input').focus();
    return { message: `File '${filename}' created successfully.` };
}

async function _rewriteFile({ filename, content }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for rewrite_file.");
    const cleanContent = stripMarkdownCodeBlock(content);
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename, { create: true });
    if (!await FileSystem.verifyAndRequestPermission(fileHandle, true)) {
        throw new Error('Permission to write to the file was denied.');
    }
    
    let originalContent = '';
    try {
        const file = await fileHandle.getFile();
        originalContent = await file.text();
        UndoManager.push(filename, originalContent);
    } catch (e) {
        // File doesn't exist, push empty content for undo
        UndoManager.push(filename, '');
    }

    // Validate syntax before writing
    await validateSyntaxBeforeWrite(filename, cleanContent);

    // Use streaming for large files
    const STREAM_THRESHOLD = 100000; // 100KB
    let processedContent = cleanContent;
    
    if (cleanContent.length > STREAM_THRESHOLD) {
        console.log(`Processing large file ${filename} with streaming...`);
        processedContent = await streamFileUpdate(filename, cleanContent);
    }

    const writable = await fileHandle.createWritable();
    await writable.write(processedContent);
    await writable.close();
    
    if (Editor.getOpenFiles().has(filename)) {
        Editor.getOpenFiles().get(filename)?.model.setValue(processedContent);
    }
    await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
    document.getElementById('chat-input').focus();
    return { message: `File '${filename}' rewritten successfully.` };
}

async function _deleteFile({ filename }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for delete_file.");
    const { parentHandle, entryName } = await FileSystem.getParentDirectoryHandle(rootHandle, filename);
    await parentHandle.removeEntry(entryName);
    await new Promise(resolve => setTimeout(resolve, 100)); // Mitigate race condition
    if (Editor.getOpenFiles().has(filename)) {
        Editor.closeTab(filename, document.getElementById('tab-bar'));
    }
    await UI.refreshFileTree(rootHandle, (filePath) => {
        const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
        Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
    });
    return { message: `File '${filename}' deleted successfully.` };
}

async function _renameFile({ old_path, new_path }, rootHandle) {
    if (!old_path || !new_path) throw new Error("The 'old_path' and 'new_path' parameters are required for rename_file.");
    await FileSystem.renameEntry(rootHandle, old_path, new_path);
    await new Promise(resolve => setTimeout(resolve, 100)); // Mitigate race condition
    await UI.refreshFileTree(rootHandle, (filePath) => {
        const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
        Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
    });
    if (Editor.getOpenFiles().has(old_path)) {
        Editor.closeTab(old_path, document.getElementById('tab-bar'));
        const newFileHandle = await FileSystem.getFileHandleFromPath(rootHandle, new_path);
        await Editor.openFile(newFileHandle, new_path, document.getElementById('tab-bar'), false);
        document.getElementById('chat-input').focus();
    }
    return { message: `File '${old_path}' renamed to '${new_path}' successfully.` };
}

// REMOVED: insert_content function - simplified to use only rewrite_file for clarity

// REMOVED: replace_lines function - was causing conflicts and bugs with complex indentation logic

// REMOVED: apply_diff function - was causing conflicts, simplified to use only rewrite_file

async function _createDiff({ original_content, new_content }) {
    if (original_content === undefined) throw new Error("The 'original_content' parameter is required for create_diff.");
    if (new_content === undefined) throw new Error("The 'new_content' parameter is required for create_diff.");

    const dmp = new diff_match_patch();
    const a = dmp.diff_linesToChars_(original_content, new_content);
    const lineText1 = a.chars1;
    const lineText2 = a.chars2;
    const lineArray = a.lineArray;
    const diffs = dmp.diff_main(lineText1, lineText2, false);
    dmp.diff_charsToLines_(diffs, lineArray);
    const patches = dmp.patch_make(original_content, diffs);
    const patchText = dmp.patch_toText(patches);

    return { patch_content: patchText };
}

// Smart file editing - efficient for large files, safe for small ones
async function _smartEditFile({ filename, edits }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!edits || !Array.isArray(edits)) throw new Error("The 'edits' parameter is required and must be an array.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    if (!await FileSystem.verifyAndRequestPermission(fileHandle, true)) {
        throw new Error('Permission to write to the file was denied.');
    }
    
    const file = await fileHandle.getFile();
    const fileSize = file.size;
    console.log(`_smartEditFile: Processing ${filename} (${fileSize} bytes)`);
    
    // For very large files (>500KB), use streaming approach
    if (fileSize > 500000) {
        return await _streamingEditFile({ filename, edits, fileHandle, file });
    }
    
    const originalContent = await file.text();
    UndoManager.push(filename, originalContent);
    
    let lines = originalContent.split(/\r?\n/);
    const originalLineCount = lines.length;
    
    // Enhanced validation with better error messages and graceful clamping
    for (const edit of edits) {
        if (edit.type === 'replace_lines') {
            let { start_line, end_line } = edit;
            if (typeof start_line !== 'number' || typeof end_line !== 'number') {
                throw new Error(`Invalid line numbers in edit: start_line=${start_line}, end_line=${end_line}`);
            }
            if (start_line < 1 || end_line < 1) {
                throw new Error(`Line numbers must be >= 1: start_line=${start_line}, end_line=${end_line}`);
            }
            if (start_line > end_line) {
                throw new Error(`start_line (${start_line}) cannot be greater than end_line (${end_line})`);
            }
            if (start_line > originalLineCount) {
                 throw new Error(`start_line (${start_line}) exceeds file length (${originalLineCount}).`);
            }
            // Gracefully clamp the end_line if it exceeds the file length
            if (end_line > originalLineCount) {
                console.warn(`Warning: end_line (${end_line}) exceeds file length (${originalLineCount}). Clamping to ${originalLineCount}.`);
                edit.end_line = originalLineCount;
            }
        } else if (edit.type === 'insert_lines') {
            const { line_number } = edit;
            if (typeof line_number !== 'number' || line_number < 0 || line_number > originalLineCount) {
                throw new Error(`Invalid line number for insert: ${line_number} (file has ${originalLineCount} lines)`);
            }
        } else {
            throw new Error(`Unsupported edit type: ${edit.type}`);
        }
    }
    
    // Apply edits in reverse order to maintain line numbers
    const sortedEdits = [...edits].sort((a, b) => {
        const aLine = a.type === 'insert_lines' ? a.line_number : a.start_line;
        const bLine = b.type === 'insert_lines' ? b.line_number : b.start_line;
        return bLine - aLine;
    });
    
    for (const edit of sortedEdits) {
        if (edit.type === 'replace_lines') {
            const { start_line, end_line, new_content } = edit;
            const cleanContent = stripMarkdownCodeBlock(new_content || '');
            const newLines = cleanContent.split(/\r?\n/);
            
            // Replace the specified range with new content
            const before = lines.slice(0, start_line - 1);
            const after = lines.slice(end_line);
            lines = [...before, ...newLines, ...after];
        } else if (edit.type === 'insert_lines') {
            const { line_number, new_content } = edit;
            const cleanContent = stripMarkdownCodeBlock(new_content || '');
            const newLines = cleanContent.split(/\r?\n/);
            
            // Insert at the specified line number
            const before = lines.slice(0, line_number);
            const after = lines.slice(line_number);
            lines = [...before, ...newLines, ...after];
        }
    }
    
    await ToolLogger.log('_smartEditFile', {
        filename,
        fileSize,
        originalLineCount,
        finalLineCount: lines.length,
        editsApplied: edits.length
    }, 'Success');
    
    // Preserve original line endings
    const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
    const newContent = lines.join(lineEnding);
    
    // Final validation of the fully assembled content before writing
    await validateSyntaxBeforeWrite(filename, newContent);

    const writable = await fileHandle.createWritable();
    await writable.write(newContent);
    await writable.close();
    
    // Only refresh editor for smaller files to avoid performance issues
    if (fileSize < 100000 && Editor.getOpenFiles().has(filename)) {
        Editor.getOpenFiles().get(filename)?.model.setValue(newContent);
    }
    
    // Only auto-open if file is small enough
    if (fileSize < 50000) {
        await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
    }
    
    document.getElementById('chat-input').focus();
    
    return {
        message: `Smart edit applied to '${filename}' successfully. ${edits.length} edit(s) applied.`,
        details: {
            originalLines: originalLineCount,
            finalLines: lines.length,
            editsApplied: edits.length,
            fileSize: fileSize,
            processingMethod: fileSize > 500000 ? 'streaming' : 'standard'
        }
    };
}

// Intelligent file size-based tool selection
async function _editFile({ filename, content, edits }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    
    // Auto-detect best approach based on file size and edit type
    if (content !== undefined && edits !== undefined) {
        throw new Error("Provide either 'content' OR 'edits', not both.");
    }
    
    if (content !== undefined) {
        // Check if file exists and its size to determine best approach
        try {
            const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
            const file = await fileHandle.getFile();
            const fileSize = file.size;
            
            // For very large files, suggest using edits instead
            if (fileSize > 1000000) { // 1MB threshold
                console.warn(`File ${filename} is large (${fileSize} bytes). Consider using 'edits' for better performance.`);
            }
        } catch (e) {
            // File doesn't exist, will be created
        }
        
        return await _rewriteFile({ filename, content }, rootHandle);
    }
    
    // If edits provided, use smart editing (for large files)
    if (edits !== undefined) {
        return await _smartEditFile({ filename, edits }, rootHandle);
    }
    
    throw new Error("Either 'content' (for full rewrite) or 'edits' (for targeted changes) must be provided.");
}

// Fast append for logs and incremental files
async function _appendToFile({ filename, content }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!content) throw new Error("The 'content' parameter is required.");
    
    const cleanContent = stripMarkdownCodeBlock(content);
    
    try {
        const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
        if (!await FileSystem.verifyAndRequestPermission(fileHandle, true)) {
            throw new Error('Permission to write to the file was denied.');
        }
        
        // Get existing content
        const file = await fileHandle.getFile();
        const existingContent = await file.text();
        
        // Append new content
        const newContent = existingContent + (existingContent ? '\n' : '') + cleanContent;
        
        const writable = await fileHandle.createWritable();
        await writable.write(newContent);
        await writable.close();
        
        return { 
            message: `Content appended to '${filename}' successfully.`,
            details: { appendedBytes: cleanContent.length }
        };
    } catch (error) {
        if (error.name === 'NotFoundError') {
            // File doesn't exist, create it
            return await _createFile({ filename, content: cleanContent }, rootHandle);
        }
        throw error;
    }
}

// Get file size and metadata without reading content
async function _getFileInfo({ filename }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    
    try {
        const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
        const file = await fileHandle.getFile();
        
        return {
            message: `File info for '${filename}':`,
            details: {
                name: file.name,
                size: file.size,
                lastModified: new Date(file.lastModified).toISOString(),
                type: file.type || 'text/plain'
            }
        };
    } catch (error) {
        if (error.name === 'NotFoundError') {
            throw new Error(`File '${filename}' does not exist.`);
        }
        throw error;
    }
}

// --- Unified Task Management Tool Handlers ---

async function _taskCreate({ title, description = '', priority = 'medium', parentId = null, listId = null }) {
    if (!title) throw new Error("The 'title' parameter is required.");
    const task = await TaskTools.create({ title, description, priority, parentId, listId });
    return {
        message: `Task "${title}" created with ID ${task.id}.`,
        details: task
    };
}

async function _taskUpdate({ taskId, updates }) {
    if (!taskId || !updates) throw new Error("Both 'taskId' and 'updates' are required.");
    const task = await TaskTools.update(taskId, updates);
    return {
        message: `Task "${task.title}" (ID: ${taskId}) updated.`,
        details: task
    };
}

async function _taskDelete({ taskId }) {
    if (!taskId) throw new Error("The 'taskId' parameter is required.");
    const task = await TaskTools.delete(taskId);
    return {
        message: `Task "${task.title}" (ID: ${taskId}) and all its subtasks have been deleted.`,
        details: task
    };
}

async function _taskBreakdown({ taskId }) {
    if (!taskId) throw new Error("The 'taskId' parameter is required.");
    const mainTask = TaskTools.getById(taskId);
    if (!mainTask) throw new Error(`Task with ID ${taskId} not found.`);
    
    const subtasks = await TaskTools.breakdown(mainTask);
    return {
        message: `Goal "${mainTask.title}" has been broken down into ${subtasks.length} subtasks.`,
        details: {
            mainTask,
            subtasks
        }
    };
}

async function _taskGetNext() {
    const nextTask = TaskTools.getNext();
    if (!nextTask) {
        return {
            message: "No actionable tasks are currently available. All tasks may be completed or blocked by dependencies.",
            details: null
        };
    }
    return {
        message: `The next actionable task is "${nextTask.title}".`,
        details: nextTask
    };
}

async function _taskGetStatus({ taskId }) {
    if (taskId) {
        const task = TaskTools.getById(taskId);
        if (!task) {
            return {
                message: `Task with ID ${taskId} not found.`,
                details: null
            };
        }
        return {
            message: `Task "${task.title}" is currently ${task.status}.`,
            details: task
        };
    } else {
        // Get overall status of all tasks
        const allTasks = TaskTools.getAll();
        const stats = {
            total: allTasks.length,
            pending: allTasks.filter(t => t.status === 'pending').length,
            in_progress: allTasks.filter(t => t.status === 'in_progress').length,
            completed: allTasks.filter(t => t.status === 'completed').length,
            failed: allTasks.filter(t => t.status === 'failed').length
        };
        
        const activeTasks = allTasks.filter(t => t.status === 'in_progress');
        const nextTask = TaskTools.getNext();
        
        return {
            message: `Task Status Overview: ${stats.total} total, ${stats.pending} pending, ${stats.in_progress} in progress, ${stats.completed} completed, ${stats.failed} failed.`,
            details: {
                stats,
                activeTasks,
                nextTask,
                recentTasks: allTasks.sort((a, b) => (b.updatedTime || b.createdTime) - (a.updatedTime || a.createdTime)).slice(0, 5)
            }
        };
    }
}

async function _createFolder({ folder_path }, rootHandle) {
    if (!folder_path) throw new Error("The 'folder_path' parameter is required for create_folder.");
    await FileSystem.createDirectoryFromPath(rootHandle, folder_path);
    await new Promise(resolve => setTimeout(resolve, 100)); // Mitigate race condition
    await UI.refreshFileTree(rootHandle, (filePath) => {
        const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
        Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
    });
    return { message: `Folder '${folder_path}' created successfully.` };
}

async function _deleteFolder({ folder_path }, rootHandle) {
    if (!folder_path) throw new Error("The 'folder_path' parameter is required for delete_folder.");
    const { parentHandle, entryName } = await FileSystem.getParentDirectoryHandle(rootHandle, folder_path);
    await parentHandle.removeEntry(entryName, { recursive: true });
    await new Promise(resolve => setTimeout(resolve, 100)); // Mitigate race condition
    await UI.refreshFileTree(rootHandle, (filePath) => {
        const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
        Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
    });
    return { message: `Folder '${folder_path}' deleted successfully.` };
}

async function _renameFolder({ old_folder_path, new_folder_path }, rootHandle) {
    if (!old_folder_path || !new_folder_path) throw new Error("The 'old_folder_path' and 'new_folder_path' parameters are required for rename_folder.");
    await FileSystem.renameEntry(rootHandle, old_folder_path, new_folder_path);
    await new Promise(resolve => setTimeout(resolve, 100)); // Mitigate race condition
    await UI.refreshFileTree(rootHandle, (filePath) => {
        const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
        Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
    });
    return { message: `Folder '${old_folder_path}' renamed to '${new_folder_path}' successfully.` };
}

async function _searchCode({ search_term }, rootHandle) {
    if (!backgroundIndexer.isAvailable()) {
        throw new Error("The background indexer is not ready. Please wait a moment and try again.");
    }
    const searchResults = await backgroundIndexer.searchInIndex(search_term);
   
   const successfulResults = searchResults.filter(r => r.matches);
   const erroredFiles = searchResults.filter(r => r.error);

   let summary = `Search complete. Found ${successfulResults.length} files with matches.`;
   if (erroredFiles.length > 0) {
       summary += ` Failed to search ${erroredFiles.length} files.`;
   }

    return {
       summary: summary,
       results: successfulResults,
       errors: erroredFiles
   };
}

async function _buildCodebaseIndex(params, rootHandle) {
    const startTime = Date.now();
    UI.appendMessage(document.getElementById('chat-messages'), 'Checking for updates and building codebase index...', 'ai');

    const lastIndexTimestamp = await DbManager.getLastIndexTimestamp() || 0;
    const existingIndex = await DbManager.getCodeIndex();
    
    const ignorePatterns = await FileSystem.getIgnorePatterns(rootHandle);
    const { index: newIndex, stats } = await CodebaseIndexer.buildIndex(rootHandle, { lastIndexTimestamp, existingIndex, ignorePatterns });
    
    await DbManager.saveCodeIndex(newIndex);
    await DbManager.saveLastIndexTimestamp(startTime);

    const message = `Codebase index updated. ${stats.indexedFileCount} files indexed, ${stats.skippedFileCount} files skipped (unchanged), ${stats.deletedFileCount} files removed.`;
    return { message };
}

async function _queryCodebase({ query }) {
    const index = await DbManager.getCodeIndex();
    if (!index) throw new Error("No codebase index. Please run 'build_or_update_codebase_index'.");
    const queryResults = await CodebaseIndexer.queryIndex(index, query);
    return { results: queryResults };
}

async function _reindexCodebasePaths({ paths }, rootHandle) {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        throw new Error("The 'paths' parameter is required and must be a non-empty array.");
    }

    UI.appendMessage(document.getElementById('chat-messages'), `Re-indexing ${paths.length} specific paths...`, 'ai');
    
    const index = await DbManager.getCodeIndex();
    if (!index) {
        throw new Error("No codebase index found. Please run 'build_or_update_codebase_index' first.");
    }
    const stats = { indexedFileCount: 0, skippedFileCount: 0, deletedFileCount: 0 };
    const ignorePatterns = await FileSystem.getIgnorePatterns(rootHandle);

    await CodebaseIndexer.reIndexPaths(rootHandle, paths, index, stats, ignorePatterns);

    await DbManager.saveCodeIndex(index);
    
    const message = `Re-indexing complete for specified paths. ${stats.indexedFileCount} files were updated.`;
    return { message };
}

async function _formatCode({ filename }, rootHandle) {
    return new Promise(async (resolve, reject) => {
        if (!filename) {
            return reject(new Error("The 'filename' parameter is required."));
        }

        try {
            const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
            const file = await fileHandle.getFile();
            const originalContent = await file.text();
            UndoManager.push(filename, originalContent);
            const parser = Editor.getPrettierParser(filename);
            
            if (!parser) {
                return reject(new Error(`Could not determine Prettier parser for file: ${filename}`));
            }

            const prettierWorker = new Worker('prettier.worker.js');

            prettierWorker.onmessage = async (event) => {
                if (event.data.success) {
                    const formattedCode = event.data.formattedCode;
                    
                    if (!await FileSystem.verifyAndRequestPermission(fileHandle, true)) {
                        return reject(new Error('Permission to write to the file was denied.'));
                    }
                    
                    const writable = await fileHandle.createWritable();
                    await writable.write(formattedCode);
                    await writable.close();

                    if (Editor.getOpenFiles().has(filename)) {
                        Editor.getOpenFiles().get(filename)?.model.setValue(formattedCode);
                    }
                    
                    resolve({ message: `File '${filename}' formatted successfully.` });
                } else {
                    console.error('Error formatting file from worker:', event.data.error);
                    reject(new Error(`An error occurred while formatting the file: ${event.data.error}`));
                }
                prettierWorker.terminate();
            };
            
            prettierWorker.onerror = (error) => {
                reject(new Error(`Prettier worker error: ${error.message}`));
                prettierWorker.terminate();
            };

            prettierWorker.postMessage({ code: originalContent, parser });

        } catch (error) {
            reject(new Error(`Failed to format code: ${error.message}`));
        }
    });
}

async function _analyzeCode({ filename }, rootHandle) {
    if (!filename.endsWith('.js')) {
        throw new Error('This tool can only analyze .js files. Use read_file for others.');
    }
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    const file = await fileHandle.getFile();
    const content = await file.text();
    const ast = acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const analysis = { functions: [], classes: [], imports: [] };
    acorn.walk.simple(ast, {
        FunctionDeclaration(node) { analysis.functions.push({ name: node.id.name, start: node.loc.start.line, end: node.loc.end.line }); },
        ClassDeclaration(node) { analysis.classes.push({ name: node.id.name, start: node.loc.start.line, end: node.loc.end.line }); },
        ImportDeclaration(node) { analysis.imports.push({ source: node.source.value, specifiers: node.specifiers.map((s) => s.local.name) }); },
    });
    return { analysis };
}

// Helper function to validate terminal commands for safety
function validateTerminalCommand(command) {
    if (!command || typeof command !== 'string') {
        throw new Error('Command must be a non-empty string');
    }
    
    // List of dangerous commands that should be blocked
    const dangerousCommands = [
        'rm -rf',
        'rm -r',
        'sudo rm',
        'format',
        'del /s',
        'rd /s',
        'mkfs',
        'dd if=',
        'fdisk',
        'shutdown',
        'reboot',
        'halt',
        'init 0',
        'killall',
        'kill -9',
        'chmod 777',
        'chown -R',
        '> /dev/',
        'curl.*|.*sh',
        'wget.*|.*sh',
    ];
    
    const lowerCommand = command.toLowerCase();
    for (const dangerous of dangerousCommands) {
        if (lowerCommand.includes(dangerous.toLowerCase())) {
            throw new Error(`Command contains potentially dangerous operation: ${dangerous}`);
        }
    }
    
    // Block commands with suspicious patterns
    if (lowerCommand.match(/rm\s+.*-r/) || 
        lowerCommand.match(/>\s*\/dev\//) ||
        lowerCommand.match(/\|\s*sh/) ||
        lowerCommand.match(/\|\s*bash/)) {
        throw new Error('Command contains potentially dangerous patterns');
    }
    
    return true;
}

async function _runTerminalCommand(parameters, rootHandle) {
    if (!parameters.command) {
        throw new Error("The 'command' parameter is required for run_terminal_command.");
    }
    
    // Validate command for security
    validateTerminalCommand(parameters.command);
    
    const updatedParameters = { ...parameters, cwd: rootHandle.name };
    const response = await fetch('/api/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: 'run_terminal_command', parameters: updatedParameters }),
    });
    const terminalResult = await response.json();
    if (terminalResult.status === 'Success') {
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        return { output: terminalResult.output };
    } else {
        throw new Error(`Command failed. This is likely a backend issue. Please check the server logs. Raw message: ${terminalResult.message}`);
    }
}

// Helper function to safely escape shell arguments
function escapeShellArg(arg) {
    if (typeof arg !== 'string') {
        throw new Error('Shell argument must be a string');
    }
    // Replace any single quotes with '\'' (close quote, escaped quote, open quote)
    return `'${arg.replace(/'/g, `'\\''`)}'`;
}

async function _getFileHistory({ filename }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for get_file_history.");
    
    // Safely escape the filename to prevent command injection
    const escapedFilename = escapeShellArg(filename);
    const command = `git log --pretty=format:"%h - %an, %ar : %s" -- ${escapedFilename}`;
    const updatedParameters = { command, cwd: rootHandle.name };
    const response = await fetch('/api/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: 'run_terminal_command', parameters: updatedParameters }),
    });
    const terminalResult = await response.json();
    if (terminalResult.status === 'Success') {
        return { history: terminalResult.output };
    } else {
        throw new Error(terminalResult.message || `Fetching file history failed. This is likely a backend issue with 'git'.`);
    }
}

// --- Non-Project Tools ---

async function _readUrl({ url }) {
    const response = await fetch('/api/read-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
    const urlResult = await response.json();
    if (response.ok) {
        return urlResult;
    } else {
        throw new Error(urlResult.message || 'Failed to read URL');
    }
}

async function _duckduckgoSearch({ query }) {
    const response = await fetch('/api/duckduckgo-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    const searchResult = await response.json();
    if (response.ok) {
        return searchResult;
    } else {
        throw new Error(searchResult.message || 'Failed to perform search');
    }
}

async function _performResearch({ query, max_results = 3, depth = 1 }) {
    if (!query) throw new Error("The 'query' parameter is required for perform_research.");

    let visitedUrls = new Set();
    let allLinks = [];
    let allContent = [];
    let references = [];

    async function searchAndRead(currentQuery, currentDepth) {
        if (currentDepth > depth) return;

        UI.appendMessage(document.getElementById('chat-messages'), `Performing search for: "${currentQuery}" (Depth: ${currentDepth})`, 'ai');
        const searchResults = await _duckduckgoSearch({ query: currentQuery });
        
        if (!searchResults.results || searchResults.results.length === 0) {
            return;
        }

        const linksToRead = searchResults.results
            .map(r => r.link)
            .filter(link => link && !visitedUrls.has(link))
            .slice(0, max_results);

        for (const link of linksToRead) {
            if (visitedUrls.has(link)) continue;
            visitedUrls.add(link);
            references.push(link);

            try {
                UI.appendMessage(document.getElementById('chat-messages'), `Reading URL: ${link}`, 'ai');
                const urlContent = await _readUrl({ url: link });
                
                if (urlContent.content) {
                    allContent.push(`--- START OF CONTENT FROM ${link} ---\n${urlContent.content}\n--- END OF CONTENT FROM ${link} ---\n`);
                }
                
                if (urlContent.links && urlContent.links.length > 0) {
                    allLinks.push(...urlContent.links);
                }
            } catch (error) {
                console.warn(`Failed to read URL ${link}:`, error.message);
                allContent.push(`--- FAILED TO READ CONTENT FROM ${link} ---\nError: ${error.message}\n--- END OF FAILED CONTENT ---`);
            }
        }
    }

    await searchAndRead(query, 1);

    // Here, you could add logic for the AI to decide to go deeper
    // For now, it just does one level of search and read.

    return {
        summary: `Research for "${query}" complete. The following content was gathered.`,
        full_content: allContent.join('\n\n'),
        references: references,
    };
}

async function _getOpenFileContent() {
    const activeFile = Editor.getActiveFile();
    if (!activeFile) throw new Error('No file is currently open in the editor.');
    
    const content = activeFile.model.getValue();
    return { filename: activeFile.name, content: content };
}

async function _getSelectedText() {
    const editor = Editor.getEditorInstance();
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) {
        throw new Error('Error: No text is currently selected in the editor. Please select the text you want to get.');
    }
    const selectedText = editor.getModel().getValueInRange(selection);
    return {
        selected_text: selectedText,
        start_line: selection.startLineNumber,
        start_column: selection.startColumn,
        end_line: selection.endLineNumber,
        end_column: selection.endColumn,
        details: `Selection from L${selection.startLineNumber}:C${selection.startColumn} to L${selection.endLineNumber}:C${selection.endColumn}`
    };
}

async function _setSelectedText({ start_line, start_column, end_line, end_column }) {
    if (start_line === undefined || start_column === undefined || end_line === undefined || end_column === undefined) {
        throw new Error("Parameters 'start_line', 'start_column', 'end_line', and 'end_column' are required.");
    }
    const editor = Editor.getEditorInstance();
    const range = new monaco.Range(start_line, start_column, end_line, end_column);
    editor.setSelection(range);
    editor.revealRange(range, monaco.editor.ScrollType.Smooth); // Scroll to the selection
    editor.focus();
    return { message: `Selection set to L${start_line}:C${start_column} to L${end_line}:C${end_column}.` };
}

async function _replaceSelectedText({ new_text }) {
   const cleanText = stripMarkdownCodeBlock(new_text);
   const editor = Editor.getEditorInstance();
   const selection = editor.getSelection();
   if (!selection || selection.isEmpty()) throw new Error('Error: No text is selected in the editor. Please select the text you want to replace.');
   editor.executeEdits('ai-agent', [{ range: selection, text: cleanText }]);
   return { message: 'Replaced the selected text.' };
}

// =================================================================
// === Backend Indexing Tools                                    ===
// =================================================================

async function build_backend_index(params, rootHandle) {
   const ignorePatterns = await FileSystem.getIgnorePatterns(rootHandle);
   const response = await fetch('/api/build-codebase-index', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ ignorePatterns }),
   });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to build backend index: ${error.message}`);
  }
  const result = await response.json();
  return `Backend index built successfully. Indexed ${result.indexedFiles} files and found ${result.totalSymbols} symbols.`;
}

async function query_backend_index({ query, page = 1, limit = 20 }) {
  const params = new URLSearchParams({ query, page, limit });
  const response = await fetch(`/api/query-codebase?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to query backend index: ${error.message}`);
  }
  const result = await response.json();
  return result;
}


async function _undoLastChange(params, rootHandle) {
   const lastState = UndoManager.pop();
   if (!lastState) {
       return { message: "No file modifications to undo." };
   }

   const { filename, content } = lastState;
   await _rewriteFile({ filename, content }, rootHandle);
   
   // After undoing, we don't want the user to "redo" the undo, so don't push to stack again.
   // The rewriteFile call inside this function will have pushed the state *before* the undo.
   // We need to pop that off to prevent a confusing redo state.
   UndoManager.pop();


   return { message: `Undid the last change to '${filename}'.` };
}

async function _listTools() {
   const toolNames = Object.keys(toolRegistry);
   return { tools: toolNames };
}

// --- Enhanced Code Comprehension Tools ---

async function _analyzeSymbol({ symbol_name, file_path }, rootHandle) {
    if (!symbol_name) throw new Error("The 'symbol_name' parameter is required.");
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const analysis = await codeComprehension.analyzeSymbol(symbol_name, file_path, rootHandle);
    return { analysis };
}

async function _explainCodeSection({ file_path, start_line, end_line }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    if (typeof start_line !== 'number') throw new Error("The 'start_line' parameter is required and must be a number.");
    if (typeof end_line !== 'number') throw new Error("The 'end_line' parameter is required and must be a number.");
    
    const explanation = await codeComprehension.explainCodeSection(file_path, start_line, end_line, rootHandle);
    return { explanation };
}

async function _traceVariableFlow({ variable_name, file_path }, rootHandle) {
    if (!variable_name) throw new Error("The 'variable_name' parameter is required.");
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const analysis = await codeComprehension.analyzeSymbol(variable_name, file_path, rootHandle);
    return {
        variable: variable_name,
        definitions: analysis.definitions,
        usages: analysis.usages,
        dataFlow: analysis.dataFlow,
        relatedFiles: analysis.relatedFiles
    };
}

// --- Precise Code Modification Tools ---

// REMOVED: modify_function - use rewrite_file for simplicity

// REMOVED: modify_class - use rewrite_file for simplicity

// REMOVED: rename_symbol - use manual find/replace with rewrite_file

// REMOVED: add_method_to_class - use rewrite_file for simplicity

// REMOVED: update_imports - use rewrite_file for simplicity

// --- Enhanced Analysis Tools ---

async function _validateSyntax({ file_path }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    const validation = await syntaxValidator.validateSyntax(file_path, content);
    
    return {
        file: file_path,
        valid: validation.valid,
        language: validation.language,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        suggestions: validation.suggestions || []
    };
}

// --- Tool Registry ---

const toolRegistry = {
   list_tools: { handler: _listTools, requiresProject: false, createsCheckpoint: false },
    // Project-based tools
    get_project_structure: { handler: _getProjectStructure, requiresProject: true, createsCheckpoint: false },
    
    // Enhanced code comprehension tools
    analyze_symbol: { handler: _analyzeSymbol, requiresProject: true, createsCheckpoint: false },
    explain_code_section: { handler: _explainCodeSection, requiresProject: true, createsCheckpoint: false },
    trace_variable_flow: { handler: _traceVariableFlow, requiresProject: true, createsCheckpoint: false },
    validate_syntax: { handler: _validateSyntax, requiresProject: true, createsCheckpoint: false },
    
    // REMOVED: Precise code modification tools - simplified to use rewrite_file only
    read_file: { handler: _readFile, requiresProject: true, createsCheckpoint: false },
    read_file_lines: { handler: _readFileLines, requiresProject: true, createsCheckpoint: false },
    search_in_file: { handler: _searchInFile, requiresProject: true, createsCheckpoint: false },
    read_multiple_files: { handler: _readMultipleFiles, requiresProject: true, createsCheckpoint: false },
    search_code: { handler: _searchCode, requiresProject: true, createsCheckpoint: false },
    build_or_update_codebase_index: { handler: _buildCodebaseIndex, requiresProject: true, createsCheckpoint: false },
    query_codebase: { handler: _queryCodebase, requiresProject: true, createsCheckpoint: false },
    reindex_codebase_paths: { handler: _reindexCodebasePaths, requiresProject: true, createsCheckpoint: false },
    format_code: { handler: _formatCode, requiresProject: true, createsCheckpoint: false },
    analyze_code: { handler: _analyzeCode, requiresProject: true, createsCheckpoint: false },
    get_file_history: { handler: _getFileHistory, requiresProject: true, createsCheckpoint: false },
    run_terminal_command: { handler: _runTerminalCommand, requiresProject: true, createsCheckpoint: false },

    // New backend indexer tools
    build_backend_index: { handler: build_backend_index, requiresProject: true, createsCheckpoint: false },
    query_backend_index: { handler: query_backend_index, requiresProject: true, createsCheckpoint: false },

    // Smart file modification tools
    create_file: { handler: _createFile, requiresProject: true, createsCheckpoint: true },
    edit_file: { handler: _editFile, requiresProject: true, createsCheckpoint: true },
    rewrite_file: { handler: _rewriteFile, requiresProject: true, createsCheckpoint: true },
    append_to_file: { handler: _appendToFile, requiresProject: true, createsCheckpoint: true },
    get_file_info: { handler: _getFileInfo, requiresProject: true, createsCheckpoint: false },
    delete_file: { handler: _deleteFile, requiresProject: true, createsCheckpoint: true },
    rename_file: { handler: _renameFile, requiresProject: true, createsCheckpoint: true },
    create_folder: { handler: _createFolder, requiresProject: true, createsCheckpoint: true },
    delete_folder: { handler: _deleteFolder, requiresProject: true, createsCheckpoint: true },
    rename_folder: { handler: _renameFolder, requiresProject: true, createsCheckpoint: true },

    // --- Unified Task Management Tools ---
    task_create: { handler: _taskCreate, requiresProject: false, createsCheckpoint: true },
    task_update: { handler: _taskUpdate, requiresProject: false, createsCheckpoint: true },
    task_delete: { handler: _taskDelete, requiresProject: false, createsCheckpoint: true },
    task_breakdown: { handler: _taskBreakdown, requiresProject: false, createsCheckpoint: true },
    task_get_next: { handler: _taskGetNext, requiresProject: false, createsCheckpoint: false },
    task_get_status: { handler: _taskGetStatus, requiresProject: false, createsCheckpoint: false },

    // Non-project / Editor tools
    read_url: { handler: _readUrl, requiresProject: false, createsCheckpoint: false },
    duckduckgo_search: { handler: _duckduckgoSearch, requiresProject: false, createsCheckpoint: false },
    perform_research: { handler: _performResearch, requiresProject: false, createsCheckpoint: false },
    get_open_file_content: { handler: _getOpenFileContent, requiresProject: false, createsCheckpoint: false },
    get_selected_text: { handler: _getSelectedText, requiresProject: false, createsCheckpoint: false },
    replace_selected_text: { handler: _replaceSelectedText, requiresProject: false, createsCheckpoint: false },
    set_selected_text: { handler: _setSelectedText, requiresProject: false, createsCheckpoint: false },
    create_diff: { handler: _createDiff, requiresProject: false, createsCheckpoint: false },
    undo_last_change: { handler: _undoLastChange, requiresProject: true, createsCheckpoint: false },
};

// --- Core Execution Logic ---

async function createAutomaticCheckpoint() {
    try {
        const editorState = Editor.getEditorState();
        if (editorState.openFiles.length > 0) {
            const checkpointData = {
                name: `Auto-Checkpoint @ ${new Date().toLocaleString()}`,
                editorState: editorState,
                timestamp: Date.now(),
            };
            await DbManager.saveCheckpoint(checkpointData);
        }
    } catch (error) {
        console.error('Failed to create automatic checkpoint:', error);
    }
}

async function executeTool(toolCall, rootDirectoryHandle) {
    const { name: toolName, args: parameters } = toolCall;
    const tool = toolRegistry[toolName];

    if (!tool) {
        throw new Error(`Unknown tool '${toolName}'.`);
    }

    if (tool.requiresProject && !rootDirectoryHandle) {
        return { error: "No project folder is open. Please ask the user to open a folder before using this tool." };
    }

    if (tool.createsCheckpoint) {
        await createAutomaticCheckpoint();
    }

    return tool.handler(parameters, rootDirectoryHandle);
}

// REMOVED: TOOLS_REQUIRING_SYNTAX_CHECK - no longer using automatic syntax checking

export async function execute(toolCall, rootDirectoryHandle, silent = false) {
    const toolName = toolCall.name;
    const mode = document.getElementById('agent-mode-selector').value;

    if (mode === 'amend' && toolName === 'rewrite_file') {
        throw new Error("The 'rewrite_file' tool is not allowed in 'Amend' mode. Use 'edit_file' with the 'edits' parameter for targeted changes.");
    }
    const parameters = toolCall.args;
    const groupTitle = `AI Tool Call: ${toolName}`;
    const groupContent = parameters && Object.keys(parameters).length > 0 ? parameters : 'No parameters';
    console.group(groupTitle, groupContent);
    
    let logEntry;
    if (!silent) {
        logEntry = UI.appendToolLog(document.getElementById('chat-messages'), toolName, parameters);
    }

    let resultForModel;
    let isSuccess = true;

    try {
        resultForModel = await executeTool(toolCall, rootDirectoryHandle);
        ToolLogger.log(toolName, parameters, 'Success', resultForModel);
    } catch (error) {
        isSuccess = false;
        const errorMessage = `Error executing tool '${toolName}': ${error.message}`;
        resultForModel = { error: errorMessage };
        UI.showError(errorMessage);
        console.error(errorMessage, error);
        ToolLogger.log(toolName, parameters, 'Error', { message: error.message, stack: error.stack });
    }

    // REMOVED: Automatic syntax checking feedback loop - was causing infinite loops and conflicts
    // Tools now report success/failure directly without automatic error detection

    const resultForLog = isSuccess ? { status: 'Success', ...resultForModel } : { status: 'Error', message: resultForModel.error };
    console.log('Result:', resultForLog);
    console.groupEnd();
    if (!silent) {
        UI.updateToolLog(logEntry, isSuccess);
    }
    return { toolResponse: { name: toolName, response: resultForModel } };
}

export function getToolDefinitions() {
    return {
        functionDeclarations: [
            { name: 'create_file', description: "Creates a new file. CRITICAL: Do NOT include the root directory name in the path. Example: To create 'app.js' in the root, the path is 'app.js', NOT 'my-project/app.js'.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'The raw text content of the file. CRITICAL: Do NOT wrap this content in markdown backticks (```).' } }, required: ['filename', 'content'] } },
            { name: 'delete_file', description: "Deletes a file. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'create_folder', description: "Creates a new folder. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { folder_path: { type: 'STRING' } }, required: ['folder_path'] } },
            { name: 'delete_folder', description: "Deletes a folder and all its contents. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { folder_path: { type: 'STRING' } }, required: ['folder_path'] } },
            { name: 'rename_folder', description: "Renames a folder. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { old_folder_path: { type: 'STRING' }, new_folder_path: { type: 'STRING' } }, required: ['old_folder_path', 'new_folder_path'] } },
            { name: 'rename_file', description: "Renames a file. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { old_path: { type: 'STRING' }, new_path: { type: 'STRING' } }, required: ['old_path', 'new_path'] } },
            { name: 'read_file', description: "Reads a file's content. CRITICAL: Do NOT include the root directory name in the path. Example: To read 'src/app.js', the path is 'src/app.js'.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'read_multiple_files', description: "Reads and concatenates the content of multiple files. Essential for multi-file context tasks.", parameters: { type: 'OBJECT', properties: { filenames: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['filenames'] } },
            { name: 'read_file_lines', description: 'Reads a specific range of lines from a file. Use this for large files.', parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, start_line: { type: 'NUMBER' }, end_line: { type: 'NUMBER' } }, required: ['filename', 'start_line', 'end_line'] } },
            { name: 'search_in_file', description: 'Searches for a pattern in a file and returns matching lines. Use this for large files.', parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, pattern: { type: 'STRING' }, context: { type: 'NUMBER' } }, required: ['filename', 'pattern'] } },
            { name: 'read_url', description: 'Reads and extracts the main content and all links from a given URL. The result will be a JSON object with "content" and "links" properties.', parameters: { type: 'OBJECT', properties: { url: { type: 'STRING' } }, required: ['url'] } },
            { name: 'get_open_file_content', description: 'Gets the content of the currently open file in the editor.' },
            { name: 'get_selected_text', description: 'Gets the text currently selected by the user in the editor.' },
            { name: 'replace_selected_text', description: 'Replaces the currently selected text in the editor with new text.', parameters: { type: 'OBJECT', properties: { new_text: { type: 'STRING', description: 'The raw text to replace the selection with. CRITICAL: Do NOT wrap this content in markdown backticks (```).' } }, required: ['new_text'] } },
            { name: 'get_project_structure', description: 'Gets the entire file and folder structure of the project. CRITICAL: Always use this tool before attempting to read or create a file to ensure you have the correct file path.' },
            { name: 'duckduckgo_search', description: 'Performs a search using DuckDuckGo and returns the results.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
            { name: 'perform_research', description: 'Performs an autonomous, multi-step research on a given query. It searches the web, reads the most relevant pages, and can recursively explore links to gather comprehensive information.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, max_results: { type: 'NUMBER', description: 'Maximum number of search results to read per level. Default is 3.' }, depth: { type: 'NUMBER', description: 'How many levels of links to follow. Default is 1.' } }, required: ['query'] } },
            { name: 'search_code', description: 'Searches for a specific string in all files in the project (like grep).', parameters: { type: 'OBJECT', properties: { search_term: { type: 'STRING' } }, required: ['search_term'] } },
            { name: 'run_terminal_command', description: 'Executes a shell command on the backend and returns the output.', parameters: { type: 'OBJECT', properties: { command: { type: 'STRING' } }, required: ['command'] } },
            { name: 'build_or_update_codebase_index', description: 'Scans the entire codebase to build a searchable index. Slow, run once per session.' },
            { name: 'query_codebase', description: 'Searches the pre-built codebase index.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
            { name: 'get_file_history', description: "Gets a file's git history. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            // REMOVED: insert_content, create_and_apply_diff, replace_lines - simplified to use rewrite_file only
            { name: 'format_code', description: "Formats a file with Prettier. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'analyze_code', description: "Analyzes a JavaScript file's structure. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'edit_file', description: "FASTEST tool for file editing. Auto-detects file size and uses optimal method. Provide EITHER 'content' for small files (full rewrite) OR 'edits' for large files (streaming). Supports both replace_lines and insert_lines.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'Complete file content for small files. CRITICAL: Do NOT wrap in markdown backticks.' }, edits: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: ['replace_lines', 'insert_lines'] }, start_line: { type: 'NUMBER', description: 'Start line for replace_lines' }, end_line: { type: 'NUMBER', description: 'End line for replace_lines' }, line_number: { type: 'NUMBER', description: 'Line position for insert_lines (0=start of file)' }, new_content: { type: 'STRING' } } }, description: 'Efficient targeted edits for large files. Use replace_lines to replace line ranges or insert_lines to add content.' } }, required: ['filename'] } },
            { name: 'append_to_file', description: "Fast append content to end of file without reading full content. Ideal for logs, incremental updates.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'Content to append. Will add newline separator automatically.' } }, required: ['filename', 'content'] } },
            { name: 'get_file_info', description: "Get file metadata (size, last modified, type) without reading content. Use before editing large files.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'rewrite_file', description: "Legacy method - rewrites entire file. Use edit_file instead for better performance.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'The new, raw text content of the file. CRITICAL: Do NOT wrap this content in markdown backticks (```).' } }, required: ['filename', 'content'] } },
            
            // --- Unified Task Management System ---
            { name: 'task_create', description: "Creates a new task. This is the starting point for any new goal.", parameters: { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' }, priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'urgent'] }, parentId: { type: 'STRING' }, listId: { type: 'STRING' } }, required: ['title'] } },
            { name: 'task_update', description: "Updates an existing task with new information or status.", parameters: { type: 'OBJECT', properties: { taskId: { type: 'STRING' }, updates: { type: 'OBJECT' } }, required: ['taskId', 'updates'] } },
            { name: 'task_delete', description: "Deletes a task and all of its subtasks.", parameters: { type: 'OBJECT', properties: { taskId: { type: 'STRING' } }, required: ['taskId'] } },
            { name: 'task_breakdown', description: "Analyzes a high-level task and automatically breaks it down into smaller, actionable subtasks.", parameters: { type: 'OBJECT', properties: { taskId: { type: 'STRING' } }, required: ['taskId'] } },
            { name: 'task_get_next', description: "Fetches the next logical task for the AI to work on, based on priority and dependencies." },
            { name: 'task_get_status', description: "Gets status information about tasks. Can check a specific task by ID or get overall task statistics.", parameters: { type: 'OBJECT', properties: { taskId: { type: 'STRING', description: 'Optional specific task ID to check. If omitted, returns overview of all tasks.' } } } },
            
            // Enhanced code comprehension tools
            { name: 'analyze_symbol', description: 'Analyzes a symbol (variable, function, class) across the entire codebase to understand its usage, definition, and relationships.', parameters: { type: 'OBJECT', properties: { symbol_name: { type: 'STRING', description: 'The name of the symbol to analyze' }, file_path: { type: 'STRING', description: 'The file path where the symbol is used or defined' } }, required: ['symbol_name', 'file_path'] } },
            { name: 'explain_code_section', description: 'Provides detailed explanation of a complex code section including complexity analysis, symbols, and control flow.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING' }, start_line: { type: 'NUMBER' }, end_line: { type: 'NUMBER' } }, required: ['file_path', 'start_line', 'end_line'] } },
            { name: 'trace_variable_flow', description: 'Traces the data flow of a variable through the codebase to understand how data moves and transforms.', parameters: { type: 'OBJECT', properties: { variable_name: { type: 'STRING' }, file_path: { type: 'STRING' } }, required: ['variable_name', 'file_path'] } },
            { name: 'validate_syntax', description: 'Validates the syntax of a file and provides detailed errors, warnings, and suggestions.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING' } }, required: ['file_path'] } },
            
            // Smart editing system - efficient for both small and large files
        ],
    };
}
