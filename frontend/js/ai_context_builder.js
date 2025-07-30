/**
 * AI Context Builder
 * Builds intelligent context for AI agents to understand large projects
 */

import { projectIntelligence } from './project_intelligence.js';
import { semanticIndexer } from './semantic_indexer.js';
import { performanceOptimizer } from './performance_optimizer.js';

class AIContextBuilder {
    constructor() {
        this.contextCache = performanceOptimizer.createSmartCache(100, 10 * 60 * 1000);
        this.maxContextSize = 50000; // Max characters in context
        this.priorityWeights = {
            currentFile: 10,
            directDependencies: 8,
            semanticSimilarity: 6,
            architecturalImportance: 5,
            recentlyModified: 4,
            frequentlyAccessed: 3
        };
    }

    /**
     * Build comprehensive context for AI agent
     */
    async buildAIContext(options = {}) {
        const {
            currentFile = null,
            query = null,
            taskType = 'general',
            includeArchitecture = true,
            includePatterns = true,
            maxFiles = 20
        } = options;

        const cacheKey = this.generateCacheKey(options);
        
        if (this.contextCache.has(cacheKey)) {
            return this.contextCache.get(cacheKey);
        }

        try {
            performanceOptimizer.startTimer('buildAIContext');
            
            const context = {
                projectOverview: await this.buildProjectOverview(),
                architecture: includeArchitecture ? await this.buildArchitecturalContext() : null,
                currentContext: currentFile ? await this.buildCurrentFileContext(currentFile) : null,
                relevantFiles: await this.selectRelevantFiles(currentFile, query, maxFiles),
                semanticContext: query ? await this.buildSemanticContext(query) : null,
                patterns: includePatterns ? await this.buildPatternContext() : null,
                suggestions: await this.buildSuggestions(currentFile, query, taskType),
                metadata: {
                    generatedAt: Date.now(),
                    contextSize: 0,
                    confidence: 0
                }
            };

            // Calculate context size and confidence
            context.metadata.contextSize = this.calculateContextSize(context);
            context.metadata.confidence = this.calculateConfidence(context);

            // Optimize context size if too large
            if (context.metadata.contextSize > this.maxContextSize) {
                context = await this.optimizeContextSize(context);
            }

            this.contextCache.set(cacheKey, context);
            performanceOptimizer.endTimer('buildAIContext');

            return context;

        } catch (error) {
            console.error('Error building AI context:', error);
            return this.buildFallbackContext();
        }
    }

    /**
     * Build project overview for AI understanding
     */
    async buildProjectOverview() {
        const projectSummary = projectIntelligence.getProjectSummary();
        const indexStats = semanticIndexer.getIndexStats();

        return {
            summary: `This is a ${projectSummary.languages.join(', ')} project with ${projectSummary.totalFiles} analyzed files.`,
            languages: projectSummary.languages,
            frameworks: Array.from(projectIntelligence.projectMetadata.frameworks),
            scale: this.categorizeProjectScale(projectSummary.totalFiles),
            complexity: this.assessProjectComplexity(indexStats),
            keyAreas: indexStats.topConcepts.slice(0, 5).map(c => c.concept),
            entryPoints: this.getProjectEntryPoints(),
            architecture: this.summarizeArchitecture()
        };
    }

    /**
     * Build architectural context
     */
    async buildArchitecturalContext() {
        return {
            patterns: this.getDetectedPatterns(),
            structure: await this.analyzeProjectStructure(),
            dependencies: this.analyzeDependencyStructure(),
            layers: this.identifyArchitecturalLayers(),
            boundaries: this.identifyModuleBoundaries(),
            dataFlow: this.analyzeDataFlowPatterns()
        };
    }

    /**
     * Build context for current file
     */
    async buildCurrentFileContext(filePath) {
        const analysis = projectIntelligence.projectMap.get(filePath);
        if (!analysis) {
            return { error: 'File not analyzed yet' };
        }

        const relatedFiles = semanticIndexer.getRelatedFiles(filePath, 5);
        const concepts = semanticIndexer.getFileConceptsFromIndex(filePath);

        return {
            file: {
                path: filePath,
                language: analysis.language,
                type: analysis.fileType,
                size: analysis.size,
                complexity: analysis.complexity
            },
            symbols: {
                functions: analysis.functions,
                classes: analysis.classes,
                exports: analysis.exports,
                apis: analysis.apis
            },
            relationships: {
                imports: analysis.imports,
                dependencies: this.getFileDependencies(filePath),
                dependents: this.getFileDependents(filePath)
            },
            concepts: concepts,
            relatedFiles: relatedFiles,
            patterns: analysis.patterns,
            role: this.determineFileRole(analysis, concepts),
            importance: this.calculateFileImportance(filePath, analysis)
        };
    }

    /**
     * Select most relevant files for context
     */
    async selectRelevantFiles(currentFile, query, maxFiles) {
        const candidates = new Map();

        // Add current file with highest priority
        if (currentFile) {
            candidates.set(currentFile, this.priorityWeights.currentFile);
        }

        // Add semantically related files
        if (query) {
            const semanticMatches = semanticIndexer.searchSemanticFiles(query, maxFiles);
            semanticMatches.forEach(match => {
                const currentScore = candidates.get(match.path) || 0;
                candidates.set(match.path, currentScore + (match.relevance * this.priorityWeights.semanticSimilarity));
            });
        }

        // Add architecturally important files
        const importantFiles = this.getArchitecturallyImportantFiles(maxFiles);
        importantFiles.forEach(file => {
            const currentScore = candidates.get(file.path) || 0;
            candidates.set(file.path, currentScore + (file.importance * this.priorityWeights.architecturalImportance));
        });

        // Add related files if we have a current file
        if (currentFile) {
            const related = semanticIndexer.getRelatedFiles(currentFile, 10);
            related.forEach(file => {
                const currentScore = candidates.get(file.path) || 0;
                candidates.set(file.path, currentScore + (file.similarity * this.priorityWeights.semanticSimilarity));
            });
        }

        // Sort by score and select top files
        const selectedFiles = Array.from(candidates.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxFiles);

        // Build detailed context for selected files
        const fileContexts = [];
        for (const [filePath, relevanceScore] of selectedFiles) {
            const analysis = projectIntelligence.projectMap.get(filePath);
            if (analysis) {
                fileContexts.push({
                    path: filePath,
                    relevanceScore,
                    summary: this.generateFileSummary(analysis),
                    keySymbols: this.extractKeySymbols(analysis),
                    role: this.determineFileRole(analysis),
                    concepts: semanticIndexer.getFileConceptsFromIndex(filePath).slice(0, 5)
                });
            }
        }

        return fileContexts;
    }

    /**
     * Build semantic context from query
     */
    async buildSemanticContext(query) {
        const semanticMatches = semanticIndexer.searchSemanticFiles(query, 15);
        const relatedConcepts = this.extractQueryConcepts(query);

        return {
            query,
            matchingFiles: semanticMatches,
            relatedConcepts: relatedConcepts.slice(0, 10),
            suggestedExplorations: this.generateExplorationSuggestions(query, semanticMatches),
            codePatterns: this.findRelatedPatterns(query),
            potentialSolutions: this.suggestSolutionApproaches(query, semanticMatches)
        };
    }

    /**
     * Build pattern context
     */
    async buildPatternContext() {
        const patterns = this.getDetectedPatterns();
        
        return {
            architecturalPatterns: patterns.architectural || [],
            designPatterns: patterns.design || [],
            codingPatterns: patterns.coding || [],
            antiPatterns: patterns.anti || [],
            recommendations: this.generatePatternRecommendations(patterns)
        };
    }

    /**
     * Build suggestions for AI
     */
    async buildSuggestions(currentFile, query, taskType) {
        const suggestions = [];

        // File-specific suggestions
        if (currentFile) {
            const fileSuggestions = semanticIndexer.generateCodeSuggestions(currentFile);
            suggestions.push(...fileSuggestions);
        }

        // Query-specific suggestions
        if (query) {
            const querySuggestions = this.generateQuerySuggestions(query, taskType);
            suggestions.push(...querySuggestions);
        }

        // Task-specific suggestions
        const taskSuggestions = this.generateTaskSuggestions(taskType, currentFile);
        suggestions.push(...taskSuggestions);

        // Learning suggestions
        const learningSuggestions = this.generateLearningSuggestions(currentFile, query);
        suggestions.push(...learningSuggestions);

        return suggestions.slice(0, 10); // Limit suggestions
    }

    /**
     * Generate file summary for AI consumption
     */
    generateFileSummary(analysis) {
        const parts = [];

        // Basic info
        parts.push(`${analysis.language} ${analysis.fileType} file`);

        // Size info
        if (analysis.lines > 500) {
            parts.push(`large file (${analysis.lines} lines)`);
        } else if (analysis.lines > 100) {
            parts.push(`medium file (${analysis.lines} lines)`);
        }

        // Symbols
        if (analysis.functions.length > 0) {
            parts.push(`${analysis.functions.length} functions`);
        }
        if (analysis.classes.length > 0) {
            parts.push(`${analysis.classes.length} classes`);
        }

        // Exports (API surface)
        if (analysis.exports.length > 0) {
            parts.push(`exports: ${analysis.exports.slice(0, 3).join(', ')}`);
        }

        // Dependencies
        if (analysis.imports.length > 0) {
            parts.push(`imports from ${analysis.imports.length} modules`);
        }

        return parts.join(', ');
    }

    /**
     * Extract key symbols from file analysis
     */
    extractKeySymbols(analysis) {
        const symbols = [];

        // Add main exports (likely public API)
        symbols.push(...analysis.exports.slice(0, 5).map(exp => ({
            name: exp,
            type: 'export',
            importance: 'high'
        })));

        // Add main functions
        symbols.push(...analysis.functions.slice(0, 5).map(func => ({
            name: func,
            type: 'function',
            importance: analysis.exports.includes(func) ? 'high' : 'medium'
        })));

        // Add classes
        symbols.push(...analysis.classes.slice(0, 3).map(cls => ({
            name: cls,
            type: 'class',
            importance: analysis.exports.includes(cls) ? 'high' : 'medium'
        })));

        return symbols.slice(0, 10); // Limit symbols
    }

    /**
     * Determine the role of a file in the project
     */
    determineFileRole(analysis, concepts = []) {
        // Entry point
        if (analysis.fileType === 'entry') {
            return 'Entry Point - Application starting point';
        }

        // Configuration
        if (analysis.fileType === 'config') {
            return 'Configuration - Project settings and setup';
        }

        // API/Service layer
        if (concepts.includes('api') || concepts.includes('service') || concepts.includes('controller')) {
            return 'Service Layer - Business logic and API endpoints';
        }

        // Data layer
        if (concepts.includes('model') || concepts.includes('database') || concepts.includes('repository')) {
            return 'Data Layer - Data models and persistence';
        }

        // UI layer
        if (concepts.includes('component') || concepts.includes('view') || concepts.includes('ui')) {
            return 'UI Layer - User interface components';
        }

        // Utility
        if (concepts.includes('utility') || concepts.includes('helper') || concepts.includes('utils')) {
            return 'Utility - Helper functions and shared code';
        }

        // Test
        if (analysis.fileType === 'test') {
            return 'Testing - Test cases and validation';
        }

        // Default based on exports
        if (analysis.exports.length > 5) {
            return 'Library Module - Provides reusable functionality';
        } else if (analysis.exports.length > 0) {
            return 'Module - Encapsulated functionality';
        }

        return 'Implementation - Internal code';
    }

    /**
     * Calculate file importance for context prioritization
     */
    calculateFileImportance(filePath, analysis) {
        let importance = 1;

        // Base importance from analysis
        importance += analysis.importance || 0;

        // Size factor (larger files might be more important, but not always)
        if (analysis.lines > 100 && analysis.lines < 1000) {
            importance += 2;
        }

        // Export factor (files that export more are likely more important)
        importance += Math.min(analysis.exports.length * 0.5, 3);

        // Function/class factor
        importance += Math.min((analysis.functions.length + analysis.classes.length) * 0.1, 2);

        return Math.min(importance, 10); // Cap at 10
    }

    /**
     * Generate context optimizations
     */
    async optimizeContextSize(context) {
        // Remove less important files
        if (context.relevantFiles.length > 10) {
            context.relevantFiles = context.relevantFiles
                .sort((a, b) => b.relevanceScore - a.relevanceScore)
                .slice(0, 10);
        }

        // Truncate file summaries
        context.relevantFiles.forEach(file => {
            if (file.summary.length > 200) {
                file.summary = file.summary.substring(0, 200) + '...';
            }
        });

        // Limit semantic matches
        if (context.semanticContext?.matchingFiles?.length > 5) {
            context.semanticContext.matchingFiles = context.semanticContext.matchingFiles.slice(0, 5);
        }

        return context;
    }

    /**
     * Utility methods
     */
    generateCacheKey(options) {
        const parts = [
            options.currentFile || 'none',
            options.query || 'none',
            options.taskType || 'general',
            options.maxFiles || 20
        ];
        return parts.join('|');
    }

    calculateContextSize(context) {
        return JSON.stringify(context).length;
    }

    calculateConfidence(context) {
        let confidence = 0.5; // Base confidence

        // Higher confidence with current file
        if (context.currentContext && !context.currentContext.error) {
            confidence += 0.2;
        }

        // Higher confidence with relevant files
        if (context.relevantFiles && context.relevantFiles.length > 0) {
            confidence += Math.min(context.relevantFiles.length * 0.05, 0.2);
        }

        // Higher confidence with semantic context
        if (context.semanticContext) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    buildFallbackContext() {
        return {
            projectOverview: {
                summary: 'Large project analysis in progress...',
                scale: 'large',
                status: 'analyzing'
            },
            error: 'Context building failed, using fallback',
            suggestions: [
                {
                    type: 'action',
                    title: 'Wait for analysis to complete',
                    description: 'Project analysis is still running in the background'
                }
            ]
        };
    }

    // Additional helper methods for completeness
    categorizeProjectScale(fileCount) {
        if (fileCount < 50) return 'small';
        if (fileCount < 500) return 'medium';
        if (fileCount < 5000) return 'large';
        return 'enterprise';
    }

    assessProjectComplexity(indexStats) {
        const conceptDensity = indexStats.totalConcepts / Math.max(indexStats.totalSymbols, 1);
        if (conceptDensity > 0.8) return 'high';
        if (conceptDensity > 0.5) return 'medium';
        return 'low';
    }

    getProjectEntryPoints() {
        const entryPoints = [];
        for (const [filePath, analysis] of projectIntelligence.projectMap) {
            if (analysis.fileType === 'entry') {
                entryPoints.push(filePath);
            }
        }
        return entryPoints;
    }

    summarizeArchitecture() {
        const patterns = Array.from(projectIntelligence.projectMetadata.patterns);
        const frameworks = Array.from(projectIntelligence.projectMetadata.frameworks);
        
        if (frameworks.includes('react')) return 'React-based frontend application';
        if (frameworks.includes('express')) return 'Express.js backend service';
        if (patterns.includes('mvc')) return 'MVC architecture';
        if (patterns.includes('microservices')) return 'Microservices architecture';
        
        return 'Custom architecture';
    }

    getDetectedPatterns() {
        // This would be implemented based on the actual pattern detection logic
        return {
            architectural: [],
            design: [],
            coding: [],
            anti: []
        };
    }

    // Placeholder methods for additional functionality
    analyzeProjectStructure() { return {}; }
    analyzeDependencyStructure() { return {}; }
    identifyArchitecturalLayers() { return []; }
    identifyModuleBoundaries() { return []; }
    analyzeDataFlowPatterns() { return {}; }
    getFileDependencies(filePath) { return []; }
    getFileDependents(filePath) { return []; }
    getArchitecturallyImportantFiles(maxFiles) { return []; }
    extractQueryConcepts(query) { return []; }
    generateExplorationSuggestions(query, matches) { return []; }
    findRelatedPatterns(query) { return []; }
    suggestSolutionApproaches(query, matches) { return []; }
    generateQuerySuggestions(query, taskType) { return []; }
    generateTaskSuggestions(taskType, currentFile) { return []; }
    generateLearningSuggestions(currentFile, query) { return []; }
    generatePatternRecommendations(patterns) { return []; }
}

// Export singleton instance
export const aiContextBuilder = new AIContextBuilder();