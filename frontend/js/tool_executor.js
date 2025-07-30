import { DbManager } from './db.js';
import { CodebaseIndexer } from './code_intel.js';
import * as FileSystem from './file_system.js';
import * as Editor from './editor.js';
import * as UI from './ui.js';
import { ChatService } from './chat_service.js';
import { UndoManager } from './undo_manager.js';
import { toolLogger } from './tool_logger.js';
import { syntaxValidator } from './syntax_validator.js';
import { codeComprehension } from './code_comprehension.js';
import { preciseEditor } from './precise_editor.js';
import { backgroundIndexer } from './background_indexer.js';
import { taskManager, TaskTools } from './task_manager.js';
import { performanceOptimizer } from './performance_optimizer.js';
import { providerOptimizer } from './provider_optimizer.js';

// Senior Engineer AI System Imports
import { symbolResolver } from './symbol_resolver.js';
import { dataFlowAnalyzer } from './data_flow_analyzer.js';
import { debuggingIntelligence } from './debugging_intelligence.js';
import { codeQualityAnalyzer } from './code_quality_analyzer.js';
import { seniorEngineerAI } from './senior_engineer_ai.js';

// Smart debugging and optimization state
const debuggingState = {
    recentErrors: new Map(), // Track recent errors for pattern detection
    toolPerformance: new Map(), // Track tool execution times
    contextCache: new Map(), // Cache frequently accessed contexts
    lastFileOperations: [], // Track recent file operations for optimization
    amendModeOptimizations: {
        preferredTools: ['apply_diff', 'search_files', 'read_file'],
        avoidedTools: ['write_to_file', 'rewrite_file'],
        smartSearch: true,
        contextAware: true
    },
    smartToolSelection: {
        fileEditingHistory: new Map(), // Track which tools work best for different file types
        errorPatterns: new Map(), // Track common error patterns and solutions
        performanceMetrics: new Map() // Track tool performance by context
    }
};

// Import diff_match_patch for diff creation
let diff_match_patch;
try {
    // Try to import from global scope (if loaded via script tag)
    diff_match_patch = window.diff_match_patch;
    if (!diff_match_patch) {
        throw new Error('diff_match_patch not found in global scope');
    }
} catch (e) {
    console.warn('diff_match_patch not available:', e.message);
}

// --- Smart Debugging and Optimization Functions ---

// Track tool performance and suggest optimizations
function trackToolPerformance(toolName, startTime, endTime, success, context = {}) {
    const duration = endTime - startTime;
    const key = `${toolName}_${context.fileType || 'unknown'}`;
    
    if (!debuggingState.toolPerformance.has(key)) {
        debuggingState.toolPerformance.set(key, {
            totalCalls: 0,
            totalTime: 0,
            successCount: 0,
            failureCount: 0,
            averageTime: 0,
            lastUsed: Date.now()
        });
    }
    
    const metrics = debuggingState.toolPerformance.get(key);
    metrics.totalCalls++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.totalCalls;
    metrics.lastUsed = Date.now();
    
    if (success) {
        metrics.successCount++;
    } else {
        metrics.failureCount++;
    }
    
    // Log performance warnings for slow tools
    if (duration > 5000) { // 5 seconds
        console.warn(`[Performance] Tool ${toolName} took ${duration}ms to execute`);
    }
}

// Smart tool selection based on context and history
function getOptimalTool(intent, context = {}) {
    const { fileType, fileSize, mode } = context;
    
    // Amend mode optimizations
    if (mode === 'amend') {
        if (intent === 'edit_file') {
            // Prefer apply_diff for surgical changes in amend mode
            return {
                recommendedTool: 'apply_diff',
                reason: 'apply_diff is safer and more precise for amend mode',
                alternatives: ['edit_file']
            };
        }
        
        if (intent === 'search') {
            return {
                recommendedTool: 'search_in_file',
                reason: 'More targeted search for amend mode',
                alternatives: ['search_code']
            };
        }
    }
    
    // File size optimizations
    if (intent === 'edit_file' && fileSize) {
        if (fileSize > 500000) { // 500KB
            return {
                recommendedTool: 'edit_file',
                reason: 'Use edits array for large files',
                parameters: { preferEditsArray: true },
                alternatives: ['apply_diff']
            };
        }
    }
    
    // Performance-based recommendations
    const performanceKey = `${intent}_${fileType || 'unknown'}`;
    const metrics = debuggingState.toolPerformance.get(performanceKey);
    
    if (metrics && metrics.failureCount > metrics.successCount) {
        console.warn(`[Smart Selection] Tool ${intent} has high failure rate for ${fileType} files`);
    }
    
    return null; // No specific recommendation
}

// Error pattern detection and smart recovery
function analyzeError(toolName, error, context = {}) {
    const errorSignature = `${toolName}:${error.message.substring(0, 100)}`;
    
    if (!debuggingState.recentErrors.has(errorSignature)) {
        debuggingState.recentErrors.set(errorSignature, {
            count: 0,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            contexts: []
        });
    }
    
    const errorInfo = debuggingState.recentErrors.get(errorSignature);
    errorInfo.count++;
    errorInfo.lastSeen = Date.now();
    errorInfo.contexts.push(context);
    
    // Detect recurring errors
    if (errorInfo.count >= 3) {
        console.warn(`[Error Pattern] Recurring error detected: ${errorSignature}`);
        return getSuggestedFix(toolName, error, errorInfo);
    }
    
    return null;
}

// Suggest fixes for common error patterns
function getSuggestedFix(toolName, error, errorInfo) {
    const errorMessage = error.message.toLowerCase();
    
    // apply_diff specific errors
    if (toolName === 'apply_diff') {
        if (errorMessage.includes('no valid diff blocks found')) {
            return {
                suggestion: 'The diff format is incorrect. Use read_file with include_line_numbers=true first, then format the diff exactly as: <<<<<<< SEARCH\\n:start_line:N\\n-------\\nexact content\\n=======\\nnew content\\n>>>>>>> REPLACE',
                alternativeTool: 'read_file',
                confidence: 0.95
            };
        }
        if (errorMessage.includes('search content does not match')) {
            return {
                suggestion: 'The search content must match exactly. Use read_file with include_line_numbers=true to get the exact current content, then copy it precisely into the SEARCH block',
                alternativeTool: 'read_file',
                confidence: 0.95
            };
        }
    }
    
    // File not found errors
    if (errorMessage.includes('not found') || errorMessage.includes('notfounderror')) {
        return {
            suggestion: 'Use get_project_structure first to verify file paths',
            alternativeTool: 'get_project_structure',
            confidence: 0.9
        };
    }
    
    // Permission errors - enhanced handling for File System Access API
    if (errorMessage.includes('permission') || errorMessage.includes('denied') ||
        errorMessage.includes('user activation is required')) {
        return {
            suggestion: 'File system permission issue. This can happen when the AI tries to access files without user interaction. The system will attempt to handle permissions automatically during file operations. If this persists, try manually clicking in the editor or file tree first.',
            alternativeTool: 'read_file',
            confidence: 0.9
        };
    }
    
    // Syntax errors in file editing
    if (toolName.includes('edit') && errorMessage.includes('syntax')) {
        return {
            suggestion: 'Use apply_diff for more precise editing to avoid syntax errors',
            alternativeTool: 'apply_diff',
            confidence: 0.85
        };
    }
    
    // Line number errors
    if (errorMessage.includes('line') && errorMessage.includes('invalid')) {
        return {
            suggestion: 'Use read_file with line numbers first to get accurate line references',
            alternativeTool: 'read_file',
            confidence: 0.9
        };
    }
    
    return null;
}

// Smart caching for repeated operations
function getCachedResult(toolName, parameters) {
    const cacheKey = `${toolName}:${JSON.stringify(parameters)}`;
    const cached = debuggingState.contextCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
        console.log(`[Cache Hit] Using cached result for ${toolName}`);
        return cached.result;
    }
    
    return null;
}

function setCachedResult(toolName, parameters, result) {
    const cacheKey = `${toolName}:${JSON.stringify(parameters)}`;
    debuggingState.contextCache.set(cacheKey, {
        result,
        timestamp: Date.now()
    });
    
    // Limit cache size
    if (debuggingState.contextCache.size > 100) {
        const oldestKey = Array.from(debuggingState.contextCache.keys())[0];
        debuggingState.contextCache.delete(oldestKey);
    }
}

// Optimize tool execution order
function optimizeToolSequence(tools) {
    // Sort tools by priority and dependencies
    const priorityOrder = {
        'get_project_structure': 1,
        'read_file': 2,
        'search_files': 3,
        'apply_diff': 4,
        'edit_file': 5,
        'create_file': 6
    };
    
    return tools.sort((a, b) => {
        const priorityA = priorityOrder[a.name] || 999;
        const priorityB = priorityOrder[b.name] || 999;
        return priorityA - priorityB;
    });
}

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
        
        // Return a detailed error object instead of throwing an error
        return {
            isValid: false,
            errors: errorMessages,
            suggestions: suggestionMessages
        };
    }

    console.log(`Syntax validation passed for ${filename}.`);
    return { isValid: true };
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

async function _readFile({ filename, include_line_numbers = false }, rootHandle) {
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
    let cleanContent = unescapeHtmlEntities(content);

    if (include_line_numbers) {
        const lines = cleanContent.split('\n');
        cleanContent = lines.map((line, index) => `${index + 1} | ${line}`).join('\n');
    }
    
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
    
    const clampedStart = Math.max(1, start_line);
    const clampedEnd = Math.min(lines.length, end_line);

    if (clampedStart > clampedEnd) {
        return { content: '' };
    }

    const selectedLines = lines.slice(clampedStart - 1, clampedEnd);
    
    // Always include line numbers in the output of this tool
    const numberedLines = selectedLines.map((line, index) => `${clampedStart + index} | ${line}`);
    
    return { content: numberedLines.join('\n') };
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

async function _createFile({ filename, content = '' }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for create_file.");
    if (typeof filename !== 'string') throw new Error("The 'filename' parameter must be a string.");
    
    const cleanContent = stripMarkdownCodeBlock(content);
    
    try {
        const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename, { create: true });
        
        // Enhanced permission handling - try to proceed even if permission check fails
        let hasPermission = false;
        try {
            hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
        } catch (permissionError) {
            console.warn('Permission check failed, attempting to proceed:', permissionError.message);
            hasPermission = true; // Optimistically proceed
        }
        
        if (!hasPermission) {
            throw new Error('Permission to write to the file was denied.');
        }
        
        // Track for undo - save empty content since this is a new file creation
        UndoManager.push(filename, '');
        
        const writable = await fileHandle.createWritable();
        await writable.write(cleanContent);
        await writable.close();
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
        document.getElementById('chat-input').focus();
        
        return { message: `File '${filename}' created successfully.` };
    } catch (error) {
        // Enhanced error handling for permission issues
        if (error.message.includes('User activation is required')) {
            throw new Error(`Failed to create file '${filename}': File system permission required. This happens when the AI tries to create files without user interaction. Please try clicking in the editor or file tree first, then retry the operation.`);
        }
        throw new Error(`Failed to create file '${filename}': ${error.message}`);
    }
}

async function _rewriteFile({ filename, content }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for rewrite_file.");
    const cleanContent = stripMarkdownCodeBlock(content);
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename, { create: true });
    
    // Enhanced permission handling - try to proceed even if permission check fails
    let hasPermission = false;
    try {
        hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
    } catch (permissionError) {
        console.warn('Permission check failed, attempting to proceed:', permissionError.message);
        hasPermission = true; // Optimistically proceed
    }
    
    if (!hasPermission) {
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

    // Validate syntax before writing, but do not block
    const validationResult = await validateSyntaxBeforeWrite(filename, cleanContent);

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
    let message = `File '${filename}' rewritten successfully.`;
    if (!validationResult.isValid) {
        message += `\n\nWARNING: Syntax errors were detected and have been written to the file.\nErrors:\n${validationResult.errors}${validationResult.suggestions}`;
    }
    return { message };
}

async function _deleteFile({ filename }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for delete_file.");
    if (typeof filename !== 'string') throw new Error("The 'filename' parameter must be a string.");
    
    try {
        const { parentHandle, entryName } = await FileSystem.getParentDirectoryHandle(rootHandle, filename);
        await parentHandle.removeEntry(entryName);
        
        // Close file in editor if open
        if (Editor.getOpenFiles().has(filename)) {
            Editor.closeTab(filename, document.getElementById('tab-bar'));
        }
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        return { message: `File '${filename}' deleted successfully.` };
    } catch (error) {
        throw new Error(`Failed to delete file '${filename}': ${error.message}`);
    }
}

async function _renameFile({ old_path, new_path }, rootHandle) {
    if (!old_path || !new_path) throw new Error("The 'old_path' and 'new_path' parameters are required for rename_file.");
    if (typeof old_path !== 'string' || typeof new_path !== 'string') {
        throw new Error("The 'old_path' and 'new_path' parameters must be strings.");
    }
    
    try {
        await FileSystem.renameEntry(rootHandle, old_path, new_path);
        
        // Handle editor state changes
        if (Editor.getOpenFiles().has(old_path)) {
            Editor.closeTab(old_path, document.getElementById('tab-bar'));
        }
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        // Reopen file with new name if it was previously open
        if (Editor.getOpenFiles().has(old_path)) {
            const newFileHandle = await FileSystem.getFileHandleFromPath(rootHandle, new_path);
            await Editor.openFile(newFileHandle, new_path, document.getElementById('tab-bar'), false);
            document.getElementById('chat-input').focus();
        }
        
        return { message: `File '${old_path}' renamed to '${new_path}' successfully.` };
    } catch (error) {
        throw new Error(`Failed to rename file '${old_path}' to '${new_path}': ${error.message}`);
    }
}

// REMOVED: insert_content function - simplified to use only rewrite_file for clarity

// REMOVED: replace_lines function - was causing conflicts and bugs with complex indentation logic

// Apply diff tool - safer and more precise than full file rewrites
async function _applyDiff({ filename, diff }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required for apply_diff.");
    if (!diff) throw new Error("The 'diff' parameter is required for apply_diff.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    
    // Enhanced permission handling - try to proceed even if permission check fails
    let hasPermission = false;
    try {
        hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
    } catch (permissionError) {
        console.warn('Permission check failed, attempting to proceed:', permissionError.message);
        hasPermission = true; // Optimistically proceed
    }
    
    if (!hasPermission) {
        throw new Error('Permission to write to the file was denied.');
    }
    
    const file = await fileHandle.getFile();
    const originalContent = await file.text();
    UndoManager.push(filename, originalContent);
    
    const lines = originalContent.split(/\r?\n/);
    const originalLineCount = lines.length;
    
    // Parse diff blocks - expecting format like:
    // <<<<<<< SEARCH
    // :start_line:10
    // -------
    // old content
    // =======
    // new content
    // >>>>>>> REPLACE
    
    const diffBlocks = [];
    
    // Debug: Log the raw diff content to understand the format
    console.log('Raw diff content:', JSON.stringify(diff));
    
    // More flexible regex pattern that handles various whitespace and newline combinations
    const diffPattern = /<<<<<<< SEARCH\s*\n:start_line:(\d+)\s*\n-------\s*\n([\s\S]*?)\n=======\s*\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    
    let match;
    while ((match = diffPattern.exec(diff)) !== null) {
        const startLine = parseInt(match[1]);
        const searchContent = match[2];
        const replaceContent = match[3];
        
        diffBlocks.push({
            startLine,
            searchContent,
            replaceContent
        });
    }
    
    // If no matches found, try alternative patterns or provide detailed debugging
    if (diffBlocks.length === 0) {
        // Try to identify what parts of the expected format are present
        const hasSearchMarker = diff.includes('<<<<<<< SEARCH');
        const hasReplaceMarker = diff.includes('>>>>>>> REPLACE');
        const hasStartLine = diff.includes(':start_line:');
        const hasSeparator = diff.includes('-------');
        const hasEquals = diff.includes('=======');
        
        let debugInfo = `No valid diff blocks found. Debug info:\n`;
        debugInfo += `- Has SEARCH marker: ${hasSearchMarker}\n`;
        debugInfo += `- Has REPLACE marker: ${hasReplaceMarker}\n`;
        debugInfo += `- Has start_line: ${hasStartLine}\n`;
        debugInfo += `- Has separator (-------): ${hasSeparator}\n`;
        debugInfo += `- Has equals (=======): ${hasEquals}\n`;
        debugInfo += `\nExpected format:\n<<<<<<< SEARCH\n:start_line:N\n-------\nold content\n=======\nnew content\n>>>>>>> REPLACE\n`;
        debugInfo += `\nActual content received:\n${diff}`;
        
        throw new Error(debugInfo);
    }
    
    // Sort diff blocks by start line in descending order to apply from bottom to top
    diffBlocks.sort((a, b) => b.startLine - a.startLine);
    
    let modifiedLines = [...lines];
    
    for (const block of diffBlocks) {
        const { startLine, searchContent, replaceContent } = block;
        
        if (startLine < 1 || startLine > originalLineCount) {
            throw new Error(`Invalid start_line ${startLine}. File has ${originalLineCount} lines.`);
        }
        
        // Find the exact match for the search content
        const searchLines = searchContent.split(/\r?\n/);
        const searchStartIndex = startLine - 1;
        
        // Verify the search content matches exactly
        let matches = true;
        for (let i = 0; i < searchLines.length; i++) {
            const lineIndex = searchStartIndex + i;
            if (lineIndex >= modifiedLines.length || modifiedLines[lineIndex] !== searchLines[i]) {
                matches = false;
                break;
            }
        }
        
        if (!matches) {
            throw new Error(`Search content does not match at line ${startLine}. Expected:\n${searchContent}\n\nActual content at that location:\n${modifiedLines.slice(searchStartIndex, searchStartIndex + searchLines.length).join('\n')}`);
        }
        
        // Apply the replacement
        const replaceLines = replaceContent.split(/\r?\n/);
        const before = modifiedLines.slice(0, searchStartIndex);
        const after = modifiedLines.slice(searchStartIndex + searchLines.length);
        modifiedLines = [...before, ...replaceLines, ...after];
    }
    
    // Preserve original line endings
    const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
    const newContent = modifiedLines.join(lineEnding);
    
    // Validate syntax before writing, but do not block
    const validationResult = await validateSyntaxBeforeWrite(filename, newContent);
    
    const writable = await fileHandle.createWritable();
    await writable.write(newContent);
    await writable.close();
    
    // Update editor if file is open
    if (Editor.getOpenFiles().has(filename)) {
        Editor.getOpenFiles().get(filename)?.model.setValue(newContent);
    }
    
    await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
    document.getElementById('chat-input').focus();
    
    let message = `Applied ${diffBlocks.length} diff block(s) to '${filename}' successfully.`;
    if (!validationResult.isValid) {
        message += `\n\nWARNING: Syntax errors were detected:\n${validationResult.errors}${validationResult.suggestions}`;
    }
    
    return {
        message,
        details: {
            originalLines: originalLineCount,
            finalLines: modifiedLines.length,
            blocksApplied: diffBlocks.length
        }
    };
}

async function _createDiff({ original_content, new_content }) {
    if (original_content === undefined) throw new Error("The 'original_content' parameter is required for create_diff.");
    if (new_content === undefined) throw new Error("The 'new_content' parameter is required for create_diff.");

    if (!diff_match_patch) {
        throw new Error("diff_match_patch library is not available. Please ensure it's loaded before using create_diff.");
    }

    try {
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
    } catch (error) {
        throw new Error(`Failed to create diff: ${error.message}`);
    }
}

// Smart file editing - efficient for large files, safe for small ones
async function _smartEditFile({ filename, edits }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!edits || !Array.isArray(edits)) throw new Error("The 'edits' parameter is required and must be an array.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    
    // Enhanced permission handling - try to proceed even if permission check fails
    let hasPermission = false;
    try {
        hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
    } catch (permissionError) {
        console.warn('Permission check failed, attempting to proceed:', permissionError.message);
        hasPermission = true; // Optimistically proceed
    }
    
    if (!hasPermission) {
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
    
    await toolLogger.log('_smartEditFile', {
        filename,
        fileSize,
        originalLineCount,
        finalLineCount: lines.length,
        editsApplied: edits.length
    }, 'Success');
    
    // Preserve original line endings
    const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
    const newContent = lines.join(lineEnding);
    
    // Final validation of the fully assembled content before writing, but do not block
    const validationResult = await validateSyntaxBeforeWrite(filename, newContent);

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
    
    let message = `Smart edit applied to '${filename}' successfully. ${edits.length} edit(s) applied.`;
    if (!validationResult.isValid) {
        message += `\n\nWARNING: Syntax errors were detected and have been written to the file.\nErrors:\n${validationResult.errors}${validationResult.suggestions}`;
    }

    return {
        message: message,
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
        
        // Enhanced permission handling - try to proceed even if permission check fails
        let hasPermission = false;
        try {
            hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
        } catch (permissionError) {
            console.warn('Permission check failed, attempting to proceed:', permissionError.message);
            hasPermission = true; // Optimistically proceed
        }
        
        if (!hasPermission) {
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
    if (typeof title !== 'string') throw new Error("The 'title' parameter must be a string.");
    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
        throw new Error("The 'priority' parameter must be one of: low, medium, high, urgent.");
    }
    
    try {
        const task = await TaskTools.create({ title, description, priority, parentId, listId });
        return {
            message: `Task "${title}" created with ID ${task.id}.`,
            details: task
        };
    } catch (error) {
        throw new Error(`Failed to create task: ${error.message}`);
    }
}

async function _taskUpdate({ taskId, updates }) {
    if (!taskId || !updates) {
        throw new Error("The 'task_update' tool requires both a 'taskId' (string) and an 'updates' (object) parameter. Please provide both in your next tool call.");
    }
    if (typeof taskId !== 'string') throw new Error("The 'taskId' parameter must be a string.");
    if (typeof updates !== 'object' || updates === null) throw new Error("The 'updates' parameter must be an object.");
    
    try {
        const task = await TaskTools.update(taskId, updates);
        return {
            message: `Task "${task.title}" (ID: ${taskId}) updated.`,
            details: task
        };
    } catch (error) {
        throw new Error(`Failed to update task ${taskId}: ${error.message}`);
    }
}

async function _taskDelete({ taskId }) {
    if (!taskId) throw new Error("The 'taskId' parameter is required.");
    if (typeof taskId !== 'string') throw new Error("The 'taskId' parameter must be a string.");
    
    try {
        const task = await TaskTools.delete(taskId);
        return {
            message: `Task "${task.title}" (ID: ${taskId}) and all its subtasks have been deleted.`,
            details: task
        };
    } catch (error) {
        throw new Error(`Failed to delete task ${taskId}: ${error.message}`);
    }
}

async function _taskBreakdown({ taskId }) {
    if (!taskId) throw new Error("The 'taskId' parameter is required.");
    if (typeof taskId !== 'string') throw new Error("The 'taskId' parameter must be a string.");
    
    try {
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
    } catch (error) {
        throw new Error(`Failed to breakdown task ${taskId}: ${error.message}`);
    }
}

async function _taskGetNext() {
    try {
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
    } catch (error) {
        throw new Error(`Failed to get next task: ${error.message}`);
    }
}

async function _taskGetStatus({ taskId }) {
    try {
        if (taskId) {
            if (typeof taskId !== 'string') throw new Error("The 'taskId' parameter must be a string.");
            
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
    } catch (error) {
        throw new Error(`Failed to get task status: ${error.message}`);
    }
}

async function _createFolder({ folder_path }, rootHandle) {
    if (!folder_path) throw new Error("The 'folder_path' parameter is required for create_folder.");
    if (typeof folder_path !== 'string') throw new Error("The 'folder_path' parameter must be a string.");
    
    try {
        await FileSystem.createDirectoryFromPath(rootHandle, folder_path);
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        return { message: `Folder '${folder_path}' created successfully.` };
    } catch (error) {
        throw new Error(`Failed to create folder '${folder_path}': ${error.message}`);
    }
}

async function _deleteFolder({ folder_path }, rootHandle) {
    if (!folder_path) throw new Error("The 'folder_path' parameter is required for delete_folder.");
    if (typeof folder_path !== 'string') throw new Error("The 'folder_path' parameter must be a string.");
    
    try {
        const { parentHandle, entryName } = await FileSystem.getParentDirectoryHandle(rootHandle, folder_path);
        await parentHandle.removeEntry(entryName, { recursive: true });
        
        // Close any open files from the deleted folder
        const openFiles = Editor.getOpenFiles();
        for (const [filePath] of openFiles) {
            if (filePath.startsWith(folder_path + '/')) {
                Editor.closeTab(filePath, document.getElementById('tab-bar'));
            }
        }
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        return { message: `Folder '${folder_path}' deleted successfully.` };
    } catch (error) {
        throw new Error(`Failed to delete folder '${folder_path}': ${error.message}`);
    }
}

async function _renameFolder({ old_folder_path, new_folder_path }, rootHandle) {
    if (!old_folder_path || !new_folder_path) {
        throw new Error("The 'old_folder_path' and 'new_folder_path' parameters are required for rename_folder.");
    }
    if (typeof old_folder_path !== 'string' || typeof new_folder_path !== 'string') {
        throw new Error("The 'old_folder_path' and 'new_folder_path' parameters must be strings.");
    }
    
    try {
        await FileSystem.renameEntry(rootHandle, old_folder_path, new_folder_path);
        
        // Update any open files from the renamed folder
        const openFiles = Editor.getOpenFiles();
        const filesToUpdate = [];
        for (const [filePath] of openFiles) {
            if (filePath.startsWith(old_folder_path + '/')) {
                const newFilePath = filePath.replace(old_folder_path, new_folder_path);
                filesToUpdate.push({ oldPath: filePath, newPath: newFilePath });
            }
        }
        
        // Close old tabs and open new ones
        for (const { oldPath, newPath } of filesToUpdate) {
            Editor.closeTab(oldPath, document.getElementById('tab-bar'));
            try {
                const newFileHandle = await FileSystem.getFileHandleFromPath(rootHandle, newPath);
                await Editor.openFile(newFileHandle, newPath, document.getElementById('tab-bar'), false);
            } catch (e) {
                console.warn(`Failed to reopen file ${newPath}:`, e.message);
            }
        }
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        return { message: `Folder '${old_folder_path}' renamed to '${new_folder_path}' successfully.` };
    } catch (error) {
        throw new Error(`Failed to rename folder '${old_folder_path}' to '${new_folder_path}': ${error.message}`);
    }
}

async function _searchCode({ search_term }, rootHandle) {
    if (!search_term) throw new Error("The 'search_term' parameter is required for search_code.");
    if (typeof search_term !== 'string') throw new Error("The 'search_term' parameter must be a string.");
    
    if (!backgroundIndexer.isAvailable()) {
        throw new Error("The background indexer is not ready. Please wait a moment and try again.");
    }
    
    try {
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
    } catch (error) {
        throw new Error(`Search failed: ${error.message}`);
    }
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

// REMOVED: validateTerminalCommand - No longer needed since run_terminal_command has been removed

// REMOVED: _runTerminalCommand - This tool has been removed to maintain the client-centric architecture.
// Terminal operations are not needed for a browser-based code editor focused on file editing.
// This eliminates security risks and backend dependencies for command execution.

// REMOVED: escapeShellArg - No longer needed since terminal commands have been removed

// REMOVED: _getFileHistory - Git operations removed to maintain client-centric architecture.
// File history can be implemented using browser-based git libraries if needed in the future.
async function _getFileHistory({ filename }, rootHandle) {
    throw new Error("File history feature has been disabled. This browser-based editor focuses on file editing without requiring git/terminal access. Consider using your local git client for version control operations.");
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
    if (new_text === undefined) throw new Error("The 'new_text' parameter is required.");
    
    try {
        const cleanText = stripMarkdownCodeBlock(new_text);
        const editor = Editor.getEditorInstance();
        if (!editor) throw new Error('No editor instance is available.');
        
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
            throw new Error('Error: No text is selected in the editor. Please select the text you want to replace.');
        }
        
        editor.executeEdits('ai-agent', [{ range: selection, text: cleanText }]);
        return { message: 'Replaced the selected text.' };
    } catch (error) {
        throw new Error(`Failed to replace selected text: ${error.message}`);
    }
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

// --- Senior Engineer AI Tools ---

async function _buildSymbolTable({ file_path }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    const symbolTable = await symbolResolver.buildSymbolTable(content, file_path);
    
    return {
        message: `Symbol table built for ${file_path}`,
        symbolTable: {
            symbols: symbolTable.symbols.size,
            functions: symbolTable.functions.length,
            classes: symbolTable.classes.length,
            imports: symbolTable.imports.length,
            exports: symbolTable.exports.length
        }
    };
}

async function _traceDataFlow({ variable_name, file_path, line }, rootHandle) {
    if (!variable_name) throw new Error("The 'variable_name' parameter is required.");
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const startLine = line || 1;
    const flowInfo = await dataFlowAnalyzer.traceVariableFlow(variable_name, file_path, startLine);
    
    return {
        message: `Data flow traced for variable '${variable_name}'`,
        flow: {
            definitions: flowInfo.definitions.length,
            usages: flowInfo.usages.length,
            mutations: flowInfo.mutations.length,
            crossFileFlows: flowInfo.crossFileFlows.length,
            dataTypes: Array.from(flowInfo.dataTypes),
            complexity: dataFlowAnalyzer.calculateFlowComplexity ?
                       dataFlowAnalyzer.calculateFlowComplexity(flowInfo) : 'N/A'
        },
        details: flowInfo
    };
}

async function _debugSystematically({ error_message, file_path, line, stack_trace }, rootHandle) {
    if (!error_message) throw new Error("The 'error_message' parameter is required.");
    
    const error = new Error(error_message);
    if (stack_trace) error.stack = stack_trace;
    
    const codeContext = {
        filePath: file_path,
        line: line || 1
    };
    
    const debuggingResult = await debuggingIntelligence.debugSystematically(error, codeContext);
    
    return {
        message: `Systematic debugging completed for: ${error_message}`,
        session: {
            id: debuggingResult.session.id,
            status: debuggingResult.session.status,
            rootCause: debuggingResult.rootCause,
            hypothesesTested: debuggingResult.hypotheses.length,
            solution: debuggingResult.solution
        },
        recommendation: debuggingResult.recommendation
    };
}

async function _analyzeCodeQuality({ file_path }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    const qualityMetrics = await codeQualityAnalyzer.analyzeCodeQuality(file_path, content);
    
    return {
        message: `Code quality analysis completed for ${file_path}`,
        quality: {
            overallScore: qualityMetrics.overallScore,
            category: codeQualityAnalyzer.categorizeQualityScore(qualityMetrics.overallScore),
            complexity: {
                average: qualityMetrics.complexity.averageComplexity,
                max: qualityMetrics.complexity.maxComplexity,
                functions: qualityMetrics.complexity.functions.length
            },
            maintainability: {
                index: qualityMetrics.maintainability.index,
                category: qualityMetrics.maintainability.category
            },
            issues: {
                codeSmells: qualityMetrics.codeSmells.length,
                security: qualityMetrics.security.length,
                performance: qualityMetrics.performance.length
            }
        },
        recommendations: codeQualityAnalyzer.getTopRecommendations(qualityMetrics)
    };
}

async function _solveEngineeringProblem({ problem_description, file_path, priority, constraints }, rootHandle) {
    if (!problem_description) throw new Error("The 'problem_description' parameter is required.");
    
    const problem = {
        description: problem_description,
        priority: priority || 'medium',
        constraints: constraints || []
    };
    
    const codeContext = {
        filePath: file_path
    };
    
    if (file_path) {
        try {
            const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
            const file = await fileHandle.getFile();
            codeContext.content = await file.text();
        } catch (error) {
            console.warn(`Could not read file ${file_path}:`, error.message);
        }
    }
    
    const solutionSession = await seniorEngineerAI.solveProblemSystematically(problem, codeContext);
    
    return {
        message: `Engineering problem analysis completed: ${problem_description}`,
        solution: {
            sessionId: solutionSession.id,
            status: solutionSession.status,
            problemType: solutionSession.analysis?.problemType,
            complexity: solutionSession.analysis?.complexity?.category,
            selectedApproach: solutionSession.selectedSolution?.approach,
            feasibility: solutionSession.selectedSolution?.evaluation?.feasibility,
            riskLevel: solutionSession.selectedSolution?.evaluation?.riskLevel,
            estimatedTime: solutionSession.implementation?.detailedSteps?.length || 0
        },
        recommendations: solutionSession.selectedSolution?.evaluation?.reasoning || [],
        implementation: solutionSession.implementation ? {
            phases: solutionSession.implementation.detailedSteps.map(step => step.phase).filter((phase, index, arr) => arr.indexOf(phase) === index),
            totalSteps: solutionSession.implementation.detailedSteps.length,
            testingRequired: solutionSession.implementation.testingPlan.length > 0
        } : null
    };
}

async function _getEngineeringInsights({ file_path }, rootHandle) {
    const insights = {
        symbolResolution: symbolResolver.getStatistics(),
        dataFlowAnalysis: dataFlowAnalyzer.getStatistics(),
        debuggingIntelligence: debuggingIntelligence.getDebuggingStatistics(),
        engineeringDecisions: seniorEngineerAI.getEngineeringStatistics()
    };
    
    if (file_path) {
        // Get file-specific insights
        const qualitySummary = codeQualityAnalyzer.getQualitySummary(file_path);
        if (qualitySummary) {
            insights.fileQuality = qualitySummary;
        }
    } else {
        // Get project-wide insights
        insights.projectQuality = codeQualityAnalyzer.getProjectQualityStatistics();
    }
    
    return {
        message: file_path ? `Engineering insights for ${file_path}` : 'Project-wide engineering insights',
        insights
    };
}

async function _optimizeCodeArchitecture({ file_path, optimization_goals }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const goals = optimization_goals || ['maintainability', 'performance', 'readability'];
    
    // Analyze current state
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    const qualityMetrics = await codeQualityAnalyzer.analyzeCodeQuality(file_path, content);
    const symbolTable = await symbolResolver.buildSymbolTable(content, file_path);
    
    // Generate optimization recommendations
    const optimizations = [];
    
    // Check complexity issues
    const complexFunctions = qualityMetrics.complexity.functions.filter(f => f.category === 'high' || f.category === 'critical');
    if (complexFunctions.length > 0) {
        optimizations.push({
            type: 'complexity_reduction',
            priority: 'high',
            description: `${complexFunctions.length} functions have high complexity`,
            recommendations: complexFunctions.flatMap(f => f.recommendations || [])
        });
    }
    
    // Check code smells
    const criticalSmells = qualityMetrics.codeSmells.filter(smell => smell.severity === 'critical' || smell.severity === 'high');
    if (criticalSmells.length > 0) {
        optimizations.push({
            type: 'code_smell_removal',
            priority: 'medium',
            description: `${criticalSmells.length} critical code smells detected`,
            recommendations: criticalSmells.map(smell => smell.recommendation)
        });
    }
    
    // Check architectural patterns
    if (qualityMetrics.architecture.detected.length === 0 && symbolTable.classes.length > 0) {
        optimizations.push({
            type: 'architectural_patterns',
            priority: 'medium',
            description: 'No design patterns detected - consider implementing appropriate patterns',
            recommendations: qualityMetrics.architecture.recommendations
        });
    }
    
    return {
        message: `Architecture optimization analysis completed for ${file_path}`,
        currentState: {
            qualityScore: qualityMetrics.overallScore,
            complexity: qualityMetrics.complexity.averageComplexity,
            maintainability: qualityMetrics.maintainability.index,
            issues: qualityMetrics.codeSmells.length + qualityMetrics.security.length + qualityMetrics.performance.length
        },
        optimizations,
        estimatedImpact: {
            qualityImprovement: optimizations.length * 10, // Rough estimate
            maintenanceReduction: optimizations.filter(o => o.type === 'complexity_reduction').length * 20,
            riskReduction: optimizations.filter(o => o.priority === 'high').length * 15
        }
    };
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
    
    // Senior Engineer AI Tools
    build_symbol_table: { handler: _buildSymbolTable, requiresProject: true, createsCheckpoint: false },
    trace_data_flow: { handler: _traceDataFlow, requiresProject: true, createsCheckpoint: false },
    debug_systematically: { handler: _debugSystematically, requiresProject: false, createsCheckpoint: false },
    analyze_code_quality: { handler: _analyzeCodeQuality, requiresProject: true, createsCheckpoint: false },
    solve_engineering_problem: { handler: _solveEngineeringProblem, requiresProject: false, createsCheckpoint: false },
    get_engineering_insights: { handler: _getEngineeringInsights, requiresProject: false, createsCheckpoint: false },
    optimize_code_architecture: { handler: _optimizeCodeArchitecture, requiresProject: true, createsCheckpoint: false },
    
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
    // REMOVED: run_terminal_command - Eliminated to maintain client-centric architecture
    get_file_history: { handler: _getFileHistory, requiresProject: true, createsCheckpoint: false },

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
    apply_diff: { handler: _applyDiff, requiresProject: true, createsCheckpoint: true },
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
    const startTime = performance.now();

    // Smart tool validation and optimization
    if (mode === 'amend' && toolName === 'rewrite_file') {
        throw new Error("The 'rewrite_file' tool is not allowed in 'Amend' mode. Use 'apply_diff' or 'edit_file' with the 'edits' parameter for targeted changes.");
    }

    const parameters = toolCall.args;
    
    // Check for cached results for read-only operations
    if (['read_file', 'get_project_structure', 'search_in_file'].includes(toolName)) {
        const cachedResult = getCachedResult(toolName, parameters);
        if (cachedResult) {
            return { toolResponse: { name: toolName, response: cachedResult } };
        }
    }

    // Get smart tool recommendations
    const context = {
        mode,
        fileType: parameters.filename ? parameters.filename.split('.').pop() : null,
        fileSize: null // Will be determined during execution if needed
    };
    
    const recommendation = getOptimalTool(toolName, context);
    if (recommendation && !silent) {
        console.log(`[Smart Selection] Recommended: ${recommendation.recommendedTool} - ${recommendation.reason}`);
    }

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
        // Enhanced execution with performance monitoring
        performanceOptimizer.startTimer(`tool_${toolName}`);
        resultForModel = await executeTool(toolCall, rootDirectoryHandle);
        const executionTime = performanceOptimizer.endTimer(`tool_${toolName}`);
        
        // Track performance metrics
        trackToolPerformance(toolName, startTime, performance.now(), true, context);
        
        // Cache successful read operations
        if (['read_file', 'get_project_structure', 'search_in_file'].includes(toolName)) {
            setCachedResult(toolName, parameters, resultForModel);
        }
        
        toolLogger.log(toolName, parameters, 'Success', resultForModel);
        
        // Log performance insights
        if (executionTime > 2000) {
            console.warn(`[Performance] Tool ${toolName} took ${executionTime}ms - consider optimization`);
        }
        
    } catch (error) {
        isSuccess = false;
        const endTime = performance.now();
        
        // Track failed performance
        trackToolPerformance(toolName, startTime, endTime, false, context);
        
        // Analyze error patterns and suggest fixes
        const errorAnalysis = analyzeError(toolName, error, context);
        let errorMessage = `Error executing tool '${toolName}': ${error.message}`;
        
        if (errorAnalysis && errorAnalysis.suggestion) {
            errorMessage += `\n\nSuggestion: ${errorAnalysis.suggestion}`;
            if (errorAnalysis.alternativeTool) {
                errorMessage += `\nConsider using: ${errorAnalysis.alternativeTool}`;
            }
        }
        
        resultForModel = { error: errorMessage };
        UI.showError(errorMessage);
        console.error(errorMessage, error);
        toolLogger.log(toolName, parameters, 'Error', {
            message: error.message,
            stack: error.stack,
            suggestion: errorAnalysis?.suggestion,
            alternativeTool: errorAnalysis?.alternativeTool
        });
    }

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
            { name: 'read_file', description: "Reads a file's content. To ensure accuracy when editing, set 'include_line_numbers' to true. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, include_line_numbers: { type: 'BOOLEAN', description: 'Set to true to prepend line numbers to each line of the output.' } }, required: ['filename'] } },
            { name: 'read_multiple_files', description: "Reads and concatenates the content of multiple files. Essential for multi-file context tasks.", parameters: { type: 'OBJECT', properties: { filenames: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['filenames'] } },
            { name: 'read_file_lines', description: 'Reads a specific range of lines from a file. Output will always include line numbers. Use for quick inspection of specific code sections.', parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, start_line: { type: 'NUMBER' }, end_line: { type: 'NUMBER' } }, required: ['filename', 'start_line', 'end_line'] } },
            { name: 'search_in_file', description: 'Searches for a pattern in a file and returns matching lines. Use this for large files.', parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, pattern: { type: 'STRING' }, context: { type: 'NUMBER' } }, required: ['filename', 'pattern'] } },
            { name: 'read_url', description: 'Reads and extracts the main content and all links from a given URL. The result will be a JSON object with "content" and "links" properties.', parameters: { type: 'OBJECT', properties: { url: { type: 'STRING' } }, required: ['url'] } },
            { name: 'get_open_file_content', description: 'Gets the content of the currently open file in the editor.' },
            { name: 'get_selected_text', description: 'Gets the text currently selected by the user in the editor.' },
            { name: 'replace_selected_text', description: 'Replaces the currently selected text in the editor with new text.', parameters: { type: 'OBJECT', properties: { new_text: { type: 'STRING', description: 'The raw text to replace the selection with. CRITICAL: Do NOT wrap this content in markdown backticks (```).' } }, required: ['new_text'] } },
            { name: 'get_project_structure', description: 'Gets the entire file and folder structure of the project. CRITICAL: Always use this tool before attempting to read or create a file to ensure you have the correct file path.' },
            { name: 'duckduckgo_search', description: 'Performs a search using DuckDuckGo and returns the results.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
            { name: 'perform_research', description: 'Performs an autonomous, multi-step research on a given query. It searches the web, reads the most relevant pages, and can recursively explore links to gather comprehensive information.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' }, max_results: { type: 'NUMBER', description: 'Maximum number of search results to read per level. Default is 3.' }, depth: { type: 'NUMBER', description: 'How many levels of links to follow. Default is 1.' } }, required: ['query'] } },
            { name: 'search_code', description: 'Searches for a specific string in all files in the project (like grep).', parameters: { type: 'OBJECT', properties: { search_term: { type: 'STRING' } }, required: ['search_term'] } },
            // REMOVED: run_terminal_command - Tool eliminated to maintain browser-first architecture
            { name: 'build_or_update_codebase_index', description: 'Scans the entire codebase to build a searchable index. Slow, run once per session.' },
            { name: 'query_codebase', description: 'Searches the pre-built codebase index.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
            { name: 'get_file_history', description: "DISABLED: Git history feature has been disabled in this browser-based editor. Use your local git client for version control operations.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            // REMOVED: insert_content, create_and_apply_diff, replace_lines - simplified to use rewrite_file only
            { name: 'format_code', description: "Formats a file with Prettier. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'analyze_code', description: "Analyzes a JavaScript file's structure. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'edit_file', description: "The primary tool for all file modifications. CRITICAL: Before using this tool to fix an error, you MUST use 'read_file' to get the full, up-to-date content of the file. CRITICAL: If the content you are using was retrieved with line numbers, you MUST remove the line numbers and the ` | ` separator from every line before using it in the 'new_content' or 'content' parameter. The content must be the raw source code. Provide EITHER 'content' for a full rewrite OR an 'edits' array for targeted changes.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'Complete file content for small files. CRITICAL: Do NOT wrap in markdown backticks.' }, edits: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: ['replace_lines', 'insert_lines'] }, start_line: { type: 'NUMBER', description: 'Start line for replace_lines' }, end_line: { type: 'NUMBER', description: 'End line for replace_lines' }, line_number: { type: 'NUMBER', description: 'Line position for insert_lines (0=start of file)' }, new_content: { type: 'STRING' } } }, description: 'Efficient targeted edits for large files. Use replace_lines to replace line ranges or insert_lines to add content.' } }, required: ['filename'] } },
            { name: 'append_to_file', description: "Fast append content to end of file without reading full content. Ideal for logs, incremental updates.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'Content to append. Will add newline separator automatically.' } }, required: ['filename', 'content'] } },
            { name: 'get_file_info', description: "Get file metadata (size, last modified, type) without reading content. Use before editing large files.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'rewrite_file', description: "DEPRECATED. Use 'edit_file' instead. This tool rewrites an entire file.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'The new, raw text content of the file. CRITICAL: Do NOT wrap this content in markdown backticks (```).' } }, required: ['filename', 'content'] } },
            { name: 'apply_diff', description: "🔧 RECOMMENDED: Apply precise, surgical changes to files using diff blocks. This is the safest and most reliable way to edit files. Use this instead of edit_file when you need to make targeted changes. CRITICAL: The diff parameter must contain properly formatted diff blocks with EXACT format:\n\n<<<<<<< SEARCH\n:start_line:10\n-------\nold code here\n=======\nnew code here\n>>>>>>> REPLACE\n\nMANDATORY REQUIREMENTS:\n1. Must include ':start_line:N' where N is the line number\n2. Must include '-------' separator line after start_line\n3. Must include '=======' separator between old and new content\n4. Each line must be exact, including whitespace and indentation\n5. Use read_file with include_line_numbers=true first to get accurate content", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING', description: 'Path to the file to modify' }, diff: { type: 'STRING', description: 'One or more diff blocks in the EXACT format: <<<<<<< SEARCH\\n:start_line:N\\n-------\\nold content\\n=======\\nnew content\\n>>>>>>> REPLACE. The -------  separator line is MANDATORY.' } }, required: ['filename', 'diff'] } },
            
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
            
            // Senior Engineer AI Tools
            { name: 'build_symbol_table', description: '🧠 SENIOR ENGINEER: Build comprehensive symbol table for advanced code analysis. Creates detailed mapping of all symbols, functions, classes, imports, and exports in a file.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Path to the file to analyze' } }, required: ['file_path'] } },
            { name: 'trace_data_flow', description: '🧠 SENIOR ENGINEER: Advanced data flow analysis that traces how variables flow through the codebase. Identifies definitions, usages, mutations, and cross-file dependencies.', parameters: { type: 'OBJECT', properties: { variable_name: { type: 'STRING', description: 'Name of the variable to trace' }, file_path: { type: 'STRING', description: 'Starting file path' }, line: { type: 'NUMBER', description: 'Starting line number (optional)' } }, required: ['variable_name', 'file_path'] } },
            { name: 'debug_systematically', description: '🧠 SENIOR ENGINEER: Systematic debugging using hypothesis-driven approach. Analyzes errors, generates hypotheses, tests them systematically, and provides root cause analysis.', parameters: { type: 'OBJECT', properties: { error_message: { type: 'STRING', description: 'The error message to debug' }, file_path: { type: 'STRING', description: 'File where error occurred (optional)' }, line: { type: 'NUMBER', description: 'Line number where error occurred (optional)' }, stack_trace: { type: 'STRING', description: 'Full stack trace (optional)' } }, required: ['error_message'] } },
            { name: 'analyze_code_quality', description: '🧠 SENIOR ENGINEER: Comprehensive code quality analysis including complexity, maintainability, code smells, security vulnerabilities, and performance issues.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Path to the file to analyze' } }, required: ['file_path'] } },
            { name: 'solve_engineering_problem', description: '🧠 SENIOR ENGINEER: Holistic engineering problem solving. Analyzes problems comprehensively, generates multiple solutions, evaluates trade-offs, and provides implementation plans.', parameters: { type: 'OBJECT', properties: { problem_description: { type: 'STRING', description: 'Detailed description of the engineering problem' }, file_path: { type: 'STRING', description: 'Related file path (optional)' }, priority: { type: 'STRING', description: 'Problem priority: low, medium, high, critical', enum: ['low', 'medium', 'high', 'critical'] }, constraints: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Any constraints or limitations (optional)' } }, required: ['problem_description'] } },
            { name: 'get_engineering_insights', description: '🧠 SENIOR ENGINEER: Get comprehensive engineering insights and statistics about code quality, debugging patterns, and decision-making effectiveness.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Specific file to analyze (optional - if omitted, provides project-wide insights)' } } } },
            { name: 'optimize_code_architecture', description: '🧠 SENIOR ENGINEER: Analyze and optimize code architecture. Identifies architectural issues, suggests design patterns, and provides optimization recommendations.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Path to the file to optimize' }, optimization_goals: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Optimization goals: maintainability, performance, readability, security (optional)' } }, required: ['file_path'] } },
            
            // Smart editing system - efficient for both small and large files
        ],
    };
}
