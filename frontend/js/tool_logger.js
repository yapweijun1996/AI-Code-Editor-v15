import { DbManager } from './db.js';

/**
 * Standardized error codes for consistent error handling across tools
 */
export const ErrorCodes = {
    // Tool execution errors
    TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
    TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
    TOOL_TIMEOUT: 'TOOL_TIMEOUT',
    TOOL_CANCELLED: 'TOOL_CANCELLED',
    
    // File system errors
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
    FILE_WRITE_FAILED: 'FILE_WRITE_FAILED',
    FILE_READ_FAILED: 'FILE_READ_FAILED',
    
    // Validation errors
    INVALID_PARAMETERS: 'INVALID_PARAMETERS',
    SYNTAX_ERROR: 'SYNTAX_ERROR',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    
    // System errors
    DATABASE_ERROR: 'DATABASE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED'
};

/**
 * Log levels for structured logging
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
};

/**
 * Enhanced logging system for tool executions with log levels, filtering, and performance metrics
 */
export class ToolLogger {
    constructor() {
        this.logDb = null;
        this.currentLogLevel = LogLevel.INFO;
        this.sessionId = this.generateSessionId();
        this.performanceMetrics = new Map();
        this.init();
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async init() {
        try {
            this.logDb = await DbManager.openDb();
            this.log('system', {}, 'INFO', { message: 'Tool execution log database initialized' }, LogLevel.INFO);
        } catch (error) {
            console.error('Failed to initialize tool execution log database:', error);
        }
    }

    /**
     * Set the minimum log level for filtering
     * @param {number} level - Log level from LogLevel enum
     */
    setLogLevel(level) {
        this.currentLogLevel = level;
    }

    /**
     * Enhanced logging with levels, performance metrics, and standardized error codes
     * @param {string} toolName - Name of the tool
     * @param {Object} parameters - Tool parameters
     * @param {string} status - Status (Success, Error, Warning, Info)
     * @param {Object} result - Tool result or error information
     * @param {number} logLevel - Log level (optional, defaults to INFO)
     * @param {Object} context - Additional context (file, line, user, etc.)
     */
    async log(toolName, parameters, status, result, logLevel = LogLevel.INFO, context = {}) {
        // Filter based on log level
        if (logLevel < this.currentLogLevel) {
            return;
        }

        if (!this.logDb) {
            console.error('Log database is not available.');
            return;
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            id: `${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp,
            sessionId: this.sessionId,
            toolName,
            parameters: this.safeDeepCopy(parameters || {}),
            status,
            result: this.safeDeepCopy(result || {}),
            logLevel,
            logLevelName: this.getLogLevelName(logLevel),
            context: {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                url: typeof window !== 'undefined' ? window.location.href : 'unknown',
                ...context
            },
            performanceMetrics: this.getPerformanceMetrics(toolName)
        };

        // Add error code if this is an error log
        if (status === 'Error' && result.errorCode) {
            logEntry.errorCode = result.errorCode;
        }

        try {
            const tx = this.logDb.transaction('tool_logs', 'readwrite');
            const store = tx.objectStore('tool_logs');
            await store.add(logEntry);
            await tx.done;

            // Also log to console based on level
            this.logToConsole(logEntry);
        } catch (error) {
            console.error('Failed to write to tool log database:', error);
        }
    }

    /**
     * Log performance metrics for a tool
     * @param {string} toolName - Name of the tool
     * @param {number} startTime - Start timestamp
     * @param {number} endTime - End timestamp
     * @param {boolean} success - Whether the tool succeeded
     * @param {Object} additionalMetrics - Additional performance data
     */
    logPerformance(toolName, startTime, endTime, success, additionalMetrics = {}) {
        const duration = endTime - startTime;
        const metrics = {
            duration,
            success,
            timestamp: new Date().toISOString(),
            ...additionalMetrics
        };

        if (!this.performanceMetrics.has(toolName)) {
            this.performanceMetrics.set(toolName, {
                totalCalls: 0,
                totalTime: 0,
                successCount: 0,
                failureCount: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                lastUsed: null
            });
        }

        const toolMetrics = this.performanceMetrics.get(toolName);
        toolMetrics.totalCalls++;
        toolMetrics.totalTime += duration;
        toolMetrics.averageTime = toolMetrics.totalTime / toolMetrics.totalCalls;
        toolMetrics.minTime = Math.min(toolMetrics.minTime, duration);
        toolMetrics.maxTime = Math.max(toolMetrics.maxTime, duration);
        toolMetrics.lastUsed = new Date().toISOString();

        if (success) {
            toolMetrics.successCount++;
        } else {
            toolMetrics.failureCount++;
        }

        // Log performance warning for slow tools
        if (duration > 5000) {
            this.log(toolName, {}, 'Warning', {
                message: `Tool execution took ${duration}ms`,
                performanceMetrics: metrics
            }, LogLevel.WARN, { category: 'performance' });
        }
    }

    /**
     * Get performance metrics for a tool
     * @param {string} toolName - Name of the tool
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics(toolName) {
        return this.performanceMetrics.get(toolName) || null;
    }

    /**
     * Get all performance metrics
     * @returns {Object} All performance metrics
     */
    getAllPerformanceMetrics() {
        const metrics = {};
        for (const [toolName, data] of this.performanceMetrics) {
            metrics[toolName] = { ...data };
        }
        return metrics;
    }

    /**
     * Get logs with filtering options
     * @param {Object} options - Filtering options
     * @returns {Promise<Array>} Filtered logs
     */
    async getLogs(options = {}) {
        const {
            limit = 100,
            toolName = null,
            status = null,
            logLevel = null,
            startTime = null,
            endTime = null,
            sessionId = null,
            errorCode = null
        } = options;

        if (!this.logDb) return Promise.resolve([]);

        return new Promise((resolve, reject) => {
            const tx = this.logDb.transaction('tool_logs', 'readonly');
            const store = tx.objectStore('tool_logs');
            const request = store.getAll();
            
            request.onerror = () => reject('Error fetching logs.');
            request.onsuccess = () => {
                let logs = request.result || [];

                // Apply filters
                if (toolName) {
                    logs = logs.filter(log => log.toolName === toolName);
                }
                if (status) {
                    logs = logs.filter(log => log.status === status);
                }
                if (logLevel !== null) {
                    logs = logs.filter(log => log.logLevel >= logLevel);
                }
                if (startTime) {
                    logs = logs.filter(log => new Date(log.timestamp) >= new Date(startTime));
                }
                if (endTime) {
                    logs = logs.filter(log => new Date(log.timestamp) <= new Date(endTime));
                }
                if (sessionId) {
                    logs = logs.filter(log => log.sessionId === sessionId);
                }
                if (errorCode) {
                    logs = logs.filter(log => log.errorCode === errorCode);
                }

                // Sort by timestamp (newest first) and limit
                logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(logs.slice(0, limit));
            };
        });
    }

    /**
     * Get error statistics
     * @returns {Promise<Object>} Error statistics
     */
    async getErrorStatistics() {
        const errorLogs = await this.getLogs({ status: 'Error', limit: 1000 });
        const stats = {
            totalErrors: errorLogs.length,
            errorsByTool: {},
            errorsByCode: {},
            recentErrors: errorLogs.slice(0, 10),
            errorTrends: this.calculateErrorTrends(errorLogs)
        };

        errorLogs.forEach(log => {
            // Count by tool
            stats.errorsByTool[log.toolName] = (stats.errorsByTool[log.toolName] || 0) + 1;
            
            // Count by error code
            if (log.errorCode) {
                stats.errorsByCode[log.errorCode] = (stats.errorsByCode[log.errorCode] || 0) + 1;
            }
        });

        return stats;
    }

    /**
     * Calculate error trends over time
     * @param {Array} errorLogs - Error log entries
     * @returns {Object} Error trend data
     */
    calculateErrorTrends(errorLogs) {
        const trends = {};
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        trends.lastHour = errorLogs.filter(log => new Date(log.timestamp) > oneHourAgo).length;
        trends.lastDay = errorLogs.filter(log => new Date(log.timestamp) > oneDayAgo).length;
        trends.total = errorLogs.length;

        return trends;
    }

    /**
     * Clear logs with optional filtering
     * @param {Object} options - Filtering options for selective clearing
     */
    async clearLogs(options = {}) {
        if (!this.logDb) return;

        if (Object.keys(options).length === 0) {
            // Clear all logs
            const tx = this.logDb.transaction('tool_logs', 'readwrite');
            await tx.objectStore('tool_logs').clear();
            this.log('system', {}, 'INFO', { message: 'All tool execution logs cleared' }, LogLevel.INFO);
        } else {
            // Selective clearing based on options
            const logsToDelete = await this.getLogs({ ...options, limit: 10000 });
            const tx = this.logDb.transaction('tool_logs', 'readwrite');
            const store = tx.objectStore('tool_logs');
            
            for (const log of logsToDelete) {
                await store.delete(log.id);
            }
            
            this.log('system', {}, 'INFO', {
                message: `Cleared ${logsToDelete.length} log entries`,
                clearOptions: options
            }, LogLevel.INFO);
        }
    }

    /**
     * Export logs for analysis
     * @param {Object} options - Export options
     * @returns {Promise<Object>} Exported log data
     */
    async exportLogs(options = {}) {
        const logs = await this.getLogs(options);
        const performanceMetrics = this.getAllPerformanceMetrics();
        const errorStats = await this.getErrorStatistics();

        return {
            exportTimestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            totalLogs: logs.length,
            logs,
            performanceMetrics,
            errorStatistics: errorStats,
            exportOptions: options
        };
    }

    // Helper methods

    safeDeepCopy(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (error) {
            return { error: 'Failed to serialize object', type: typeof obj };
        }
    }

    getLogLevelName(level) {
        const levelNames = {
            [LogLevel.DEBUG]: 'DEBUG',
            [LogLevel.INFO]: 'INFO',
            [LogLevel.WARN]: 'WARN',
            [LogLevel.ERROR]: 'ERROR',
            [LogLevel.CRITICAL]: 'CRITICAL'
        };
        return levelNames[level] || 'UNKNOWN';
    }

    logToConsole(logEntry) {
        const { toolName, status, logLevel, result, timestamp } = logEntry;
        const message = `[${timestamp}] ${this.getLogLevelName(logLevel)} ${toolName}: ${status}`;

        switch (logLevel) {
            case LogLevel.DEBUG:
                console.debug(message, result);
                break;
            case LogLevel.INFO:
                console.info(message, result);
                break;
            case LogLevel.WARN:
                console.warn(message, result);
                break;
            case LogLevel.ERROR:
            case LogLevel.CRITICAL:
                console.error(message, result);
                break;
            default:
                console.log(message, result);
        }
    }

    /**
     * Create a standardized error object
     * @param {string} errorCode - Error code from ErrorCodes
     * @param {string} message - Error message
     * @param {Object} context - Additional error context
     * @returns {Object} Standardized error object
     */
    static createError(errorCode, message, context = {}) {
        return {
            errorCode,
            message,
            timestamp: new Date().toISOString(),
            context,
            stack: new Error().stack
        };
    }
}

export const toolLogger = new ToolLogger();
