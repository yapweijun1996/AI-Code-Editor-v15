/**
 * Performance monitoring and optimization tools
 */

import { debuggingState } from './operation_manager.js';
import { getAdaptiveThresholds, getMemoryMonitor, getCacheManager } from '../utils/shared_utils.js';

/**
 * Enhanced performance tracking with detailed metrics
 */
class PerformanceTracker {
    constructor() {
        this.metrics = new Map();
        this.sessionStart = Date.now();
        this.performanceHistory = [];
        this.thresholds = {
            slow: 5000,      // 5 seconds
            verySlow: 15000, // 15 seconds
            critical: 30000  // 30 seconds
        };
    }
    
    track(toolName, startTime, endTime, success, context = {}) {
        const duration = endTime - startTime;
        const fileSize = context.fileSize || 0;
        const fileType = context.fileType || 'unknown';
        const processingMethod = context.processingMethod || 'standard';
        
        const key = `${toolName}_${fileType}`;
        
        if (!this.metrics.has(key)) {
            this.metrics.set(key, {
                toolName,
                fileType,
                totalCalls: 0,
                totalTime: 0,
                successCount: 0,
                failureCount: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                lastUsed: Date.now(),
                fileSizeStats: {
                    totalSize: 0,
                    averageSize: 0,
                    minSize: Infinity,
                    maxSize: 0
                },
                processingMethods: new Map(),
                performanceTrend: []
            });
        }
        
        const metrics = this.metrics.get(key);
        metrics.totalCalls++;
        metrics.totalTime += duration;
        metrics.averageTime = metrics.totalTime / metrics.totalCalls;
        metrics.minTime = Math.min(metrics.minTime, duration);
        metrics.maxTime = Math.max(metrics.maxTime, duration);
        metrics.lastUsed = Date.now();
        
        // File size statistics
        if (fileSize > 0) {
            metrics.fileSizeStats.totalSize += fileSize;
            metrics.fileSizeStats.averageSize = metrics.fileSizeStats.totalSize / metrics.totalCalls;
            metrics.fileSizeStats.minSize = Math.min(metrics.fileSizeStats.minSize, fileSize);
            metrics.fileSizeStats.maxSize = Math.max(metrics.fileSizeStats.maxSize, fileSize);
        }
        
        // Processing method tracking
        if (!metrics.processingMethods.has(processingMethod)) {
            metrics.processingMethods.set(processingMethod, {
                count: 0,
                totalTime: 0,
                averageTime: 0
            });
        }
        const methodStats = metrics.processingMethods.get(processingMethod);
        methodStats.count++;
        methodStats.totalTime += duration;
        methodStats.averageTime = methodStats.totalTime / methodStats.count;
        
        // Performance trend (keep last 20 measurements)
        metrics.performanceTrend.push({
            timestamp: endTime,
            duration,
            fileSize,
            success,
            processingMethod
        });
        if (metrics.performanceTrend.length > 20) {
            metrics.performanceTrend.shift();
        }
        
        if (success) {
            metrics.successCount++;
        } else {
            metrics.failureCount++;
        }
        
        // Add to global performance history
        this.performanceHistory.push({
            toolName,
            fileType,
            duration,
            fileSize,
            success,
            processingMethod,
            timestamp: endTime
        });
        
        // Keep only last 1000 entries
        if (this.performanceHistory.length > 1000) {
            this.performanceHistory.shift();
        }
        
        // Enhanced performance warnings with context
        this.checkPerformanceThresholds(toolName, duration, fileSize, processingMethod);
        
        // Check for performance degradation
        this.checkPerformanceTrend(metrics);
    }
    
    checkPerformanceThresholds(toolName, duration, fileSize, processingMethod) {
        const adaptiveThresholds = getAdaptiveThresholds();
        const memoryMonitor = getMemoryMonitor();
        
        if (duration > this.thresholds.critical) {
            console.error(`[Performance CRITICAL] ${toolName} took ${Math.round(duration/1000)}s (file: ${this.formatFileSize(fileSize)}, method: ${processingMethod})`);
        } else if (duration > this.thresholds.verySlow) {
            console.warn(`[Performance WARNING] ${toolName} took ${Math.round(duration/1000)}s (file: ${this.formatFileSize(fileSize)}, method: ${processingMethod})`);
        } else if (duration > this.thresholds.slow) {
            console.log(`[Performance INFO] ${toolName} took ${Math.round(duration/1000)}s (file: ${this.formatFileSize(fileSize)}, method: ${processingMethod})`);
        }
        
        // Suggest optimizations based on context
        if (duration > this.thresholds.slow) {
            this.suggestOptimizations(toolName, duration, fileSize, processingMethod);
        }
    }
    
    checkPerformanceTrend(metrics) {
        if (metrics.performanceTrend.length < 5) return;
        
        const recent = metrics.performanceTrend.slice(-5);
        const older = metrics.performanceTrend.slice(-10, -5);
        
        if (older.length === 0) return;
        
        const recentAvg = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length;
        const olderAvg = older.reduce((sum, m) => sum + m.duration, 0) / older.length;
        
        const degradation = (recentAvg - olderAvg) / olderAvg;
        
        if (degradation > 0.5) { // 50% performance degradation
            console.warn(`[Performance TREND] ${metrics.toolName} performance degraded by ${Math.round(degradation * 100)}% recently`);
        }
    }
    
    suggestOptimizations(toolName, duration, fileSize, processingMethod) {
        const suggestions = [];
        
        if (fileSize > 1000000 && processingMethod === 'standard') { // 1MB
            suggestions.push('Consider using streaming processing for large files');
        }
        
        if (toolName.includes('read') && duration > 10000) {
            suggestions.push('Enable caching for frequently accessed files');
            suggestions.push('Use read_file_lines for specific sections instead of full file reads');
        }
        
        if (toolName.includes('write') && duration > 15000) {
            suggestions.push('Use chunked processing for large write operations');
            suggestions.push('Consider batch operations for multiple small writes');
        }
        
        if (toolName.includes('analyze') && duration > 20000) {
            suggestions.push('Use worker threads for CPU-intensive analysis');
            suggestions.push('Enable incremental analysis for large codebases');
        }
        
        const memoryMonitor = getMemoryMonitor();
        if (memoryMonitor.shouldOptimizeForMemory()) {
            suggestions.push('High memory usage detected - consider memory optimization');
        }
        
        if (suggestions.length > 0) {
            console.log(`[Performance SUGGESTIONS] For ${toolName}:`, suggestions);
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    getMetrics(toolName = null, fileType = null) {
        if (toolName && fileType) {
            return this.metrics.get(`${toolName}_${fileType}`) || null;
        }
        
        if (toolName) {
            const results = new Map();
            for (const [key, metrics] of this.metrics) {
                if (metrics.toolName === toolName) {
                    results.set(key, metrics);
                }
            }
            return results;
        }
        
        return this.metrics;
    }
    
    getGlobalStats() {
        const totalOperations = this.performanceHistory.length;
        const successfulOperations = this.performanceHistory.filter(h => h.success).length;
        const totalTime = this.performanceHistory.reduce((sum, h) => sum + h.duration, 0);
        const averageTime = totalOperations > 0 ? totalTime / totalOperations : 0;
        
        const recentOperations = this.performanceHistory.slice(-100);
        const recentAverageTime = recentOperations.length > 0
            ? recentOperations.reduce((sum, h) => sum + h.duration, 0) / recentOperations.length
            : 0;
        
        return {
            sessionDuration: Date.now() - this.sessionStart,
            totalOperations,
            successfulOperations,
            successRate: totalOperations > 0 ? successfulOperations / totalOperations : 0,
            averageTime,
            recentAverageTime,
            performanceTrend: recentAverageTime > averageTime ? 'degrading' : 'improving',
            slowOperations: this.performanceHistory.filter(h => h.duration > this.thresholds.slow).length,
            criticalOperations: this.performanceHistory.filter(h => h.duration > this.thresholds.critical).length
        };
    }
}

// Global performance tracker instance
let performanceTracker = null;

function getPerformanceTracker() {
    if (!performanceTracker) {
        performanceTracker = new PerformanceTracker();
    }
    return performanceTracker;
}

// Enhanced tool performance tracking
export function trackToolPerformance(toolName, startTime, endTime, success, context = {}) {
    const tracker = getPerformanceTracker();
    tracker.track(toolName, startTime, endTime, success, context);
    
    // Also update legacy debugging state for backward compatibility
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
}

// Enhanced smart tool selection with adaptive recommendations
export function getOptimalTool(intent, context = {}) {
    const { fileType, fileSize, mode } = context;
    const adaptiveThresholds = getAdaptiveThresholds();
    const memoryMonitor = getMemoryMonitor();
    const tracker = getPerformanceTracker();
    
    // Get file extension for adaptive thresholds
    const fileExtension = fileType ? `.${fileType}` : '';
    
    // Amend mode optimizations
    if (mode === 'amend') {
        if (intent === 'edit_file') {
            return {
                recommendedTool: 'apply_diff',
                reason: 'apply_diff is safer and more precise for amend mode',
                alternatives: ['edit_file'],
                confidence: 0.9
            };
        }
        
        if (intent === 'search') {
            return {
                recommendedTool: 'search_in_file',
                reason: 'More targeted search for amend mode',
                alternatives: ['search_code'],
                confidence: 0.8
            };
        }
    }
    
    // Adaptive file size optimizations
    if (intent === 'edit_file' && fileSize) {
        const streamingThreshold = adaptiveThresholds.getThreshold('stream', fileExtension, fileSize);
        const shouldUseStreaming = adaptiveThresholds.shouldUseStreaming(fileSize, 'write', fileExtension);
        
        if (shouldUseStreaming) {
            return {
                recommendedTool: 'edit_file',
                reason: `File size (${tracker.formatFileSize(fileSize)}) exceeds streaming threshold (${tracker.formatFileSize(streamingThreshold)}) - use streaming edits`,
                parameters: {
                    preferEditsArray: true,
                    useStreaming: true,
                    chunkSize: adaptiveThresholds.getOptimalChunkSize(fileSize, 'write')
                },
                alternatives: ['apply_diff'],
                confidence: 0.95
            };
        } else if (adaptiveThresholds.shouldUseChunking(fileSize, 'write', fileExtension)) {
            return {
                recommendedTool: 'edit_file',
                reason: `File size (${tracker.formatFileSize(fileSize)}) benefits from chunked processing`,
                parameters: {
                    preferEditsArray: true,
                    useChunking: true
                },
                alternatives: ['apply_diff'],
                confidence: 0.85
            };
        }
    }
    
    if (intent === 'read_file' && fileSize) {
        const readThreshold = adaptiveThresholds.getThreshold('read', fileExtension, fileSize);
        
        if (fileSize > readThreshold) {
            return {
                recommendedTool: 'read_file_lines',
                reason: `File size (${tracker.formatFileSize(fileSize)}) exceeds read threshold - use targeted reading`,
                parameters: {
                    suggestedRange: Math.min(100, Math.floor(readThreshold / 100))
                },
                alternatives: ['read_file'],
                confidence: 0.8
            };
        }
    }
    
    // Memory-based optimizations
    if (memoryMonitor.shouldOptimizeForMemory()) {
        if (intent === 'read_multiple_files') {
            return {
                recommendedTool: 'read_file',
                reason: 'High memory usage detected - read files individually instead of batch',
                parameters: { sequential: true },
                alternatives: ['read_multiple_files'],
                confidence: 0.9
            };
        }
        
        if (intent.includes('analyze') || intent.includes('search')) {
            return {
                recommendedTool: intent,
                reason: 'High memory usage - use memory-optimized processing',
                parameters: {
                    memoryOptimized: true,
                    useWorkers: true
                },
                confidence: 0.85
            };
        }
    }
    
    // Performance-based recommendations
    const performanceKey = `${intent}_${fileType || 'unknown'}`;
    const metrics = debuggingState.toolPerformance.get(performanceKey);
    const detailedMetrics = tracker.getMetrics(intent, fileType || 'unknown');
    
    if (metrics && metrics.failureCount > metrics.successCount) {
        console.warn(`[Smart Selection] Tool ${intent} has high failure rate for ${fileType} files`);
        
        // Suggest alternative based on failure patterns
        if (intent === 'edit_file') {
            return {
                recommendedTool: 'apply_diff',
                reason: `${intent} has high failure rate for ${fileType} files - try more precise editing`,
                alternatives: [intent],
                confidence: 0.7
            };
        }
    }
    
    // Performance trend analysis
    if (detailedMetrics && detailedMetrics.performanceTrend.length >= 5) {
        const recentPerformance = detailedMetrics.performanceTrend.slice(-3);
        const avgRecentTime = recentPerformance.reduce((sum, p) => sum + p.duration, 0) / recentPerformance.length;
        
        if (avgRecentTime > detailedMetrics.averageTime * 1.5) {
            return {
                recommendedTool: intent,
                reason: 'Recent performance degradation detected - consider optimization parameters',
                parameters: {
                    useOptimization: true,
                    enableCaching: true,
                    memoryOptimized: memoryMonitor.shouldOptimizeForMemory()
                },
                confidence: 0.75
            };
        }
    }
    
    return null; // No specific recommendation
}

// Error pattern detection and smart recovery
export function analyzeError(toolName, error, context = {}) {
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
export function getSuggestedFix(toolName, error, errorInfo) {
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
export function getCachedResult(toolName, parameters) {
    const cacheKey = `${toolName}:${JSON.stringify(parameters)}`;
    const cached = debuggingState.contextCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
        console.log(`[Cache Hit] Using cached result for ${toolName}`);
        return cached.result;
    }
    
    return null;
}

export function setCachedResult(toolName, parameters, result) {
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

// Optimize tool execution order (enhanced with dependency graph)
export function optimizeToolSequence(tools) {
    // If dependency graph is available, use it for optimization
    if (tools.length > 1 && debuggingState.dependencyGraph.nodes.size > 0) {
        // Import dependency graph manager dynamically to avoid circular dependencies
        import('./dependency_graph.js').then(({ dependencyGraphManager }) => {
            const plan = dependencyGraphManager.generateExecutionPlan();
            if (plan.phases.length > 0) {
                console.log('[DependencyGraph] Using dependency-based optimization');
                return plan;
            }
        }).catch(error => {
            console.warn('[DependencyGraph] Failed to load dependency graph manager:', error.message);
        });
    }
    
    // Fallback to simple priority-based sorting
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

// Enhanced performance analytics and reporting
export function getPerformanceReport(detailed = false) {
    const tracker = getPerformanceTracker();
    const cacheManager = getCacheManager();
    const memoryMonitor = getMemoryMonitor();
    const adaptiveThresholds = getAdaptiveThresholds();
    
    const globalStats = tracker.getGlobalStats();
    const cacheStats = cacheManager.getGlobalStats();
    const memoryStats = memoryMonitor.getMemoryStats();
    
    const report = {
        timestamp: new Date().toISOString(),
        session: {
            duration: Math.round(globalStats.sessionDuration / 1000), // seconds
            totalOperations: globalStats.totalOperations,
            successRate: Math.round(globalStats.successRate * 100), // percentage
            averageTime: Math.round(globalStats.averageTime),
            recentAverageTime: Math.round(globalStats.recentAverageTime),
            performanceTrend: globalStats.performanceTrend
        },
        performance: {
            slowOperations: globalStats.slowOperations,
            criticalOperations: globalStats.criticalOperations,
            slowOperationRate: globalStats.totalOperations > 0
                ? Math.round((globalStats.slowOperations / globalStats.totalOperations) * 100)
                : 0
        },
        cache: {
            totalMemoryUsage: cacheStats.totalMemoryMB,
            averageHitRate: Math.round(cacheStats.averageHitRate * 100),
            cacheCount: Object.keys(cacheStats.caches).length
        },
        memory: {
            available: memoryStats.available,
            currentUsage: memoryStats.available ? Math.round(memoryStats.current.ratio * 100) : 'N/A',
            shouldOptimize: memoryStats.available ? memoryMonitor.shouldOptimizeForMemory() : false
        },
        thresholds: {
            systemCapability: adaptiveThresholds.systemCapability,
            currentThresholds: adaptiveThresholds.currentThresholds
        }
    };
    
    if (detailed) {
        // Add detailed metrics for each tool
        report.toolMetrics = {};
        const allMetrics = tracker.getMetrics();
        
        for (const [key, metrics] of allMetrics) {
            report.toolMetrics[key] = {
                toolName: metrics.toolName,
                fileType: metrics.fileType,
                totalCalls: metrics.totalCalls,
                successRate: Math.round((metrics.successCount / metrics.totalCalls) * 100),
                averageTime: Math.round(metrics.averageTime),
                minTime: Math.round(metrics.minTime),
                maxTime: Math.round(metrics.maxTime),
                averageFileSize: tracker.formatFileSize(metrics.fileSizeStats.averageSize),
                processingMethods: Object.fromEntries(
                    Array.from(metrics.processingMethods.entries()).map(([method, stats]) => [
                        method,
                        {
                            count: stats.count,
                            averageTime: Math.round(stats.averageTime)
                        }
                    ])
                )
            };
        }
        
        // Add cache details
        report.cacheDetails = cacheStats.caches;
        
        // Add memory trend if available
        if (memoryStats.trend) {
            report.memoryTrend = {
                averageRatio: Math.round(memoryStats.trend.averageRatio * 100),
                increasing: memoryStats.trend.increasing
            };
        }
    }
    
    return report;
}

// Performance optimization recommendations
export function getOptimizationRecommendations() {
    const tracker = getPerformanceTracker();
    const cacheManager = getCacheManager();
    const memoryMonitor = getMemoryMonitor();
    const globalStats = tracker.getGlobalStats();
    const cacheStats = cacheManager.getGlobalStats();
    
    const recommendations = [];
    
    // Performance-based recommendations
    if (globalStats.slowOperations > globalStats.totalOperations * 0.2) {
        recommendations.push({
            type: 'performance',
            priority: 'high',
            title: 'High number of slow operations detected',
            description: `${globalStats.slowOperations} out of ${globalStats.totalOperations} operations (${Math.round((globalStats.slowOperations / globalStats.totalOperations) * 100)}%) are running slowly.`,
            suggestions: [
                'Enable streaming processing for large files',
                'Use chunked processing for large operations',
                'Consider using worker threads for CPU-intensive tasks'
            ]
        });
    }
    
    if (globalStats.performanceTrend === 'degrading') {
        recommendations.push({
            type: 'performance',
            priority: 'medium',
            title: 'Performance degradation detected',
            description: 'Recent operations are taking longer than historical average.',
            suggestions: [
                'Clear caches to free up memory',
                'Restart the application if performance continues to degrade',
                'Check for memory leaks in long-running operations'
            ]
        });
    }
    
    // Cache-based recommendations
    if (cacheStats.averageHitRate < 0.5) {
        recommendations.push({
            type: 'cache',
            priority: 'medium',
            title: 'Low cache hit rate',
            description: `Cache hit rate is ${Math.round(cacheStats.averageHitRate * 100)}%, indicating inefficient caching.`,
            suggestions: [
                'Review caching strategies for frequently accessed files',
                'Increase cache sizes if memory allows',
                'Implement more aggressive caching for repeated operations'
            ]
        });
    }
    
    if (cacheStats.totalMemoryMB > 200) {
        recommendations.push({
            type: 'cache',
            priority: 'low',
            title: 'High cache memory usage',
            description: `Caches are using ${cacheStats.totalMemoryMB}MB of memory.`,
            suggestions: [
                'Consider reducing cache sizes',
                'Enable more aggressive cache eviction',
                'Monitor memory usage during peak operations'
            ]
        });
    }
    
    // Memory-based recommendations
    if (memoryMonitor.shouldOptimizeForMemory()) {
        recommendations.push({
            type: 'memory',
            priority: 'high',
            title: 'High memory usage detected',
            description: 'System memory usage is high and may impact performance.',
            suggestions: [
                'Enable memory-optimized processing modes',
                'Use streaming for large file operations',
                'Clear unnecessary caches',
                'Close unused browser tabs'
            ]
        });
    }
    
    // Tool-specific recommendations
    const allMetrics = tracker.getMetrics();
    for (const [key, metrics] of allMetrics) {
        const failureRate = metrics.failureCount / metrics.totalCalls;
        if (failureRate > 0.1) { // 10% failure rate
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                title: `High failure rate for ${metrics.toolName}`,
                description: `${metrics.toolName} for ${metrics.fileType} files has a ${Math.round(failureRate * 100)}% failure rate.`,
                suggestions: [
                    'Review error patterns for this tool',
                    'Consider using alternative tools',
                    'Check file permissions and accessibility'
                ]
            });
        }
        
        if (metrics.averageTime > 10000 && metrics.totalCalls > 5) { // 10 seconds average
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                title: `Slow performance for ${metrics.toolName}`,
                description: `${metrics.toolName} for ${metrics.fileType} files averages ${Math.round(metrics.averageTime/1000)}s per operation.`,
                suggestions: [
                    'Enable streaming or chunked processing',
                    'Use more targeted operations',
                    'Consider batch processing for multiple operations'
                ]
            });
        }
    }
    
    return recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
}

// Export performance tracker for external use
export { getPerformanceTracker };