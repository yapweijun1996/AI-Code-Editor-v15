/**
 * File and folder management operations
 */

import { createSuccessResponse, createErrorResponse, validateRequiredParams, validateParameterTypes, validateToolSecurity, validateSecureFilePath } from '../core/tool_interfaces.js';
import { validateFilePermission, validateDirectoryPermission } from '../utils/shared_utils.js';
import * as FileSystem from '../../../file_system.js';
import * as Editor from '../../../editor.js';
import * as UI from '../../../ui.js';

export async function _deleteFile({ filename }, rootHandle) {
    try {
        // Enhanced security validation
        const securityResult = await validateToolSecurity(
            { filename },
            {
                toolName: 'delete_file',
                operation: 'file_write' // Delete is a write operation
            }
        );
        
        const sanitizedFilename = securityResult.sanitizedParams.filePath || securityResult.sanitizedParams.filename;
        
        // Validate file permissions
        await validateFilePermission(sanitizedFilename, 'delete');
        
        validateRequiredParams({ filename: sanitizedFilename }, ['filename'], 'delete_file');
        validateParameterTypes({ filename: sanitizedFilename }, { filename: 'string' }, 'delete_file');
        
        const { parentHandle, entryName } = await FileSystem.getParentDirectoryHandle(rootHandle, sanitizedFilename);
        await parentHandle.removeEntry(entryName);
        
        // Close file in editor if open
        if (Editor.getOpenFiles().has(sanitizedFilename)) {
            Editor.closeTab(sanitizedFilename, document.getElementById('tab-bar'));
        }
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        return createSuccessResponse(`File '${sanitizedFilename}' deleted successfully`);
    } catch (error) {
        return createErrorResponse(`Failed to delete file '${sanitizedFilename || filename}'`, error.message);
    }
}

export async function _renameFile({ old_path, new_path }, rootHandle) {
    try {
        // Enhanced security validation
        const securityResult = await validateToolSecurity(
            { old_path, new_path },
            {
                toolName: 'rename_file',
                operation: 'file_write'
            }
        );
        
        const sanitizedOldPath = validateSecureFilePath(old_path, 'rename_file');
        const sanitizedNewPath = validateSecureFilePath(new_path, 'rename_file');
        
        // Validate file permissions for both paths
        await validateFilePermission(sanitizedOldPath, 'rename');
        await validateFilePermission(sanitizedNewPath, 'create');
        
        validateRequiredParams({ old_path: sanitizedOldPath, new_path: sanitizedNewPath }, ['old_path', 'new_path'], 'rename_file');
        validateParameterTypes({ old_path: sanitizedOldPath, new_path: sanitizedNewPath }, { old_path: 'string', new_path: 'string' }, 'rename_file');
        
        await FileSystem.renameEntry(rootHandle, sanitizedOldPath, sanitizedNewPath);
        
        // Handle editor state changes
        if (Editor.getOpenFiles().has(sanitizedOldPath)) {
            Editor.closeTab(sanitizedOldPath, document.getElementById('tab-bar'));
        }
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        // Reopen file with new name if it was previously open
        if (Editor.getOpenFiles().has(sanitizedOldPath)) {
            const newFileHandle = await FileSystem.getFileHandleFromPath(rootHandle, sanitizedNewPath);
            await Editor.openFile(newFileHandle, sanitizedNewPath, document.getElementById('tab-bar'), false);
            document.getElementById('chat-input').focus();
        }
        
        return createSuccessResponse(`File '${sanitizedOldPath}' renamed to '${sanitizedNewPath}' successfully`);
    } catch (error) {
        return createErrorResponse(`Failed to rename file '${sanitizedOldPath || old_path}' to '${sanitizedNewPath || new_path}'`, error.message);
    }
}

export async function _createFolder({ folder_path }, rootHandle) {
    try {
        // Enhanced security validation
        const securityResult = await validateToolSecurity(
            { folder_path },
            {
                toolName: 'create_folder',
                operation: 'file_write'
            }
        );
        
        const sanitizedFolderPath = validateSecureFilePath(folder_path, 'create_folder');
        
        // Validate directory permissions
        validateDirectoryPermission(sanitizedFolderPath, 'create');
        
        validateRequiredParams({ folder_path: sanitizedFolderPath }, ['folder_path'], 'create_folder');
        validateParameterTypes({ folder_path: sanitizedFolderPath }, { folder_path: 'string' }, 'create_folder');
        
        await FileSystem.createDirectoryFromPath(rootHandle, sanitizedFolderPath);
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        return createSuccessResponse(`Folder '${sanitizedFolderPath}' created successfully`);
    } catch (error) {
        return createErrorResponse(`Failed to create folder '${sanitizedFolderPath || folder_path}'`, error.message);
    }
}

export async function _deleteFolder({ folder_path }, rootHandle) {
    try {
        // Enhanced security validation
        const securityResult = await validateToolSecurity(
            { folder_path },
            {
                toolName: 'delete_folder',
                operation: 'file_write'
            }
        );
        
        const sanitizedFolderPath = validateSecureFilePath(folder_path, 'delete_folder');
        
        // Validate directory permissions
        validateDirectoryPermission(sanitizedFolderPath, 'delete');
        
        validateRequiredParams({ folder_path: sanitizedFolderPath }, ['folder_path'], 'delete_folder');
        validateParameterTypes({ folder_path: sanitizedFolderPath }, { folder_path: 'string' }, 'delete_folder');
        
        const { parentHandle, entryName } = await FileSystem.getParentDirectoryHandle(rootHandle, sanitizedFolderPath);
        await parentHandle.removeEntry(entryName, { recursive: true });
        
        // Close any open files from the deleted folder
        const openFiles = Editor.getOpenFiles();
        for (const [filePath] of openFiles) {
            if (filePath.startsWith(sanitizedFolderPath + '/')) {
                Editor.closeTab(filePath, document.getElementById('tab-bar'));
            }
        }
        
        // Use more reliable refresh timing
        await new Promise(resolve => setTimeout(resolve, 150));
        await UI.refreshFileTree(rootHandle, (filePath) => {
            const fileHandle = FileSystem.getFileHandleFromPath(rootHandle, filePath);
            Editor.openFile(fileHandle, filePath, document.getElementById('tab-bar'));
        });
        
        return createSuccessResponse(`Folder '${sanitizedFolderPath}' deleted successfully`);
    } catch (error) {
        return createErrorResponse(`Failed to delete folder '${sanitizedFolderPath || folder_path}'`, error.message);
    }
}

export async function _renameFolder({ old_folder_path, new_folder_path }, rootHandle) {
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

/**
 * Find and replace text in a file - more reliable than apply_diff for simple changes
 */
export async function _findAndReplace({ filename, find_text, replace_text, all_occurrences = false }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!find_text) throw new Error("The 'find_text' parameter is required.");
    if (replace_text === undefined) throw new Error("The 'replace_text' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    
    try {
        const hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
        if (!hasPermission) {
            throw new Error('Permission to write to the file was denied.');
        }
        
        const file = await fileHandle.getFile();
        const originalContent = await file.text();
        
        let newContent;
        let replacementCount = 0;
        
        if (all_occurrences) {
            // Replace all occurrences
            const regex = new RegExp(find_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            replacementCount = (originalContent.match(regex) || []).length;
            newContent = originalContent.replace(regex, replace_text);
        } else {
            // Replace only first occurrence
            if (originalContent.includes(find_text)) {
                replacementCount = 1;
                newContent = originalContent.replace(find_text, replace_text);
            } else {
                newContent = originalContent;
            }
        }
        
        if (replacementCount === 0) {
            throw new Error(`Text not found: "${find_text}"`);
        }
        
        await FileSystem.writeFile(fileHandle, newContent);
        
        return {
            message: `Successfully replaced ${replacementCount} occurrence(s) of "${find_text}" with "${replace_text}" in ${filename}`,
            details: {
                filename,
                replacements: replacementCount,
                find_text,
                replace_text
            }
        };
        
    } catch (error) {
        throw new Error(`Failed to find and replace in ${filename}: ${error.message}`);
    }
}

/**
 * Insert text at a specific line number - useful when you know exactly where to add content
 */
export async function _insertAtLine({ filename, line_number, content, insert_mode = 'after' }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!line_number) throw new Error("The 'line_number' parameter is required.");
    if (!content) throw new Error("The 'content' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    
    try {
        const hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
        if (!hasPermission) {
            throw new Error('Permission to write to the file was denied.');
        }
        
        const file = await fileHandle.getFile();
        const originalContent = await file.text();
        const lines = originalContent.split(/\r?\n/);
        
        const targetIndex = line_number - 1; // Convert to 0-based index
        
        if (targetIndex < 0 || targetIndex >= lines.length) {
            throw new Error(`Invalid line number ${line_number}. File has ${lines.length} lines.`);
        }
        
        const contentLines = content.split(/\r?\n/);
        
        if (insert_mode === 'before') {
            lines.splice(targetIndex, 0, ...contentLines);
        } else if (insert_mode === 'after') {
            lines.splice(targetIndex + 1, 0, ...contentLines);
        } else if (insert_mode === 'replace') {
            lines.splice(targetIndex, 1, ...contentLines);
        } else {
            throw new Error("insert_mode must be 'before', 'after', or 'replace'");
        }
        
        const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
        const newContent = lines.join(lineEnding);
        
        await FileSystem.writeFile(fileHandle, newContent);
        
        return {
            message: `Successfully inserted content ${insert_mode} line ${line_number} in ${filename}`,
            details: {
                filename,
                line_number,
                insert_mode,
                lines_added: contentLines.length
            }
        };
        
    } catch (error) {
        throw new Error(`Failed to insert at line in ${filename}: ${error.message}`);
    }
}

/**
 * Replace content between two line numbers - useful for replacing entire sections
 */
export async function _replaceLines({ filename, start_line, end_line, new_content }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!start_line) throw new Error("The 'start_line' parameter is required.");
    if (!end_line) throw new Error("The 'end_line' parameter is required.");
    if (new_content === undefined) throw new Error("The 'new_content' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    
    try {
        const hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
        if (!hasPermission) {
            throw new Error('Permission to write to the file was denied.');
        }
        
        const file = await fileHandle.getFile();
        const originalContent = await file.text();
        const lines = originalContent.split(/\r?\n/);
        
        const startIndex = start_line - 1; // Convert to 0-based index
        const endIndex = end_line - 1;
        
        if (startIndex < 0 || startIndex >= lines.length) {
            throw new Error(`Invalid start_line ${start_line}. File has ${lines.length} lines.`);
        }
        
        if (endIndex < 0 || endIndex >= lines.length) {
            throw new Error(`Invalid end_line ${end_line}. File has ${lines.length} lines.`);
        }
        
        if (startIndex > endIndex) {
            throw new Error(`start_line (${start_line}) must be less than or equal to end_line (${end_line})`);
        }
        
        const newContentLines = new_content.split(/\r?\n/);
        const originalLinesCount = endIndex - startIndex + 1;
        
        // Replace the range with new content
        lines.splice(startIndex, originalLinesCount, ...newContentLines);
        
        const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
        const newFileContent = lines.join(lineEnding);
        
        const writable = await fileHandle.createWritable();
        await writable.write(newFileContent);
        await writable.close();
        
        return {
            message: `Successfully replaced lines ${start_line}-${end_line} in ${filename}`,
            details: {
                filename,
                start_line,
                end_line,
                original_lines: originalLinesCount,
                new_lines: newContentLines.length
            }
        };
        
    } catch (error) {
        throw new Error(`Failed to replace lines in ${filename}: ${error.message}`);
    }
}

/**
 * Smart content replacement using fuzzy matching - finds similar content even if not exact
 */
export async function _smartReplace({ filename, old_content, new_content, similarity_threshold = 0.8 }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (!old_content) throw new Error("The 'old_content' parameter is required.");
    if (new_content === undefined) throw new Error("The 'new_content' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    
    try {
        const hasPermission = await FileSystem.verifyAndRequestPermission(fileHandle, true);
        if (!hasPermission) {
            throw new Error('Permission to write to the file was denied.');
        }
        
        const file = await fileHandle.getFile();
        const originalContent = await file.text();
        const lines = originalContent.split(/\r?\n/);
        const searchLines = old_content.split(/\r?\n/);
        
        // Simple similarity function (can be enhanced)
        function calculateSimilarity(text1, text2) {
            const longer = text1.length > text2.length ? text1 : text2;
            const shorter = text1.length > text2.length ? text2 : text1;
            
            if (longer.length === 0) return 1.0;
            
            let matches = 0;
            for (let i = 0; i < shorter.length; i++) {
                if (longer[i] === shorter[i]) matches++;
            }
            
            return matches / longer.length;
        }
        
        // Find the best matching section
        let bestMatch = { index: -1, score: 0 };
        
        for (let i = 0; i <= lines.length - searchLines.length; i++) {
            const section = lines.slice(i, i + searchLines.length);
            const sectionText = section.join('\n').trim();
            const searchText = old_content.trim();
            
            const similarity = calculateSimilarity(sectionText, searchText);
            
            if (similarity > bestMatch.score && similarity >= similarity_threshold) {
                bestMatch = { index: i, score: similarity };
            }
        }
        
        if (bestMatch.index === -1) {
            throw new Error(`No similar content found. Highest similarity: ${bestMatch.score.toFixed(2)}, threshold: ${similarity_threshold}`);
        }
        
        // Replace the best matching section
        const newContentLines = new_content.split(/\r?\n/);
        lines.splice(bestMatch.index, searchLines.length, ...newContentLines);
        
        const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
        const newFileContent = lines.join(lineEnding);
        
        await FileSystem.writeFile(fileHandle, newFileContent);
        
        return {
            message: `Successfully replaced content with ${(bestMatch.score * 100).toFixed(1)}% similarity match in ${filename}`,
            details: {
                filename,
                similarity_score: bestMatch.score,
                match_line: bestMatch.index + 1,
                lines_replaced: searchLines.length,
                new_lines: newContentLines.length
            }
        };
        
    } catch (error) {
        throw new Error(`Failed to smart replace in ${filename}: ${error.message}`);
    }
}

export async function _undoLastChange(params, rootHandle) {
   const lastState = UndoManager.pop();
   if (!lastState) {
       return { message: "No file modifications to undo." };
   }

   const { filename, content } = lastState;
   // Import _rewriteFile dynamically to avoid circular dependencies
   const { _rewriteFile } = await import('./file_writers.js');
   await _rewriteFile({ filename, content }, rootHandle);
   
   // After undoing, we don't want the user to "redo" the undo, so don't push to stack again.
   // The rewriteFile call inside this function will have pushed the state *before* the undo.
   // We need to pop that off to prevent a confusing redo state.
   UndoManager.pop();

   return { message: `Undid the last change to '${filename}'.` };
}

export async function _formatCode({ filename }, rootHandle) {
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

export async function _createDiff({ original_content, new_content }) {
    if (original_content === undefined) throw new Error("The 'original_content' parameter is required for create_diff.");
    if (new_content === undefined) throw new Error("The 'new_content' parameter is required for create_diff.");

    // Import diff_match_patch dynamically
    let diff_match_patch;
    try {
        // Try to import from global scope (if loaded via script tag)
        diff_match_patch = window.diff_match_patch;
        if (!diff_match_patch) {
            throw new Error('diff_match_patch not found in global scope');
        }
    } catch (e) {
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