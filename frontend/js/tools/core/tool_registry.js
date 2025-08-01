/**
 * @fileoverview Central Tool Registry - Imports and organizes all tools from various modules
 *
 * This module serves as the central registry for all available tools in the AI Code Editor.
 * It imports tools from all specialized modules and provides a unified interface for
 * tool discovery, execution, and management.
 *
 * Key Features:
 * - Central registry mapping tool names to handlers
 * - Tool metadata management (requirements, checkpoints, categories)
 * - System operation management (timeouts, cancellation, dependency graphs)
 * - Tool categorization and organization
 * - Operation tracking and performance monitoring
 *
 * Tool Categories:
 * - File Operations: Reading, writing, and managing files
 * - Code Analysis: AST parsing, symbol analysis, quality checks
 * - Research Tools: Web research and search engine integration
 * - Engineering Tools: Advanced AI capabilities and debugging
 * - System Management: Operation tracking, performance, dependencies
 *
 * @author AI Code Editor Team
 * @version 1.0.0
 * @since 2024
 */

// Import file operation tools
import {
    _getProjectStructure,
    _readFile,
    _readFileLines,
    _searchInFile,
    _readMultipleFiles,
    _getFileInfo,
    _getOpenFileContent,
    _getSelectedText,
    _setSelectedText
} from '../file_operations/file_readers.js';

import {
    _createFile,
    _applyDiff,
    _smartEditFile,
    _editFile,
    _appendToFile,
    _replaceSelectedText
} from '../file_operations/file_writers.js';

import {
    _deleteFile,
    _renameFile,
    _createFolder,
    _deleteFolder,
    _renameFolder,
    _findAndReplace,
    _insertAtLine,
    _replaceLines,
    _smartReplace,
    _undoLastChange,
    _formatCode,
    _createDiff
} from '../file_operations/file_managers.js';

// Import code analysis tools
import {
    _analyzeCode,
    _analyzeSymbol,
    _explainCodeSection,
    _traceVariableFlow,
    _validateSyntax,
    _batchAnalyzeFiles,
    _batchValidateFiles
} from '../code_analysis/analyzers.js';

import {
    _searchCode,
    _buildCodebaseIndex,
    _queryCodebase,
    _reindexCodebasePaths,
    build_backend_index,
    query_backend_index
} from '../code_analysis/search_tools.js';

import {
    _analyzeCodeQuality,
    _optimizeCodeArchitecture
} from '../code_analysis/quality_tools.js';

// Import research tools
import {
    _readUrl,
    _performResearch,
    _testResearch
} from '../research/web_research.js';

import {
    _duckduckgoSearch
} from '../research/search_engines.js';

// Import engineering tools
import {
    _buildSymbolTable,
    _traceDataFlow,
    _solveEngineeringProblem,
    _getEngineeringInsights
} from '../engineering/senior_ai_tools.js';

import {
    _debugSystematically
} from '../engineering/debugging_tools.js';

// Import system tools
import {
    debuggingState,
    getActiveOperationsStatus,
    cancelOperation,
    cancelAllOperations
} from '../system/operation_manager.js';

import {
    dependencyGraphManager
} from '../system/dependency_graph.js';

/**
 * Central tool registry containing all available tools organized by category
 *
 * Each tool entry contains:
 * - handler: Function that implements the tool's functionality
 * - requiresProject: Whether the tool needs a project to be loaded
 * - createsCheckpoint: Whether the tool creates an undo checkpoint
 *
 * @type {Object<string, Object>}
 * @property {Function} handler - The tool's implementation function
 * @property {boolean} requiresProject - Whether tool requires project context
 * @property {boolean} createsCheckpoint - Whether tool creates undo checkpoint
 *
 * @example
 * // Access a tool from the registry
 * const readFileTool = toolRegistry['read_file'];
 * if (readFileTool) {
 *   const result = await readFileTool.handler(params, options);
 * }
 *
 * @example
 * // Check tool requirements
 * const tool = toolRegistry['create_file'];
 * console.log('Requires project:', tool.requiresProject); // true
 * console.log('Creates checkpoint:', tool.createsCheckpoint); // true
 */
export const toolRegistry = {
    // List tools
    list_tools: { handler: _listTools, requiresProject: false, createsCheckpoint: false },
    
    // Operation management tools
    get_active_operations: { handler: _getActiveOperations, requiresProject: false, createsCheckpoint: false },
    cancel_operation: { handler: _cancelOperation, requiresProject: false, createsCheckpoint: false },
    cancel_all_operations: { handler: _cancelAllOperations, requiresProject: false, createsCheckpoint: false },
    get_timeout_settings: { handler: _getTimeoutSettings, requiresProject: false, createsCheckpoint: false },
    update_timeout_settings: { handler: _updateTimeoutSettings, requiresProject: false, createsCheckpoint: false },
    
    // Dependency graph management tools
    create_dependency_graph: { handler: _createDependencyGraph, requiresProject: false, createsCheckpoint: false },
    get_execution_plan: { handler: _getExecutionPlan, requiresProject: false, createsCheckpoint: false },
    get_dependency_graph_status: { handler: _getDependencyGraphStatus, requiresProject: false, createsCheckpoint: false },
    add_tool_to_dependency_graph: { handler: _addToolToDependencyGraph, requiresProject: false, createsCheckpoint: false },
    clear_dependency_graph: { handler: _clearDependencyGraph, requiresProject: false, createsCheckpoint: false },
    export_dependency_graph: { handler: _exportDependencyGraph, requiresProject: false, createsCheckpoint: false },
    
    // Project-based tools
    get_project_structure: { handler: _getProjectStructure, requiresProject: true, createsCheckpoint: false },
    
    // Enhanced code comprehension tools
    analyze_symbol: { handler: _analyzeSymbol, requiresProject: true, createsCheckpoint: false },
    explain_code_section: { handler: _explainCodeSection, requiresProject: true, createsCheckpoint: false },
    trace_variable_flow: { handler: _traceVariableFlow, requiresProject: true, createsCheckpoint: false },
    validate_syntax: { handler: _validateSyntax, requiresProject: true, createsCheckpoint: false },
    
    // Senior Engineer AI Tools
    build_symbol_table: { handler: _buildSymbolTable, requiresProject: true, createsCheckpoint: false },
    trace_data_flow: { handler: _traceDataFlow, requiresProject: true, createsCheckpoint: false },
    debug_systematically: { handler: _debugSystematically, requiresProject: false, createsCheckpoint: false },
    analyze_code_quality: { handler: _analyzeCodeQuality, requiresProject: true, createsCheckpoint: false },
    solve_engineering_problem: { handler: _solveEngineeringProblem, requiresProject: false, createsCheckpoint: false },
    get_engineering_insights: { handler: _getEngineeringInsights, requiresProject: false, createsCheckpoint: false },
    optimize_code_architecture: { handler: _optimizeCodeArchitecture, requiresProject: true, createsCheckpoint: false },
    
    // File operations
    read_file: { handler: _readFile, requiresProject: true, createsCheckpoint: false },
    read_file_lines: { handler: _readFileLines, requiresProject: true, createsCheckpoint: false },
    search_in_file: { handler: _searchInFile, requiresProject: true, createsCheckpoint: false },
    read_multiple_files: { handler: _readMultipleFiles, requiresProject: true, createsCheckpoint: false },
    search_code: { handler: _searchCode, requiresProject: true, createsCheckpoint: false },
    build_or_update_codebase_index: { handler: _buildCodebaseIndex, requiresProject: true, createsCheckpoint: false },
    query_codebase: { handler: _queryCodebase, requiresProject: true, createsCheckpoint: false },
    reindex_codebase_paths: { handler: _reindexCodebasePaths, requiresProject: true, createsCheckpoint: false },
    format_code: { handler: _formatCode, requiresProject: true, createsCheckpoint: false },
    analyze_code: { handler: _analyzeCode, requiresProject: true, createsCheckpoint: false },

    // New backend indexer tools
    build_backend_index: { handler: build_backend_index, requiresProject: true, createsCheckpoint: false },
    query_backend_index: { handler: query_backend_index, requiresProject: true, createsCheckpoint: false },

    // Smart file modification tools
    create_file: { handler: _createFile, requiresProject: true, createsCheckpoint: true },
    edit_file: { handler: _editFile, requiresProject: true, createsCheckpoint: true },
    append_to_file: { handler: _appendToFile, requiresProject: true, createsCheckpoint: true },
    get_file_info: { handler: _getFileInfo, requiresProject: true, createsCheckpoint: false },
    delete_file: { handler: _deleteFile, requiresProject: true, createsCheckpoint: true },
    rename_file: { handler: _renameFile, requiresProject: true, createsCheckpoint: true },
    create_folder: { handler: _createFolder, requiresProject: true, createsCheckpoint: true },
    delete_folder: { handler: _deleteFolder, requiresProject: true, createsCheckpoint: true },
    rename_folder: { handler: _renameFolder, requiresProject: true, createsCheckpoint: true },

    // Non-project / Editor tools
    read_url: { handler: _readUrl, requiresProject: false, createsCheckpoint: false },
    duckduckgo_search: { handler: _duckduckgoSearch, requiresProject: false, createsCheckpoint: false },
    perform_research: { handler: _performResearch, requiresProject: false, createsCheckpoint: false },
    get_open_file_content: { handler: _getOpenFileContent, requiresProject: false, createsCheckpoint: false },
    get_selected_text: { handler: _getSelectedText, requiresProject: false, createsCheckpoint: false },
    replace_selected_text: { handler: _replaceSelectedText, requiresProject: false, createsCheckpoint: false },
    set_selected_text: { handler: _setSelectedText, requiresProject: false, createsCheckpoint: false },
    create_diff: { handler: _createDiff, requiresProject: false, createsCheckpoint: false },
    apply_diff: { handler: _applyDiff, requiresProject: true, createsCheckpoint: true },
    
    // Alternative file editing tools - more reliable than apply_diff in many cases
    find_and_replace: { handler: _findAndReplace, requiresProject: true, createsCheckpoint: true },
    insert_at_line: { handler: _insertAtLine, requiresProject: true, createsCheckpoint: true },
    replace_lines: { handler: _replaceLines, requiresProject: true, createsCheckpoint: true },
    smart_replace: { handler: _smartReplace, requiresProject: true, createsCheckpoint: true },
    
    // Batch processing tools for efficient bulk operations
    batch_analyze_files: { handler: _batchAnalyzeFiles, requiresProject: true, createsCheckpoint: false },
    batch_validate_files: { handler: _batchValidateFiles, requiresProject: true, createsCheckpoint: false },
    
    undo_last_change: { handler: _undoLastChange, requiresProject: true, createsCheckpoint: false },
    test_research: { handler: _testResearch, requiresProject: false, createsCheckpoint: false },
};

/**
 * Retrieves information about currently active operations
 *
 * Provides detailed information about all operations currently running in the system,
 * including their status, duration, and summary statistics.
 *
 * @async
 * @function _getActiveOperations
 * @returns {Promise<Object>} Active operations information
 * @returns {string} returns.message - Summary message about active operations
 * @returns {Array<Object>} returns.operations - Array of active operation objects
 * @returns {Object} returns.summary - Summary statistics
 * @returns {number} returns.summary.total - Total number of active operations
 * @returns {number} returns.summary.running - Number of currently running operations
 * @returns {number} returns.summary.cancelled - Number of cancelled operations
 * @returns {number} returns.summary.longestRunning - Duration of longest running operation (ms)
 *
 * @example
 * const activeOps = await _getActiveOperations();
 * console.log(`Found ${activeOps.operations.length} active operations`);
 * console.log(`Longest running: ${activeOps.summary.longestRunning}ms`);
 */
async function _getActiveOperations() {
    const operations = getActiveOperationsStatus();
    return {
        message: `Found ${operations.length} active operations`,
        operations,
        summary: {
            total: operations.length,
            running: operations.filter(op => op.status === 'running').length,
            cancelled: operations.filter(op => op.status === 'cancelled').length,
            longestRunning: operations.length > 0 ? Math.max(...operations.map(op => op.duration)) : 0
        }
    };
}

/**
 * Cancels a specific operation by its ID
 *
 * Attempts to cancel a running operation and provides feedback on whether
 * the cancellation was successful.
 *
 * @async
 * @function _cancelOperation
 * @param {Object} params - Cancellation parameters
 * @param {string} params.operation_id - Unique identifier of the operation to cancel
 * @param {string} [params.reason='User requested cancellation'] - Reason for cancellation
 * @returns {Promise<Object>} Cancellation result
 * @returns {string} returns.message - Result message
 * @returns {boolean} returns.success - Whether cancellation was successful
 * @returns {string} returns.reason - Reason for cancellation
 * @throws {Error} If operation_id parameter is missing
 *
 * @example
 * // Cancel a specific operation
 * const result = await _cancelOperation({
 *   operation_id: 'op_12345',
 *   reason: 'User cancelled via UI'
 * });
 *
 * @example
 * // Cancel with default reason
 * const result = await _cancelOperation({ operation_id: 'op_67890' });
 */
async function _cancelOperation({ operation_id, reason = 'User requested cancellation' }) {
    if (!operation_id) throw new Error("The 'operation_id' parameter is required.");
    
    const success = cancelOperation(operation_id, reason);
    return {
        message: success ?
            `Operation ${operation_id} cancelled successfully` :
            `Operation ${operation_id} not found or already completed`,
        success,
        reason
    };
}

/**
 * Cancels all currently active operations
 *
 * Cancels all running operations in the system and returns the count of
 * operations that were cancelled.
 *
 * @async
 * @function _cancelAllOperations
 * @param {Object} [params={}] - Cancellation parameters
 * @param {string} [params.reason='User requested cancellation of all operations'] - Reason for cancellation
 * @returns {Promise<Object>} Cancellation result
 * @returns {string} returns.message - Result message with count
 * @returns {number} returns.cancelledCount - Number of operations cancelled
 * @returns {string} returns.reason - Reason for cancellation
 *
 * @example
 * // Cancel all operations
 * const result = await _cancelAllOperations({
 *   reason: 'System shutdown requested'
 * });
 * console.log(`Cancelled ${result.cancelledCount} operations`);
 */
async function _cancelAllOperations({ reason = 'User requested cancellation of all operations' }) {
    const cancelledCount = cancelAllOperations(reason);
    return {
        message: `Cancelled ${cancelledCount} active operations`,
        cancelledCount,
        reason
    };
}

/**
 * Retrieves current timeout settings for different tool types
 *
 * Returns the current timeout configuration for various tool categories,
 * along with information about active operations.
 *
 * @async
 * @function _getTimeoutSettings
 * @returns {Promise<Object>} Timeout settings information
 * @returns {string} returns.message - Description message
 * @returns {Object} returns.settings - Current timeout settings by tool type
 * @returns {number} returns.activeOperations - Number of currently active operations
 *
 * @example
 * const timeouts = await _getTimeoutSettings();
 * console.log('File operation timeout:', timeouts.settings.file_operations);
 * console.log('Active operations:', timeouts.activeOperations);
 */
async function _getTimeoutSettings() {
    return {
        message: 'Current timeout settings',
        settings: debuggingState.timeoutSettings,
        activeOperations: debuggingState.activeOperations.size
    };
}

/**
 * Updates timeout settings for a specific tool type
 *
 * Modifies the timeout configuration for a specific category of tools.
 * Useful for adjusting performance based on system capabilities or user preferences.
 *
 * @async
 * @function _updateTimeoutSettings
 * @param {Object} params - Timeout update parameters
 * @param {string} params.tool_type - Type of tool to update timeout for
 * @param {number} params.timeout_ms - New timeout value in milliseconds
 * @returns {Promise<Object>} Update result
 * @returns {string} returns.message - Result message
 * @returns {string} returns.tool_type - Tool type that was updated
 * @returns {number} returns.old_timeout - Previous timeout value
 * @returns {number} returns.new_timeout - New timeout value
 * @throws {Error} If tool_type or timeout_ms parameters are missing or invalid
 *
 * @example
 * // Increase timeout for file operations
 * const result = await _updateTimeoutSettings({
 *   tool_type: 'file_operations',
 *   timeout_ms: 60000
 * });
 * console.log(`Updated ${result.tool_type} timeout from ${result.old_timeout}ms to ${result.new_timeout}ms`);
 */
async function _updateTimeoutSettings({ tool_type, timeout_ms }) {
    if (!tool_type || typeof timeout_ms !== 'number') {
        throw new Error("Both 'tool_type' and 'timeout_ms' parameters are required.");
    }
    
    if (!debuggingState.timeoutSettings.hasOwnProperty(tool_type)) {
        throw new Error(`Invalid tool_type '${tool_type}'. Valid types: ${Object.keys(debuggingState.timeoutSettings).join(', ')}`);
    }
    
    const oldTimeout = debuggingState.timeoutSettings[tool_type];
    debuggingState.timeoutSettings[tool_type] = timeout_ms;
    
    return {
        message: `Updated ${tool_type} timeout from ${oldTimeout}ms to ${timeout_ms}ms`,
        tool_type,
        old_timeout: oldTimeout,
        new_timeout: timeout_ms
    };
}

/**
 * Creates a dependency graph for tool execution planning
 *
 * Creates a dependency graph that can be used to optimize tool execution order,
 * enable parallel processing, and manage complex tool chains efficiently.
 *
 * @async
 * @function _createDependencyGraph
 * @param {Object} params - Dependency graph parameters
 * @param {Array<Object>} params.tools - Array of tool definitions
 * @param {string} params.tools[].name - Tool name
 * @param {Object} [params.tools[].parameters={}] - Tool parameters
 * @param {Object} [params.tools[].metadata={}] - Tool metadata (priority, duration, etc.)
 * @param {number[]} [params.tools[].dependencies=[]] - Array of dependency indices
 * @param {boolean} [params.auto_detect_dependencies=true] - Whether to auto-detect dependencies
 * @returns {Promise<Object>} Dependency graph creation result
 * @returns {string} returns.message - Result message
 * @returns {string[]} returns.nodeIds - Array of created node IDs
 * @returns {Object} returns.executionPlan - Generated execution plan summary
 * @returns {number} returns.executionPlan.phases - Number of execution phases
 * @returns {number} returns.executionPlan.totalEstimatedTime - Total estimated execution time
 * @returns {number} returns.executionPlan.parallelGroups - Number of parallel execution groups
 * @returns {number} returns.executionPlan.criticalPathLength - Length of critical path
 * @returns {string[]} returns.executionPlan.warnings - Any warnings about the plan
 * @returns {Object} returns.statistics - Graph statistics
 * @throws {Error} If tools parameter is missing or invalid
 *
 * @example
 * // Create dependency graph for file processing chain
 * const result = await _createDependencyGraph({
 *   tools: [
 *     { name: 'read_file', parameters: { filename: 'input.js' } },
 *     { name: 'analyze_code', parameters: { filename: 'input.js' }, dependencies: [0] },
 *     { name: 'create_file', parameters: { filename: 'output.js' }, dependencies: [1] }
 *   ]
 * });
 */
async function _createDependencyGraph({ tools, auto_detect_dependencies = true }) {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
        throw new Error("The 'tools' parameter is required and must be a non-empty array of tool definitions.");
    }
    
    // Clear existing graph
    dependencyGraphManager.clear();
    
    const nodeIds = [];
    
    // Add all tools to the graph
    for (const toolDef of tools) {
        if (!toolDef.name) {
            throw new Error("Each tool definition must have a 'name' property.");
        }
        
        const nodeId = dependencyGraphManager.addTool(
            toolDef.name,
            toolDef.parameters || {},
            toolDef.metadata || {}
        );
        nodeIds.push(nodeId);
    }
    
    // Add explicit dependencies if provided
    for (let i = 0; i < tools.length; i++) {
        const toolDef = tools[i];
        if (toolDef.dependencies && Array.isArray(toolDef.dependencies)) {
            for (const depIndex of toolDef.dependencies) {
                if (depIndex >= 0 && depIndex < nodeIds.length) {
                    dependencyGraphManager.addDependency(nodeIds[i], nodeIds[depIndex]);
                }
            }
        }
    }
    
    // Generate execution plan
    const plan = dependencyGraphManager.generateExecutionPlan();
    
    return {
        message: `Created dependency graph with ${nodeIds.length} tools`,
        nodeIds,
        executionPlan: {
            phases: plan.phases.length,
            totalEstimatedTime: plan.totalEstimatedTime,
            parallelGroups: plan.parallelGroups.length,
            criticalPathLength: plan.criticalPath.length,
            warnings: plan.warnings
        },
        statistics: dependencyGraphManager.getStatistics()
    };
}

/**
 * Retrieves the current execution plan from the dependency graph
 *
 * Returns detailed information about how tools will be executed based on
 * the current dependency graph, including phases, parallel groups, and timing estimates.
 *
 * @async
 * @function _getExecutionPlan
 * @returns {Promise<Object>} Execution plan information
 * @returns {string} returns.message - Summary message
 * @returns {Object} returns.plan - Detailed execution plan
 * @returns {Array<Object>} returns.plan.phases - Execution phases
 * @returns {number} returns.plan.phases[].phaseIndex - Phase number
 * @returns {number} returns.plan.phases[].toolCount - Number of tools in phase
 * @returns {Array<Object>} returns.plan.phases[].tools - Tools in this phase
 * @returns {boolean} returns.plan.phases[].canRunInParallel - Whether tools can run in parallel
 * @returns {number} returns.plan.totalEstimatedTime - Total estimated execution time
 * @returns {Array<Object>} returns.plan.criticalPath - Critical path through the graph
 * @returns {Array<Object>} returns.plan.parallelGroups - Groups that can run in parallel
 * @returns {string[]} returns.plan.warnings - Execution warnings
 * @returns {Object} returns.statistics - Graph statistics
 *
 * @example
 * const plan = await _getExecutionPlan();
 * console.log(`Execution will take ${plan.plan.phases.length} phases`);
 * console.log(`Estimated time: ${plan.plan.totalEstimatedTime}ms`);
 * plan.plan.phases.forEach((phase, i) => {
 *   console.log(`Phase ${i}: ${phase.toolCount} tools, parallel: ${phase.canRunInParallel}`);
 * });
 */
async function _getExecutionPlan() {
    const plan = dependencyGraphManager.generateExecutionPlan();
    const stats = dependencyGraphManager.getStatistics();
    
    return {
        message: `Execution plan for ${stats.totalTools} tools`,
        plan: {
            phases: plan.phases.map((phase, index) => ({
                phaseIndex: index,
                toolCount: phase.length,
                tools: phase.map(nodeId => {
                    const node = debuggingState.dependencyGraph.nodes.get(nodeId);
                    return {
                        id: nodeId,
                        toolName: node.toolName,
                        status: node.status,
                        estimatedDuration: node.metadata.estimatedDuration
                    };
                }),
                canRunInParallel: phase.length > 1
            })),
            totalEstimatedTime: plan.totalEstimatedTime,
            criticalPath: plan.criticalPath.map(nodeId => {
                const node = debuggingState.dependencyGraph.nodes.get(nodeId);
                return {
                    id: nodeId,
                    toolName: node.toolName,
                    estimatedDuration: node.metadata.estimatedDuration
                };
            }),
            parallelGroups: plan.parallelGroups,
            warnings: plan.warnings
        },
        statistics: stats
    };
}

/**
 * Retrieves current status of the dependency graph
 *
 * Provides comprehensive information about the current state of the dependency graph,
 * including statistics, ready tools, and overall graph health.
 *
 * @async
 * @function _getDependencyGraphStatus
 * @returns {Promise<Object>} Dependency graph status
 * @returns {string} returns.message - Status summary message
 * @returns {Object} returns.statistics - Graph statistics
 * @returns {Array<Object>} returns.readyTools - Tools ready for execution
 * @returns {string} returns.readyTools[].id - Tool node ID
 * @returns {string} returns.readyTools[].toolName - Tool name
 * @returns {number} returns.readyTools[].priority - Tool priority
 * @returns {number} returns.readyTools[].estimatedDuration - Estimated execution time
 * @returns {string[]} returns.readyTools[].dependencies - Tool dependencies
 * @returns {boolean} returns.readyTools[].canRunInParallel - Whether tool can run in parallel
 * @returns {Object} returns.graphSummary - Graph summary statistics
 * @returns {number} returns.graphSummary.totalNodes - Total number of nodes
 * @returns {number} returns.graphSummary.totalEdges - Total number of edges
 * @returns {number} returns.graphSummary.completedTools - Number of completed tools
 * @returns {number} returns.graphSummary.failedTools - Number of failed tools
 * @returns {number} returns.graphSummary.blockedTools - Number of blocked tools
 *
 * @example
 * const status = await _getDependencyGraphStatus();
 * console.log(`Graph has ${status.statistics.totalTools} tools`);
 * console.log(`${status.readyTools.length} tools ready to execute`);
 * status.readyTools.forEach(tool => {
 *   console.log(`Ready: ${tool.toolName} (priority: ${tool.priority})`);
 * });
 */
async function _getDependencyGraphStatus() {
    const stats = dependencyGraphManager.getStatistics();
    const readyTools = dependencyGraphManager.getReadyTools();
    
    return {
        message: `Dependency graph status: ${stats.totalTools} total tools`,
        statistics: stats,
        readyTools: readyTools.map(node => ({
            id: node.id,
            toolName: node.toolName,
            priority: node.metadata.priority,
            estimatedDuration: node.metadata.estimatedDuration,
            dependencies: Array.from(node.dependencies),
            canRunInParallel: node.metadata.canRunInParallel
        })),
        graphSummary: {
            totalNodes: debuggingState.dependencyGraph.nodes.size,
            totalEdges: Array.from(debuggingState.dependencyGraph.edges.values())
                .reduce((sum, set) => sum + set.size, 0),
            completedTools: debuggingState.dependencyGraph.completedTools.size,
            failedTools: debuggingState.dependencyGraph.failedTools.size,
            blockedTools: debuggingState.dependencyGraph.blockedTools.size
        }
    };
}

/**
 * Adds a new tool to the existing dependency graph
 *
 * Dynamically adds a tool to the current dependency graph and establishes
 * its relationships with existing tools.
 *
 * @async
 * @function _addToolToDependencyGraph
 * @param {Object} params - Tool addition parameters
 * @param {string} params.tool_name - Name of the tool to add
 * @param {Object} [params.parameters={}] - Tool parameters
 * @param {Object} [params.metadata={}] - Tool metadata (priority, duration, etc.)
 * @param {string[]} [params.dependencies=[]] - Array of node IDs this tool depends on
 * @returns {Promise<Object>} Tool addition result
 * @returns {string} returns.message - Result message
 * @returns {string} returns.nodeId - ID of the newly created node
 * @returns {Object} returns.toolInfo - Information about the added tool
 * @returns {string} returns.toolInfo.id - Tool node ID
 * @returns {string} returns.toolInfo.toolName - Tool name
 * @returns {string} returns.toolInfo.status - Tool status
 * @returns {string[]} returns.toolInfo.dependencies - Tool dependencies
 * @returns {string[]} returns.toolInfo.dependents - Tools that depend on this tool
 * @returns {Object} returns.toolInfo.metadata - Tool metadata
 * @throws {Error} If tool_name parameter is missing
 *
 * @example
 * // Add a new tool to existing graph
 * const result = await _addToolToDependencyGraph({
 *   tool_name: 'format_code',
 *   parameters: { filename: 'src/app.js' },
 *   metadata: { priority: 2, estimatedDuration: 3000 },
 *   dependencies: ['node_123'] // depends on another tool
 * });
 * console.log(`Added tool with ID: ${result.nodeId}`);
 */
async function _addToolToDependencyGraph({ tool_name, parameters = {}, metadata = {}, dependencies = [] }) {
    if (!tool_name) {
        throw new Error("The 'tool_name' parameter is required.");
    }
    
    const nodeId = dependencyGraphManager.addTool(tool_name, parameters, metadata);
    
    // Add dependencies if provided
    for (const depId of dependencies) {
        if (debuggingState.dependencyGraph.nodes.has(depId)) {
            dependencyGraphManager.addDependency(nodeId, depId);
        }
    }
    
    const node = debuggingState.dependencyGraph.nodes.get(nodeId);
    
    return {
        message: `Added ${tool_name} to dependency graph`,
        nodeId,
        toolInfo: {
            id: nodeId,
            toolName: node.toolName,
            status: node.status,
            dependencies: Array.from(node.dependencies),
            dependents: Array.from(node.dependents),
            metadata: node.metadata
        }
    };
}

/**
 * Clears the current dependency graph
 *
 * Removes all tools and dependencies from the current graph, returning
 * statistics about what was cleared.
 *
 * @async
 * @function _clearDependencyGraph
 * @returns {Promise<Object>} Clear operation result
 * @returns {string} returns.message - Result message
 * @returns {Object} returns.previousStatistics - Statistics before clearing
 *
 * @example
 * const result = await _clearDependencyGraph();
 * console.log('Cleared dependency graph');
 * console.log(`Previous graph had ${result.previousStatistics.totalTools} tools`);
 */
async function _clearDependencyGraph() {
    const stats = dependencyGraphManager.getStatistics();
    dependencyGraphManager.clear();
    
    return {
        message: 'Dependency graph cleared successfully',
        previousStatistics: stats
    };
}

/**
 * Exports the current dependency graph data
 *
 * Exports the complete dependency graph structure for backup, analysis,
 * or transfer to another system.
 *
 * @async
 * @function _exportDependencyGraph
 * @returns {Promise<Object>} Export result
 * @returns {string} returns.message - Export summary message
 * @returns {Object} returns.graphData - Complete graph data structure
 * @returns {string} returns.exportTimestamp - ISO timestamp of export
 *
 * @example
 * const exported = await _exportDependencyGraph();
 * console.log(`Exported graph with ${exported.graphData.nodes.length} nodes`);
 * // Save to file or send to another system
 * localStorage.setItem('dependency_graph_backup', JSON.stringify(exported.graphData));
 */
async function _exportDependencyGraph() {
    const exportData = dependencyGraphManager.exportGraph();
    
    return {
        message: `Exported dependency graph with ${exportData.nodes.length} nodes`,
        graphData: exportData,
        exportTimestamp: new Date().toISOString()
    };
}

/**
 * Lists all available tools in the registry
 *
 * Returns a simple list of all tool names currently registered in the system.
 * Useful for discovery and debugging purposes.
 *
 * @async
 * @function _listTools
 * @returns {Promise<Object>} List of available tools
 * @returns {string[]} returns.tools - Array of tool names
 *
 * @example
 * const result = await _listTools();
 * console.log(`Available tools: ${result.tools.join(', ')}`);
 *
 * @example
 * // Check if a specific tool is available
 * const result = await _listTools();
 * const hasReadFile = result.tools.includes('read_file');
 * console.log('Read file tool available:', hasReadFile);
 */
async function _listTools() {
   const toolNames = Object.keys(toolRegistry);
   return { tools: toolNames };
}