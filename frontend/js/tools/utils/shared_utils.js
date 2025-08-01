/**
 * Shared utility functions for the tool system
 */

// Performance and memory monitoring globals
let memoryMonitor = null;
let performanceMetrics = new Map();
let adaptiveThresholds = null;

/**
 * Adaptive file size threshold system
 * Dynamically adjusts thresholds based on system capabilities and file type
 */
class AdaptiveThresholds {
    constructor() {
        this.baseThresholds = {
            small: 50000,      // 50KB - always process in memory
            medium: 256000,    // 256KB - current default
            large: 1000000,    // 1MB - use streaming
            xlarge: 10000000   // 10MB - maximum supported
        };
        
        this.fileTypeMultipliers = {
            '.js': 1.0,
            '.ts': 1.0,
            '.jsx': 1.0,
            '.tsx': 1.0,
            '.json': 0.8,      // JSON is more structured, can handle larger
            '.md': 1.2,        // Markdown can be more memory intensive
            '.txt': 0.9,
            '.css': 1.0,
            '.html': 1.1,
            '.xml': 1.2,
            '.svg': 1.3,
            '.log': 0.7,       // Log files are often repetitive
            'default': 1.0
        };
        
        this.systemCapability = this.detectSystemCapability();
        this.updateThresholds();
    }
    
    detectSystemCapability() {
        // Detect system memory and performance capabilities
        const memory = navigator.deviceMemory || 4; // Default to 4GB if not available
        const cores = navigator.hardwareConcurrency || 4;
        
        // Calculate capability score (0.5 to 2.0)
        let capability = 1.0;
        
        if (memory >= 8) capability *= 1.5;
        else if (memory <= 2) capability *= 0.7;
        
        if (cores >= 8) capability *= 1.2;
        else if (cores <= 2) capability *= 0.8;
        
        // Check if we're in a worker context (better for large operations)
        if (typeof WorkerGlobalScope !== 'undefined') {
            capability *= 1.3;
        }
        
        return Math.max(0.5, Math.min(2.0, capability));
    }
    
    updateThresholds() {
        this.currentThresholds = {};
        for (const [key, value] of Object.entries(this.baseThresholds)) {
            this.currentThresholds[key] = Math.floor(value * this.systemCapability);
        }
    }
    
    getThreshold(operation, fileExtension = '', fileSize = 0) {
        const multiplier = this.fileTypeMultipliers[fileExtension] || this.fileTypeMultipliers.default;
        
        let baseThreshold;
        switch (operation) {
            case 'read':
                baseThreshold = this.currentThresholds.medium;
                break;
            case 'write':
                baseThreshold = this.currentThresholds.medium;
                break;
            case 'analyze':
                baseThreshold = this.currentThresholds.small; // Analysis is more memory intensive
                break;
            case 'search':
                baseThreshold = this.currentThresholds.large; // Search can handle larger files
                break;
            case 'stream':
                return this.currentThresholds.xlarge; // Streaming threshold
            default:
                baseThreshold = this.currentThresholds.medium;
        }
        
        return Math.floor(baseThreshold * multiplier);
    }
    
    shouldUseStreaming(fileSize, operation, fileExtension = '') {
        const threshold = this.getThreshold('stream', fileExtension);
        return fileSize > threshold;
    }
    
    shouldUseChunking(fileSize, operation, fileExtension = '') {
        const threshold = this.getThreshold(operation, fileExtension);
        return fileSize > threshold;
    }
    
    getOptimalChunkSize(fileSize, operation) {
        // Calculate optimal chunk size based on file size and operation
        if (fileSize < this.currentThresholds.small) {
            return fileSize; // Process entire file
        }
        
        if (fileSize < this.currentThresholds.medium) {
            return Math.floor(fileSize / 2); // Split in half
        }
        
        if (fileSize < this.currentThresholds.large) {
            return Math.floor(this.currentThresholds.small * this.systemCapability);
        }
        
        // For very large files, use smaller chunks
        return Math.floor(this.currentThresholds.small * 0.5 * this.systemCapability);
    }
}

/**
 * Memory usage monitoring and cleanup system
 */
class MemoryMonitor {
    constructor() {
        this.memoryUsage = new Map();
        this.cleanupCallbacks = new Set();
        this.maxMemoryThreshold = 0.8; // 80% of available memory
        this.checkInterval = 5000; // Check every 5 seconds
        this.isMonitoring = false;
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.monitorInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, this.checkInterval);
    }
    
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.isMonitoring = false;
    }
    
    checkMemoryUsage() {
        if (!performance.memory) return;
        
        const memory = performance.memory;
        const usedRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        // Store memory metrics
        this.memoryUsage.set(Date.now(), {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            ratio: usedRatio
        });
        
        // Keep only last 100 measurements
        if (this.memoryUsage.size > 100) {
            const oldestKey = this.memoryUsage.keys().next().value;
            this.memoryUsage.delete(oldestKey);
        }
        
        // Trigger cleanup if memory usage is high
        if (usedRatio > this.maxMemoryThreshold) {
            console.warn(`[MemoryMonitor] High memory usage detected: ${Math.round(usedRatio * 100)}%`);
            this.triggerCleanup();
        }
    }
    
    registerCleanupCallback(callback) {
        this.cleanupCallbacks.add(callback);
    }
    
    unregisterCleanupCallback(callback) {
        this.cleanupCallbacks.delete(callback);
    }
    
    triggerCleanup() {
        console.log('[MemoryMonitor] Triggering memory cleanup...');
        
        // Execute all cleanup callbacks
        for (const callback of this.cleanupCallbacks) {
            try {
                callback();
            } catch (error) {
                console.warn('[MemoryMonitor] Cleanup callback failed:', error);
            }
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }
    
    getMemoryStats() {
        if (!performance.memory) {
            return { available: false };
        }
        
        const memory = performance.memory;
        const recent = Array.from(this.memoryUsage.values()).slice(-10);
        
        return {
            available: true,
            current: {
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize,
                limit: memory.jsHeapSizeLimit,
                ratio: memory.usedJSHeapSize / memory.jsHeapSizeLimit
            },
            trend: recent.length > 1 ? {
                averageRatio: recent.reduce((sum, m) => sum + m.ratio, 0) / recent.length,
                increasing: recent[recent.length - 1].ratio > recent[0].ratio
            } : null
        };
    }
    
    shouldOptimizeForMemory() {
        const stats = this.getMemoryStats();
        return stats.available && stats.current.ratio > 0.6; // 60% threshold for optimization
    }
}

// Initialize global instances
function initializePerformanceSystem() {
    if (!adaptiveThresholds) {
        adaptiveThresholds = new AdaptiveThresholds();
    }
    if (!memoryMonitor) {
        memoryMonitor = new MemoryMonitor();
    }
}

/**
 * LRU (Least Recently Used) Cache with memory-aware eviction
 */
class LRUCache {
    constructor(maxSize = 100, maxMemoryMB = 50) {
        this.maxSize = maxSize;
        this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
        this.cache = new Map();
        this.accessOrder = new Map(); // Track access order
        this.memoryUsage = 0;
        this.hitCount = 0;
        this.missCount = 0;
    }
    
    get(key) {
        if (this.cache.has(key)) {
            // Update access order
            this.accessOrder.delete(key);
            this.accessOrder.set(key, Date.now());
            this.hitCount++;
            return this.cache.get(key);
        }
        
        this.missCount++;
        return null;
    }
    
    set(key, value, estimatedSize = 0) {
        // If key already exists, remove it first
        if (this.cache.has(key)) {
            this.delete(key);
        }
        
        // Estimate memory usage if not provided
        if (estimatedSize === 0) {
            estimatedSize = this.estimateSize(value);
        }
        
        // Evict items if necessary
        this.evictIfNecessary(estimatedSize);
        
        // Add new item
        this.cache.set(key, {
            value: value,
            size: estimatedSize,
            timestamp: Date.now(),
            accessCount: 1
        });
        
        this.accessOrder.set(key, Date.now());
        this.memoryUsage += estimatedSize;
    }
    
    delete(key) {
        if (this.cache.has(key)) {
            const item = this.cache.get(key);
            this.memoryUsage -= item.size;
            this.cache.delete(key);
            this.accessOrder.delete(key);
            return true;
        }
        return false;
    }
    
    clear() {
        this.cache.clear();
        this.accessOrder.clear();
        this.memoryUsage = 0;
        this.hitCount = 0;
        this.missCount = 0;
    }
    
    evictIfNecessary(newItemSize = 0) {
        // Check if we need to evict based on size or memory
        while ((this.cache.size >= this.maxSize) ||
               (this.memoryUsage + newItemSize > this.maxMemoryBytes)) {
            
            if (this.cache.size === 0) break;
            
            // Find least recently used item
            let oldestKey = null;
            let oldestTime = Infinity;
            
            for (const [key, time] of this.accessOrder) {
                if (time < oldestTime) {
                    oldestTime = time;
                    oldestKey = key;
                }
            }
            
            if (oldestKey) {
                console.log(`[LRUCache] Evicting item: ${oldestKey}`);
                this.delete(oldestKey);
            } else {
                break;
            }
        }
    }
    
    estimateSize(value) {
        if (typeof value === 'string') {
            return value.length * 2; // Rough estimate for UTF-16
        } else if (typeof value === 'object' && value !== null) {
            try {
                return JSON.stringify(value).length * 2;
            } catch (e) {
                return 1000; // Default estimate for complex objects
            }
        } else {
            return 100; // Default for primitives
        }
    }
    
    getStats() {
        const hitRate = this.hitCount + this.missCount > 0
            ? this.hitCount / (this.hitCount + this.missCount)
            : 0;
            
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            memoryUsage: this.memoryUsage,
            maxMemoryBytes: this.maxMemoryBytes,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: hitRate,
            memoryUsagePercent: (this.memoryUsage / this.maxMemoryBytes) * 100
        };
    }
    
    // Memory-aware cleanup
    cleanup() {
        const memoryMonitor = getMemoryMonitor();
        if (memoryMonitor.shouldOptimizeForMemory()) {
            // Aggressive cleanup - remove 50% of items
            const targetSize = Math.floor(this.cache.size * 0.5);
            while (this.cache.size > targetSize) {
                this.evictIfNecessary();
            }
            console.log(`[LRUCache] Memory cleanup: reduced cache size to ${this.cache.size}`);
        }
    }
}

/**
 * Performance-aware cache management
 */
class CacheManager {
    constructor() {
        this.caches = new Map();
        this.initializeCaches();
        
        // Register cleanup with memory monitor
        const memoryMonitor = getMemoryMonitor();
        memoryMonitor.registerCleanupCallback(() => this.performCleanup());
    }
    
    initializeCaches() {
        // File content cache - larger memory allowance
        this.caches.set('fileContent', new LRUCache(50, 100)); // 100MB
        
        // AST cache - moderate memory usage
        this.caches.set('ast', new LRUCache(30, 50)); // 50MB
        
        // Validation cache - smaller, frequently accessed
        this.caches.set('validation', new LRUCache(100, 20)); // 20MB
        
        // Search results cache
        this.caches.set('search', new LRUCache(20, 30)); // 30MB
        
        // Analysis cache
        this.caches.set('analysis', new LRUCache(25, 40)); // 40MB
    }
    
    getCache(type) {
        return this.caches.get(type);
    }
    
    performCleanup() {
        console.log('[CacheManager] Performing memory cleanup across all caches');
        for (const [type, cache] of this.caches) {
            cache.cleanup();
        }
    }
    
    getGlobalStats() {
        const stats = {};
        let totalMemory = 0;
        let totalHitRate = 0;
        let cacheCount = 0;
        
        for (const [type, cache] of this.caches) {
            const cacheStats = cache.getStats();
            stats[type] = cacheStats;
            totalMemory += cacheStats.memoryUsage;
            totalHitRate += cacheStats.hitRate;
            cacheCount++;
        }
        
        return {
            caches: stats,
            totalMemoryUsage: totalMemory,
            totalMemoryMB: Math.round(totalMemory / (1024 * 1024) * 100) / 100,
            averageHitRate: cacheCount > 0 ? totalHitRate / cacheCount : 0
        };
    }
}

// Global cache manager
let cacheManager = null;

// Export functions to access the system
export function getAdaptiveThresholds() {
    if (!adaptiveThresholds) initializePerformanceSystem();
    return adaptiveThresholds;
}

export function getMemoryMonitor() {
    if (!memoryMonitor) initializePerformanceSystem();
    return memoryMonitor;
}

export function getCacheManager() {
    if (!cacheManager) {
        initializePerformanceSystem();
        cacheManager = new CacheManager();
    }
    return cacheManager;
}

/**
 * Strips markdown code block formatting from content
 * @param {string} content - Content that may contain markdown code blocks
 * @returns {string} - Clean content without markdown formatting
 */
export function stripMarkdownCodeBlock(content) {
   if (typeof content !== 'string') {
       return content;
   }
   // Use a regular expression to match the code block format (e.g., ```javascript ... ```)
   const match = content.match(/^```(?:\w+)?\n([\s\S]+)\n```$/);
   // If it matches, return the captured group (the actual code). Otherwise, return the original content.
   return match ? match[1] : content;
}

/**
 * Unescapes HTML entities from text
 * @param {string} text - Text containing HTML entities
 * @returns {string} - Decoded text
 */
export function unescapeHtmlEntities(text) {
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

/**
 * Enhanced syntax validation using workers and caching
 * @param {string} filename - Name of the file to validate
 * @param {string} content - Content to validate
 * @returns {Promise<Object>} - Validation result
 */
export async function validateSyntaxBeforeWrite(filename, content) {
    try {
        // Import required modules dynamically to avoid circular dependencies
        const { operationCache } = await import('../../../cache_manager.js');
        const { workerManager } = await import('../../../worker_manager.js');
        
        // Use cached validation if available
        const validation = await operationCache.cacheValidation(filename, content, async (content, filename) => {
            // Use worker for validation to avoid blocking main thread
            return await workerManager.processFile('validate', {
                filename,
                content
            });
        });

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
    } catch (error) {
        console.warn(`Validation failed for ${filename}:`, error.message);
        // Fallback to basic validation
        return { isValid: true, warnings: [`Validation service unavailable: ${error.message}`] };
    }
}

/**
 * Streaming file processing for large files
 * @param {string} filename - Name of the file
 * @param {string} content - Content to process
 * @param {number} chunkSize - Size of each chunk (default: 50000)
 * @returns {Promise<string>} - Processed content
 */
export async function streamFileUpdate(filename, content, chunkSize = 50000) {
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

/**
 * Finds the best match for a block of search lines within a file's content.
 * @param {string[]} contentLines - The lines of the file content.
 * @param {string[]} searchLines - The lines to search for.
 * @param {number} targetLine - The 1-based line number to start searching from.
 * @returns {{index: number, score: number, strategy: string}|null} - The best match found or null.
 */
export function findBestMatch(contentLines, searchLines, targetLine) {
    const targetIndex = targetLine - 1;

    // Strategy 1: Exact match at the specified line
    let exactMatch = true;
    for (let i = 0; i < searchLines.length; i++) {
        if (contentLines[targetIndex + i] !== searchLines[i]) {
            exactMatch = false;
            break;
        }
    }
    if (exactMatch) {
        return { index: targetIndex, score: 1.0, strategy: 'exact' };
    }

    // Strategy 2: Fuzzy match (trimmed content) nearby
    const searchRange = 10;
    for (let i = -searchRange; i <= searchRange; i++) {
        const currentIndex = targetIndex + i;
        if (currentIndex < 0 || currentIndex + searchLines.length > contentLines.length) continue;

        let fuzzyMatch = true;
        for (let j = 0; j < searchLines.length; j++) {
            if ((contentLines[currentIndex + j] || '').trim() !== (searchLines[j] || '').trim()) {
                fuzzyMatch = false;
                break;
            }
        }
        if (fuzzyMatch) {
            return { index: currentIndex, score: 0.9, strategy: 'fuzzy' };
        }
    }

    return null;
}

/**
 * Comprehensive error analysis and categorization system
 * Analyzes errors to determine type, severity, and recovery strategies
 * @param {Error|string} error - The error to analyze
 * @param {string} context - Context about what operation was being performed
 * @param {string} toolName - Name of the tool that encountered the error
 * @returns {Object} Detailed error analysis with recovery suggestions
 */
export function analyzeError(error, context = '', toolName = '') {
    const errorMessage = typeof error === 'string' ? error : error.message || error.toString();
    const errorStack = error.stack || '';
    
    // Error categorization patterns
    const errorPatterns = {
        // Network-related errors
        network: {
            patterns: [
                /network|fetch|connection|timeout|cors|dns|socket/i,
                /failed to fetch/i,
                /net::/i,
                /ERR_NETWORK/i,
                /ERR_INTERNET_DISCONNECTED/i,
                /ERR_CONNECTION_REFUSED/i,
                /ERR_CONNECTION_TIMED_OUT/i
            ],
            severity: 'medium',
            category: 'network',
            retryable: true,
            maxRetries: 3,
            backoffStrategy: 'exponential'
        },
        
        // File system errors
        filesystem: {
            patterns: [
                /file|directory|path|permission|access|exists|not found/i,
                /ENOENT|EACCES|EPERM|EISDIR|ENOTDIR/i,
                /NotFoundError|NotAllowedError|SecurityError/i,
                /User activation is required/i,
                /Permission.*denied/i
            ],
            severity: 'high',
            category: 'filesystem',
            retryable: false,
            requiresUserAction: true
        },
        
        // Syntax and parsing errors
        syntax: {
            patterns: [
                /syntax|parse|unexpected token|invalid|malformed/i,
                /SyntaxError|ParseError/i,
                /JSON\.parse/i,
                /Unexpected end of/i
            ],
            severity: 'high',
            category: 'syntax',
            retryable: false,
            requiresCodeFix: true
        },
        
        // Memory and resource errors
        resource: {
            patterns: [
                /memory|heap|stack|resource|quota|limit/i,
                /out of memory/i,
                /Maximum call stack/i,
                /QuotaExceededError/i
            ],
            severity: 'critical',
            category: 'resource',
            retryable: true,
            maxRetries: 1,
            requiresOptimization: true
        },
        
        // Timeout errors
        timeout: {
            patterns: [
                /timeout|timed out|time limit|deadline/i,
                /TimeoutError/i,
                /Operation.*cancelled/i
            ],
            severity: 'medium',
            category: 'timeout',
            retryable: true,
            maxRetries: 2,
            backoffStrategy: 'progressive'
        },
        
        // Authentication and authorization errors
        auth: {
            patterns: [
                /auth|unauthorized|forbidden|credential|token|login/i,
                /401|403/i,
                /Unauthorized|Forbidden/i
            ],
            severity: 'high',
            category: 'auth',
            retryable: false,
            requiresUserAction: true
        },
        
        // Validation errors
        validation: {
            patterns: [
                /validation|invalid.*parameter|required.*parameter|missing.*parameter/i,
                /ValidationError|TypeError.*parameter/i,
                /must be.*type|expected.*got/i
            ],
            severity: 'medium',
            category: 'validation',
            retryable: false,
            requiresParameterFix: true
        },
        
        // Cancellation errors
        cancellation: {
            patterns: [
                /cancel|abort|interrupt/i,
                /CancelledError|AbortError/i,
                /Operation.*cancelled/i
            ],
            severity: 'low',
            category: 'cancellation',
            retryable: true,
            maxRetries: 1
        }
    };
    
    // Analyze error against patterns
    let matchedCategory = null;
    let matchedPattern = null;
    
    for (const [categoryName, categoryInfo] of Object.entries(errorPatterns)) {
        for (const pattern of categoryInfo.patterns) {
            if (pattern.test(errorMessage) || pattern.test(errorStack)) {
                matchedCategory = categoryInfo;
                matchedPattern = pattern;
                break;
            }
        }
        if (matchedCategory) break;
    }
    
    // Default category for unmatched errors
    if (!matchedCategory) {
        matchedCategory = {
            severity: 'medium',
            category: 'unknown',
            retryable: false,
            requiresInvestigation: true
        };
    }
    
    // Generate recovery suggestions based on category and context
    const recoverySuggestions = generateRecoverySuggestions(
        matchedCategory.category,
        errorMessage,
        context,
        toolName
    );
    
    // Create comprehensive error analysis
    const analysis = {
        originalError: error,
        message: errorMessage,
        category: matchedCategory.category,
        severity: matchedCategory.severity,
        retryable: matchedCategory.retryable || false,
        maxRetries: matchedCategory.maxRetries || 0,
        backoffStrategy: matchedCategory.backoffStrategy || 'linear',
        requiresUserAction: matchedCategory.requiresUserAction || false,
        requiresCodeFix: matchedCategory.requiresCodeFix || false,
        requiresParameterFix: matchedCategory.requiresParameterFix || false,
        requiresOptimization: matchedCategory.requiresOptimization || false,
        requiresInvestigation: matchedCategory.requiresInvestigation || false,
        context: context,
        toolName: toolName,
        timestamp: new Date().toISOString(),
        recoverySuggestions: recoverySuggestions,
        matchedPattern: matchedPattern ? matchedPattern.toString() : null
    };
    
    return analysis;
}

/**
 * Generates specific recovery suggestions based on error category and context
 * @param {string} category - Error category
 * @param {string} errorMessage - Original error message
 * @param {string} context - Operation context
 * @param {string} toolName - Tool name
 * @returns {Array<string>} Array of recovery suggestions
 */
function generateRecoverySuggestions(category, errorMessage, context, toolName) {
    const suggestions = [];
    
    switch (category) {
        case 'network':
            suggestions.push('Check your internet connection and try again');
            suggestions.push('The server might be temporarily unavailable - retry in a few moments');
            if (toolName.includes('research') || toolName.includes('url')) {
                suggestions.push('Try using a different search engine or URL source');
                suggestions.push('Check if the target website is accessible in your browser');
            }
            suggestions.push('Consider using a VPN if the resource is geo-blocked');
            break;
            
        case 'filesystem':
            if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
                suggestions.push('Click in the editor or file tree to activate user permissions');
                suggestions.push('Ensure you have write permissions to the target directory');
                suggestions.push('Try refreshing the page and reopening the project folder');
            } else if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
                suggestions.push('Verify the file path is correct and the file exists');
                suggestions.push('Check if the file was moved or renamed recently');
                suggestions.push('Use the file tree to navigate to the correct location');
            } else {
                suggestions.push('Check file system permissions and available disk space');
                suggestions.push('Ensure the target directory exists and is accessible');
            }
            break;
            
        case 'syntax':
            suggestions.push('Review the code for syntax errors before saving');
            suggestions.push('Check for missing brackets, quotes, or semicolons');
            suggestions.push('Use the editor\'s syntax highlighting to identify issues');
            if (toolName.includes('diff') || toolName.includes('edit')) {
                suggestions.push('Verify the diff format is correct with proper SEARCH/REPLACE blocks');
                suggestions.push('Ensure line numbers in the diff match the actual file content');
            }
            break;
            
        case 'resource':
            suggestions.push('The operation requires too much memory - try processing smaller chunks');
            suggestions.push('Close other browser tabs to free up memory');
            suggestions.push('Consider using streaming or batch processing for large files');
            if (toolName.includes('file') || toolName.includes('read')) {
                suggestions.push('Use read_file_lines for specific sections instead of reading entire large files');
                suggestions.push('Enable file streaming for better memory management');
            }
            break;
            
        case 'timeout':
            suggestions.push('The operation took too long - try again with a shorter scope');
            suggestions.push('Break down large operations into smaller, manageable chunks');
            if (toolName.includes('research')) {
                suggestions.push('Reduce the number of URLs to research or search results to process');
                suggestions.push('Use more specific search terms to get faster, more relevant results');
            }
            suggestions.push('Check your internet connection speed for network operations');
            break;
            
        case 'auth':
            suggestions.push('Check if you need to log in or refresh your authentication');
            suggestions.push('Verify API keys or credentials are valid and not expired');
            suggestions.push('Ensure you have the necessary permissions for this operation');
            break;
            
        case 'validation':
            suggestions.push('Check that all required parameters are provided');
            suggestions.push('Verify parameter types match the expected format');
            suggestions.push('Review the tool documentation for correct parameter usage');
            if (context) {
                suggestions.push(`Review the parameters for the ${context} operation`);
            }
            break;
            
        case 'cancellation':
            suggestions.push('The operation was cancelled - you can retry if needed');
            suggestions.push('Check if you accidentally cancelled the operation');
            break;
            
        default:
            suggestions.push('This is an unexpected error - please try the operation again');
            suggestions.push('If the error persists, try refreshing the page');
            suggestions.push('Check the browser console for additional error details');
            suggestions.push('Consider reporting this error if it continues to occur');
            break;
    }
    
    return suggestions;
}

/**
 * Automatic retry logic with exponential backoff
 * @param {Function} operation - The operation to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the operation or final error
 */
export async function withRetry(operation, options = {}) {
    const {
        maxRetries = 3,
        backoffStrategy = 'exponential',
        baseDelay = 1000,
        maxDelay = 30000,
        retryCondition = null,
        onRetry = null,
        context = '',
        toolName = ''
    } = options;
    
    let lastError = null;
    let attempt = 0;
    
    while (attempt <= maxRetries) {
        try {
            const result = await operation();
            
            // Log successful retry if this wasn't the first attempt
            if (attempt > 0) {
                console.log(`[Retry Success] Operation succeeded on attempt ${attempt + 1}/${maxRetries + 1}`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            attempt++;
            
            // Analyze the error to determine if it's retryable
            const errorAnalysis = analyzeError(error, context, toolName);
            
            // Check if we should retry based on error analysis
            const shouldRetry = retryCondition
                ? retryCondition(error, attempt, errorAnalysis)
                : errorAnalysis.retryable && attempt <= maxRetries;
            
            if (!shouldRetry || attempt > maxRetries) {
                console.error(`[Retry Failed] Operation failed after ${attempt} attempts:`, error.message);
                throw error;
            }
            
            // Calculate delay based on backoff strategy
            let delay = baseDelay;
            if (backoffStrategy === 'exponential') {
                delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
            } else if (backoffStrategy === 'linear') {
                delay = Math.min(baseDelay * attempt, maxDelay);
            } else if (backoffStrategy === 'progressive') {
                delay = Math.min(baseDelay + (attempt * 2000), maxDelay);
            }
            
            // Add jitter to prevent thundering herd
            delay += Math.random() * 1000;
            
            console.warn(`[Retry ${attempt}/${maxRetries}] Operation failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`);
            
            // Call retry callback if provided
            if (onRetry) {
                try {
                    await onRetry(error, attempt, delay, errorAnalysis);
                } catch (callbackError) {
                    console.warn('Retry callback failed:', callbackError.message);
                }
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

/**
 * Progressive timeout handler with user feedback
 * @param {Promise} operation - The operation to execute with timeout
 * @param {Object} options - Timeout options
 * @returns {Promise} Result of the operation or timeout error
 */
export async function withProgressiveTimeout(operation, options = {}) {
    const {
        initialTimeout = 30000,
        maxTimeout = 300000,
        progressCallback = null,
        warningThresholds = [0.5, 0.75, 0.9],
        context = '',
        toolName = ''
    } = options;
    
    let currentTimeout = initialTimeout;
    let startTime = Date.now();
    let warningsSent = new Set();
    
    // Create progress monitoring
    const progressMonitor = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / currentTimeout;
        
        // Send warnings at specified thresholds
        for (const threshold of warningThresholds) {
            if (progress >= threshold && !warningsSent.has(threshold)) {
                warningsSent.add(threshold);
                const remainingTime = Math.max(0, currentTimeout - elapsed);
                
                if (progressCallback) {
                    progressCallback({
                        type: 'warning',
                        progress: progress,
                        elapsed: elapsed,
                        remaining: remainingTime,
                        threshold: threshold,
                        message: `Operation is taking longer than expected (${Math.round(progress * 100)}% of timeout). ${Math.round(remainingTime / 1000)}s remaining.`
                    });
                }
                
                console.warn(`[Timeout Warning] ${context || toolName}: ${Math.round(progress * 100)}% of timeout reached. ${Math.round(remainingTime / 1000)}s remaining.`);
            }
        }
    }, 1000);
    
    try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${currentTimeout}ms: ${context || toolName}`));
            }, currentTimeout);
        });
        
        // Race between operation and timeout
        const result = await Promise.race([operation, timeoutPromise]);
        
        clearInterval(progressMonitor);
        
        const totalTime = Date.now() - startTime;
        if (progressCallback) {
            progressCallback({
                type: 'success',
                progress: 1,
                elapsed: totalTime,
                message: `Operation completed successfully in ${Math.round(totalTime / 1000)}s`
            });
        }
        
        return result;
    } catch (error) {
        clearInterval(progressMonitor);
        
        const totalTime = Date.now() - startTime;
        if (progressCallback) {
            progressCallback({
                type: 'error',
                progress: totalTime / currentTimeout,
                elapsed: totalTime,
                error: error,
                message: `Operation failed after ${Math.round(totalTime / 1000)}s: ${error.message}`
            });
        }
        
        throw error;
    }
}

/**
 * Enhanced error context builder
 * @param {string} operation - The operation being performed
 * @param {string} toolName - Name of the tool
 * @param {Object} parameters - Operation parameters
 * @param {Object} additionalContext - Additional context information
 * @returns {string} Formatted error context
 */
export function buildErrorContext(operation, toolName, parameters = {}, additionalContext = {}) {
    const contextParts = [];
    
    if (toolName) {
        contextParts.push(`Tool: ${toolName}`);
    }
    
    if (operation) {
        contextParts.push(`Operation: ${operation}`);
    }
    
    // Add relevant parameters (excluding sensitive data)
    const safeParams = {};
    for (const [key, value] of Object.entries(parameters)) {
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key')) {
            safeParams[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.length > 100) {
            safeParams[key] = value.substring(0, 100) + '...';
        } else {
            safeParams[key] = value;
        }
    }
    
    if (Object.keys(safeParams).length > 0) {
        contextParts.push(`Parameters: ${JSON.stringify(safeParams)}`);
    }
    
    // Add additional context
    for (const [key, value] of Object.entries(additionalContext)) {
        contextParts.push(`${key}: ${value}`);
    }
    
    return contextParts.join(' | ');
}
/**
 * ============================================================================
 * SECURITY AND VALIDATION UTILITIES
 * ============================================================================
 */

/**
 * Comprehensive input sanitization and validation system
 */
class SecurityValidator {
    constructor() {
        this.maxInputLength = 1000000; // 1MB max input length
        this.maxPathLength = 4096; // Maximum path length
        this.maxUrlLength = 2048; // Maximum URL length
        this.allowedFileExtensions = new Set([
            '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.css', '.html',
            '.xml', '.svg', '.log', '.yml', '.yaml', '.toml', '.ini', '.conf',
            '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb',
            '.go', '.rs', '.sh', '.bat', '.ps1', '.sql', '.dockerfile'
        ]);
        this.dangerousPatterns = [
            // Path traversal patterns
            /\.\.[\/\\]/g,
            /\.\.[\/\\].*[\/\\]/g,
            /[\/\\]\.\.[\/\\]/g,
            // Null bytes
            /\0/g,
            // Control characters
            /[\x00-\x1f\x7f-\x9f]/g,
            // Script injection patterns
            /<script[^>]*>.*?<\/script>/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /<object[^>]*>.*?<\/object>/gi,
            /<embed[^>]*>/gi,
            /javascript:/gi,
            /vbscript:/gi,
            /data:text\/html/gi,
            // SQL injection patterns
            /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
            // Command injection patterns
            /[;&|`$(){}[\]]/g
        ];
    }

    /**
     * Sanitizes file paths to prevent directory traversal attacks
     * @param {string} filePath - The file path to sanitize
     * @returns {string} - Sanitized file path
     * @throws {Error} - If path is invalid or dangerous
     */
    sanitizeFilePath(filePath) {
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('File path must be a non-empty string');
        }

        if (filePath.length > this.maxPathLength) {
            throw new Error(`File path exceeds maximum length of ${this.maxPathLength} characters`);
        }

        // Remove null bytes and control characters
        let sanitized = filePath.replace(/\0/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');

        // Check for path traversal attempts
        if (sanitized.includes('..')) {
            throw new Error('Path traversal detected: ".." is not allowed in file paths');
        }

        // Normalize path separators
        sanitized = sanitized.replace(/\\/g, '/');

        // Remove leading slashes to prevent absolute path access
        sanitized = sanitized.replace(/^\/+/, '');

        // Check for dangerous patterns
        for (const pattern of this.dangerousPatterns) {
            if (pattern.test(sanitized)) {
                throw new Error(`Dangerous pattern detected in file path: ${pattern}`);
            }
        }

        // Validate file extension if present
        const extension = sanitized.substring(sanitized.lastIndexOf('.'));
        if (extension && !this.allowedFileExtensions.has(extension.toLowerCase())) {
            console.warn(`Warning: File extension '${extension}' is not in the allowed list`);
        }

        return sanitized;
    }

    /**
     * Sanitizes content to prevent XSS and injection attacks
     * @param {string} content - Content to sanitize
     * @param {Object} options - Sanitization options
     * @returns {string} - Sanitized content
     */
    sanitizeContent(content, options = {}) {
        if (!content || typeof content !== 'string') {
            return content;
        }

        const {
            allowHtml = false,
            allowScripts = false,
            maxLength = this.maxInputLength,
            preserveFormatting = true
        } = options;

        if (content.length > maxLength) {
            throw new Error(`Content exceeds maximum length of ${maxLength} characters`);
        }

        let sanitized = content;

        // Remove null bytes and dangerous control characters
        sanitized = sanitized.replace(/\0/g, '');

        if (!allowScripts) {
            // Remove script tags and javascript: URLs
            sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
            sanitized = sanitized.replace(/javascript:/gi, 'blocked-javascript:');
            sanitized = sanitized.replace(/vbscript:/gi, 'blocked-vbscript:');
            sanitized = sanitized.replace(/data:text\/html/gi, 'blocked-data-html');
        }

        if (!allowHtml) {
            // Escape HTML entities
            sanitized = sanitized
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
        }

        // Remove dangerous iframe, object, and embed tags
        sanitized = sanitized.replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
        sanitized = sanitized.replace(/<object[^>]*>.*?<\/object>/gi, '');
        sanitized = sanitized.replace(/<embed[^>]*>/gi, '');

        return sanitized;
    }

    /**
     * Validates and sanitizes URLs
     * @param {string} url - URL to validate
     * @returns {string} - Sanitized URL
     * @throws {Error} - If URL is invalid or dangerous
     */
    sanitizeUrl(url) {
        if (!url || typeof url !== 'string') {
            throw new Error('URL must be a non-empty string');
        }

        if (url.length > this.maxUrlLength) {
            throw new Error(`URL exceeds maximum length of ${this.maxUrlLength} characters`);
        }

        // Remove null bytes and control characters
        let sanitized = url.replace(/\0/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, '');

        // Check for dangerous protocols
        const dangerousProtocols = ['javascript:', 'vbscript:', 'data:', 'file:', 'ftp:'];
        const lowerUrl = sanitized.toLowerCase();
        
        for (const protocol of dangerousProtocols) {
            if (lowerUrl.startsWith(protocol)) {
                throw new Error(`Dangerous protocol detected: ${protocol}`);
            }
        }

        // Ensure URL starts with http or https
        if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
            throw new Error('URL must start with http:// or https://');
        }

        try {
            // Validate URL structure
            const urlObj = new URL(sanitized);
            
            // Check for suspicious domains
            const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
            if (suspiciousDomains.includes(urlObj.hostname.toLowerCase())) {
                throw new Error('Access to local/internal URLs is not allowed');
            }

            // Check for private IP ranges
            if (this.isPrivateIP(urlObj.hostname)) {
                throw new Error('Access to private IP addresses is not allowed');
            }

            return urlObj.toString();
        } catch (error) {
            if (error.message.includes('not allowed')) {
                throw error;
            }
            throw new Error(`Invalid URL format: ${error.message}`);
        }
    }

    /**
     * Checks if an IP address is in a private range
     * @param {string} hostname - Hostname to check
     * @returns {boolean} - True if private IP
     */
    isPrivateIP(hostname) {
        // IPv4 private ranges
        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = hostname.match(ipv4Regex);
        
        if (match) {
            const [, a, b, c, d] = match.map(Number);
            
            // 10.0.0.0/8
            if (a === 10) return true;
            
            // 172.16.0.0/12
            if (a === 172 && b >= 16 && b <= 31) return true;
            
            // 192.168.0.0/16
            if (a === 192 && b === 168) return true;
            
            // 127.0.0.0/8 (loopback)
            if (a === 127) return true;
        }

        return false;
    }

    /**
     * Validates parameter types and values
     * @param {Object} params - Parameters to validate
     * @param {Object} schema - Validation schema
     * @throws {Error} - If validation fails
     */
    validateParameters(params, schema) {
        for (const [key, rules] of Object.entries(schema)) {
            const value = params[key];

            // Check required parameters
            if (rules.required && (value === undefined || value === null)) {
                throw new Error(`Required parameter '${key}' is missing`);
            }

            if (value !== undefined && value !== null) {
                // Type validation
                if (rules.type && typeof value !== rules.type) {
                    if (rules.type === 'array' && !Array.isArray(value)) {
                        throw new Error(`Parameter '${key}' must be an array`);
                    } else if (rules.type !== 'array' && typeof value !== rules.type) {
                        throw new Error(`Parameter '${key}' must be of type ${rules.type}`);
                    }
                }

                // Length validation
                if (rules.maxLength && value.length > rules.maxLength) {
                    throw new Error(`Parameter '${key}' exceeds maximum length of ${rules.maxLength}`);
                }

                if (rules.minLength && value.length < rules.minLength) {
                    throw new Error(`Parameter '${key}' is below minimum length of ${rules.minLength}`);
                }

                // Value validation
                if (rules.allowedValues && !rules.allowedValues.includes(value)) {
                    throw new Error(`Parameter '${key}' must be one of: ${rules.allowedValues.join(', ')}`);
                }

                // Custom validation
                if (rules.validator && !rules.validator(value)) {
                    throw new Error(`Parameter '${key}' failed custom validation`);
                }
            }
        }
    }
}

/**
 * Resource usage monitoring and limiting system
 */
class ResourceLimiter {
    constructor() {
        this.operationCounts = new Map();
        this.operationTimestamps = new Map();
        this.rateLimits = {
            file_read: { maxPerMinute: 60, maxPerHour: 1000 },
            file_write: { maxPerMinute: 30, maxPerHour: 500 },
            web_request: { maxPerMinute: 20, maxPerHour: 200 },
            search: { maxPerMinute: 10, maxPerHour: 100 },
            analysis: { maxPerMinute: 15, maxPerHour: 150 }
        };
        this.resourceUsage = {
            memoryUsage: 0,
            cpuTime: 0,
            networkRequests: 0,
            fileOperations: 0
        };
        this.maxResourceLimits = {
            maxMemoryMB: 500,
            maxCpuTimeMs: 30000,
            maxNetworkRequests: 100,
            maxFileOperations: 200
        };
    }

    /**
     * Checks if an operation is allowed based on rate limits
     * @param {string} operation - Operation type
     * @returns {boolean} - True if operation is allowed
     */
    checkRateLimit(operation) {
        const now = Date.now();
        const limits = this.rateLimits[operation];
        
        if (!limits) {
            console.warn(`No rate limit defined for operation: ${operation}`);
            return true;
        }

        // Initialize tracking for this operation
        if (!this.operationCounts.has(operation)) {
            this.operationCounts.set(operation, []);
            this.operationTimestamps.set(operation, []);
        }

        const counts = this.operationCounts.get(operation);
        const timestamps = this.operationTimestamps.get(operation);

        // Clean old entries (older than 1 hour)
        const oneHourAgo = now - (60 * 60 * 1000);
        while (timestamps.length > 0 && timestamps[0] < oneHourAgo) {
            timestamps.shift();
            counts.shift();
        }

        // Count operations in the last minute and hour
        const oneMinuteAgo = now - (60 * 1000);
        const recentMinute = timestamps.filter(t => t >= oneMinuteAgo).length;
        const recentHour = timestamps.length;

        // Check limits
        if (recentMinute >= limits.maxPerMinute) {
            throw new Error(`Rate limit exceeded: ${operation} - ${recentMinute}/${limits.maxPerMinute} per minute`);
        }

        if (recentHour >= limits.maxPerHour) {
            throw new Error(`Rate limit exceeded: ${operation} - ${recentHour}/${limits.maxPerHour} per hour`);
        }

        return true;
    }

    /**
     * Records an operation for rate limiting
     * @param {string} operation - Operation type
     */
    recordOperation(operation) {
        const now = Date.now();
        
        if (!this.operationCounts.has(operation)) {
            this.operationCounts.set(operation, []);
            this.operationTimestamps.set(operation, []);
        }

        this.operationTimestamps.get(operation).push(now);
        this.operationCounts.get(operation).push(1);

        // Update resource usage
        this.resourceUsage.fileOperations++;
        if (operation === 'web_request') {
            this.resourceUsage.networkRequests++;
        }
    }

    /**
     * Checks resource usage limits
     * @param {string} operation - Operation type
     * @param {number} estimatedMemoryMB - Estimated memory usage
     * @param {number} estimatedCpuMs - Estimated CPU time
     * @throws {Error} - If resource limits would be exceeded
     */
    checkResourceLimits(operation, estimatedMemoryMB = 0, estimatedCpuMs = 0) {
        const newMemory = this.resourceUsage.memoryUsage + estimatedMemoryMB;
        const newCpuTime = this.resourceUsage.cpuTime + estimatedCpuMs;

        if (newMemory > this.maxResourceLimits.maxMemoryMB) {
            throw new Error(`Memory limit exceeded: ${newMemory}MB > ${this.maxResourceLimits.maxMemoryMB}MB`);
        }

        if (newCpuTime > this.maxResourceLimits.maxCpuTimeMs) {
            throw new Error(`CPU time limit exceeded: ${newCpuTime}ms > ${this.maxResourceLimits.maxCpuTimeMs}ms`);
        }

        if (this.resourceUsage.networkRequests >= this.maxResourceLimits.maxNetworkRequests) {
            throw new Error(`Network request limit exceeded: ${this.resourceUsage.networkRequests} >= ${this.maxResourceLimits.maxNetworkRequests}`);
        }

        if (this.resourceUsage.fileOperations >= this.maxResourceLimits.maxFileOperations) {
            throw new Error(`File operation limit exceeded: ${this.resourceUsage.fileOperations} >= ${this.maxResourceLimits.maxFileOperations}`);
        }
    }

    /**
     * Updates resource usage
     * @param {Object} usage - Resource usage update
     */
    updateResourceUsage(usage) {
        if (usage.memoryMB) this.resourceUsage.memoryUsage += usage.memoryMB;
        if (usage.cpuMs) this.resourceUsage.cpuTime += usage.cpuMs;
        if (usage.networkRequests) this.resourceUsage.networkRequests += usage.networkRequests;
        if (usage.fileOperations) this.resourceUsage.fileOperations += usage.fileOperations;
    }

    /**
     * Gets current resource usage statistics
     * @returns {Object} - Resource usage statistics
     */
    getResourceStats() {
        return {
            current: { ...this.resourceUsage },
            limits: { ...this.maxResourceLimits },
            rateLimits: { ...this.rateLimits },
            utilizationPercent: {
                memory: (this.resourceUsage.memoryUsage / this.maxResourceLimits.maxMemoryMB) * 100,
                cpu: (this.resourceUsage.cpuTime / this.maxResourceLimits.maxCpuTimeMs) * 100,
                network: (this.resourceUsage.networkRequests / this.maxResourceLimits.maxNetworkRequests) * 100,
                fileOps: (this.resourceUsage.fileOperations / this.maxResourceLimits.maxFileOperations) * 100
            }
        };
    }

    /**
     * Resets resource usage counters
     */
    resetResourceUsage() {
        this.resourceUsage = {
            memoryUsage: 0,
            cpuTime: 0,
            networkRequests: 0,
            fileOperations: 0
        };
        this.operationCounts.clear();
        this.operationTimestamps.clear();
    }
}

/**
 * File permission validation system
 */
class PermissionValidator {
    constructor() {
        this.allowedOperations = new Set(['read', 'write', 'create', 'delete', 'rename']);
        this.restrictedPaths = new Set([
            'system32',
            'windows',
            'program files',
            'program files (x86)',
            'users',
            'etc',
            'usr',
            'var',
            'tmp',
            'temp'
        ]);
        this.dangerousExtensions = new Set([
            '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
            '.app', '.deb', '.rpm', '.dmg', '.pkg', '.msi', '.dll', '.so', '.dylib'
        ]);
    }

    /**
     * Validates file permissions before operations
     * @param {string} filePath - File path to validate
     * @param {string} operation - Operation type (read, write, create, delete, rename)
     * @param {Object} fileHandle - File handle (if available)
     * @returns {Promise<boolean>} - True if operation is allowed
     * @throws {Error} - If operation is not permitted
     */
    async validateFilePermission(filePath, operation, fileHandle = null) {
        if (!this.allowedOperations.has(operation)) {
            throw new Error(`Operation '${operation}' is not allowed`);
        }

        // Check for restricted paths
        const lowerPath = filePath.toLowerCase();
        for (const restricted of this.restrictedPaths) {
            if (lowerPath.includes(restricted)) {
                throw new Error(`Access to restricted path '${restricted}' is not allowed`);
            }
        }

        // Check for dangerous file extensions
        const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        if (this.dangerousExtensions.has(extension)) {
            if (operation === 'write' || operation === 'create') {
                throw new Error(`Creating or writing files with extension '${extension}' is not allowed for security reasons`);
            }
            console.warn(`Warning: Accessing file with potentially dangerous extension: ${extension}`);
        }

        // If we have a file handle, check actual permissions
        if (fileHandle) {
            try {
                const permission = await fileHandle.queryPermission({ mode: operation === 'read' ? 'read' : 'readwrite' });
                if (permission !== 'granted') {
                    const requestPermission = await fileHandle.requestPermission({ mode: operation === 'read' ? 'read' : 'readwrite' });
                    if (requestPermission !== 'granted') {
                        throw new Error(`File system permission denied for ${operation} operation on ${filePath}`);
                    }
                }
            } catch (error) {
                // If permission API is not available, log warning but continue
                console.warn(`Permission check failed for ${filePath}: ${error.message}`);
            }
        }

        return true;
    }

    /**
     * Validates directory permissions
     * @param {string} dirPath - Directory path to validate
     * @param {string} operation - Operation type
     * @returns {boolean} - True if operation is allowed
     * @throws {Error} - If operation is not permitted
     */
    validateDirectoryPermission(dirPath, operation) {
        const lowerPath = dirPath.toLowerCase();
        
        // Check for restricted directories
        for (const restricted of this.restrictedPaths) {
            if (lowerPath.includes(restricted)) {
                throw new Error(`Access to restricted directory '${restricted}' is not allowed`);
            }
        }

        // Prevent operations on system directories
        const systemDirs = ['/', '/root', '/boot', '/dev', '/proc', '/sys', 'c:\\', 'd:\\'];
        if (systemDirs.includes(lowerPath) || systemDirs.some(dir => lowerPath.startsWith(dir))) {
            throw new Error(`Operations on system directory '${dirPath}' are not allowed`);
        }

        return true;
    }
}

// Global security instances
let securityValidator = null;
let resourceLimiter = null;
let permissionValidator = null;

/**
 * Initialize security system
 */
function initializeSecuritySystem() {
    if (!securityValidator) {
        securityValidator = new SecurityValidator();
    }
    if (!resourceLimiter) {
        resourceLimiter = new ResourceLimiter();
    }
    if (!permissionValidator) {
        permissionValidator = new PermissionValidator();
    }
}

/**
 * Export security utility functions
 */
export function getSecurityValidator() {
    if (!securityValidator) initializeSecuritySystem();
    return securityValidator;
}

export function getResourceLimiter() {
    if (!resourceLimiter) initializeSecuritySystem();
    return resourceLimiter;
}

export function getPermissionValidator() {
    if (!permissionValidator) initializeSecuritySystem();
    return permissionValidator;
}

/**
 * Convenience functions for common security operations
 */
export function sanitizeFilePath(filePath) {
    return getSecurityValidator().sanitizeFilePath(filePath);
}

export function sanitizeContent(content, options = {}) {
    return getSecurityValidator().sanitizeContent(content, options);
}

export function sanitizeUrl(url) {
    return getSecurityValidator().sanitizeUrl(url);
}

export function validateParameters(params, schema) {
    return getSecurityValidator().validateParameters(params, schema);
}

export function checkRateLimit(operation) {
    return getResourceLimiter().checkRateLimit(operation);
}

export function recordOperation(operation) {
    return getResourceLimiter().recordOperation(operation);
}

export async function validateFilePermission(filePath, operation, fileHandle = null) {
    return await getPermissionValidator().validateFilePermission(filePath, operation, fileHandle);
}

export function validateDirectoryPermission(dirPath, operation) {
    return getPermissionValidator().validateDirectoryPermission(dirPath, operation);
}

/**
 * Comprehensive security validation wrapper
 * @param {Object} options - Validation options
 * @returns {Object} - Validation results
 */
export async function performSecurityValidation(options = {}) {
    const {
        filePath,
        content,
        url,
        operation = 'read',
        parameters = {},
        parameterSchema = {},
        fileHandle = null,
        skipRateLimit = false
    } = options;

    const results = {
        valid: true,
        warnings: [],
        errors: [],
        sanitized: {}
    };

    try {
        // Initialize security system
        initializeSecuritySystem();

        // Rate limiting check
        if (!skipRateLimit && operation) {
            try {
                checkRateLimit(operation);
                recordOperation(operation);
            } catch (error) {
                results.valid = false;
                results.errors.push(`Rate limit: ${error.message}`);
                return results;
            }
        }

        // File path validation
        if (filePath) {
            try {
                results.sanitized.filePath = sanitizeFilePath(filePath);
                await validateFilePermission(results.sanitized.filePath, operation, fileHandle);
            } catch (error) {
                results.valid = false;
                results.errors.push(`File path: ${error.message}`);
            }
        }

        // Content sanitization
        if (content) {
            try {
                results.sanitized.content = sanitizeContent(content);
            } catch (error) {
                results.valid = false;
                results.errors.push(`Content: ${error.message}`);
            }
        }

        // URL validation
        if (url) {
            try {
                results.sanitized.url = sanitizeUrl(url);
            } catch (error) {
                results.valid = false;
                results.errors.push(`URL: ${error.message}`);
            }
        }

        // Parameter validation
        if (Object.keys(parameters).length > 0 && Object.keys(parameterSchema).length > 0) {
            try {
                validateParameters(parameters, parameterSchema);
                results.sanitized.parameters = parameters;
            } catch (error) {
                results.valid = false;
                results.errors.push(`Parameters: ${error.message}`);
            }
        }

    } catch (error) {
        results.valid = false;
        results.errors.push(`Security validation failed: ${error.message}`);
    }

    return results;
}