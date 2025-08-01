/**
 * Dependency graph management for intelligent tool orchestration
 */

import { debuggingState } from './operation_manager.js';

/**
 * Represents a tool node in the dependency graph
 */
export class ToolNode {
    constructor(toolName, parameters = {}, metadata = {}) {
        this.id = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.toolName = toolName;
        this.parameters = parameters;
        this.metadata = {
            priority: metadata.priority || 'medium',
            estimatedDuration: metadata.estimatedDuration || 5000,
            resourceRequirements: metadata.resourceRequirements || [],
            canRunInParallel: metadata.canRunInParallel !== false,
            ...metadata
        };
        this.dependencies = new Set(); // Tools this depends on
        this.dependents = new Set(); // Tools that depend on this
        this.status = 'pending'; // pending, ready, running, completed, failed, blocked
        this.result = null;
        this.error = null;
        this.startTime = null;
        this.endTime = null;
        this.executionTime = null;
    }
    
    addDependency(nodeId) {
        this.dependencies.add(nodeId);
    }
    
    addDependent(nodeId) {
        this.dependents.add(nodeId);
    }
    
    isReady() {
        if (this.status !== 'pending') return false;
        
        // Check if all dependencies are completed
        for (const depId of this.dependencies) {
            const depNode = debuggingState.dependencyGraph.nodes.get(depId);
            if (!depNode || depNode.status !== 'completed') {
                return false;
            }
        }
        return true;
    }
    
    canRunInParallelWith(otherNode) {
        if (!this.metadata.canRunInParallel || !otherNode.metadata.canRunInParallel) {
            return false;
        }
        
        // Check for resource conflicts
        const thisResources = new Set(this.metadata.resourceRequirements);
        const otherResources = new Set(otherNode.metadata.resourceRequirements);
        
        // If they share exclusive resources, they can't run in parallel
        for (const resource of thisResources) {
            if (otherResources.has(resource) && resource.startsWith('exclusive:')) {
                return false;
            }
        }
        
        // Check for file conflicts
        const thisFiles = this.getFileTargets();
        const otherFiles = otherNode.getFileTargets();
        
        // If they modify the same files, they can't run in parallel
        for (const file of thisFiles.write) {
            if (otherFiles.write.has(file)) {
                return false;
            }
        }
        
        return true;
    }
    
    getFileTargets() {
        const targets = { read: new Set(), write: new Set() };
        
        // Analyze parameters to determine file targets
        if (this.parameters.filename) {
            if (this.isWriteOperation()) {
                targets.write.add(this.parameters.filename);
            } else {
                targets.read.add(this.parameters.filename);
            }
        }
        
        if (this.parameters.filenames && Array.isArray(this.parameters.filenames)) {
            this.parameters.filenames.forEach(filename => {
                targets.read.add(filename);
            });
        }
        
        return targets;
    }
    
    isWriteOperation() {
        const writeTools = [
            'create_file', 'edit_file', 'rewrite_file', 'apply_diff',
            'delete_file', 'rename_file', 'append_to_file',
            'find_and_replace', 'insert_at_line', 'replace_lines', 'smart_replace'
        ];
        return writeTools.includes(this.toolName);
    }
    
    getPriority() {
        const priorityMap = { low: 1, medium: 2, high: 3, critical: 4 };
        return priorityMap[this.metadata.priority] || 2;
    }
}

/**
 * Dependency graph manager for intelligent tool orchestration
 */
export class DependencyGraphManager {
    constructor() {
        this.graph = debuggingState.dependencyGraph;
    }
    
    /**
     * Add a tool to the dependency graph
     */
    addTool(toolName, parameters = {}, metadata = {}) {
        const node = new ToolNode(toolName, parameters, metadata);
        this.graph.nodes.set(node.id, node);
        
        // Auto-detect dependencies based on tool patterns
        this.detectAutomaticDependencies(node);
        
        console.log(`[DependencyGraph] Added tool ${toolName} (ID: ${node.id})`);
        return node.id;
    }
    
    /**
     * Add explicit dependency between tools
     */
    addDependency(dependentId, dependencyId) {
        const dependent = this.graph.nodes.get(dependentId);
        const dependency = this.graph.nodes.get(dependencyId);
        
        if (!dependent || !dependency) {
            throw new Error(`Invalid tool IDs: ${dependentId} or ${dependencyId}`);
        }
        
        dependent.addDependency(dependencyId);
        dependency.addDependent(dependentId);
        
        // Update edges
        if (!this.graph.edges.has(dependencyId)) {
            this.graph.edges.set(dependencyId, new Set());
        }
        this.graph.edges.get(dependencyId).add(dependentId);
        
        console.log(`[DependencyGraph] Added dependency: ${dependent.toolName} depends on ${dependency.toolName}`);
    }
    
    /**
     * Automatically detect dependencies based on tool patterns
     */
    detectAutomaticDependencies(node) {
        const existingNodes = Array.from(this.graph.nodes.values());
        
        // Rule 1: File operations depend on structure queries
        if (node.isWriteOperation() && node.parameters.filename) {
            const structureNode = existingNodes.find(n =>
                n.toolName === 'get_project_structure' && n.status !== 'failed'
            );
            if (structureNode) {
                this.addDependency(node.id, structureNode.id);
            }
        }
        
        // Rule 2: Edit operations should depend on read operations for the same file
        if (node.isWriteOperation() && node.parameters.filename) {
            const readNode = existingNodes.find(n =>
                (n.toolName === 'read_file' || n.toolName === 'read_file_lines') &&
                n.parameters.filename === node.parameters.filename &&
                n.status !== 'failed'
            );
            if (readNode) {
                this.addDependency(node.id, readNode.id);
            }
        }
        
        // Rule 3: apply_diff should depend on read_file with line numbers
        if (node.toolName === 'apply_diff' && node.parameters.filename) {
            const readWithLinesNode = existingNodes.find(n =>
                n.toolName === 'read_file' &&
                n.parameters.filename === node.parameters.filename &&
                n.parameters.include_line_numbers === true &&
                n.status !== 'failed'
            );
            if (readWithLinesNode) {
                this.addDependency(node.id, readWithLinesNode.id);
            }
        }
        
        // Rule 4: Analysis tools depend on indexing
        if (['analyze_code_quality', 'build_symbol_table', 'trace_data_flow'].includes(node.toolName)) {
            const indexNode = existingNodes.find(n =>
                n.toolName === 'build_or_update_codebase_index' && n.status !== 'failed'
            );
            if (indexNode) {
                this.addDependency(node.id, indexNode.id);
            }
        }
        
        // Rule 5: Batch operations depend on individual file reads
        if (node.toolName.startsWith('batch_') && node.parameters.filenames) {
            node.parameters.filenames.forEach(filename => {
                const readNode = existingNodes.find(n =>
                    n.toolName === 'read_file' &&
                    n.parameters.filename === filename &&
                    n.status !== 'failed'
                );
                if (readNode) {
                    this.addDependency(node.id, readNode.id);
                }
            });
        }
    }
    
    /**
     * Generate optimized execution plan
     */
    generateExecutionPlan() {
        const plan = {
            phases: [],
            parallelGroups: [],
            totalEstimatedTime: 0,
            criticalPath: [],
            warnings: []
        };
        
        // Topological sort to determine execution order
        const sorted = this.topologicalSort();
        if (!sorted) {
            plan.warnings.push('Circular dependency detected - cannot create execution plan');
            return plan;
        }
        
        // Group tools into parallel execution phases
        const phases = this.groupIntoParallelPhases(sorted);
        plan.phases = phases;
        
        // Calculate critical path and estimated time
        const criticalPath = this.calculateCriticalPath();
        plan.criticalPath = criticalPath.path;
        plan.totalEstimatedTime = criticalPath.duration;
        
        // Identify optimization opportunities
        plan.parallelGroups = this.identifyParallelGroups(phases);
        
        console.log(`[DependencyGraph] Generated execution plan with ${phases.length} phases`);
        console.log(`[DependencyGraph] Estimated total time: ${plan.totalEstimatedTime}ms`);
        console.log(`[DependencyGraph] Critical path length: ${plan.criticalPath.length} tools`);
        
        return plan;
    }
    
    /**
     * Topological sort to detect cycles and determine execution order
     */
    topologicalSort() {
        const visited = new Set();
        const visiting = new Set();
        const result = [];
        
        const visit = (nodeId) => {
            if (visiting.has(nodeId)) {
                return false; // Cycle detected
            }
            if (visited.has(nodeId)) {
                return true;
            }
            
            visiting.add(nodeId);
            const node = this.graph.nodes.get(nodeId);
            
            // Visit all dependencies first
            for (const depId of node.dependencies) {
                if (!visit(depId)) {
                    return false;
                }
            }
            
            visiting.delete(nodeId);
            visited.add(nodeId);
            result.push(nodeId);
            
            return true;
        };
        
        // Visit all nodes
        for (const nodeId of this.graph.nodes.keys()) {
            if (!visited.has(nodeId)) {
                if (!visit(nodeId)) {
                    return null; // Cycle detected
                }
            }
        }
        
        return result;
    }
    
    /**
     * Group tools into phases that can run in parallel
     */
    groupIntoParallelPhases(sortedNodes) {
        const phases = [];
        const processed = new Set();
        
        while (processed.size < sortedNodes.length) {
            const currentPhase = [];
            
            // Find all nodes that are ready to execute
            for (const nodeId of sortedNodes) {
                if (processed.has(nodeId)) continue;
                
                const node = this.graph.nodes.get(nodeId);
                
                // Check if all dependencies are in previous phases
                const dependenciesReady = Array.from(node.dependencies).every(depId =>
                    processed.has(depId)
                );
                
                if (dependenciesReady) {
                    // Check if it can run in parallel with other tools in current phase
                    const canRunInParallel = currentPhase.every(otherId => {
                        const otherNode = this.graph.nodes.get(otherId);
                        return node.canRunInParallelWith(otherNode);
                    });
                    
                    if (canRunInParallel) {
                        currentPhase.push(nodeId);
                        processed.add(nodeId);
                    }
                }
            }
            
            if (currentPhase.length === 0) {
                // No more tools can be processed - might indicate an issue
                break;
            }
            
            phases.push(currentPhase);
        }
        
        return phases;
    }
    
    /**
     * Calculate critical path through the dependency graph
     */
    calculateCriticalPath() {
        const distances = new Map();
        const predecessors = new Map();
        
        // Initialize distances
        for (const nodeId of this.graph.nodes.keys()) {
            distances.set(nodeId, 0);
        }
        
        // Calculate longest path (critical path)
        const sortedNodes = this.topologicalSort();
        if (!sortedNodes) return { path: [], duration: 0 };
        
        for (const nodeId of sortedNodes) {
            const node = this.graph.nodes.get(nodeId);
            const currentDistance = distances.get(nodeId);
            
            // Update distances for all dependents
            for (const dependentId of node.dependents) {
                const dependent = this.graph.nodes.get(dependentId);
                const newDistance = currentDistance + node.metadata.estimatedDuration;
                
                if (newDistance > distances.get(dependentId)) {
                    distances.set(dependentId, newDistance);
                    predecessors.set(dependentId, nodeId);
                }
            }
        }
        
        // Find the node with maximum distance (end of critical path)
        let maxDistance = 0;
        let endNode = null;
        
        for (const [nodeId, distance] of distances) {
            if (distance > maxDistance) {
                maxDistance = distance;
                endNode = nodeId;
            }
        }
        
        // Reconstruct critical path
        const path = [];
        let current = endNode;
        
        while (current) {
            path.unshift(current);
            current = predecessors.get(current);
        }
        
        return { path, duration: maxDistance };
    }
    
    /**
     * Identify groups of tools that can run in parallel
     */
    identifyParallelGroups(phases) {
        const parallelGroups = [];
        
        phases.forEach((phase, phaseIndex) => {
            if (phase.length > 1) {
                const group = {
                    phaseIndex,
                    tools: phase.map(nodeId => {
                        const node = this.graph.nodes.get(nodeId);
                        return {
                            id: nodeId,
                            toolName: node.toolName,
                            estimatedDuration: node.metadata.estimatedDuration
                        };
                    }),
                    estimatedParallelTime: Math.max(...phase.map(nodeId =>
                        this.graph.nodes.get(nodeId).metadata.estimatedDuration
                    )),
                    estimatedSequentialTime: phase.reduce((sum, nodeId) =>
                        sum + this.graph.nodes.get(nodeId).metadata.estimatedDuration, 0
                    )
                };
                
                group.timeSavings = group.estimatedSequentialTime - group.estimatedParallelTime;
                parallelGroups.push(group);
            }
        });
        
        return parallelGroups;
    }
    
    /**
     * Get ready tools that can be executed now
     */
    getReadyTools() {
        const readyTools = [];
        
        for (const node of this.graph.nodes.values()) {
            if (node.isReady()) {
                readyTools.push(node);
            }
        }
        
        // Sort by priority
        readyTools.sort((a, b) => b.getPriority() - a.getPriority());
        
        return readyTools;
    }
    
    /**
     * Mark a tool as completed and update dependent tools
     */
    markToolCompleted(nodeId, result) {
        const node = this.graph.nodes.get(nodeId);
        if (!node) return;
        
        node.status = 'completed';
        node.result = result;
        node.endTime = Date.now();
        node.executionTime = node.endTime - node.startTime;
        
        this.graph.completedTools.add(nodeId);
        this.graph.statistics.totalExecutions++;
        
        // Update dependent tools status
        for (const dependentId of node.dependents) {
            const dependent = this.graph.nodes.get(dependentId);
            if (dependent && dependent.status === 'blocked') {
                if (dependent.isReady()) {
                    dependent.status = 'pending';
                    this.graph.blockedTools.delete(dependentId);
                }
            }
        }
        
        console.log(`[DependencyGraph] Tool ${node.toolName} completed in ${node.executionTime}ms`);
    }
    
    /**
     * Mark a tool as failed and handle dependent tools
     */
    markToolFailed(nodeId, error) {
        const node = this.graph.nodes.get(nodeId);
        if (!node) return;
        
        node.status = 'failed';
        node.error = error;
        node.endTime = Date.now();
        node.executionTime = node.endTime - node.startTime;
        
        this.graph.failedTools.add(nodeId);
        
        // Mark all dependent tools as blocked
        const blockedTools = this.propagateFailure(nodeId);
        
        console.warn(`[DependencyGraph] Tool ${node.toolName} failed, blocking ${blockedTools.length} dependent tools`);
        
        return blockedTools;
    }
    
    /**
     * Propagate failure to dependent tools
     */
    propagateFailure(failedNodeId) {
        const blockedTools = [];
        const visited = new Set();
        
        const propagate = (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);
            
            const node = this.graph.nodes.get(nodeId);
            if (!node) return;
            
            for (const dependentId of node.dependents) {
                const dependent = this.graph.nodes.get(dependentId);
                if (dependent && dependent.status === 'pending') {
                    dependent.status = 'blocked';
                    this.graph.blockedTools.add(dependentId);
                    blockedTools.push(dependentId);
                    
                    // Recursively propagate
                    propagate(dependentId);
                }
            }
        };
        
        propagate(failedNodeId);
        return blockedTools;
    }
    
    /**
     * Get execution statistics
     */
    getStatistics() {
        const stats = { ...this.graph.statistics };
        
        stats.totalTools = this.graph.nodes.size;
        stats.completedTools = this.graph.completedTools.size;
        stats.failedTools = this.graph.failedTools.size;
        stats.blockedTools = this.graph.blockedTools.size;
        stats.pendingTools = stats.totalTools - stats.completedTools - stats.failedTools;
        
        // Calculate average execution time
        const completedNodes = Array.from(this.graph.nodes.values())
            .filter(node => node.status === 'completed' && node.executionTime);
        
        stats.averageExecutionTime = completedNodes.length > 0 ?
            completedNodes.reduce((sum, node) => sum + node.executionTime, 0) / completedNodes.length : 0;
        
        return stats;
    }
    
    /**
     * Clear the dependency graph
     */
    clear() {
        this.graph.nodes.clear();
        this.graph.edges.clear();
        this.graph.executionQueue = [];
        this.graph.parallelGroups = [];
        this.graph.completedTools.clear();
        this.graph.failedTools.clear();
        this.graph.blockedTools.clear();
        
        console.log('[DependencyGraph] Cleared dependency graph');
    }
    
    /**
     * Export graph for visualization or debugging
     */
    exportGraph() {
        const exportData = {
            nodes: Array.from(this.graph.nodes.entries()).map(([id, node]) => ({
                id,
                toolName: node.toolName,
                status: node.status,
                dependencies: Array.from(node.dependencies),
                dependents: Array.from(node.dependents),
                metadata: node.metadata,
                executionTime: node.executionTime
            })),
            edges: Array.from(this.graph.edges.entries()).map(([from, toSet]) => ({
                from,
                to: Array.from(toSet)
            })),
            statistics: this.getStatistics()
        };
        
        return exportData;
    }
}

// Create global dependency graph manager instance
export const dependencyGraphManager = new DependencyGraphManager();