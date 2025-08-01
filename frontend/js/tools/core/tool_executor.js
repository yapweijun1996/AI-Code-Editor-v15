/**
 * Streamlined Tool Executor - Main orchestrator for the modular tool system
 * This replaces the monolithic tool_executor.js with a clean, modular architecture
 */

import { toolRegistry } from './tool_registry.js';
import { createSuccessResponse, createErrorResponse, createEnhancedErrorResponse, validateToolParameters } from './tool_interfaces.js';
import { createOperationToken, trackOperation, completeOperation, cancelOperation } from '../system/operation_manager.js';
import { performanceMonitor } from '../system/performance_tools.js';
import { dependencyGraphManager } from '../system/dependency_graph.js';
import { analyzeError, withRetry, withProgressiveTimeout, buildErrorContext } from '../utils/shared_utils.js';

/**
 * Main ToolExecutor class - orchestrates tool execution with performance monitoring,
 * operation tracking, and dependency management
 */
export class ToolExecutor {
    constructor() {
        this.isInitialized = false;
        this.projectHandle = null;
        this.checkpoints = new Map();
        this.maxCheckpoints = 10;
    }

    /**
     * Initialize the tool executor with project context
     */
    async initialize(projectHandle = null) {
        try {
            this.projectHandle = projectHandle;
            this.isInitialized = true;
            
            // Initialize performance monitoring
            performanceMonitor.initialize();
            
            console.log('ToolExecutor initialized successfully');
            return createSuccessResponse('ToolExecutor initialized', { 
                hasProject: !!projectHandle,
                availableTools: Object.keys(toolRegistry).length
            });
        } catch (error) {
            console.error('Failed to initialize ToolExecutor:', error);
            return createErrorResponse('Initialization failed', error.message);
        }
    }

    /**
     * Execute a single tool with enhanced error handling, retry logic, and fallback mechanisms
     */
    async executeTool(toolName, parameters = {}, options = {}) {
        const startTime = performance.now();
        let operationToken = null;
        const context = buildErrorContext('tool_execution', toolName, parameters, options);
        
        try {
            // Validate tool exists
            const toolConfig = toolRegistry[toolName];
            if (!toolConfig) {
                throw new Error(`Unknown tool: ${toolName}`);
            }

            // Check project requirements
            if (toolConfig.requiresProject && !this.projectHandle) {
                throw new Error(`Tool '${toolName}' requires a project to be loaded`);
            }

            // Validate parameters
            const validationResult = validateToolParameters(toolName, parameters);
            if (!validationResult.isValid) {
                throw new Error(`Parameter validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Create operation tracking
            operationToken = createOperationToken(toolName, parameters);
            trackOperation(operationToken, 'running');

            // Create checkpoint if tool modifies files
            let checkpointId = null;
            if (toolConfig.createsCheckpoint) {
                checkpointId = await this.createCheckpoint(toolName);
            }

            // Determine if this tool should use retry logic
            const shouldUseRetry = this.shouldRetryTool(toolName, options);
            const shouldUseProgressiveTimeout = this.shouldUseProgressiveTimeout(toolName, parameters);

            let result;
            
            if (shouldUseRetry) {
                // Execute with retry logic
                result = await withRetry(
                    async () => {
                        if (shouldUseProgressiveTimeout) {
                            return await withProgressiveTimeout(
                                () => toolConfig.handler(parameters, {
                                    projectHandle: this.projectHandle,
                                    operationToken,
                                    ...options
                                }),
                                {
                                    initialTimeout: options.timeout || this.getToolTimeout(toolName, parameters),
                                    context: context,
                                    toolName: toolName,
                                    progressCallback: options.progressCallback
                                }
                            );
                        } else {
                            return await performanceMonitor.executeWithMonitoring(
                                toolName,
                                () => toolConfig.handler(parameters, {
                                    projectHandle: this.projectHandle,
                                    operationToken,
                                    ...options
                                }),
                                options.timeout
                            );
                        }
                    },
                    {
                        maxRetries: this.getMaxRetries(toolName),
                        backoffStrategy: this.getBackoffStrategy(toolName),
                        context: context,
                        toolName: toolName,
                        onRetry: async (error, attempt, delay, errorAnalysis) => {
                            console.log(`[Retry] ${toolName} attempt ${attempt}: ${error.message}`);
                            if (options.onRetry) {
                                await options.onRetry(error, attempt, delay, errorAnalysis);
                            }
                        }
                    }
                );
            } else {
                // Execute normally with optional progressive timeout
                if (shouldUseProgressiveTimeout) {
                    result = await withProgressiveTimeout(
                        () => performanceMonitor.executeWithMonitoring(
                            toolName,
                            () => toolConfig.handler(parameters, {
                                projectHandle: this.projectHandle,
                                operationToken,
                                ...options
                            }),
                            options.timeout
                        ),
                        {
                            initialTimeout: options.timeout || this.getToolTimeout(toolName, parameters),
                            context: context,
                            toolName: toolName,
                            progressCallback: options.progressCallback
                        }
                    );
                } else {
                    result = await performanceMonitor.executeWithMonitoring(
                        toolName,
                        () => toolConfig.handler(parameters, {
                            projectHandle: this.projectHandle,
                            operationToken,
                            ...options
                        }),
                        options.timeout
                    );
                }
            }

            // Complete operation tracking
            completeOperation(operationToken, 'completed');

            const executionTime = performance.now() - startTime;
            
            return createSuccessResponse(
                result.message || `Tool '${toolName}' executed successfully`,
                {
                    ...result,
                    executionTime: Math.round(executionTime),
                    operationId: operationToken,
                    checkpointId,
                    enhancedHandling: {
                        usedRetry: shouldUseRetry,
                        usedProgressiveTimeout: shouldUseProgressiveTimeout
                    }
                }
            );

        } catch (error) {
            // Handle operation cancellation
            if (operationToken) {
                completeOperation(operationToken, 'failed', error.message);
            }

            const executionTime = performance.now() - startTime;
            
            console.error(`Tool execution failed for '${toolName}':`, error);
            
            // Try fallback mechanisms before final failure
            const fallbackResult = await this.tryFallbackMechanisms(toolName, parameters, error, options);
            if (fallbackResult) {
                console.log(`[Fallback Success] ${toolName} succeeded using fallback mechanism`);
                return createSuccessResponse(
                    `Tool '${toolName}' executed successfully using fallback mechanism`,
                    {
                        ...fallbackResult,
                        executionTime: Math.round(performance.now() - startTime),
                        operationId: operationToken,
                        usedFallback: true
                    }
                );
            }
            
            // Create enhanced error response with analysis
            return await createEnhancedErrorResponse(
                `Tool '${toolName}' execution failed`,
                error,
                {
                    context: context,
                    toolName: toolName,
                    additionalData: {
                        parameters,
                        executionTime: Math.round(executionTime),
                        operationId: operationToken,
                        attemptedFallback: true
                    }
                }
            );
        }
    }

    /**
     * Determines if a tool should use retry logic
     */
    shouldRetryTool(toolName, options = {}) {
        if (options.disableRetry) return false;
        
        // Tools that benefit from retry logic
        const retryableTools = [
            'read_url', 'perform_research', 'duckduckgo_search',
            'read_file', 'create_file', 'apply_diff',
            'build_codebase_index', 'query_codebase'
        ];
        
        return retryableTools.some(pattern => toolName.includes(pattern));
    }

    /**
     * Determines if a tool should use progressive timeout
     */
    shouldUseProgressiveTimeout(toolName, parameters = {}) {
        // Tools that typically take longer and benefit from progress feedback
        const longRunningTools = [
            'perform_research', 'build_codebase_index', 'analyze_code_quality',
            'debug_systematically', 'solve_engineering_problem'
        ];
        
        // Also use for large file operations
        if (parameters.content && parameters.content.length > 100000) {
            return true;
        }
        
        return longRunningTools.some(pattern => toolName.includes(pattern));
    }

    /**
     * Gets maximum retry attempts for a tool
     */
    getMaxRetries(toolName) {
        if (toolName.includes('research') || toolName.includes('url')) {
            return 3; // Network operations
        }
        if (toolName.includes('file')) {
            return 2; // File operations
        }
        return 1; // Default
    }

    /**
     * Gets backoff strategy for a tool
     */
    getBackoffStrategy(toolName) {
        if (toolName.includes('research') || toolName.includes('url')) {
            return 'exponential'; // Network operations
        }
        if (toolName.includes('file')) {
            return 'linear'; // File operations
        }
        return 'linear'; // Default
    }

    /**
     * Gets appropriate timeout for a tool
     */
    getToolTimeout(toolName, parameters = {}) {
        // Network operations
        if (toolName.includes('research') || toolName.includes('url')) {
            return 45000; // 45 seconds
        }
        
        // Analysis operations
        if (toolName.includes('analyze') || toolName.includes('debug')) {
            return 120000; // 2 minutes
        }
        
        // File operations - adjust based on content size
        if (toolName.includes('file')) {
            if (parameters.content && parameters.content.length > 100000) {
                return 90000; // 90 seconds for large files
            }
            return 30000; // 30 seconds for normal files
        }
        
        return 30000; // Default 30 seconds
    }

    /**
     * Attempts fallback mechanisms for failed operations
     */
    async tryFallbackMechanisms(toolName, parameters, error, options = {}) {
        const errorAnalysis = analyzeError(error, `fallback_${toolName}`, toolName);
        
        // Don't attempt fallbacks for certain error types
        if (errorAnalysis.category === 'validation' ||
            errorAnalysis.category === 'auth' ||
            errorAnalysis.requiresUserAction) {
            return null;
        }
        
        try {
            // File operation fallbacks
            if (toolName.includes('file')) {
                return await this.tryFileOperationFallbacks(toolName, parameters, error, options);
            }
            
            // Research operation fallbacks
            if (toolName.includes('research') || toolName.includes('search')) {
                return await this.tryResearchFallbacks(toolName, parameters, error, options);
            }
            
            // Code analysis fallbacks
            if (toolName.includes('analyze') || toolName.includes('code')) {
                return await this.tryAnalysisFallbacks(toolName, parameters, error, options);
            }
            
        } catch (fallbackError) {
            console.warn(`[Fallback Failed] ${toolName}: ${fallbackError.message}`);
        }
        
        return null;
    }

    /**
     * File operation fallback mechanisms
     */
    async tryFileOperationFallbacks(toolName, parameters, error, options) {
        // For large file operations, try streaming approach
        if (toolName === 'read_file' && error.message.includes('memory')) {
            console.log('[Fallback] Trying streaming file read...');
            // This would implement streaming file read fallback
            return null; // Placeholder
        }
        
        // For write operations with permission errors, suggest user action
        if (toolName.includes('create') || toolName.includes('write')) {
            if (error.message.includes('permission') || error.message.includes('activation')) {
                console.log('[Fallback] File permission error - user action required');
                return null; // Cannot fallback from permission errors
            }
        }
        
        return null;
    }

    /**
     * Research operation fallback mechanisms
     */
    async tryResearchFallbacks(toolName, parameters, error, options) {
        // For research failures, try with reduced scope
        if (toolName === 'perform_research') {
            console.log('[Fallback] Trying research with reduced scope...');
            try {
                const reducedParams = {
                    ...parameters,
                    max_results: Math.max(1, Math.floor((parameters.max_results || 3) / 2)),
                    depth: Math.max(1, (parameters.depth || 2) - 1)
                };
                
                const toolConfig = toolRegistry[toolName];
                return await toolConfig.handler(reducedParams, options);
            } catch (fallbackError) {
                console.warn('[Fallback] Reduced scope research also failed:', fallbackError.message);
            }
        }
        
        return null;
    }

    /**
     * Code analysis fallback mechanisms
     */
    async tryAnalysisFallbacks(toolName, parameters, error, options) {
        // For analysis operations that timeout, try with smaller scope
        if (error.message.includes('timeout') || error.message.includes('memory')) {
            console.log('[Fallback] Trying analysis with reduced scope...');
            // This would implement reduced scope analysis
            return null; // Placeholder
        }
        
        return null;
    }

    /**
     * Execute multiple tools with dependency management
     */
    async executeToolChain(tools, options = {}) {
        const startTime = performance.now();
        const results = [];
        
        try {
            // Create dependency graph if not using existing one
            if (options.useDependencyGraph && tools.length > 1) {
                const graphResult = await this.executeTool('create_dependency_graph', {
                    tools: tools.map((tool, index) => ({
                        name: tool.name,
                        parameters: tool.parameters || {},
                        metadata: { 
                            priority: tool.priority || 1,
                            estimatedDuration: tool.estimatedDuration || 5000,
                            ...tool.metadata 
                        },
                        dependencies: tool.dependencies || []
                    }))
                });

                if (!graphResult.success) {
                    throw new Error(`Failed to create dependency graph: ${graphResult.error}`);
                }

                // Execute tools according to dependency plan
                const planResult = await this.executeTool('get_execution_plan');
                if (planResult.success && planResult.data.plan) {
                    return await this.executeByDependencyPlan(planResult.data.plan, options);
                }
            }

            // Fallback to sequential execution
            for (let i = 0; i < tools.length; i++) {
                const tool = tools[i];
                const result = await this.executeTool(tool.name, tool.parameters, {
                    ...options,
                    chainIndex: i,
                    totalChainLength: tools.length
                });
                
                results.push(result);
                
                // Stop on first failure unless continueOnError is set
                if (!result.success && !options.continueOnError) {
                    break;
                }
            }

            const executionTime = performance.now() - startTime;
            const successCount = results.filter(r => r.success).length;
            
            return createSuccessResponse(
                `Tool chain completed: ${successCount}/${tools.length} tools succeeded`,
                {
                    results,
                    summary: {
                        total: tools.length,
                        succeeded: successCount,
                        failed: tools.length - successCount,
                        executionTime: Math.round(executionTime)
                    }
                }
            );

        } catch (error) {
            const executionTime = performance.now() - startTime;
            
            return createErrorResponse(
                'Tool chain execution failed',
                error.message,
                {
                    results,
                    executionTime: Math.round(executionTime)
                }
            );
        }
    }

    /**
     * Execute tools according to dependency graph plan
     */
    async executeByDependencyPlan(plan, options = {}) {
        const results = new Map();
        const startTime = performance.now();
        
        try {
            // Execute each phase
            for (let phaseIndex = 0; phaseIndex < plan.phases.length; phaseIndex++) {
                const phase = plan.phases[phaseIndex];
                const phaseResults = [];
                
                // Execute tools in parallel within the phase if possible
                if (phase.canRunInParallel && phase.tools.length > 1) {
                    const promises = phase.tools.map(async (toolInfo) => {
                        const result = await this.executeTool(
                            toolInfo.toolName, 
                            toolInfo.parameters || {},
                            { ...options, phaseIndex, toolId: toolInfo.id }
                        );
                        return { toolId: toolInfo.id, result };
                    });
                    
                    const phasePromiseResults = await Promise.allSettled(promises);
                    
                    for (const promiseResult of phasePromiseResults) {
                        if (promiseResult.status === 'fulfilled') {
                            const { toolId, result } = promiseResult.value;
                            results.set(toolId, result);
                            phaseResults.push(result);
                        } else {
                            const errorResult = createErrorResponse(
                                'Tool execution failed in parallel phase',
                                promiseResult.reason?.message || 'Unknown error'
                            );
                            phaseResults.push(errorResult);
                        }
                    }
                } else {
                    // Sequential execution within phase
                    for (const toolInfo of phase.tools) {
                        const result = await this.executeTool(
                            toolInfo.toolName,
                            toolInfo.parameters || {},
                            { ...options, phaseIndex, toolId: toolInfo.id }
                        );
                        
                        results.set(toolInfo.id, result);
                        phaseResults.push(result);
                        
                        // Stop phase on failure unless continueOnError is set
                        if (!result.success && !options.continueOnError) {
                            break;
                        }
                    }
                }
                
                // Check if phase failed and should stop execution
                const phaseSuccessCount = phaseResults.filter(r => r.success).length;
                if (phaseSuccessCount === 0 && !options.continueOnError) {
                    throw new Error(`Phase ${phaseIndex} failed completely`);
                }
            }

            const executionTime = performance.now() - startTime;
            const allResults = Array.from(results.values());
            const successCount = allResults.filter(r => r.success).length;
            
            return createSuccessResponse(
                `Dependency-based execution completed: ${successCount}/${allResults.length} tools succeeded`,
                {
                    results: allResults,
                    executionPlan: plan,
                    summary: {
                        total: allResults.length,
                        succeeded: successCount,
                        failed: allResults.length - successCount,
                        executionTime: Math.round(executionTime),
                        phasesCompleted: plan.phases.length
                    }
                }
            );

        } catch (error) {
            const executionTime = performance.now() - startTime;
            const allResults = Array.from(results.values());
            
            return createErrorResponse(
                'Dependency-based execution failed',
                error.message,
                {
                    results: allResults,
                    executionTime: Math.round(executionTime)
                }
            );
        }
    }

    /**
     * Get available tools with their metadata
     */
    getAvailableTools() {
        const tools = {};
        
        for (const [name, config] of Object.entries(toolRegistry)) {
            tools[name] = {
                requiresProject: config.requiresProject,
                createsCheckpoint: config.createsCheckpoint,
                category: this.getToolCategory(name)
            };
        }
        
        return tools;
    }

    /**
     * Get tool category based on name patterns
     */
    getToolCategory(toolName) {
        if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write') || toolName.includes('create') || toolName.includes('delete')) {
            return 'file_operations';
        }
        if (toolName.includes('analyze') || toolName.includes('search') || toolName.includes('code') || toolName.includes('symbol')) {
            return 'code_analysis';
        }
        if (toolName.includes('research') || toolName.includes('url') || toolName.includes('search')) {
            return 'research';
        }
        if (toolName.includes('debug') || toolName.includes('trace') || toolName.includes('engineering')) {
            return 'engineering';
        }
        if (toolName.includes('dependency') || toolName.includes('operation') || toolName.includes('timeout')) {
            return 'system';
        }
        return 'core';
    }

    /**
     * Create a checkpoint for file operations
     */
    async createCheckpoint(toolName) {
        const checkpointId = `checkpoint_${Date.now()}_${toolName}`;
        const timestamp = new Date().toISOString();
        
        // Store checkpoint metadata
        this.checkpoints.set(checkpointId, {
            id: checkpointId,
            toolName,
            timestamp,
            projectState: this.projectHandle ? 'available' : 'none'
        });
        
        // Maintain checkpoint limit
        if (this.checkpoints.size > this.maxCheckpoints) {
            const oldestKey = this.checkpoints.keys().next().value;
            this.checkpoints.delete(oldestKey);
        }
        
        return checkpointId;
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return performanceMonitor.getStatistics();
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.checkpoints.clear();
        performanceMonitor.cleanup();
        dependencyGraphManager.clear();
        this.isInitialized = false;
    }
}

// Export singleton instance
export const toolExecutor = new ToolExecutor();

// Export for backward compatibility
export default toolExecutor;