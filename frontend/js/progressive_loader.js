/**
 * Progressive Loader
 * Handles progressive loading of large directories
 */

import { getIgnorePatterns } from './file_system.js';
import { performanceOptimizer } from './performance_optimizer.js';

class ProgressiveLoader {
    constructor() {
        this.loadingCache = new Map(); // Cache for directory entries
        this.loadingStates = new Map(); // Track loading states
    }

    /**
     * Load more items for a directory
     */
    async loadMoreItems(dirHandle, parentPath, currentLoaded, batchSize = 500) {
        const cacheKey = `${parentPath}_entries`;
        
        try {
            // Get all entries (from cache if available)
            let allEntries = this.loadingCache.get(cacheKey);
            if (!allEntries) {
                allEntries = await this.getAllEntries(dirHandle, parentPath);
                this.loadingCache.set(cacheKey, allEntries);
            }
            
            // Calculate the batch to load
            const startIndex = currentLoaded;
            const endIndex = Math.min(startIndex + batchSize, allEntries.length);
            const batch = allEntries.slice(startIndex, endIndex);
            
            // Process batch
            const children = [];
            for (let i = 0; i < batch.length; i++) {
                const { entry, newPath } = batch[i];
                const childNode = await this.createChildNode(entry, newPath);
                if (childNode) {
                    children.push(childNode);
                }
                
                // Yield periodically
                if (i % 50 === 0) {
                    await performanceOptimizer.yieldToUI();
                }
            }
            
            // Sort the batch
            children.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return a.text.localeCompare(b.text);
            });
            
            const result = {
                children,
                newLoaded: endIndex,
                totalEntries: allEntries.length,
                hasMore: endIndex < allEntries.length
            };
            
            return result;
            
        } catch (error) {
            console.error('Error loading more items:', error);
            return {
                children: [],
                newLoaded: currentLoaded,
                totalEntries: currentLoaded,
                hasMore: false
            };
        }
    }

    /**
     * Get all entries from a directory handle
     */
    async getAllEntries(dirHandle, pathPrefix) {
        const entries = [];
        
        try {
            // Get root directory handle for ignore patterns
            const rootHandle = window.appState?.rootDirectoryHandle || dirHandle;
            const ignorePatterns = await getIgnorePatterns(rootHandle);
            
            for await (const entry of dirHandle.values()) {
                const newPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
                
                // Skip ignored files
                if (ignorePatterns.some(pattern => newPath.startsWith(pattern.replace(/\/$/, '')))) {
                    continue;
                }
                
                entries.push({ entry, newPath });
            }
        } catch (error) {
            console.error('Error getting directory entries:', error);
            // Return empty array if there's an error
        }
        
        return entries;
    }

    /**
     * Create a child node from directory entry
     */
    async createChildNode(entry, newPath) {
        try {
            if (entry.kind === 'directory') {
                return {
                    id: newPath,
                    text: entry.name,
                    type: 'folder',
                    children: true, // Lazy loading indicator
                    li_attr: { 'data-path': newPath, 'data-handle': entry, 'data-lazy': 'true' }
                };
            } else {
                return {
                    id: newPath,
                    text: entry.name,
                    type: 'file',
                    li_attr: { 'data-path': newPath, 'data-handle': entry }
                };
            }
        } catch (error) {
            console.error('Error creating child node:', error);
            return null;
        }
    }

    /**
     * Search within a large directory
     */
    async searchDirectory(dirHandle, parentPath, searchTerm, maxResults = 100) {
        const cacheKey = `${parentPath}_entries`;
        
        try {
            // Get all entries
            let allEntries = this.loadingCache.get(cacheKey);
            if (!allEntries) {
                allEntries = await this.getAllEntries(dirHandle, parentPath);
                this.loadingCache.set(cacheKey, allEntries);
            }
            
            // Filter by search term
            const searchLower = searchTerm.toLowerCase();
            const matchingEntries = allEntries.filter(({ entry }) => 
                entry.name.toLowerCase().includes(searchLower)
            ).slice(0, maxResults);
            
            // Convert to child nodes
            const children = [];
            for (const { entry, newPath } of matchingEntries) {
                const childNode = await this.createChildNode(entry, newPath);
                if (childNode) {
                    children.push(childNode);
                }
            }
            
            return {
                children,
                totalMatches: matchingEntries.length,
                hasMore: matchingEntries.length >= maxResults
            };
            
        } catch (error) {
            console.error('Error searching directory:', error);
            return {
                children: [],
                totalMatches: 0,
                hasMore: false
            };
        }
    }

    /**
     * Clear cache for specific directory
     */
    clearDirectoryCache(parentPath) {
        const cacheKey = `${parentPath}_entries`;
        this.loadingCache.delete(cacheKey);
        this.loadingStates.delete(parentPath);
    }

    /**
     * Clear all cache
     */
    clearAllCache() {
        this.loadingCache.clear();
        this.loadingStates.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cachedDirectories: this.loadingCache.size,
            loadingStates: this.loadingStates.size,
            totalMemoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Estimate memory usage of cached data
     */
    estimateMemoryUsage() {
        let totalSize = 0;
        for (const [key, entries] of this.loadingCache) {
            totalSize += key.length * 2; // Key size (UTF-16)
            totalSize += entries.length * 100; // Estimate 100 bytes per entry
        }
        return Math.round(totalSize / 1024); // Return in KB
    }

    /**
     * Set loading state for a directory
     */
    setLoadingState(path, isLoading) {
        this.loadingStates.set(path, isLoading);
    }

    /**
     * Get loading state for a directory
     */
    getLoadingState(path) {
        return this.loadingStates.get(path) || false;
    }
}

// Export singleton instance
export const progressiveLoader = new ProgressiveLoader();