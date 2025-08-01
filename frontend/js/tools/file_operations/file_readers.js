/**
 * @fileoverview File reading operations for the AI Code Editor tool system.
 *
 * This module provides comprehensive file reading capabilities including:
 * - Single file reading with adaptive performance optimization
 * - Line-specific reading for large files
 * - Multiple file batch reading with parallel processing
 * - File search and pattern matching
 * - Editor integration for file content access
 * - Project structure analysis
 *
 * All functions implement security validation, error handling, caching,
 * and performance optimization strategies.
 *
 * @author AI Code Editor Team
 * @version 2.0.0
 * @since 1.0.0
 */

import { createSuccessResponse, createErrorResponse, createEnhancedErrorResponse, validateRequiredParams, validateParameterTypes, validateToolSecurity, validateSecureFilePath } from '../core/tool_interfaces.js';
import { unescapeHtmlEntities, analyzeError, withRetry, buildErrorContext, getAdaptiveThresholds, getMemoryMonitor, getCacheManager, validateFilePermission } from '../utils/shared_utils.js';
import * as FileSystem from '../../../file_system.js';
import * as Editor from '../../../editor.js';

/**
 * Retrieves the project directory structure as a formatted tree string.
 *
 * This function analyzes the project directory structure, respects ignore patterns
 * (like .gitignore), and returns a hierarchical view of the project files and folders.
 *
 * @async
 * @function _getProjectStructure
 * @param {Object} params - Parameters object (currently unused but maintained for consistency)
 * @param {FileSystemDirectoryHandle} rootHandle - The root directory handle for the project
 * @returns {Promise<Object>} Success response with project structure or error response
 *
 * @example
 * const result = await _getProjectStructure({}, rootHandle);
 * if (result.success) {
 *   console.log('Project structure:');
 *   console.log(result.data.structure);
 * }
 *
 * @throws {Error} When unable to access the project directory or build structure tree
 */
export async function _getProjectStructure(params, rootHandle) {
    try {
        const ignorePatterns = await FileSystem.getIgnorePatterns(rootHandle);
        const tree = await FileSystem.buildStructureTree(rootHandle, ignorePatterns);
        const structure = FileSystem.formatTreeToString(tree);
        return createSuccessResponse('Project structure retrieved successfully', { structure });
    } catch (error) {
        return createErrorResponse('Failed to get project structure', error.message);
    }
}

export async function _readFile({ filename, include_line_numbers = false }, rootHandle) {
    const context = buildErrorContext('read_file', 'read_file', { filename, include_line_numbers });
    
    try {
        // Enhanced security validation
        const securityResult = await validateToolSecurity(
            { filename, include_line_numbers },
            {
                toolName: 'read_file',
                operation: 'file_read',
                maxContentLength: 10000000 // 10MB limit for read operations
            }
        );
        
        const sanitizedFilename = securityResult.sanitizedParams.filePath || securityResult.sanitizedParams.filename;
        
        // Validate file permissions
        await validateFilePermission(sanitizedFilename, 'read');
        
        validateRequiredParams({ filename: sanitizedFilename }, ['filename'], 'read_file');
        validateParameterTypes({ filename: sanitizedFilename, include_line_numbers }, { filename: 'string', include_line_numbers: 'boolean' }, 'read_file');
        
        // Get adaptive thresholds and cache manager
        const adaptiveThresholds = getAdaptiveThresholds();
        const cacheManager = getCacheManager();
        const memoryMonitor = getMemoryMonitor();
        
        // Check cache first
        const cacheKey = `${filename}:${include_line_numbers}`;
        const cached = cacheManager.getCache('fileContent').get(cacheKey);
        if (cached && !memoryMonitor.shouldOptimizeForMemory()) {
            console.log(`[ReadFile] Cache hit for ${filename}`);
            return createSuccessResponse('File read from cache', cached.value);
        }
        
        // Use retry logic for file operations that might fail due to temporary issues
        const result = await withRetry(
            async () => {
                const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, sanitizedFilename);
                const file = await fileHandle.getFile();
                
                // Get file extension for adaptive thresholds
                const fileExtension = sanitizedFilename.substring(sanitizedFilename.lastIndexOf('.'));
                
                // Use adaptive thresholds instead of fixed values
                const threshold = adaptiveThresholds.getThreshold('read', fileExtension, file.size);
                const shouldUseStreaming = adaptiveThresholds.shouldUseStreaming(file.size, 'read', fileExtension);
                
                console.log(`[ReadFile] File: ${sanitizedFilename}, Size: ${file.size}, Threshold: ${threshold}, UseStreaming: ${shouldUseStreaming}`);

                await Editor.openFile(fileHandle, sanitizedFilename, document.getElementById('tab-bar'), false);
                document.getElementById('chat-input').focus();

                let streamResult;
                let processingMethod = 'standard';

                if (shouldUseStreaming) {
                    // Use streaming file reader for very large files
                    const { readFileWithStrategy } = await import('../../../file_streaming.js');
                    streamResult = await readFileWithStrategy(fileHandle, sanitizedFilename, {
                        previewOnly: true,
                        previewSize: threshold,
                        chunkSize: adaptiveThresholds.getOptimalChunkSize(file.size, 'read')
                    });
                    processingMethod = 'streaming';
                    
                    const resultData = {
                        success: true,
                        message: 'Large file processed with streaming - showing preview content',
                        data: {
                            filename: sanitizedFilename,
                            file_size: file.size,
                            preview_size: threshold,
                            truncated: true,
                            content: streamResult.content,
                            processing_method: processingMethod,
                            guidance: "Only preview content shown due to file size. File opened in editor. Use 'read_file_lines' for specific sections or 'edit_file' for targeted modifications."
                        }
                    };
                    
                    // Cache the result if memory allows
                    if (!memoryMonitor.shouldOptimizeForMemory()) {
                        cacheManager.getCache('fileContent').set(cacheKey, resultData, streamResult.content.length);
                    }
                    
                    return resultData;
                }

                if (file.size > threshold) {
                    // For large files, use chunked processing with preview
                    const { readFileWithStrategy } = await import('../../../file_streaming.js');
                    streamResult = await readFileWithStrategy(fileHandle, sanitizedFilename, {
                        previewOnly: true,
                        previewSize: threshold,
                        chunkSize: adaptiveThresholds.getOptimalChunkSize(file.size, 'read')
                    });
                    processingMethod = 'chunked';
                    
                    const resultData = {
                        success: true,
                        message: 'File is large - showing preview content',
                        data: {
                            filename: sanitizedFilename,
                            file_size: file.size,
                            preview_size: threshold,
                            truncated: true,
                            content: streamResult.content,
                            processing_method: processingMethod,
                            guidance: "Only preview content shown to prevent exceeding context window. File opened in editor. Use 'read_file_lines' for specific sections or 'edit_file' for targeted modifications."
                        }
                    };
                    
                    // Cache the result if memory allows
                    if (!memoryMonitor.shouldOptimizeForMemory()) {
                        cacheManager.getCache('fileContent').set(cacheKey, resultData, streamResult.content.length);
                    }
                    
                    return resultData;
                }

                // For smaller files, read normally but with optimized processing
                const { readFileWithStrategy } = await import('../../../file_streaming.js');
                streamResult = await readFileWithStrategy(fileHandle, sanitizedFilename, {
                    chunkSize: adaptiveThresholds.getOptimalChunkSize(file.size, 'read')
                });
                
                let cleanContent = unescapeHtmlEntities(streamResult.content);

                if (typeof cleanContent !== 'string') {
                    console.warn(`Read file content for ${sanitizedFilename} is not a string, it is a ${typeof cleanContent}. Coercing to empty string.`);
                    cleanContent = '';
                }

                if (include_line_numbers) {
                    const lines = cleanContent.split('\n');
                    cleanContent = lines.map((line, index) => `${index + 1} | ${line}`).join('\n');
                }
                
                const resultData = {
                    success: true,
                    message: 'File read successfully',
                    data: {
                        content: cleanContent,
                        filename: sanitizedFilename,
                        file_size: file.size,
                        processing_method: processingMethod,
                        strategy: streamResult.strategy
                    }
                };
                
                // Cache the result if memory allows and file is not too large
                if (!memoryMonitor.shouldOptimizeForMemory() && cleanContent.length < threshold) {
                    cacheManager.getCache('fileContent').set(cacheKey, resultData, cleanContent.length);
                }
                
                return resultData;
            },
            {
                maxRetries: 2,
                backoffStrategy: 'linear',
                context: context,
                toolName: 'read_file',
                retryCondition: (error, attempt, errorAnalysis) => {
                    // Retry for network/filesystem issues but not for validation errors
                    return errorAnalysis.category === 'filesystem' ||
                           errorAnalysis.category === 'network' ||
                           errorAnalysis.category === 'timeout';
                }
            }
        );
        
        return createSuccessResponse(result.message, result.data);
        
    } catch (error) {
        console.error(`Enhanced error handling for read_file '${sanitizedFilename || filename}':`, error);
        
        return await createEnhancedErrorResponse(
            `Failed to read file '${sanitizedFilename || filename}'`,
            error,
            {
                context: context,
                toolName: 'read_file',
                additionalData: { filename: sanitizedFilename || filename, include_line_numbers }
            }
        );
    }
}

/**
 * Reads a specific range of lines from a file.
 */
export async function _readFileLines({ filename, start_line, end_line }, rootHandle) {
    if (!filename) throw new Error("The 'filename' parameter is required.");
    if (typeof start_line !== 'number' || typeof end_line !== 'number') {
        throw new Error("The 'start_line' and 'end_line' parameters must be numbers.");
    }
    if (start_line > end_line) {
        throw new Error("The 'start_line' must not be after the 'end_line'.");
    }

    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    
    // Use streaming file reader for better performance with large files
    const { readFileWithStrategy, FileInfo } = await import('../../../file_streaming.js');
    
    // Declare variables in the correct scope
    let content, lines, clampedStart, clampedEnd;
    
    try {
        const file = await fileHandle.getFile();
        const fileInfo = new FileInfo(file, fileHandle);
        
        // Add detailed logging for debugging
        console.log(`Reading file: ${filename} (${fileInfo.formatFileSize(file.size)})`);
        console.log(`File type: ${file.type || 'unknown'}, Extension: ${fileInfo.extension}`);
        console.log(`Is text file: ${fileInfo.isText()}, Is binary file: ${fileInfo.isBinary()}`);
        
        const streamResult = await readFileWithStrategy(fileHandle, filename);
        
        // Enhanced type checking to handle various content types (binary files, null content, etc.)
        // This fixes the "content.split is not a function" error for files misclassified as text
        if (typeof streamResult.content !== 'string') {
            console.warn(`Warning: File content for ${filename} is not a string, it is a ${typeof streamResult.content}.`);
            console.warn(`Strategy used: ${streamResult.strategy}, Content truncated: ${streamResult.truncated}`);
            
            // Try to convert to string or use empty string as fallback
            content = streamResult.content ? String(streamResult.content) : '';
            console.log(`Converted content to string (length: ${content.length})`);
            
            lines = content.split('\n');
            console.log(`Split content into ${lines.length} lines`);
            
            clampedStart = Math.max(1, start_line);
            clampedEnd = Math.min(lines.length, end_line);
        } else {
            content = streamResult.content;
            lines = content.split('\n');
            
            clampedStart = Math.max(1, start_line);
            clampedEnd = Math.min(lines.length, end_line);
        }
    } catch (error) {
        console.error(`Error reading file ${filename}:`, error);
        throw new Error(`Failed to read file ${filename}: ${error.message}`);
    }

    // Check if line range is valid
    if (clampedStart > clampedEnd) {
        console.log(`Invalid line range: start(${clampedStart}) > end(${clampedEnd})`);
        return { content: '' };
    }

    // Extract the requested lines
    const selectedLines = lines.slice(clampedStart - 1, clampedEnd);
    console.log(`Selected ${selectedLines.length} lines from ${clampedStart} to ${clampedEnd}`);
    
    // Always include line numbers in the output of this tool
    const numberedLines = selectedLines.map((line, index) => `${clampedStart + index} | ${line}`);
    
    return {
        content: numberedLines.join('\n'),
        details: {
            filename,
            start_line: clampedStart,
            end_line: clampedEnd,
            lines_count: selectedLines.length,
            original_lines_count: lines.length
        }
    };
}

export async function _searchInFile({ filename, pattern, context = 2 }, rootHandle) {
    try {
        validateRequiredParams({ filename, pattern }, ['filename', 'pattern'], 'search_in_file');
        validateParameterTypes({ filename, pattern, context }, { filename: 'string', pattern: 'string', context: 'number' }, 'search_in_file');

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
            return createSuccessResponse("No matches found", { results: [] });
        }

        return createSuccessResponse(`Found ${searchResults.length} matches in '${filename}'`, { results: searchResults });
    } catch (error) {
        return createErrorResponse(`Failed to search in file '${filename}'`, error.message);
    }
}

export async function _readMultipleFiles({ filenames }, rootHandle) {
    try {
        validateRequiredParams({ filenames }, ['filenames'], 'read_multiple_files');
        validateParameterTypes({ filenames }, { filenames: 'array' }, 'read_multiple_files');
        
        if (filenames.length === 0) {
            throw new Error("The 'filenames' array must contain at least one filename.");
        }

        // Get adaptive thresholds and performance monitoring
        const adaptiveThresholds = getAdaptiveThresholds();
        const memoryMonitor = getMemoryMonitor();
        const cacheManager = getCacheManager();
        
        // Calculate total estimated size and adjust processing strategy
        let totalEstimatedSize = 0;
        const fileInfos = [];
        
        for (const filename of filenames) {
            try {
                const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
                const file = await fileHandle.getFile();
                const fileExtension = filename.substring(filename.lastIndexOf('.'));
                const threshold = adaptiveThresholds.getThreshold('read', fileExtension, file.size);
                
                fileInfos.push({
                    filename,
                    fileHandle,
                    file,
                    size: file.size,
                    threshold,
                    extension: fileExtension
                });
                
                totalEstimatedSize += Math.min(file.size, threshold);
            } catch (error) {
                fileInfos.push({
                    filename,
                    error: error.message
                });
            }
        }
        
        console.log(`[ReadMultipleFiles] Processing ${filenames.length} files, estimated total size: ${totalEstimatedSize} bytes`);
        
        // Determine processing strategy based on total size and memory
        const shouldUseParallel = !memoryMonitor.shouldOptimizeForMemory() &&
                                 totalEstimatedSize < adaptiveThresholds.currentThresholds.large * 5;
        
        try {
            if (shouldUseParallel) {
                // Use parallel processing for better performance
                const { ensureWorkersInitialized } = await import('../../../worker_manager.js');
                const { workerManager } = await import('../../../worker_manager.js');
                await ensureWorkersInitialized();
                
                // Use batch worker with adaptive thresholds
                const batchResult = await workerManager.executeBatch([
                    {
                        type: 'file_read',
                        filenames: filenames,
                        adaptiveThresholds: true,
                        includeMetadata: true,
                        memoryOptimized: memoryMonitor.shouldOptimizeForMemory()
                    }
                ]);
                
                let combinedContent = '';
                const processedFiles = [];
                const errors = [];
                let totalProcessedSize = 0;
                
                for (let i = 0; i < filenames.length; i++) {
                    const filename = filenames[i];
                    const result = batchResult.results[i];
                    
                    if (result.success) {
                        combinedContent += `--- START OF FILE: ${filename} ---\n`;
                        
                        if (result.truncated) {
                            combinedContent += `File processed with ${result.processingMethod || 'adaptive'} method (Size: ${result.fileSize} bytes).\n`;
                            combinedContent += `Guidance: The file has been opened in the editor. Use surgical tools to modify it.\n`;
                        } else {
                            combinedContent += result.content + '\n';
                        }
                        
                        combinedContent += `--- END OF FILE: ${filename} ---\n\n`;
                        processedFiles.push(filename);
                        totalProcessedSize += result.content.length;
                        
                        // Open file in editor
                        try {
                            const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
                            await Editor.openFile(fileHandle, filename, document.getElementById('tab-bar'), false);
                        } catch (editorError) {
                            console.warn(`Failed to open ${filename} in editor:`, editorError.message);
                        }
                    } else {
                        combinedContent += `--- ERROR READING FILE: ${filename} ---\n`;
                        combinedContent += `${result.error}\n`;
                        combinedContent += `--- END OF ERROR ---\n\n`;
                        errors.push({ filename, error: result.error });
                    }
                }
                
                document.getElementById('chat-input').focus();
                
                return createSuccessResponse('Multiple files read successfully', {
                    combined_content: combinedContent,
                    batch_stats: {
                        total_files: filenames.length,
                        successful: processedFiles.length,
                        failed: errors.length,
                        processing_time: batchResult.processingTime || 0,
                        parallel_processing: true,
                        total_processed_size: totalProcessedSize,
                        memory_optimized: memoryMonitor.shouldOptimizeForMemory()
                    }
                });
            }
        } catch (error) {
            console.warn('Parallel processing failed, falling back to sequential processing:', error.message);
        }
        
        // Sequential processing with adaptive thresholds
        let combinedContent = '';
        let totalProcessedSize = 0;
        const processedFiles = [];
        const errors = [];

        for (const fileInfo of fileInfos) {
            if (fileInfo.error) {
                combinedContent += `--- ERROR READING FILE: ${fileInfo.filename} ---\n`;
                combinedContent += `${fileInfo.error}\n`;
                combinedContent += `--- END OF ERROR ---\n\n`;
                errors.push({ filename: fileInfo.filename, error: fileInfo.error });
                continue;
            }
            
            try {
                combinedContent += `--- START OF FILE: ${fileInfo.filename} ---\n`;

                if (fileInfo.size > fileInfo.threshold) {
                    // Use streaming for large files
                    const { readFileWithStrategy } = await import('../../../file_streaming.js');
                    const streamResult = await readFileWithStrategy(fileInfo.fileHandle, fileInfo.filename, {
                        previewOnly: true,
                        previewSize: fileInfo.threshold,
                        chunkSize: adaptiveThresholds.getOptimalChunkSize(fileInfo.size, 'read')
                    });
                    
                    combinedContent += `File processed with streaming (Size: ${fileInfo.size} bytes, Preview: ${fileInfo.threshold} bytes).\n`;
                    combinedContent += streamResult.content + '\n';
                    totalProcessedSize += streamResult.content.length;
                } else {
                    // Read smaller files normally
                    let content = await fileInfo.file.text();
                    combinedContent += content + '\n';
                    totalProcessedSize += content.length;
                }
                
                combinedContent += `--- END OF FILE: ${fileInfo.filename} ---\n\n`;
                processedFiles.push(fileInfo.filename);

                await Editor.openFile(fileInfo.fileHandle, fileInfo.filename, document.getElementById('tab-bar'), false);
                
                // Yield control periodically to prevent UI blocking
                if (processedFiles.length % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                
            } catch (error) {
                combinedContent += `--- ERROR READING FILE: ${fileInfo.filename} ---\n`;
                combinedContent += `${error.message}\n`;
                combinedContent += `--- END OF ERROR ---\n\n`;
                errors.push({ filename: fileInfo.filename, error: error.message });
            }
        }
        
        document.getElementById('chat-input').focus();
        
        return createSuccessResponse('Multiple files read successfully (adaptive processing)', {
            combined_content: combinedContent,
            batch_stats: {
                total_files: filenames.length,
                successful: processedFiles.length,
                failed: errors.length,
                parallel_processing: false,
                total_processed_size: totalProcessedSize,
                memory_optimized: memoryMonitor.shouldOptimizeForMemory(),
                adaptive_processing: true
            }
        });
        
    } catch (error) {
        return createErrorResponse('Failed to read multiple files', error.message);
    }
}

// Get file size and metadata without reading content
export async function _getFileInfo({ filename }, rootHandle) {
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

// Editor-specific tools
export async function _getOpenFileContent() {
    const activeFile = Editor.getActiveFile();
    if (!activeFile) throw new Error('No file is currently open in the editor.');
    
    const content = activeFile.model.getValue();
    return { filename: activeFile.name, content: content };
}

export async function _getSelectedText() {
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

export async function _setSelectedText({ start_line, start_column, end_line, end_column }) {
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