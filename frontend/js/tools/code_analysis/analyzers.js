/**
 * Code analysis and AST parsing tools
 */

import { createSuccessResponse, createErrorResponse } from '../core/tool_interfaces.js';
import { getAdaptiveThresholds, getMemoryMonitor, getCacheManager } from '../utils/shared_utils.js';
import * as FileSystem from '../../../file_system.js';

export async function _analyzeCode({ filename }, rootHandle) {
    if (!filename.endsWith('.js') && !filename.endsWith('.ts') && !filename.endsWith('.jsx') && !filename.endsWith('.tsx')) {
        throw new Error('This tool can only analyze JavaScript/TypeScript files. Use read_file for others.');
    }
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
    const file = await fileHandle.getFile();
    const fileSize = file.size;
    const fileExtension = filename.substring(filename.lastIndexOf('.'));
    
    // Get performance monitoring systems
    const adaptiveThresholds = getAdaptiveThresholds();
    const memoryMonitor = getMemoryMonitor();
    const cacheManager = getCacheManager();
    
    // Check if we should use memory-optimized processing
    const shouldOptimizeForMemory = memoryMonitor.shouldOptimizeForMemory();
    const analysisThreshold = adaptiveThresholds.getThreshold('analyze', fileExtension, fileSize);
    
    console.log(`[AnalyzeCode] File: ${filename}, Size: ${fileSize}, Threshold: ${analysisThreshold}, Memory optimized: ${shouldOptimizeForMemory}`);
    
    // Check cache first
    const cacheKey = `analyze_${filename}_${file.lastModified}`;
    const cached = cacheManager.getCache('analysis').get(cacheKey);
    if (cached && !shouldOptimizeForMemory) {
        console.log(`[AnalyzeCode] Cache hit for ${filename}`);
        return { analysis: cached.value, cached: true };
    }
    
    let content;
    
    // Use adaptive content loading based on file size
    if (fileSize > analysisThreshold) {
        console.log(`[AnalyzeCode] Large file detected, using chunked analysis for ${filename}`);
        
        // For large files, read in chunks and perform incremental analysis
        const chunkSize = adaptiveThresholds.getOptimalChunkSize(fileSize, 'analyze');
        const chunks = [];
        let currentPos = 0;
        
        while (currentPos < fileSize) {
            const chunkEnd = Math.min(currentPos + chunkSize, fileSize);
            const chunk = await file.slice(currentPos, chunkEnd).text();
            chunks.push(chunk);
            currentPos = chunkEnd;
            
            // Yield control periodically
            if (chunks.length % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        content = chunks.join('');
    } else {
        content = await file.text();
    }
    
    try {
        // Import required modules dynamically to avoid circular dependencies
        const { operationCache } = await import('../../../cache_manager.js');
        const { workerManager } = await import('../../../worker_manager.js');
        
        // Use cached AST parsing with worker, with memory optimization if needed
        const analysis = await operationCache.cacheAST(filename, content, async (content, filename) => {
            return await workerManager.parseAST(content, filename, {
                ecmaVersion: 'latest',
                sourceType: 'module',
                locations: true,
                memoryOptimized: shouldOptimizeForMemory,
                chunkSize: fileSize > analysisThreshold ? adaptiveThresholds.getOptimalChunkSize(fileSize, 'analyze') : undefined
            });
        });
        
        // Cache the result if memory allows
        if (!shouldOptimizeForMemory && fileSize < analysisThreshold) {
            cacheManager.getCache('analysis').set(cacheKey, analysis, JSON.stringify(analysis).length);
        }
        
        return {
            analysis,
            processingMethod: fileSize > analysisThreshold ? 'chunked' : 'standard',
            fileSize,
            memoryOptimized: shouldOptimizeForMemory
        };
        
    } catch (error) {
        console.warn(`AST analysis failed for ${filename}, falling back to basic analysis:`, error.message);
        
        // Enhanced fallback analysis with chunked processing for large files
        const basicAnalysis = {
            functions: [],
            classes: [],
            imports: [],
            variables: [],
            processingMethod: 'fallback'
        };
        
        // For large files, process in chunks to avoid memory issues
        if (fileSize > analysisThreshold) {
            const chunkSize = Math.min(100000, adaptiveThresholds.getOptimalChunkSize(fileSize, 'analyze'));
            let processedChunks = 0;
            
            for (let i = 0; i < content.length; i += chunkSize) {
                const chunk = content.slice(i, i + chunkSize);
                
                // Extract functions from chunk
                const functionMatches = chunk.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g) || [];
                functionMatches.forEach(match => {
                    const name = match.match(/(?:function\s+(\w+)|const\s+(\w+))/)?.[1] || match.match(/(?:function\s+(\w+)|const\s+(\w+))/)?.[2];
                    if (name && !basicAnalysis.functions.some(f => f.name === name)) {
                        basicAnalysis.functions.push({ name, type: 'function' });
                    }
                });
                
                // Extract classes from chunk
                const classMatches = chunk.match(/class\s+(\w+)/g) || [];
                classMatches.forEach(match => {
                    const name = match.replace('class ', '');
                    if (!basicAnalysis.classes.some(c => c.name === name)) {
                        basicAnalysis.classes.push({ name, type: 'class' });
                    }
                });
                
                // Extract imports from chunk (usually at the beginning)
                if (i === 0) {
                    const importMatches = chunk.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
                    importMatches.forEach(match => {
                        const source = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
                        if (source) {
                            basicAnalysis.imports.push({ source });
                        }
                    });
                }
                
                processedChunks++;
                
                // Progress reporting and memory check
                if (processedChunks % 10 === 0) {
                    const progress = Math.round((i / content.length) * 100);
                    console.log(`[AnalyzeCode] Fallback analysis progress: ${progress}%`);
                    
                    // Yield control and check memory
                    await new Promise(resolve => setTimeout(resolve, 0));
                    if (memoryMonitor.shouldOptimizeForMemory()) {
                        console.warn('[AnalyzeCode] High memory usage during fallback analysis');
                        memoryMonitor.triggerCleanup();
                    }
                }
            }
            
            basicAnalysis.processingMethod = 'chunked_fallback';
        } else {
            // Standard fallback for smaller files
            const functionMatches = content.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g) || [];
            functionMatches.forEach(match => {
                const name = match.match(/(?:function\s+(\w+)|const\s+(\w+))/)?.[1] || match.match(/(?:function\s+(\w+)|const\s+(\w+))/)?.[2];
                if (name) {
                    basicAnalysis.functions.push({ name, type: 'function' });
                }
            });
            
            const classMatches = content.match(/class\s+(\w+)/g) || [];
            classMatches.forEach(match => {
                const name = match.replace('class ', '');
                basicAnalysis.classes.push({ name, type: 'class' });
            });
            
            const importMatches = content.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
            importMatches.forEach(match => {
                const source = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
                if (source) {
                    basicAnalysis.imports.push({ source });
                }
            });
        }
        
        // Cache fallback result if memory allows
        if (!shouldOptimizeForMemory && fileSize < analysisThreshold) {
            cacheManager.getCache('analysis').set(cacheKey, basicAnalysis, JSON.stringify(basicAnalysis).length);
        }
        
        return {
            analysis: basicAnalysis,
            fileSize,
            memoryOptimized: shouldOptimizeForMemory,
            fallback: true
        };
    }
}

export async function _analyzeSymbol({ symbol_name, file_path }, rootHandle) {
    if (!symbol_name) throw new Error("The 'symbol_name' parameter is required.");
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    // Import code comprehension module dynamically
    const { codeComprehension } = await import('../../../code_comprehension.js');
    const analysis = await codeComprehension.analyzeSymbol(symbol_name, file_path, rootHandle);
    return { analysis };
}

export async function _explainCodeSection({ file_path, start_line, end_line }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    if (typeof start_line !== 'number') throw new Error("The 'start_line' parameter is required and must be a number.");
    if (typeof end_line !== 'number') throw new Error("The 'end_line' parameter is required and must be a number.");
    
    // Import code comprehension module dynamically
    const { codeComprehension } = await import('../../../code_comprehension.js');
    const explanation = await codeComprehension.explainCodeSection(file_path, start_line, end_line, rootHandle);
    return { explanation };
}

export async function _traceVariableFlow({ variable_name, file_path }, rootHandle) {
    if (!variable_name) throw new Error("The 'variable_name' parameter is required.");
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    // Import code comprehension module dynamically
    const { codeComprehension } = await import('../../../code_comprehension.js');
    const analysis = await codeComprehension.analyzeSymbol(variable_name, file_path, rootHandle);
    return {
        variable: variable_name,
        definitions: analysis.definitions,
        usages: analysis.usages,
        dataFlow: analysis.dataFlow,
        relatedFiles: analysis.relatedFiles
    };
}

export async function _validateSyntax({ file_path }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    // Import syntax validator dynamically
    const { syntaxValidator } = await import('../../../syntax_validator.js');
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

// Enhanced batch processing with adaptive performance optimization
export async function _batchAnalyzeFiles({ filenames, analysis_types = ['ast', 'quality', 'symbols'] }, rootHandle) {
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
        throw new Error("The 'filenames' parameter is required and must be a non-empty array of strings.");
    }
    
    // Get performance monitoring systems
    const adaptiveThresholds = getAdaptiveThresholds();
    const memoryMonitor = getMemoryMonitor();
    const cacheManager = getCacheManager();
    
    // Calculate total estimated processing load
    let totalEstimatedSize = 0;
    const fileInfos = [];
    
    for (const filename of filenames) {
        try {
            const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, filename);
            const file = await fileHandle.getFile();
            const fileExtension = filename.substring(filename.lastIndexOf('.'));
            
            fileInfos.push({
                filename,
                fileHandle,
                file,
                size: file.size,
                extension: fileExtension
            });
            
            totalEstimatedSize += file.size;
        } catch (error) {
            fileInfos.push({
                filename,
                error: error.message
            });
        }
    }
    
    // Determine processing strategy based on total load and memory
    const shouldUseParallel = !memoryMonitor.shouldOptimizeForMemory() &&
                             totalEstimatedSize < adaptiveThresholds.currentThresholds.large * 10 &&
                             filenames.length <= 20; // Limit parallel processing
    
    console.log(`[BatchAnalyze] Processing ${filenames.length} files, total size: ${totalEstimatedSize} bytes, parallel: ${shouldUseParallel}`);
    
    try {
        if (shouldUseParallel) {
            // Import required modules dynamically
            const { ensureWorkersInitialized, workerManager } = await import('../../../worker_manager.js');
            
            // Ensure workers are initialized before use
            await ensureWorkersInitialized();
            
            // Use batch worker with adaptive settings
            const batchResult = await workerManager.executeBatch([
                {
                    type: 'file_analyze',
                    filenames: filenames,
                    analysisTypes: analysis_types,
                    includeMetrics: true,
                    includeRecommendations: true,
                    adaptiveThresholds: true,
                    memoryOptimized: memoryMonitor.shouldOptimizeForMemory()
                }
            ]);
            
            const results = [];
            const summary = {
                totalFiles: filenames.length,
                successful: 0,
                failed: 0,
                totalIssues: 0,
                averageQuality: 0,
                processingTime: batchResult.processingTime || 0,
                totalProcessedSize: 0
            };
            
            for (let i = 0; i < filenames.length; i++) {
                const filename = filenames[i];
                const result = batchResult.results[i];
                const fileInfo = fileInfos[i];
                
                if (result.success) {
                    summary.successful++;
                    summary.totalIssues += (result.issues?.length || 0);
                    summary.averageQuality += (result.qualityScore || 0);
                    summary.totalProcessedSize += (fileInfo.size || 0);
                    
                    results.push({
                        filename,
                        success: true,
                        analysis: result.analysis,
                        qualityScore: result.qualityScore,
                        issues: result.issues || [],
                        recommendations: result.recommendations || [],
                        metrics: result.metrics || {},
                        fileSize: fileInfo.size || 0,
                        processingMethod: result.processingMethod || 'parallel'
                    });
                } else {
                    summary.failed++;
                    results.push({
                        filename,
                        success: false,
                        error: result.error
                    });
                }
            }
            
            summary.averageQuality = summary.successful > 0 ? summary.averageQuality / summary.successful : 0;
            
            return {
                message: `Batch analysis completed for ${filenames.length} files`,
                summary,
                results,
                performance: {
                    parallelProcessing: true,
                    processingTime: batchResult.processingTime || 0,
                    averageTimePerFile: summary.successful > 0 ? (batchResult.processingTime || 0) / summary.successful : 0,
                    totalProcessedSize: summary.totalProcessedSize,
                    memoryOptimized: memoryMonitor.shouldOptimizeForMemory()
                }
            };
        }
    } catch (error) {
        console.warn('Parallel batch analysis failed, falling back to sequential processing:', error.message);
    }
    
    // Sequential processing with adaptive optimization
    const results = [];
    const startTime = Date.now();
    let totalProcessedSize = 0;
    let processedFiles = 0;
    
    for (const fileInfo of fileInfos) {
        if (fileInfo.error) {
            results.push({
                filename: fileInfo.filename,
                success: false,
                error: fileInfo.error
            });
            continue;
        }
        
        try {
            const content = await fileInfo.file.text();
            const analysis = {};
            const fileSize = fileInfo.file.size;
            const analysisThreshold = adaptiveThresholds.getThreshold('analyze', fileInfo.extension, fileSize);
            
            // Perform requested analysis types with adaptive processing
            if (analysis_types.includes('ast')) {
                try {
                    const { operationCache } = await import('../../../cache_manager.js');
                    const { ensureWorkersInitialized, workerManager } = await import('../../../worker_manager.js');
                    
                    analysis.ast = await operationCache.cacheAST(fileInfo.filename, content, async (content, filename) => {
                        await ensureWorkersInitialized();
                        return await workerManager.parseAST(content, filename, {
                            memoryOptimized: memoryMonitor.shouldOptimizeForMemory(),
                            chunkSize: fileSize > analysisThreshold ? adaptiveThresholds.getOptimalChunkSize(fileSize, 'analyze') : undefined
                        });
                    });
                } catch (e) {
                    analysis.ast = { error: e.message };
                }
            }
            
            if (analysis_types.includes('quality')) {
                try {
                    // Import quality analyzer dynamically
                    const { _analyzeCodeQuality } = await import('../engineering/senior_ai_tools.js');
                    analysis.quality = await _analyzeCodeQuality({ file_path: fileInfo.filename }, rootHandle);
                } catch (e) {
                    analysis.quality = { error: e.message };
                }
            }
            
            if (analysis_types.includes('symbols')) {
                try {
                    // Import symbol builder dynamically
                    const { _buildSymbolTable } = await import('../engineering/senior_ai_tools.js');
                    analysis.symbols = await _buildSymbolTable({ file_path: fileInfo.filename }, rootHandle);
                } catch (e) {
                    analysis.symbols = { error: e.message };
                }
            }
            
            results.push({
                filename: fileInfo.filename,
                success: true,
                analysis,
                fileSize,
                processingMethod: fileSize > analysisThreshold ? 'chunked_sequential' : 'sequential',
                fallback: true
            });
            
            totalProcessedSize += fileSize;
            processedFiles++;
            
            // Progress reporting and memory management
            if (processedFiles % 5 === 0) {
                const progress = Math.round((processedFiles / fileInfos.length) * 100);
                console.log(`[BatchAnalyze] Sequential progress: ${progress}% (${processedFiles}/${fileInfos.length} files)`);
                
                // Yield control and check memory
                await new Promise(resolve => setTimeout(resolve, 0));
                if (memoryMonitor.shouldOptimizeForMemory()) {
                    console.warn('[BatchAnalyze] High memory usage, triggering cleanup');
                    memoryMonitor.triggerCleanup();
                }
            }
            
        } catch (error) {
            results.push({
                filename: fileInfo.filename,
                success: false,
                error: error.message
            });
        }
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
        message: `Batch analysis completed for ${filenames.length} files (adaptive sequential processing)`,
        results,
        fallback: true,
        performance: {
            parallelProcessing: false,
            processingTime,
            averageTimePerFile: processedFiles > 0 ? processingTime / processedFiles : 0,
            totalProcessedSize,
            memoryOptimized: memoryMonitor.shouldOptimizeForMemory(),
            adaptiveProcessing: true
        }
    };
}

export async function _batchValidateFiles({ filenames, validation_types = ['syntax', 'style', 'security'] }, rootHandle) {
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
        throw new Error("The 'filenames' parameter is required and must be a non-empty array of strings.");
    }
    
    try {
        // Import required modules dynamically
        const { ensureWorkersInitialized, workerManager } = await import('../../../worker_manager.js');
        
        // Ensure workers are initialized before use
        await ensureWorkersInitialized();
        
        // Use batch worker for parallel validation of multiple files
        const batchResult = await workerManager.executeBatch([
            {
                type: 'file_validate',
                filenames: filenames,
                validationTypes: validation_types,
                includeWarnings: true,
                includeSuggestions: true
            }
        ]);
        
        const results = [];
        const summary = {
            totalFiles: filenames.length,
            validFiles: 0,
            filesWithErrors: 0,
            filesWithWarnings: 0,
            totalErrors: 0,
            totalWarnings: 0,
            processingTime: batchResult.processingTime || 0
        };
        
        for (let i = 0; i < filenames.length; i++) {
            const filename = filenames[i];
            const result = batchResult.results[i];
            
            if (result.success) {
                const hasErrors = result.errors && result.errors.length > 0;
                const hasWarnings = result.warnings && result.warnings.length > 0;
                
                if (!hasErrors && !hasWarnings) {
                    summary.validFiles++;
                } else {
                    if (hasErrors) summary.filesWithErrors++;
                    if (hasWarnings) summary.filesWithWarnings++;
                }
                
                summary.totalErrors += (result.errors?.length || 0);
                summary.totalWarnings += (result.warnings?.length || 0);
                
                results.push({
                    filename,
                    success: true,
                    valid: !hasErrors,
                    errors: result.errors || [],
                    warnings: result.warnings || [],
                    suggestions: result.suggestions || [],
                    language: result.language || 'unknown'
                });
            } else {
                summary.filesWithErrors++;
                results.push({
                    filename,
                    success: false,
                    valid: false,
                    error: result.error
                });
            }
        }
        
        return {
            message: `Batch validation completed for ${filenames.length} files`,
            summary,
            results,
            performance: {
                parallelProcessing: true,
                processingTime: batchResult.processingTime || 0,
                averageTimePerFile: filenames.length > 0 ? (batchResult.processingTime || 0) / filenames.length : 0
            }
        };
        
    } catch (error) {
        console.warn('Batch validation failed, falling back to sequential processing:', error.message);
        
        // Fallback to sequential processing
        const results = [];
        const startTime = Date.now();
        
        for (const filename of filenames) {
            try {
                const validation = await _validateSyntax({ file_path: filename }, rootHandle);
                results.push({
                    filename,
                    success: true,
                    valid: validation.valid,
                    errors: validation.errors || [],
                    warnings: validation.warnings || [],
                    suggestions: validation.suggestions || [],
                    language: validation.language || 'unknown',
                    fallback: true
                });
            } catch (error) {
                results.push({
                    filename,
                    success: false,
                    valid: false,
                    error: error.message
                });
            }
        }
        
        const processingTime = Date.now() - startTime;
        
        return {
            message: `Batch validation completed for ${filenames.length} files (fallback mode)`,
            results,
            fallback: true,
            performance: {
                parallelProcessing: false,
                processingTime,
                averageTimePerFile: processingTime / filenames.length
            }
        };
    }
}