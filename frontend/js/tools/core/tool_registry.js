/**
 * Tool registry that imports and organizes all tools from various modules
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

// Tool registry with all tools organized by category
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

// System operation management tools
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

async function _cancelAllOperations({ reason = 'User requested cancellation of all operations' }) {
    const cancelledCount = cancelAllOperations(reason);
    return {
        message: `Cancelled ${cancelledCount} active operations`,
        cancelledCount,
        reason
    };
}

async function _getTimeoutSettings() {
    return {
        message: 'Current timeout settings',
        settings: debuggingState.timeoutSettings,
        activeOperations: debuggingState.activeOperations.size
    };
}

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

// Dependency graph management tools
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

async function _clearDependencyGraph() {
    const stats = dependencyGraphManager.getStatistics();
    dependencyGraphManager.clear();
    
    return {
        message: 'Dependency graph cleared successfully',
        previousStatistics: stats
    };
}

async function _exportDependencyGraph() {
    const exportData = dependencyGraphManager.exportGraph();
    
    return {
        message: `Exported dependency graph with ${exportData.nodes.length} nodes`,
        graphData: exportData,
        exportTimestamp: new Date().toISOString()
    };
}

async function _listTools() {
   const toolNames = Object.keys(toolRegistry);
   return { tools: toolNames };
}