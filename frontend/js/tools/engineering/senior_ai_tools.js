/**
 * Senior Engineer AI tools for advanced code analysis and problem solving
 */

import * as FileSystem from '../../../file_system.js';

export async function _buildSymbolTable({ file_path }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    try {
        // Import required modules dynamically
        const { operationCache } = await import('../../../cache_manager.js');
        const { workerManager } = await import('../../../worker_manager.js');
        
        // Use cached symbol resolution with worker for background processing
        const symbolTable = await operationCache.cacheSymbolResolution(file_path, content, async (content, filePath) => {
            // Use symbol worker for comprehensive symbol analysis
            return await workerManager.resolveSymbols(content, filePath, {
                includeTypes: true,
                includeDependencies: true,
                includeComplexity: true
            });
        });
        
        return {
            message: `Symbol table built for ${file_path}`,
            symbolTable: {
                symbols: symbolTable.symbols?.size || symbolTable.symbolCount || 0,
                functions: symbolTable.functions?.length || 0,
                classes: symbolTable.classes?.length || 0,
                imports: symbolTable.imports?.length || 0,
                exports: symbolTable.exports?.length || 0,
                variables: symbolTable.variables?.length || 0,
                dependencies: symbolTable.dependencies?.length || 0
            },
            performance: {
                cached: symbolTable._cached || false,
                processingTime: symbolTable._processingTime || 0
            }
        };
    } catch (error) {
        console.warn(`Worker-based symbol resolution failed for ${file_path}, falling back to basic analysis:`, error.message);
        
        // Import symbol resolver dynamically
        const { symbolResolver } = await import('../../../symbol_resolver.js');
        
        // Fallback to basic symbol resolution
        const symbolTable = await symbolResolver.buildSymbolTable(content, file_path);
        
        return {
            message: `Symbol table built for ${file_path} (fallback mode)`,
            symbolTable: {
                symbols: symbolTable.symbols?.size || 0,
                functions: symbolTable.functions?.length || 0,
                classes: symbolTable.classes?.length || 0,
                imports: symbolTable.imports?.length || 0,
                exports: symbolTable.exports?.length || 0
            },
            fallback: true
        };
    }
}

export async function _traceDataFlow({ variable_name, file_path, line }, rootHandle) {
    if (!variable_name) throw new Error("The 'variable_name' parameter is required.");
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const startLine = line || 1;
    
    try {
        const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
        const file = await fileHandle.getFile();
        const content = await file.text();
        
        // Import required modules dynamically
        const { operationCache } = await import('../../../cache_manager.js');
        const { workerManager } = await import('../../../worker_manager.js');
        
        // Use cached data flow analysis with worker processing
        const flowInfo = await operationCache.cacheSymbolResolution(`${file_path}:${variable_name}:flow`, content, async (content, cacheKey) => {
            // Use symbol worker for data flow analysis
            return await workerManager.resolveSymbols(content, file_path, {
                targetVariable: variable_name,
                startLine: startLine,
                includeDataFlow: true,
                includeCrossFileAnalysis: true
            });
        });
        
        return {
            message: `Data flow traced for variable '${variable_name}'`,
            flow: {
                definitions: flowInfo.definitions?.length || 0,
                usages: flowInfo.usages?.length || 0,
                mutations: flowInfo.mutations?.length || 0,
                crossFileFlows: flowInfo.crossFileFlows?.length || 0,
                dataTypes: Array.from(flowInfo.dataTypes || []),
                complexity: flowInfo.complexity || 'N/A',
                scope: flowInfo.scope || 'unknown'
            },
            details: flowInfo,
            performance: {
                cached: flowInfo._cached || false,
                processingTime: flowInfo._processingTime || 0
            }
        };
    } catch (error) {
        console.warn(`Worker-based data flow analysis failed for ${variable_name}, falling back:`, error.message);
        
        // Import data flow analyzer dynamically
        const { dataFlowAnalyzer } = await import('../../../data_flow_analyzer.js');
        
        // Fallback to original data flow analyzer
        const flowInfo = await dataFlowAnalyzer.traceVariableFlow(variable_name, file_path, startLine);
        
        return {
            message: `Data flow traced for variable '${variable_name}' (fallback mode)`,
            flow: {
                definitions: flowInfo.definitions?.length || 0,
                usages: flowInfo.usages?.length || 0,
                mutations: flowInfo.mutations?.length || 0,
                crossFileFlows: flowInfo.crossFileFlows?.length || 0,
                dataTypes: Array.from(flowInfo.dataTypes || []),
                complexity: dataFlowAnalyzer.calculateFlowComplexity ?
                           dataFlowAnalyzer.calculateFlowComplexity(flowInfo) : 'N/A'
            },
            details: flowInfo,
            fallback: true
        };
    }
}

export async function _solveEngineeringProblem({ problem_description, file_path, priority, constraints }, rootHandle) {
    if (!problem_description) throw new Error("The 'problem_description' parameter is required.");
    
    const problem = {
        description: problem_description,
        priority: priority || 'medium',
        constraints: constraints || []
    };
    
    const codeContext = {
        filePath: file_path
    };
    
    if (file_path) {
        try {
            const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
            const file = await fileHandle.getFile();
            codeContext.content = await file.text();
        } catch (error) {
            console.warn(`Could not read file ${file_path}:`, error.message);
        }
    }
    
    // Import senior engineer AI dynamically
    const { seniorEngineerAI } = await import('../../../senior_engineer_ai.js');
    
    const solutionSession = await seniorEngineerAI.solveProblemSystematically(problem, codeContext);
    
    return {
        message: `Engineering problem analysis completed: ${problem_description}`,
        solution: {
            sessionId: solutionSession.id,
            status: solutionSession.status,
            problemType: solutionSession.analysis?.problemType,
            complexity: solutionSession.analysis?.complexity?.category,
            selectedApproach: solutionSession.selectedSolution?.approach,
            feasibility: solutionSession.selectedSolution?.evaluation?.feasibility,
            riskLevel: solutionSession.selectedSolution?.evaluation?.riskLevel,
            estimatedTime: solutionSession.implementation?.detailedSteps?.length || 0
        },
        recommendations: solutionSession.selectedSolution?.evaluation?.reasoning || [],
        implementation: solutionSession.implementation ? {
            phases: solutionSession.implementation.detailedSteps.map(step => step.phase).filter((phase, index, arr) => arr.indexOf(phase) === index),
            totalSteps: solutionSession.implementation.detailedSteps.length,
            testingRequired: solutionSession.implementation.testingPlan.length > 0
        } : null
    };
}

export async function _getEngineeringInsights({ file_path }, rootHandle) {
    // Import required modules dynamically
    const { symbolResolver } = await import('../../../symbol_resolver.js');
    const { dataFlowAnalyzer } = await import('../../../data_flow_analyzer.js');
    const { debuggingIntelligence } = await import('../../../debugging_intelligence.js');
    const { seniorEngineerAI } = await import('../../../senior_engineer_ai.js');
    const { codeQualityAnalyzer } = await import('../../../code_quality_analyzer.js');
    
    const insights = {
        symbolResolution: symbolResolver.getStatistics(),
        dataFlowAnalysis: dataFlowAnalyzer.getStatistics(),
        debuggingIntelligence: debuggingIntelligence.getDebuggingStatistics(),
        engineeringDecisions: seniorEngineerAI.getEngineeringStatistics()
    };
    
    if (file_path) {
        // Get file-specific insights
        const qualitySummary = codeQualityAnalyzer.getQualitySummary(file_path);
        if (qualitySummary) {
            insights.fileQuality = qualitySummary;
        }
    } else {
        // Get project-wide insights
        insights.projectQuality = codeQualityAnalyzer.getProjectQualityStatistics();
    }
    
    return {
        message: file_path ? `Engineering insights for ${file_path}` : 'Project-wide engineering insights',
        insights
    };
}