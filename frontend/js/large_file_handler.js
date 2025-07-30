/**
 * Large File Handler
 * Specialized handling for files larger than 600KB
 */

import { performanceOptimizer } from './performance_optimizer.js';

class LargeFileHandler {
    constructor() {
        this.chunkSize = 512 * 1024; // 512KB chunks
        this.previewSize = 100 * 1024; // 100KB preview
        this.cache = performanceOptimizer.createSmartCache(20, 10 * 60 * 1000); // 20 files, 10 min TTL
    }

    /**
     * Check if file should be handled as large file
     */
    isLargeFile(fileSize) {
        return fileSize > 600 * 1024; // 600KB threshold
    }

    /**
     * Get file preview (first chunk) for large files
     */
    async getFilePreview(fileHandle, filePath) {
        const cacheKey = `preview_${filePath}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const file = await fileHandle.getFile();
            const stream = file.stream();
            const reader = stream.getReader();
            
            let preview = '';
            let bytesRead = 0;
            
            while (bytesRead < this.previewSize) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = new TextDecoder().decode(value);
                preview += chunk;
                bytesRead += value.length;
            }
            
            reader.releaseLock();
            
            const previewData = {
                content: preview,
                isPreview: true,
                totalSize: file.size,
                previewSize: bytesRead
            };
            
            this.cache.set(cacheKey, previewData);
            return previewData;
            
        } catch (error) {
            console.error('Error getting file preview:', error);
            throw error;
        }
    }

    /**
     * Load full file content in chunks
     */
    async loadFullFile(fileHandle, filePath, progressCallback = null) {
        const cacheKey = `full_${filePath}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            performanceOptimizer.startTimer(`loadFullFile_${filePath}`);
            
            const file = await fileHandle.getFile();
            const totalSize = file.size;
            const chunks = [];
            
            const stream = file.stream();
            const reader = stream.getReader();
            
            let bytesRead = 0;
            let chunkIndex = 0;
            
            while (bytesRead < totalSize) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = new TextDecoder().decode(value);
                chunks.push(chunk);
                bytesRead += value.length;
                chunkIndex++;
                
                // Progress callback
                if (progressCallback) {
                    progressCallback(bytesRead, totalSize, chunkIndex);
                }
                
                // Yield to UI periodically
                if (chunkIndex % 10 === 0) {
                    await performanceOptimizer.yieldToUI();
                }
            }
            
            reader.releaseLock();
            
            const fullContent = chunks.join('');
            const contentData = {
                content: fullContent,
                isPreview: false,
                totalSize: totalSize,
                chunks: chunks.length
            };
            
            this.cache.set(cacheKey, contentData);
            performanceOptimizer.endTimer(`loadFullFile_${filePath}`);
            
            return contentData;
            
        } catch (error) {
            console.error('Error loading full file:', error);
            throw error;
        }
    }

    /**
     * Stream file content for very large files (>10MB)
     */
    async *streamFileContent(fileHandle, filePath) {
        try {
            const file = await fileHandle.getFile();
            const stream = file.stream();
            const reader = stream.getReader();
            
            let chunkIndex = 0;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = new TextDecoder().decode(value);
                yield {
                    content: chunk,
                    index: chunkIndex++,
                    size: value.length
                };
                
                // Yield to UI between chunks
                await performanceOptimizer.yieldToUI();
            }
            
            reader.releaseLock();
            
        } catch (error) {
            console.error('Error streaming file:', error);
            throw error;
        }
    }

    /**
     * Optimize file content for Monaco editor
     */
    prepareForEditor(contentData, filePath) {
        const { content, totalSize } = contentData;
        
        // For very large files, limit lines shown initially
        if (totalSize > 5 * 1024 * 1024) { // 5MB+
            const lines = content.split('\n');
            if (lines.length > 10000) {
                const truncatedContent = lines.slice(0, 10000).join('\n');
                console.warn(`File ${filePath} truncated to 10,000 lines for editor performance`);
                
                return {
                    content: truncatedContent + '\n\n// ... (file truncated for performance)',
                    isTruncated: true,
                    originalLineCount: lines.length,
                    shownLines: 10000
                };
            }
        }
        
        return {
            content: content,
            isTruncated: false
        };
    }

    /**
     * Save large file content in chunks
     */
    async saveFileContent(fileHandle, content, progressCallback = null) {
        try {
            performanceOptimizer.startTimer('saveLargeFile');
            
            const writable = await fileHandle.createWritable();
            const contentSize = content.length;
            
            if (contentSize > this.chunkSize) {
                // Save in chunks for very large content
                let offset = 0;
                let chunkIndex = 0;
                
                while (offset < contentSize) {
                    const chunkEnd = Math.min(offset + this.chunkSize, contentSize);
                    const chunk = content.slice(offset, chunkEnd);
                    
                    await writable.write(chunk);
                    offset = chunkEnd;
                    chunkIndex++;
                    
                    if (progressCallback) {
                        progressCallback(offset, contentSize, chunkIndex);
                    }
                    
                    // Yield to UI periodically
                    if (chunkIndex % 5 === 0) {
                        await performanceOptimizer.yieldToUI();
                    }
                }
            } else {
                // Save directly for smaller content
                await writable.write(content);
            }
            
            await writable.close();
            performanceOptimizer.endTimer('saveLargeFile');
            
        } catch (error) {
            console.error('Error saving large file:', error);
            throw error;
        }
    }

    /**
     * Clear cache for specific file
     */
    clearFileCache(filePath) {
        this.cache.delete(`preview_${filePath}`);
        this.cache.delete(`full_${filePath}`);
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size(),
            chunkSize: this.chunkSize,
            previewSize: this.previewSize
        };
    }
}

// Export singleton instance
export const largeFileHandler = new LargeFileHandler();