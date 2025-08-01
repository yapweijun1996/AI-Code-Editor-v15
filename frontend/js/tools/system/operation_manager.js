/**
 * Operation management system for handling active operations, cancellation, and timeouts
 */

// Smart debugging and optimization state
export const debuggingState = {
    recentErrors: new Map(), // Track recent errors for pattern detection
    toolPerformance: new Map(), // Track tool execution times
    contextCache: new Map(), // Cache frequently accessed contexts
    lastFileOperations: [], // Track recent file operations for optimization
    amendModeOptimizations: {
        preferredTools: ['apply_diff', 'search_files', 'read_file'],
        avoidedTools: ['write_to_file'],
        smartSearch: true,
        contextAware: true
    },
    smartToolSelection: {
        fileEditingHistory: new Map(), // Track which tools work best for different file types
        errorPatterns: new Map(), // Track common error patterns and solutions
        performanceMetrics: new Map() // Track tool performance by context
    },
    // Enhanced execution control
    activeOperations: new Map(), // Track active tool operations for cancellation
    timeoutSettings: {
        default: 30000, // 30 seconds default timeout
        fileOperations: 60000, // 60 seconds for file operations
        networkOperations: 45000, // 45 seconds for network operations
        analysisOperations: 120000, // 2 minutes for complex analysis
        batchOperations: 300000 // 5 minutes for batch operations
    },
    cancellationTokens: new Map(), // Store cancellation tokens for operations
    
    // Dependency graph modeling for tool orchestration
    dependencyGraph: {
        nodes: new Map(), // Tool nodes with metadata
        edges: new Map(), // Dependencies between tools
        executionQueue: [], // Ordered execution queue
        parallelGroups: [], // Groups of tools that can run in parallel
        completedTools: new Set(), // Track completed tools
        failedTools: new Set(), // Track failed tools
        blockedTools: new Set(), // Tools blocked by dependencies
        statistics: {
            totalExecutions: 0,
            parallelExecutions: 0,
            dependencyViolations: 0,
            optimizationSavings: 0
        }
    }
};

/**
 * Creates a cancellation token that can be used to cancel long-running operations
 */
export class CancellationToken {
    constructor() {
        this.cancelled = false;
        this.reason = null;
        this.callbacks = [];
    }
    
    cancel(reason = 'Operation cancelled') {
        if (this.cancelled) return;
        
        this.cancelled = true;
        this.reason = reason;
        
        // Notify all registered callbacks
        this.callbacks.forEach(callback => {
            try {
                callback(reason);
            } catch (error) {
                console.warn('Error in cancellation callback:', error);
            }
        });
        
        this.callbacks.length = 0; // Clear callbacks
    }
    
    onCancelled(callback) {
        if (this.cancelled) {
            callback(this.reason);
        } else {
            this.callbacks.push(callback);
        }
    }
    
    throwIfCancelled() {
        if (this.cancelled) {
            throw new Error(`Operation cancelled: ${this.reason}`);
        }
    }
}

/**
 * Creates a timeout promise that rejects after the specified duration
 */
export function createTimeoutPromise(timeoutMs, message = 'Operation timed out') {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${message} (${timeoutMs}ms)`));
        }, timeoutMs);
    });
}

/**
 * Wraps a promise with timeout and cancellation support
 */
export async function withTimeoutAndCancellation(promise, options = {}) {
    const {
        timeout = debuggingState.timeoutSettings.default,
        cancellationToken = null,
        timeoutMessage = 'Operation timed out',
        operationId = null
    } = options;
    
    const promises = [promise];
    
    // Add timeout promise
    if (timeout > 0) {
        promises.push(createTimeoutPromise(timeout, timeoutMessage));
    }
    
    // Add cancellation promise
    if (cancellationToken) {
        promises.push(new Promise((_, reject) => {
            cancellationToken.onCancelled((reason) => {
                reject(new Error(`Operation cancelled: ${reason}`));
            });
        }));
    }
    
    try {
        const result = await Promise.race(promises);
        
        // Clean up operation tracking
        if (operationId && debuggingState.activeOperations.has(operationId)) {
            debuggingState.activeOperations.delete(operationId);
        }
        
        return result;
    } catch (error) {
        // Clean up operation tracking on error
        if (operationId && debuggingState.activeOperations.has(operationId)) {
            debuggingState.activeOperations.delete(operationId);
        }
        
        // Enhance error with timeout/cancellation context
        if (error.message.includes('timed out')) {
            error.isTimeout = true;
            error.timeoutDuration = timeout;
        } else if (error.message.includes('cancelled')) {
            error.isCancelled = true;
        }
        
        throw error;
    }
}

/**
 * Gets appropriate timeout for a tool based on its characteristics
 */
export function getToolTimeout(toolName, parameters = {}) {
    const settings = debuggingState.timeoutSettings;
    
    // Network operations
    if (['read_url', 'duckduckgo_search', 'perform_research'].includes(toolName)) {
        return settings.networkOperations;
    }
    
    // Batch operations
    if (toolName.startsWith('batch_') || toolName.includes('multiple')) {
        return settings.batchOperations;
    }
    
    // Analysis operations
    if (['analyze_code_quality', 'debug_systematically', 'solve_engineering_problem',
         'build_symbol_table', 'trace_data_flow'].includes(toolName)) {
        return settings.analysisOperations;
    }
    
    // File operations
    if (['create_file', 'edit_file', 'rewrite_file', 'read_file', 'apply_diff'].includes(toolName)) {
        // Adjust timeout based on file size if available
        if (parameters.content && parameters.content.length > 100000) {
            return settings.fileOperations * 2; // Double timeout for large files
        }
        return settings.fileOperations;
    }
    
    return settings.default;
}

/**
 * Creates and tracks a cancellation token for an operation
 */
export function createOperationToken(operationId, toolName) {
    const token = new CancellationToken();
    
    const operationInfo = {
        id: operationId,
        toolName,
        token,
        startTime: Date.now(),
        status: 'running'
    };
    
    debuggingState.activeOperations.set(operationId, operationInfo);
    debuggingState.cancellationTokens.set(operationId, token);
    
    return token;
}

/**
 * Cancels a specific operation by ID
 */
export function cancelOperation(operationId, reason = 'User requested cancellation') {
    const token = debuggingState.cancellationTokens.get(operationId);
    if (token) {
        token.cancel(reason);
        
        // Update operation status
        const operation = debuggingState.activeOperations.get(operationId);
        if (operation) {
            operation.status = 'cancelled';
            operation.endTime = Date.now();
        }
        
        console.log(`[Cancellation] Operation ${operationId} cancelled: ${reason}`);
        return true;
    }
    return false;
}

/**
 * Cancels all active operations
 */
export function cancelAllOperations(reason = 'System shutdown or reset') {
    const cancelledCount = debuggingState.activeOperations.size;
    
    for (const [operationId] of debuggingState.activeOperations) {
        cancelOperation(operationId, reason);
    }
    
    console.log(`[Cancellation] Cancelled ${cancelledCount} active operations`);
    return cancelledCount;
}

/**
 * Gets status of all active operations
 */
export function getActiveOperationsStatus() {
    const operations = [];
    const now = Date.now();
    
    for (const [id, operation] of debuggingState.activeOperations) {
        operations.push({
            id,
            toolName: operation.toolName,
            status: operation.status,
            duration: now - operation.startTime,
            startTime: operation.startTime
        });
    }
    
    return operations;
}

/**
 * Enhanced operation tracking with error analysis integration
 * @param {string} operationId - Operation identifier
 * @param {string} toolName - Name of the tool
 * @param {Object} parameters - Operation parameters
 * @returns {Object} Operation token with enhanced tracking
 */
export function trackOperation(operationId, status, additionalInfo = {}) {
    const operation = debuggingState.activeOperations.get(operationId);
    if (operation) {
        operation.status = status;
        operation.lastUpdate = Date.now();
        
        // Add additional tracking information
        if (additionalInfo.error) {
            operation.error = additionalInfo.error;
            operation.errorTimestamp = Date.now();
        }
        
        if (additionalInfo.progress) {
            operation.progress = additionalInfo.progress;
        }
        
        if (additionalInfo.stage) {
            operation.stage = additionalInfo.stage;
        }
        
        console.log(`[Operation Tracking] ${operationId}: ${status}`, additionalInfo);
    }
}

/**
 * Complete operation with enhanced error analysis
 * @param {string} operationId - Operation identifier
 * @param {string} finalStatus - Final status (completed, failed, cancelled)
 * @param {string|Error} error - Error information if failed
 */
export function completeOperation(operationId, finalStatus, error = null) {
    const operation = debuggingState.activeOperations.get(operationId);
    if (operation) {
        operation.status = finalStatus;
        operation.endTime = Date.now();
        operation.duration = operation.endTime - operation.startTime;
        
        if (error) {
            operation.error = typeof error === 'string' ? error : error.message;
            
            // Analyze error for future optimization
            try {
                // Import analyzeError dynamically to avoid circular dependencies
                import('../utils/shared_utils.js').then(({ analyzeError }) => {
                    const analysis = analyzeError(error, `operation_${operation.toolName}`, operation.toolName);
                    operation.errorAnalysis = analysis;
                    
                    // Update debugging state with error patterns
                    const errorKey = `${operation.toolName}_${analysis.category}`;
                    if (!debuggingState.recentErrors.has(errorKey)) {
                        debuggingState.recentErrors.set(errorKey, []);
                    }
                    debuggingState.recentErrors.get(errorKey).push({
                        timestamp: Date.now(),
                        error: error,
                        analysis: analysis,
                        operationId: operationId
                    });
                    
                    // Keep only recent errors (last 50 per error type)
                    const errors = debuggingState.recentErrors.get(errorKey);
                    if (errors.length > 50) {
                        debuggingState.recentErrors.set(errorKey, errors.slice(-50));
                    }
                }).catch(analysisError => {
                    console.warn('Failed to analyze operation error:', analysisError.message);
                });
            } catch (analysisError) {
                console.warn('Error analysis setup failed:', analysisError.message);
            }
        }
        
        // Update performance metrics
        const performanceKey = operation.toolName;
        if (!debuggingState.toolPerformance.has(performanceKey)) {
            debuggingState.toolPerformance.set(performanceKey, {
                totalExecutions: 0,
                totalDuration: 0,
                successCount: 0,
                failureCount: 0,
                averageDuration: 0,
                recentExecutions: []
            });
        }
        
        const perfData = debuggingState.toolPerformance.get(performanceKey);
        perfData.totalExecutions++;
        perfData.totalDuration += operation.duration;
        
        if (finalStatus === 'completed') {
            perfData.successCount++;
        } else if (finalStatus === 'failed') {
            perfData.failureCount++;
        }
        
        perfData.averageDuration = perfData.totalDuration / perfData.totalExecutions;
        perfData.recentExecutions.push({
            timestamp: operation.endTime,
            duration: operation.duration,
            status: finalStatus
        });
        
        // Keep only recent executions (last 100)
        if (perfData.recentExecutions.length > 100) {
            perfData.recentExecutions = perfData.recentExecutions.slice(-100);
        }
        
        console.log(`[Operation Complete] ${operationId}: ${finalStatus} (${operation.duration}ms)`);
        
        // Clean up completed operations after a delay
        setTimeout(() => {
            debuggingState.activeOperations.delete(operationId);
            debuggingState.cancellationTokens.delete(operationId);
        }, 60000); // Keep for 1 minute for debugging
    }
}

/**
 * Get error patterns and suggestions for a specific tool
 * @param {string} toolName - Name of the tool
 * @returns {Object} Error patterns and recovery suggestions
 */
export function getToolErrorPatterns(toolName) {
    const patterns = {
        commonErrors: [],
        recoverySuggestions: [],
        performanceMetrics: null
    };
    
    // Get recent errors for this tool
    for (const [errorKey, errors] of debuggingState.recentErrors.entries()) {
        if (errorKey.startsWith(toolName + '_')) {
            const recentErrors = errors.slice(-10); // Last 10 errors
            patterns.commonErrors.push({
                category: errorKey.split('_')[1],
                count: errors.length,
                recentOccurrences: recentErrors.length,
                lastOccurrence: recentErrors.length > 0 ? recentErrors[recentErrors.length - 1].timestamp : null,
                suggestions: recentErrors.length > 0 ? recentErrors[recentErrors.length - 1].analysis.recoverySuggestions : []
            });
        }
    }
    
    // Get performance metrics
    if (debuggingState.toolPerformance.has(toolName)) {
        patterns.performanceMetrics = debuggingState.toolPerformance.get(toolName);
    }
    
    // Generate general recovery suggestions based on patterns
    if (patterns.commonErrors.length > 0) {
        const mostCommonError = patterns.commonErrors.reduce((prev, current) =>
            (prev.count > current.count) ? prev : current
        );
        
        patterns.recoverySuggestions = mostCommonError.suggestions;
    }
    
    return patterns;
}

/**
 * Smart timeout calculation based on tool history and current conditions
 * @param {string} toolName - Name of the tool
 * @param {Object} parameters - Tool parameters
 * @param {Object} options - Additional options
 * @returns {number} Recommended timeout in milliseconds
 */
export function calculateSmartTimeout(toolName, parameters = {}, options = {}) {
    const baseTimeout = getToolTimeout(toolName, parameters);
    let adjustedTimeout = baseTimeout;
    
    // Get performance history for this tool
    const perfData = debuggingState.toolPerformance.get(toolName);
    if (perfData && perfData.recentExecutions.length > 0) {
        // Calculate 95th percentile of recent execution times
        const recentDurations = perfData.recentExecutions
            .filter(exec => exec.status === 'completed')
            .map(exec => exec.duration)
            .sort((a, b) => a - b);
        
        if (recentDurations.length > 0) {
            const p95Index = Math.floor(recentDurations.length * 0.95);
            const p95Duration = recentDurations[p95Index];
            
            // Use 95th percentile + 50% buffer, but not less than base timeout
            adjustedTimeout = Math.max(baseTimeout, p95Duration * 1.5);
        }
    }
    
    // Adjust based on current system conditions
    const activeOpsCount = debuggingState.activeOperations.size;
    if (activeOpsCount > 5) {
        // System is busy, increase timeout
        adjustedTimeout *= 1.3;
    }
    
    // Adjust based on parameters (e.g., large content)
    if (parameters.content && parameters.content.length > 100000) {
        adjustedTimeout *= 2;
    }
    
    if (parameters.max_results && parameters.max_results > 5) {
        adjustedTimeout *= 1.5;
    }
    
    // Cap the timeout to reasonable limits
    const maxTimeout = 300000; // 5 minutes
    const minTimeout = 5000;   // 5 seconds
    
    return Math.min(Math.max(adjustedTimeout, minTimeout), maxTimeout);
}

/**
 * Enhanced operation monitoring with predictive failure detection
 * @param {string} operationId - Operation to monitor
 * @returns {Object} Monitoring information and predictions
 */
export function monitorOperation(operationId) {
    const operation = debuggingState.activeOperations.get(operationId);
    if (!operation) {
        return null;
    }
    
    const now = Date.now();
    const elapsed = now - operation.startTime;
    const toolName = operation.toolName;
    
    // Get expected duration based on history
    const perfData = debuggingState.toolPerformance.get(toolName);
    let expectedDuration = debuggingState.timeoutSettings.default;
    
    if (perfData && perfData.averageDuration > 0) {
        expectedDuration = perfData.averageDuration * 2; // 2x average as expected max
    }
    
    // Calculate risk factors
    const riskFactors = {
        timeoutRisk: elapsed / expectedDuration,
        systemLoad: debuggingState.activeOperations.size / 10, // Normalize to 0-1
        historicalFailureRate: perfData ? (perfData.failureCount / perfData.totalExecutions) : 0,
        overallRisk: 0
    };
    
    riskFactors.overallRisk = (
        riskFactors.timeoutRisk * 0.5 +
        riskFactors.systemLoad * 0.2 +
        riskFactors.historicalFailureRate * 0.3
    );
    
    // Generate predictions and recommendations
    const predictions = {
        likelyToTimeout: riskFactors.timeoutRisk > 0.8,
        likelyToFail: riskFactors.overallRisk > 0.7,
        recommendedAction: 'continue'
    };
    
    if (predictions.likelyToTimeout) {
        predictions.recommendedAction = 'extend_timeout';
    } else if (predictions.likelyToFail) {
        predictions.recommendedAction = 'prepare_fallback';
    }
    
    return {
        operation: {
            id: operationId,
            toolName: toolName,
            status: operation.status,
            elapsed: elapsed,
            expectedDuration: expectedDuration
        },
        riskFactors: riskFactors,
        predictions: predictions,
        recommendations: generateOperationRecommendations(operation, riskFactors, predictions)
    };
}

/**
 * Generate recommendations for operation management
 */
function generateOperationRecommendations(operation, riskFactors, predictions) {
    const recommendations = [];
    
    if (predictions.likelyToTimeout) {
        recommendations.push({
            type: 'timeout_warning',
            priority: 'high',
            message: 'Operation is likely to timeout. Consider breaking it into smaller chunks.',
            action: 'extend_timeout_or_chunk'
        });
    }
    
    if (riskFactors.systemLoad > 0.7) {
        recommendations.push({
            type: 'system_load',
            priority: 'medium',
            message: 'System load is high. Consider queuing non-urgent operations.',
            action: 'queue_operations'
        });
    }
    
    if (riskFactors.historicalFailureRate > 0.3) {
        recommendations.push({
            type: 'reliability_warning',
            priority: 'medium',
            message: `Tool ${operation.toolName} has a high failure rate. Consider using alternative approaches.`,
            action: 'use_alternative_tool'
        });
    }
    
    return recommendations;
}