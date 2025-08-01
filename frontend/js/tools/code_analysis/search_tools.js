/**
 * Code search and indexing tools
 */

import { createSuccessResponse, createErrorResponse, validateRequiredParams, validateParameterTypes } from '../core/tool_interfaces.js';
import { getAdaptiveThresholds, getMemoryMonitor, getCacheManager } from '../utils/shared_utils.js';
import * as UI from '../../../ui.js';

export async function _searchCode({ search_term }, rootHandle) {
    try {
        validateRequiredParams({ search_term }, ['search_term'], 'search_code');
        validateParameterTypes({ search_term }, { search_term: 'string' }, 'search_code');
        
        // Get performance monitoring systems
        const adaptiveThresholds = getAdaptiveThresholds();
        const memoryMonitor = getMemoryMonitor();
        const cacheManager = getCacheManager();
        
        // Check cache first for recent searches
        const cacheKey = `search_${search_term}`;
        const cached = cacheManager.getCache('search').get(cacheKey);
        if (cached && !memoryMonitor.shouldOptimizeForMemory()) {
            console.log(`[SearchCode] Cache hit for search term: ${search_term}`);
            return createSuccessResponse('Search results from cache', {
                ...cached.value,
                cached: true
            });
        }
        
        // Import background indexer dynamically
        const { backgroundIndexer } = await import('../../../background_indexer.js');
        
        if (!backgroundIndexer.isAvailable()) {
            throw new Error("The background indexer is not ready. Please wait a moment and try again.");
        }
        
        const startTime = Date.now();
        
        // Use memory-optimized search if needed
        const searchOptions = {
            memoryOptimized: memoryMonitor.shouldOptimizeForMemory(),
            maxResults: memoryMonitor.shouldOptimizeForMemory() ? 50 : 100,
            chunkSize: adaptiveThresholds.getOptimalChunkSize(search_term.length * 1000, 'search') // Estimate based on search complexity
        };
        
        const searchResults = await backgroundIndexer.searchInIndex(search_term, searchOptions);
       
        const successfulResults = searchResults.filter(r => r.matches);
        const erroredFiles = searchResults.filter(r => r.error);
        
        // Calculate search statistics
        const totalMatches = successfulResults.reduce((sum, result) => sum + (result.matches?.length || 0), 0);
        const searchTime = Date.now() - startTime;

        let summary = `Search complete in ${searchTime}ms. Found ${totalMatches} matches in ${successfulResults.length} files.`;
        if (erroredFiles.length > 0) {
            summary += ` Failed to search ${erroredFiles.length} files.`;
        }
        
        const resultData = {
           results: successfulResults,
           errors: erroredFiles,
           stats: {
               total_files_searched: searchResults.length,
               successful_files: successfulResults.length,
               failed_files: erroredFiles.length,
               total_matches: totalMatches,
               search_time: searchTime,
               memory_optimized: searchOptions.memoryOptimized
           }
        };
        
        // Cache results if memory allows and search was successful
        if (!memoryMonitor.shouldOptimizeForMemory() && successfulResults.length > 0) {
            const resultSize = JSON.stringify(resultData).length;
            cacheManager.getCache('search').set(cacheKey, resultData, resultSize);
        }

        return createSuccessResponse(summary, resultData);
    } catch (error) {
        return createErrorResponse('Search failed', error.message);
    }
}

export async function _buildCodebaseIndex(params, rootHandle) {
    try {
        const startTime = Date.now();
        UI.appendMessage(document.getElementById('chat-messages'), 'Checking for updates and building codebase index...', 'ai');

        // Get performance monitoring systems
        const adaptiveThresholds = getAdaptiveThresholds();
        const memoryMonitor = getMemoryMonitor();
        const cacheManager = getCacheManager();

        // Import required modules dynamically
        const { DbManager } = await import('../../../db.js');
        const { CodebaseIndexer } = await import('../../../code_intel.js');
        const { FileSystem } = await import('../../../file_system.js');

        const lastIndexTimestamp = await DbManager.getLastIndexTimestamp() || 0;
        const existingIndex = await DbManager.getCodeIndex();
        
        const ignorePatterns = await FileSystem.getIgnorePatterns(rootHandle);
        
        // Enhanced indexing options with adaptive processing
        const indexingOptions = {
            lastIndexTimestamp,
            existingIndex,
            ignorePatterns,
            memoryOptimized: memoryMonitor.shouldOptimizeForMemory(),
            chunkSize: adaptiveThresholds.getOptimalChunkSize(1000000, 'analyze'), // 1MB base estimate
            progressCallback: (progress) => {
                if (progress.filesProcessed % 50 === 0) {
                    console.log(`[BuildIndex] Progress: ${progress.filesProcessed}/${progress.totalFiles} files (${Math.round(progress.percentage)}%)`);
                    UI.appendMessage(document.getElementById('chat-messages'),
                        `Indexing progress: ${progress.filesProcessed}/${progress.totalFiles} files...`, 'ai');
                }
            }
        };
        
        const { index: newIndex, stats } = await CodebaseIndexer.buildIndex(rootHandle, indexingOptions);
        
        await DbManager.saveCodeIndex(newIndex);
        await DbManager.saveLastIndexTimestamp(startTime);
        
        // Clear search cache since index has been updated
        cacheManager.getCache('search').clear();
        
        const processingTime = Date.now() - startTime;
        const message = `Codebase index updated in ${Math.round(processingTime/1000)}s. ${stats.indexedFileCount} files indexed, ${stats.skippedFileCount} files skipped (unchanged), ${stats.deletedFileCount} files removed.`;
        
        return createSuccessResponse(message, {
            stats: {
                indexed_files: stats.indexedFileCount,
                skipped_files: stats.skippedFileCount,
                deleted_files: stats.deletedFileCount,
                processing_time: processingTime,
                memory_optimized: indexingOptions.memoryOptimized,
                average_time_per_file: stats.indexedFileCount > 0 ? Math.round(processingTime / stats.indexedFileCount) : 0
            }
        });
    } catch (error) {
        return createErrorResponse('Failed to build codebase index', error.message);
    }
}

export async function _queryCodebase({ query }) {
    try {
        validateRequiredParams({ query }, ['query'], 'query_codebase');
        validateParameterTypes({ query }, { query: 'string' }, 'query_codebase');
        
        // Get performance monitoring systems
        const memoryMonitor = getMemoryMonitor();
        const cacheManager = getCacheManager();
        
        // Check cache first
        const cacheKey = `query_${query}`;
        const cached = cacheManager.getCache('search').get(cacheKey);
        if (cached && !memoryMonitor.shouldOptimizeForMemory()) {
            console.log(`[QueryCodebase] Cache hit for query: ${query}`);
            return createSuccessResponse(`Found ${cached.value.results.length} cached results for query '${query}'`, {
                ...cached.value,
                cached: true
            });
        }
        
        // Import required modules dynamically
        const { DbManager } = await import('../../../db.js');
        const { CodebaseIndexer } = await import('../../../code_intel.js');
        
        const index = await DbManager.getCodeIndex();
        if (!index) {
            throw new Error("No codebase index found. Please run 'build_or_update_codebase_index' first.");
        }
        
        const startTime = Date.now();
        
        // Enhanced query options with memory optimization
        const queryOptions = {
            memoryOptimized: memoryMonitor.shouldOptimizeForMemory(),
            maxResults: memoryMonitor.shouldOptimizeForMemory() ? 100 : 500,
            includeContext: !memoryMonitor.shouldOptimizeForMemory()
        };
        
        const queryResults = await CodebaseIndexer.queryIndex(index, query, queryOptions);
        const queryTime = Date.now() - startTime;
        
        const resultData = {
            results: queryResults,
            query: query,
            result_count: queryResults.length,
            query_time: queryTime,
            memory_optimized: queryOptions.memoryOptimized
        };
        
        // Cache results if memory allows
        if (!memoryMonitor.shouldOptimizeForMemory() && queryResults.length > 0) {
            const resultSize = JSON.stringify(resultData).length;
            cacheManager.getCache('search').set(cacheKey, resultData, resultSize);
        }
        
        return createSuccessResponse(`Found ${queryResults.length} results for query '${query}' in ${queryTime}ms`, resultData);
    } catch (error) {
        return createErrorResponse('Failed to query codebase', error.message);
    }
}

export async function _reindexCodebasePaths({ paths }, rootHandle) {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        throw new Error("The 'paths' parameter is required and must be a non-empty array.");
    }

    UI.appendMessage(document.getElementById('chat-messages'), `Re-indexing ${paths.length} specific paths...`, 'ai');
    
    // Import required modules dynamically
    const { DbManager } = await import('../../../db.js');
    const { CodebaseIndexer } = await import('../../../code_intel.js');
    const { FileSystem } = await import('../../../file_system.js');
    
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

// Backend indexing tools
export async function build_backend_index(params, rootHandle) {
   // Import FileSystem dynamically
   const { FileSystem } = await import('../../../file_system.js');
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

export async function query_backend_index({ query, page = 1, limit = 20 }) {
  const params = new URLSearchParams({ query, page, limit });
  const response = await fetch(`/api/query-codebase?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to query backend index: ${error.message}`);
  }
  const result = await response.json();
  return result;
}