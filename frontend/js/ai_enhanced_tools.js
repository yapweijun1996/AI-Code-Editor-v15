/**
 * AI Enhanced Tools
 * Integrates project intelligence with existing AI tools
 */

import { aiContextBuilder } from './ai_context_builder.js';
import { semanticIndexer } from './semantic_indexer.js';
import { projectIntelligence } from './project_intelligence.js';

class AIEnhancedTools {
    constructor() {
        this.enhancedTools = new Map();
        this.setupEnhancedTools();
    }

    setupEnhancedTools() {
        // Enhanced query_codebase tool with semantic understanding
        this.enhancedTools.set('query_codebase_enhanced', {
            name: 'Query Codebase (Enhanced)',
            description: 'Search and understand code using semantic analysis and AI context',
            handler: this.enhancedQueryCodebase.bind(this)
        });

        // Architectural analysis tool
        this.enhancedTools.set('analyze_architecture', {
            name: 'Analyze Architecture',
            description: 'Analyze and explain the project architecture and design patterns',
            handler: this.analyzeArchitecture.bind(this)
        });

        // Context-aware code suggestions
        this.enhancedTools.set('suggest_improvements', {
            name: 'Suggest Improvements',
            description: 'Provide context-aware suggestions for code improvements',
            handler: this.suggestImprovements.bind(this)
        });

        // Find related code
        this.enhancedTools.set('find_related_code', {
            name: 'Find Related Code',
            description: 'Find code related to current file or concept using semantic analysis',
            handler: this.findRelatedCode.bind(this)
        });

        // Explain code relationships
        this.enhancedTools.set('explain_relationships', {
            name: 'Explain Relationships',
            description: 'Explain how different parts of the codebase relate to each other',
            handler: this.explainRelationships.bind(this)
        });
    }

    /**
     * Enhanced codebase query with semantic understanding
     */
    async enhancedQueryCodebase(query, options = {}) {
        try {
            // Get semantic matches
            const semanticResults = semanticIndexer.searchSemanticFiles(query, 20);
            
            // Build AI context
            const context = await aiContextBuilder.buildAIContext({
                query: query,
                taskType: 'search',
                includeArchitecture: true,
                maxFiles: 15
            });

            // Format results for AI consumption
            const enhancedResults = {
                query: query,
                semanticMatches: semanticResults.map(result => ({
                    file: result.path,
                    relevance: Math.round(result.relevance * 100),
                    concepts: result.matchingConcepts || [],
                    summary: this.generateFileSummary(result.path)
                })),
                aiContext: {
                    projectOverview: context.projectOverview?.summary || 'Large project analysis',
                    relevantConcepts: context.semanticContext?.relatedConcepts?.slice(0, 10) || [],
                    suggestedExplorations: context.semanticContext?.suggestedExplorations || [],
                    architecturalContext: context.architecture ? 'Available' : 'Not analyzed'
                },
                recommendations: this.generateSearchRecommendations(query, semanticResults),
                totalMatches: semanticResults.length,
                confidence: context.metadata?.confidence || 0
            };

            return {
                success: true,
                data: enhancedResults,
                message: `Found ${semanticResults.length} semantically related files for "${query}"`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Enhanced codebase query failed'
            };
        }
    }

    /**
     * Analyze project architecture
     */
    async analyzeArchitecture(focusArea = null) {
        try {
            const context = await aiContextBuilder.buildAIContext({
                taskType: 'architecture',
                includeArchitecture: true,
                includePatterns: true
            });

            const analysis = {
                overview: context.projectOverview,
                architecture: context.architecture,
                patterns: context.patterns,
                keyInsights: this.generateArchitecturalInsights(context),
                recommendations: this.generateArchitecturalRecommendations(context),
                complexity: this.assessArchitecturalComplexity(context),
                entryPoints: this.identifyEntryPoints(),
                coreModules: this.identifyCoreModules(),
                focusArea: focusArea ? this.analyzeFocusArea(focusArea) : null
            };

            return {
                success: true,
                data: analysis,
                message: 'Architectural analysis complete'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Architecture analysis failed'
            };
        }
    }

    /**
     * Suggest context-aware improvements
     */
    async suggestImprovements(currentFile = null, category = 'all') {
        try {
            const context = await aiContextBuilder.buildAIContext({
                currentFile: currentFile,
                taskType: 'improvement',
                includePatterns: true,
                maxFiles: 10
            });

            const suggestions = {
                currentFile: currentFile ? {
                    path: currentFile,
                    analysis: context.currentContext,
                    suggestions: this.generateFileSuggestions(context.currentContext)
                } : null,
                projectLevel: this.generateProjectSuggestions(context),
                architectural: this.generateArchitecturalSuggestions(context),
                performance: this.generatePerformanceSuggestions(context),
                codeQuality: this.generateCodeQualitySuggestions(context),
                maintainability: this.generateMaintainabilitySuggestions(context),
                priority: this.prioritizeSuggestions(context)
            };

            // Filter by category if specified
            if (category !== 'all') {
                const filteredSuggestions = {};
                filteredSuggestions[category] = suggestions[category];
                if (currentFile) filteredSuggestions.currentFile = suggestions.currentFile;
                return {
                    success: true,
                    data: filteredSuggestions,
                    message: `Generated ${category} suggestions`
                };
            }

            return {
                success: true,
                data: suggestions,
                message: 'Generated comprehensive improvement suggestions'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Suggestion generation failed'
            };
        }
    }

    /**
     * Find related code using semantic analysis
     */
    async findRelatedCode(reference, type = 'semantic') {
        try {
            let relatedFiles = [];
            let relatedSymbols = [];
            let explanation = '';

            if (type === 'semantic' || type === 'all') {
                // Semantic similarity
                relatedFiles = semanticIndexer.searchSemanticFiles(reference, 15);
                explanation += `Found ${relatedFiles.length} semantically related files. `;
            }

            if (type === 'dependency' || type === 'all') {
                // Dependency relationships
                const dependencies = this.findDependencyRelated(reference);
                relatedFiles.push(...dependencies);
                explanation += `Analyzed dependency relationships. `;
            }

            if (type === 'conceptual' || type === 'all') {
                // Conceptual similarity
                const concepts = this.extractConcepts(reference);
                const conceptualMatches = this.findConceptuallyRelated(concepts);
                relatedFiles.push(...conceptualMatches);
                explanation += `Found conceptually similar code. `;
            }

            // Remove duplicates and sort by relevance
            const uniqueFiles = this.deduplicateAndSort(relatedFiles);

            const results = {
                reference: reference,
                type: type,
                relatedFiles: uniqueFiles.slice(0, 20),
                relatedSymbols: relatedSymbols,
                conceptualGroups: this.groupByConcepts(uniqueFiles),
                explanation: explanation,
                totalFound: uniqueFiles.length,
                searchStrategies: this.getSearchStrategiesUsed(type)
            };

            return {
                success: true,
                data: results,
                message: `Found ${uniqueFiles.length} related code references`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Related code search failed'
            };
        }
    }

    /**
     * Explain code relationships
     */
    async explainRelationships(file1, file2 = null, relationshipType = 'all') {
        try {
            let explanation = {
                files: file2 ? [file1, file2] : [file1],
                relationships: [],
                visualizations: [],
                insights: [],
                recommendations: []
            };

            if (file2) {
                // Analyze relationship between two specific files
                explanation = await this.analyzeBinaryRelationship(file1, file2);
            } else {
                // Analyze relationships of one file with the broader codebase
                explanation = await this.analyzeFileRelationships(file1);
            }

            // Add architectural context
            const context = await aiContextBuilder.buildAIContext({
                currentFile: file1,
                taskType: 'understanding',
                maxFiles: 5
            });

            explanation.architecturalContext = {
                fileRole: context.currentContext?.role || 'Unknown',
                importance: context.currentContext?.importance || 1,
                patterns: context.currentContext?.patterns || [],
                relatedFiles: context.relevantFiles?.slice(0, 5) || []
            };

            return {
                success: true,
                data: explanation,
                message: `Analyzed relationships for ${explanation.files.length} file(s)`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Relationship analysis failed'
            };
        }
    }

    /**
     * Generate comprehensive project understanding context for AI
     */
    async generateProjectContext(focusArea = null) {
        try {
            const context = await aiContextBuilder.buildAIContext({
                query: focusArea,
                taskType: 'understanding',
                includeArchitecture: true,
                includePatterns: true,
                maxFiles: 25
            });

            // Enhance with additional insights
            const enhancedContext = {
                ...context,
                codebaseMap: this.generateCodebaseMap(),
                learningPath: this.generateLearningPath(focusArea),
                expertiseAreas: this.identifyExpertiseAreas(),
                complexityHotspots: this.identifyComplexityHotspots(),
                maintenanceAreas: this.identifyMaintenanceAreas()
            };

            return {
                success: true,
                data: enhancedContext,
                message: 'Generated comprehensive project context'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Project context generation failed'
            };
        }
    }

    // Helper methods
    generateFileSummary(filePath) {
        const analysis = projectIntelligence.projectMap.get(filePath);
        if (!analysis) return 'File not analyzed';

        return `${analysis.language} ${analysis.fileType}, ${analysis.lines} lines, ${analysis.functions.length} functions, ${analysis.classes.length} classes`;
    }

    generateSearchRecommendations(query, results) {
        const recommendations = [];

        if (results.length === 0) {
            recommendations.push({
                type: 'expand_search',
                suggestion: 'Try broader search terms or check spelling'
            });
        } else if (results.length > 50) {
            recommendations.push({
                type: 'narrow_search',
                suggestion: 'Refine search with more specific terms'
            });
        }

        // Add concept-based recommendations
        const topConcepts = semanticIndexer.getIndexStats().topConcepts.slice(0, 5);
        recommendations.push({
            type: 'explore_concepts',
            suggestion: `Explore key concepts: ${topConcepts.map(c => c.concept).join(', ')}`
        });

        return recommendations;
    }

    generateArchitecturalInsights(context) {
        const insights = [];

        if (context.projectOverview?.scale === 'large') {
            insights.push('Large-scale project with complex architecture');
        }

        if (context.projectOverview?.complexity === 'high') {
            insights.push('High complexity indicates potential for refactoring');
        }

        if (context.patterns?.architecturalPatterns?.length > 0) {
            insights.push(`Uses ${context.patterns.architecturalPatterns.length} architectural patterns`);
        }

        return insights;
    }

    generateArchitecturalRecommendations(context) {
        const recommendations = [];

        if (context.projectOverview?.complexity === 'high') {
            recommendations.push({
                priority: 'high',
                category: 'complexity',
                recommendation: 'Consider breaking down complex modules'
            });
        }

        return recommendations;
    }

    assessArchitecturalComplexity(context) {
        const complexity = {
            overall: context.projectOverview?.complexity || 'unknown',
            factors: [],
            score: 0
        };

        if (context.projectOverview?.totalFiles > 1000) {
            complexity.factors.push('Large number of files');
            complexity.score += 2;
        }

        if (context.projectOverview?.languages?.length > 3) {
            complexity.factors.push('Multiple programming languages');
            complexity.score += 1;
        }

        return complexity;
    }

    // Additional helper methods (simplified implementations)
    identifyEntryPoints() {
        const entryPoints = [];
        for (const [filePath, analysis] of projectIntelligence.projectMap) {
            if (analysis.fileType === 'entry') {
                entryPoints.push(filePath);
            }
        }
        return entryPoints;
    }

    identifyCoreModules() {
        const coreModules = [];
        for (const [filePath, analysis] of projectIntelligence.projectMap) {
            if (analysis.importance > 7) {
                coreModules.push({
                    path: filePath,
                    importance: analysis.importance,
                    role: analysis.fileType
                });
            }
        }
        return coreModules.sort((a, b) => b.importance - a.importance).slice(0, 10);
    }

    // Placeholder methods for full implementation
    analyzeFocusArea(focusArea) { return { area: focusArea, analysis: 'To be implemented' }; }
    generateFileSuggestions(context) { return []; }
    generateProjectSuggestions(context) { return []; }
    generateArchitecturalSuggestions(context) { return []; }
    generatePerformanceSuggestions(context) { return []; }
    generateCodeQualitySuggestions(context) { return []; }
    generateMaintainabilitySuggestions(context) { return []; }
    prioritizeSuggestions(context) { return []; }
    findDependencyRelated(reference) { return []; }
    extractConcepts(reference) { return []; }
    findConceptuallyRelated(concepts) { return []; }
    deduplicateAndSort(files) { return files; }
    groupByConcepts(files) { return {}; }
    getSearchStrategiesUsed(type) { return [type]; }
    analyzeBinaryRelationship(file1, file2) { return {}; }
    analyzeFileRelationships(file) { return {}; }
    generateCodebaseMap() { return {}; }
    generateLearningPath(focusArea) { return []; }
    identifyExpertiseAreas() { return []; }
    identifyComplexityHotspots() { return []; }
    identifyMaintenanceAreas() { return []; }

    // Public API
    getEnhancedTool(toolName) {
        return this.enhancedTools.get(toolName);
    }

    getAllEnhancedTools() {
        return Array.from(this.enhancedTools.entries()).map(([name, tool]) => ({
            name,
            description: tool.description
        }));
    }
}

// Export singleton instance
export const aiEnhancedTools = new AIEnhancedTools();