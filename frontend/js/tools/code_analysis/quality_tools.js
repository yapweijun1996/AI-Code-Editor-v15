/**
 * Code quality analysis tools
 */

import * as FileSystem from '../../../file_system.js';

export async function _analyzeCodeQuality({ file_path }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    try {
        // Import required modules dynamically
        const { operationCache } = await import('../../../cache_manager.js');
        const { ensureWorkersInitialized, workerManager } = await import('../../../worker_manager.js');
        
        // Use cached code quality analysis with worker processing
        const qualityMetrics = await operationCache.cacheValidation(`${file_path}:quality`, content, async (content, filePath) => {
            // Ensure workers are initialized before use
            await ensureWorkersInitialized();
            
            // Use file worker for comprehensive quality analysis
            return await workerManager.processFile('analyze_quality', {
                filename: file_path,
                content: content,
                includeComplexity: true,
                includeSecurity: true,
                includePerformance: true,
                includeMaintainability: true
            });
        });
        
        return {
            message: `Code quality analysis completed for ${file_path}`,
            quality: {
                overallScore: qualityMetrics.overallScore || 0,
                category: qualityMetrics.category || 'unknown',
                complexity: {
                    average: qualityMetrics.complexity?.averageComplexity || 0,
                    max: qualityMetrics.complexity?.maxComplexity || 0,
                    functions: qualityMetrics.complexity?.functions?.length || 0,
                    distribution: qualityMetrics.complexity?.distribution || {}
                },
                maintainability: {
                    index: qualityMetrics.maintainability?.index || 0,
                    category: qualityMetrics.maintainability?.category || 'unknown',
                    factors: qualityMetrics.maintainability?.factors || []
                },
                issues: {
                    codeSmells: qualityMetrics.codeSmells?.length || 0,
                    security: qualityMetrics.security?.length || 0,
                    performance: qualityMetrics.performance?.length || 0,
                    total: (qualityMetrics.codeSmells?.length || 0) +
                           (qualityMetrics.security?.length || 0) +
                           (qualityMetrics.performance?.length || 0)
                },
                metrics: {
                    linesOfCode: qualityMetrics.linesOfCode || 0,
                    cyclomaticComplexity: qualityMetrics.cyclomaticComplexity || 0,
                    cognitiveComplexity: qualityMetrics.cognitiveComplexity || 0,
                    technicalDebt: qualityMetrics.technicalDebt || 0
                }
            },
            recommendations: qualityMetrics.recommendations || [],
            performance: {
                cached: qualityMetrics._cached || false,
                processingTime: qualityMetrics._processingTime || 0
            }
        };
    } catch (error) {
        console.warn(`Worker-based quality analysis failed for ${file_path}, falling back:`, error.message);
        
        // Import code quality analyzer dynamically
        const { codeQualityAnalyzer } = await import('../../../code_quality_analyzer.js');
        
        // Fallback to original code quality analyzer
        const qualityMetrics = await codeQualityAnalyzer.analyzeCodeQuality(file_path, content);
        
        return {
            message: `Code quality analysis completed for ${file_path} (fallback mode)`,
            quality: {
                overallScore: qualityMetrics.overallScore || 0,
                category: codeQualityAnalyzer.categorizeQualityScore ?
                         codeQualityAnalyzer.categorizeQualityScore(qualityMetrics.overallScore) : 'unknown',
                complexity: {
                    average: qualityMetrics.complexity?.averageComplexity || 0,
                    max: qualityMetrics.complexity?.maxComplexity || 0,
                    functions: qualityMetrics.complexity?.functions?.length || 0
                },
                maintainability: {
                    index: qualityMetrics.maintainability?.index || 0,
                    category: qualityMetrics.maintainability?.category || 'unknown'
                },
                issues: {
                    codeSmells: qualityMetrics.codeSmells?.length || 0,
                    security: qualityMetrics.security?.length || 0,
                    performance: qualityMetrics.performance?.length || 0
                }
            },
            recommendations: codeQualityAnalyzer.getTopRecommendations ?
                           codeQualityAnalyzer.getTopRecommendations(qualityMetrics) : [],
            fallback: true
        };
    }
}

export async function _optimizeCodeArchitecture({ file_path, optimization_goals }, rootHandle) {
    if (!file_path) throw new Error("The 'file_path' parameter is required.");
    
    const goals = optimization_goals || ['maintainability', 'performance', 'readability'];
    
    // Analyze current state
    const fileHandle = await FileSystem.getFileHandleFromPath(rootHandle, file_path);
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    // Import required modules dynamically
    const { codeQualityAnalyzer } = await import('../../../code_quality_analyzer.js');
    const { symbolResolver } = await import('../../../symbol_resolver.js');
    
    const qualityMetrics = await codeQualityAnalyzer.analyzeCodeQuality(file_path, content);
    const symbolTable = await symbolResolver.buildSymbolTable(content, file_path);
    
    // Generate optimization recommendations
    const optimizations = [];
    
    // Check complexity issues
    const complexFunctions = qualityMetrics.complexity.functions.filter(f => f.category === 'high' || f.category === 'critical');
    if (complexFunctions.length > 0) {
        optimizations.push({
            type: 'complexity_reduction',
            priority: 'high',
            description: `${complexFunctions.length} functions have high complexity`,
            recommendations: complexFunctions.flatMap(f => f.recommendations || [])
        });
    }
    
    // Check code smells
    const criticalSmells = qualityMetrics.codeSmells.filter(smell => smell.severity === 'critical' || smell.severity === 'high');
    if (criticalSmells.length > 0) {
        optimizations.push({
            type: 'code_smell_removal',
            priority: 'medium',
            description: `${criticalSmells.length} critical code smells detected`,
            recommendations: criticalSmells.map(smell => smell.recommendation)
        });
    }
    
    // Check architectural patterns
    if (qualityMetrics.architecture.detected.length === 0 && symbolTable.classes.length > 0) {
        optimizations.push({
            type: 'architectural_patterns',
            priority: 'medium',
            description: 'No design patterns detected - consider implementing appropriate patterns',
            recommendations: qualityMetrics.architecture.recommendations
        });
    }
    
    return {
        message: `Architecture optimization analysis completed for ${file_path}`,
        currentState: {
            qualityScore: qualityMetrics.overallScore,
            complexity: qualityMetrics.complexity.averageComplexity,
            maintainability: qualityMetrics.maintainability.index,
            issues: qualityMetrics.codeSmells.length + qualityMetrics.security.length + qualityMetrics.performance.length
        },
        optimizations,
        estimatedImpact: {
            qualityImprovement: optimizations.length * 10, // Rough estimate
            maintenanceReduction: optimizations.filter(o => o.type === 'complexity_reduction').length * 20,
            riskReduction: optimizations.filter(o => o.priority === 'high').length * 15
        }
    };
}