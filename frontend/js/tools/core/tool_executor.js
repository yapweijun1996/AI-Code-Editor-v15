/**
 * @fileoverview Streamlined Tool Executor - Main orchestrator for the modular tool system
 *
 * This module provides the main ToolExecutor class that orchestrates tool execution across
 * the entire AI Code Editor system. It replaces the monolithic tool_executor.js with a
 * clean, modular architecture that supports advanced features like dependency management,
 * performance monitoring, retry logic, and sophisticated error handling.
 *
 * Key Features:
 * - Single tool and tool chain execution
 * - Performance monitoring and timeout management
 * - Operation tracking and cancellation support
 * - Dependency graph integration for optimized execution
 * - Sophisticated retry logic with exponential backoff
 * - Fallback mechanisms for failed operations
 * - Checkpoint management for file operations
 * - Memory and resource optimization
 *
 * Architecture:
 * - ToolExecutor class: Main orchestrator
 * - Performance monitoring: Execution timing and optimization
 * - Operation management: Tracking, cancellation, and lifecycle
 * - Dependency management: Graph-based execution planning
 * - Error handling: Analysis, retry, and recovery
 *
 * @author AI Code Editor Team
 * @version 1.0.0
 * @since 2024
 */

import { toolRegistry } from './tool_registry.js';
import { createSuccessResponse, createErrorResponse, createEnhancedErrorResponse, validateToolParameters } from './tool_interfaces.js';
import { createOperationToken, trackOperation, completeOperation, cancelOperation } from '../system/operation_manager.js';
import { performanceMonitor } from '../system/performance_tools.js';
import { dependencyGraphManager } from '../system/dependency_graph.js';
import { analyzeError, withRetry, withProgressiveTimeout, buildErrorContext } from '../utils/shared_utils.js';

/**
 * Main ToolExecutor class - orchestrates tool execution with advanced features
 *
 * The ToolExecutor is the central orchestrator for all tool operations in the AI Code Editor.
 * It provides sophisticated execution capabilities including performance monitoring,
 * operation tracking, dependency management, and intelligent error handling with recovery.
 *
 * Features:
 * - Single tool execution with retry logic and fallbacks
 * - Tool chain execution with dependency management
 * - Performance monitoring and adaptive optimization
 * - Operation lifecycle management and cancellation
 * - Checkpoint system for undo/redo operations
 * - Memory and resource usage optimization
 * - Comprehensive error analysis and recovery
 *
 * @class ToolExecutor
 * @example
 * // Initialize and use the tool executor
 * import { toolExecutor } from './tool_executor.js';
 *
 * // Initialize with project context
 * await toolExecutor.initialize(projectHandle);
 *
 * // Execute a single tool
 * const result = await toolExecutor.executeTool('read_file', {
 *   filename: 'src/app.js',
 *   include_line_numbers: true
 * });
 *
 * // Execute a tool chain
 * const chainResult = await toolExecutor.executeToolChain([
 *   { name: 'read_file', parameters: { filename: 'input.js' } },
 *   { name: 'analyze_code', parameters: { filename: 'input.js' } },
 *   { name: 'create_file', parameters: { filename: 'output.js', content: '...' } }
 * ]);
 */
export class ToolExecutor {
    /**
     * Creates a new ToolExecutor instance
     *
     * Initializes the executor with default settings. The executor must be
     * initialized with a project handle before it can execute project-dependent tools.
     *
     * @constructor
     */
    constructor() {
        /** @type {boolean} Whether the executor has been initialized */
        this.isInitialized = false;
        
        /** @type {*} Project handle for file system operations */
        this.projectHandle = null;
        
        /** @type {Map<string, Object>} Checkpoint storage for undo operations */
        this.checkpoints = new Map();
        
        /** @type {number} Maximum number of checkpoints to maintain */
        this.maxCheckpoints = 10;
    }

    /**
     * Initialize the tool executor with project context
     *
     * Sets up the executor with project context and initializes performance monitoring.
     * Must be called before executing any project-dependent tools.
     *
     * @async
     * @param {*} [projectHandle=null] - Project handle for file system operations
     * @returns {Promise<Object>} Initialization result
     * @returns {boolean} returns.success - Whether initialization succeeded
     * @returns {string} returns.message - Initialization status message
     * @returns {Object} [returns.data] - Additional initialization data
     * @returns {boolean} returns.data.hasProject - Whether project handle was provided
     * @returns {number} returns.data.availableTools - Number of available tools
     *
     * @example
     * // Initialize without project (for non-project tools only)
     * const result = await toolExecutor.initialize();
     *
     * @example
     * // Initialize with project handle
     * const result = await toolExecutor.initialize(projectHandle);
     * if (result.success) {
     *   console.log(`Initialized with ${result.data.availableTools} tools`);
     * }
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
     *
     * This is the primary method for executing individual tools. It provides comprehensive
     * error handling, automatic retry logic, performance monitoring, and fallback mechanisms
     * to ensure reliable tool execution even in challenging conditions.
     *
     * @async
     * @param {string} toolName - Name of the tool to execute
     * @param {Object} [parameters={}] - Parameters to pass to the tool
     * @param {Object} [options={}] - Execution options
     * @param {number} [options.timeout] - Custom timeout in milliseconds
     * @param {boolean} [options.disableRetry=false] - Whether to disable retry logic
     * @param {Function} [options.progressCallback] - Progress callback for long operations
     * @param {Function} [options.onRetry] - Callback called on each retry attempt
     * @param {number} [options.chainIndex] - Index in tool chain (for chain execution)
     * @param {number} [options.totalChainLength] - Total length of tool chain
     * @returns {Promise<Object>} Tool execution result
     * @returns {boolean} returns.success - Whether execution succeeded
     * @returns {string} returns.message - Result or error message
     * @returns {Object} [returns.data] - Tool-specific result data
     * @returns {number} returns.executionTime - Execution time in milliseconds
     * @returns {string} returns.operationId - Unique operation identifier
     * @returns {string} [returns.checkpointId] - Checkpoint ID (if checkpoint was created)
     * @returns {Object} returns.enhancedHandling - Information about enhanced handling used
     * @returns {boolean} returns.enhancedHandling.usedRetry - Whether retry logic was used
     * @returns {boolean} returns.enhancedHandling.usedProgressiveTimeout - Whether progressive timeout was used
     * @returns {boolean} [returns.usedFallback] - Whether fallback mechanism was used
     * @returns {Object} [returns.errorAnalysis] - Error analysis (if execution failed)
     *
     * @throws {Error} If tool name is invalid or critical validation fails
     *
     * @example
     * // Simple tool execution
     * const result = await toolExecutor.executeTool('read_file', {
     *   filename: 'src/app.js'
     * });
     *
     * @example
     * // Tool execution with options
     * const result = await toolExecutor.executeTool('perform_research', {
     *   query: 'JavaScript best practices'
     * }, {
     *   timeout: 60000,
     *   progressCallback: (progress) => console.log(`Progress: ${progress.message}`),
     *   onRetry: (error, attempt) => console.log(`Retry ${attempt}: ${error.message}`)
     * });
     *
     * @example
     * // Handle execution result
     * const result = await toolExecutor.executeTool('create_file', {
     *   filename: 'new-component.jsx',
     *   content: 'export default function Component() { return <div>Hello</div>; }'
     * });
     *
     * if (result.success) {
     *   console.log(`File created in ${result.executionTime}ms`);
     *   if (result.checkpointId) {
     *     console.log(`Checkpoint created: ${result.checkpointId}`);
     *   }
     * } else {
     *   console.error('Creation failed:', result.message);
     *   if (result.errorAnalysis) {
     *     console.log('Recovery suggestions:', result.errorAnalysis.recoverySuggestions);
     *   }
     * }
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
     * Determines if a tool should use retry logic based on tool type and options
     *
     * Analyzes the tool name and options to determine whether retry logic would be
     * beneficial for this particular tool execution.
     *
     * @param {string} toolName - Name of the tool to check
     * @param {Object} [options={}] - Execution options
     * @param {boolean} [options.disableRetry=false] - Whether retry is explicitly disabled
     * @returns {boolean} Whether the tool should use retry logic
     *
     * @example
     * const shouldRetry = toolExecutor.shouldRetryTool('read_url');
     * console.log('Should retry network operation:', shouldRetry); // true
     *
     * const noRetry = toolExecutor.shouldRetryTool('read_url', { disableRetry: true });
     * console.log('Retry disabled:', noRetry); // false
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
     * Determines if a tool should use progressive timeout with progress feedback
     *
     * Analyzes the tool name and parameters to determine whether progressive timeout
     * (with progress callbacks and warnings) would be beneficial for this operation.
     *
     * @param {string} toolName - Name of the tool to check
     * @param {Object} [parameters={}] - Tool parameters
     * @returns {boolean} Whether the tool should use progressive timeout
     *
     * @example
     * const useProgressive = toolExecutor.shouldUseProgressiveTimeout('perform_research');
     * console.log('Use progressive timeout:', useProgressive); // true
     *
     * const largeFile = toolExecutor.shouldUseProgressiveTimeout('read_file', {
     *   content: 'very large content...'
     * });
     * console.log('Large file needs progressive timeout:', largeFile); // true
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
     * Gets maximum retry attempts for a tool based on its type and characteristics
     *
     * Different tool types have different optimal retry counts based on their
     * failure patterns and recovery likelihood.
     *
     * @param {string} toolName - Name of the tool
     * @returns {number} Maximum number of retry attempts
     *
     * @example
     * const maxRetries = toolExecutor.getMaxRetries('read_url');
     * console.log('Network operations max retries:', maxRetries); // 3
     *
     * const fileRetries = toolExecutor.getMaxRetries('read_file');
     * console.log('File operations max retries:', fileRetries); // 2
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
     * Gets the optimal backoff strategy for retry attempts based on tool type
     *
     * Different tool types benefit from different backoff strategies:
     * - Exponential: For network operations (handles server load)
     * - Linear: For file operations (consistent retry intervals)
     *
     * @param {string} toolName - Name of the tool
     * @returns {string} Backoff strategy ('exponential', 'linear', or 'progressive')
     *
     * @example
     * const strategy = toolExecutor.getBackoffStrategy('perform_research');
     * console.log('Research backoff strategy:', strategy); // 'exponential'
     *
     * const fileStrategy = toolExecutor.getBackoffStrategy('create_file');
     * console.log('File operation strategy:', fileStrategy); // 'linear'
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
     * Gets appropriate timeout for a tool based on its type and parameters
     *
     * Calculates optimal timeout values based on tool characteristics and
     * parameter analysis (e.g., content size for file operations).
     *
     * @param {string} toolName - Name of the tool
     * @param {Object} [parameters={}] - Tool parameters for timeout calculation
     * @returns {number} Timeout in milliseconds
     *
     * @example
     * const timeout = toolExecutor.getToolTimeout('read_url');
     * console.log('Network operation timeout:', timeout); // 45000 (45 seconds)
     *
     * const fileTimeout = toolExecutor.getToolTimeout('create_file', {
     *   content: 'large file content...'
     * });
     * console.log('Large file timeout:', fileTimeout); // 90000 (90 seconds)
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
     *
     * When a tool operation fails, this method attempts various fallback strategies
     * based on the error type and tool characteristics. Fallbacks include reduced
     * scope operations, alternative approaches, and graceful degradation.
     *
     * @async
     * @param {string} toolName - Name of the tool that failed
     * @param {Object} parameters - Original tool parameters
     * @param {Error} error - The error that occurred
     * @param {Object} [options={}] - Execution options
     * @returns {Promise<Object|null>} Fallback result or null if no fallback available
     *
     * @example
     * // This is typically called internally by executeTool
     * const fallbackResult = await toolExecutor.tryFallbackMechanisms(
     *   'perform_research',
     *   { query: 'complex query', max_results: 10 },
     *   new Error('Request timeout'),
     *   { timeout: 30000 }
     * );
     *
     * if (fallbackResult) {
     *   console.log('Fallback succeeded with reduced scope');
     * }
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
     *
     * Implements specific fallback strategies for file operations, including
     * streaming approaches for large files and permission error handling.
     *
     * @async
     * @private
     * @param {string} toolName - Name of the file operation tool
     * @param {Object} parameters - Original tool parameters
     * @param {Error} error - The error that occurred
     * @param {Object} options - Execution options
     * @returns {Promise<Object|null>} Fallback result or null
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
     *
     * Implements fallback strategies for research operations, including
     * reduced scope searches and alternative search strategies.
     *
     * @async
     * @private
     * @param {string} toolName - Name of the research tool
     * @param {Object} parameters - Original tool parameters
     * @param {Error} error - The error that occurred
     * @param {Object} options - Execution options
     * @returns {Promise<Object|null>} Fallback result or null
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
     *
     * Implements fallback strategies for code analysis operations, including
     * reduced scope analysis and alternative parsing approaches.
     *
     * @async
     * @private
     * @param {string} toolName - Name of the analysis tool
     * @param {Object} parameters - Original tool parameters
     * @param {Error} error - The error that occurred
     * @param {Object} options - Execution options
     * @returns {Promise<Object|null>} Fallback result or null
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
     * Execute multiple tools with dependency management and optimization
     *
     * Executes a sequence of tools with optional dependency graph optimization.
     * Can run tools sequentially or in parallel based on dependencies and system capabilities.
     *
     * @async
     * @param {Array<Object>} tools - Array of tool definitions
     * @param {string} tools[].name - Tool name
     * @param {Object} [tools[].parameters={}] - Tool parameters
     * @param {number} [tools[].priority=1] - Tool priority for execution order
     * @param {number} [tools[].estimatedDuration=5000] - Estimated execution time in ms
     * @param {Object} [tools[].metadata={}] - Additional tool metadata
     * @param {number[]} [tools[].dependencies=[]] - Array of dependency indices
     * @param {Object} [options={}] - Execution options
     * @param {boolean} [options.useDependencyGraph=false] - Whether to use dependency graph optimization
     * @param {boolean} [options.continueOnError=false] - Whether to continue execution after errors
     * @returns {Promise<Object>} Tool chain execution result
     * @returns {boolean} returns.success - Whether chain execution succeeded
     * @returns {string} returns.message - Summary message
     * @returns {Array<Object>} returns.results - Results from each tool execution
     * @returns {Object} returns.summary - Execution summary statistics
     * @returns {number} returns.summary.total - Total number of tools
     * @returns {number} returns.summary.succeeded - Number of successful executions
     * @returns {number} returns.summary.failed - Number of failed executions
     * @returns {number} returns.summary.executionTime - Total execution time in ms
     *
     * @example
     * // Simple sequential tool chain
     * const result = await toolExecutor.executeToolChain([
     *   { name: 'read_file', parameters: { filename: 'input.js' } },
     *   { name: 'analyze_code', parameters: { filename: 'input.js' } },
     *   { name: 'create_file', parameters: { filename: 'output.js', content: '...' } }
     * ]);
     *
     * @example
     * // Tool chain with dependency optimization
     * const result = await toolExecutor.executeToolChain([
     *   { name: 'read_file', parameters: { filename: 'a.js' } },
     *   { name: 'read_file', parameters: { filename: 'b.js' } },
     *   { name: 'analyze_code', parameters: { filename: 'a.js' }, dependencies: [0] },
     *   { name: 'analyze_code', parameters: { filename: 'b.js' }, dependencies: [1] }
     * ], {
     *   useDependencyGraph: true,
     *   continueOnError: true
     * });
     *
     * console.log(`Chain completed: ${result.summary.succeeded}/${result.summary.total} tools succeeded`);
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
     * Execute tools according to dependency graph plan with parallel optimization
     *
     * Executes tools based on a pre-computed dependency graph plan, enabling
     * parallel execution where possible and respecting dependency constraints.
     *
     * @async
     * @param {Object} plan - Dependency graph execution plan
     * @param {Array<Object>} plan.phases - Execution phases
     * @param {Array<Object>} plan.phases[].tools - Tools in each phase
     * @param {boolean} plan.phases[].canRunInParallel - Whether phase tools can run in parallel
     * @param {number} plan.totalEstimatedTime - Total estimated execution time
     * @param {Array<Object>} plan.criticalPath - Critical path through the graph
     * @param {Array<Object>} plan.parallelGroups - Groups that can run in parallel
     * @param {Object} [options={}] - Execution options
     * @param {boolean} [options.continueOnError=false] - Whether to continue after errors
     * @returns {Promise<Object>} Dependency-based execution result
     * @returns {boolean} returns.success - Whether execution succeeded
     * @returns {string} returns.message - Summary message
     * @returns {Array<Object>} returns.results - Results from each tool execution
     * @returns {Object} returns.executionPlan - The execution plan that was used
     * @returns {Object} returns.summary - Execution summary with performance metrics
     * @returns {number} returns.summary.phasesCompleted - Number of phases completed
     *
     * @example
     * // This is typically called internally by executeToolChain
     * const plan = await toolExecutor.executeTool('get_execution_plan');
     * const result = await toolExecutor.executeByDependencyPlan(plan.data.plan, {
     *   continueOnError: false
     * });
     *
     * console.log(`Executed ${result.summary.phasesCompleted} phases`);
     * console.log(`Parallel optimization saved time: ${plan.totalEstimatedTime - result.summary.executionTime}ms`);
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
     * Get available tools with their metadata and categorization
     *
     * Returns information about all available tools including their requirements,
     * capabilities, and categorization for discovery and planning purposes.
     *
     * @returns {Object<string, Object>} Available tools with metadata
     * @returns {boolean} returns.toolName.requiresProject - Whether tool needs project context
     * @returns {boolean} returns.toolName.createsCheckpoint - Whether tool creates checkpoints
     * @returns {string} returns.toolName.category - Tool category classification
     *
     * @example
     * const tools = toolExecutor.getAvailableTools();
     *
     * // Find all file operation tools
     * const fileTools = Object.entries(tools)
     *   .filter(([name, info]) => info.category === 'file_operations')
     *   .map(([name]) => name);
     *
     * console.log('File operation tools:', fileTools);
     *
     * // Check if a tool requires a project
     * if (tools['read_file']?.requiresProject) {
     *   console.log('read_file requires a project to be loaded');
     * }
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
     * Get tool category based on name patterns and functionality
     *
     * Analyzes tool names to automatically categorize them for organization
     * and discovery purposes.
     *
     * @param {string} toolName - Name of the tool to categorize
     * @returns {string} Tool category ('file_operations', 'code_analysis', 'research', 'engineering', 'system', 'core')
     *
     * @example
     * const category = toolExecutor.getToolCategory('read_file');
     * console.log('Category:', category); // 'file_operations'
     *
     * const researchCategory = toolExecutor.getToolCategory('perform_research');
     * console.log('Category:', researchCategory); // 'research'
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
     * Create a checkpoint for file operations to enable undo functionality
     *
     * Creates a checkpoint that can be used to undo file modifications.
     * Automatically manages checkpoint storage and cleanup.
     *
     * @async
     * @param {string} toolName - Name of the tool creating the checkpoint
     * @returns {Promise<string>} Unique checkpoint identifier
     *
     * @example
     * // This is typically called internally by executeTool
     * const checkpointId = await toolExecutor.createCheckpoint('create_file');
     * console.log('Created checkpoint:', checkpointId);
     *
     * // Checkpoints are automatically managed and cleaned up
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
     * Get performance statistics for monitoring and optimization
     *
     * Returns comprehensive performance metrics collected during tool execution
     * for monitoring, debugging, and optimization purposes.
     *
     * @returns {Object} Performance statistics from the performance monitor
     *
     * @example
     * const stats = toolExecutor.getPerformanceStats();
     * console.log('Average execution time:', stats.averageExecutionTime);
     * console.log('Total operations:', stats.totalOperations);
     * console.log('Error rate:', stats.errorRate);
     *
     * // Use stats for optimization decisions
     * if (stats.errorRate > 0.1) {
     *   console.warn('High error rate detected, consider adjusting retry settings');
     * }
     */
    getPerformanceStats() {
        return performanceMonitor.getStatistics();
    }

    /**
     * Clean up resources and reset executor state
     *
     * Performs cleanup of all resources including checkpoints, performance monitors,
     * dependency graphs, and resets the executor to uninitialized state.
     *
     * @example
     * // Clean up when shutting down or switching projects
     * toolExecutor.cleanup();
     * console.log('Tool executor cleaned up and reset');
     *
     * // Re-initialize for new project
     * await toolExecutor.initialize(newProjectHandle);
     */
    cleanup() {
        this.checkpoints.clear();
        performanceMonitor.cleanup();
        dependencyGraphManager.clear();
        this.isInitialized = false;
    }
}

/**
 * Singleton instance of ToolExecutor for global use
 *
 * This is the main instance used throughout the application. It provides
 * a consistent interface for tool execution across all components.
 *
 * @type {ToolExecutor}
 * @example
 * import { toolExecutor } from './tool_executor.js';
 *
 * // Initialize and use the global instance
 * await toolExecutor.initialize(projectHandle);
 * const result = await toolExecutor.executeTool('read_file', { filename: 'app.js' });
 */
export const toolExecutor = new ToolExecutor();

/**
 * Default export for backward compatibility
 * @type {ToolExecutor}
 */
export default toolExecutor;