/**
 * Semantic Code Indexer
 * Creates semantic understanding of code relationships and patterns
 */

import { performanceOptimizer } from './performance_optimizer.js';

class SemanticIndexer {
    constructor() {
        this.semanticIndex = new Map(); // Concept -> files/symbols
        this.symbolGraph = new Map(); // Symbol -> related symbols
        this.conceptGraph = new Map(); // Concept -> related concepts
        this.codePatterns = new Map(); // Pattern -> occurrences
        this.apiIndex = new Map(); // API endpoint -> implementation
        this.cache = performanceOptimizer.createSmartCache(500, 15 * 60 * 1000);
    }

    /**
     * Build semantic index from project analysis
     */
    async buildSemanticIndex(projectMap, dependencyGraph) {
        console.log('Building semantic index...');
        
        try {
            // Extract concepts from all files
            for (const [filePath, analysis] of projectMap) {
                await this.extractSemanticConcepts(filePath, analysis);
            }
            
            // Build symbol relationships
            await this.buildSymbolRelationships(projectMap, dependencyGraph);
            
            // Identify design patterns
            await this.identifyDesignPatterns(projectMap);
            
            // Create concept clusters
            await this.createConceptClusters();
            
            console.log(`Semantic index built: ${this.semanticIndex.size} concepts indexed`);
            
        } catch (error) {
            console.error('Error building semantic index:', error);
        }
    }

    /**
     * Extract semantic concepts from code analysis
     */
    async extractSemanticConcepts(filePath, analysis) {
        const concepts = new Set();
        
        // Extract concepts from file path
        const pathConcepts = this.extractPathConcepts(filePath);
        pathConcepts.forEach(concept => concepts.add(concept));
        
        // Extract concepts from symbols
        const symbolConcepts = this.extractSymbolConcepts(analysis);
        symbolConcepts.forEach(concept => concepts.add(concept));
        
        // Extract concepts from code patterns
        const patternConcepts = this.extractPatternConcepts(analysis);
        patternConcepts.forEach(concept => concepts.add(concept));
        
        // Store concepts for this file
        for (const concept of concepts) {
            if (!this.semanticIndex.has(concept)) {
                this.semanticIndex.set(concept, {
                    files: new Set(),
                    symbols: new Set(),
                    patterns: new Set(),
                    weight: 0
                });
            }
            
            const conceptData = this.semanticIndex.get(concept);
            conceptData.files.add(filePath);
            conceptData.weight += this.calculateConceptWeight(concept, analysis);
            
            // Add symbols related to this concept
            analysis.functions.forEach(func => {
                if (this.isSymbolRelatedToConcept(func, concept)) {
                    conceptData.symbols.add(`${filePath}:${func}`);
                }
            });
            
            analysis.classes.forEach(cls => {
                if (this.isSymbolRelatedToConcept(cls, concept)) {
                    conceptData.symbols.add(`${filePath}:${cls}`);
                }
            });
        }
    }

    /**
     * Extract concepts from file path
     */
    extractPathConcepts(filePath) {
        const concepts = [];
        const pathParts = filePath.toLowerCase().split('/');
        
        pathParts.forEach(part => {
            // Clean part (remove extensions, special chars)
            const cleanPart = part.replace(/[._-]/g, ' ').replace(/\.(js|ts|py|java|cpp|c|php|rb|go|rs)$/, '');
            
            // Extract meaningful words
            const words = cleanPart.split(/\s+/).filter(word => word.length > 2);
            
            words.forEach(word => {
                const concept = this.normalizeConcept(word);
                if (this.isValidConcept(concept)) {
                    concepts.push(concept);
                }
            });
            
            // Domain-specific concepts
            if (part.includes('api')) concepts.push('api');
            if (part.includes('service')) concepts.push('service');
            if (part.includes('controller')) concepts.push('controller');
            if (part.includes('model')) concepts.push('model');
            if (part.includes('view')) concepts.push('view');
            if (part.includes('component')) concepts.push('component');
            if (part.includes('util')) concepts.push('utility');
            if (part.includes('helper')) concepts.push('helper');
            if (part.includes('config')) concepts.push('configuration');
            if (part.includes('test')) concepts.push('testing');
        });
        
        return concepts;
    }

    /**
     * Extract concepts from function and class names
     */
    extractSymbolConcepts(analysis) {
        const concepts = [];
        
        // Process functions
        analysis.functions.forEach(funcName => {
            const funcConcepts = this.extractConceptsFromName(funcName);
            concepts.push(...funcConcepts);
        });
        
        // Process classes
        analysis.classes.forEach(className => {
            const classConcepts = this.extractConceptsFromName(className);
            concepts.push(...classConcepts);
        });
        
        // Process exports (API surface)
        analysis.exports.forEach(exportName => {
            const exportConcepts = this.extractConceptsFromName(exportName);
            concepts.push(...exportConcepts);
        });
        
        return concepts;
    }

    /**
     * Extract concepts from identifier names using camelCase/snake_case parsing
     */
    extractConceptsFromName(name) {
        const concepts = [];
        
        // Split camelCase and PascalCase
        const camelSplit = name.split(/(?=[A-Z])/).map(part => part.toLowerCase());
        
        // Split snake_case and kebab-case
        const snakeSplit = name.split(/[_-]/).map(part => part.toLowerCase());
        
        // Combine all parts
        const allParts = [...new Set([...camelSplit, ...snakeSplit])];
        
        allParts.forEach(part => {
            const concept = this.normalizeConcept(part);
            if (this.isValidConcept(concept)) {
                concepts.push(concept);
            }
        });
        
        // Add compound concepts for common patterns
        if (name.toLowerCase().includes('create')) concepts.push('creation');
        if (name.toLowerCase().includes('delete')) concepts.push('deletion');
        if (name.toLowerCase().includes('update')) concepts.push('modification');
        if (name.toLowerCase().includes('get')) concepts.push('retrieval');
        if (name.toLowerCase().includes('set')) concepts.push('assignment');
        if (name.toLowerCase().includes('validate')) concepts.push('validation');
        if (name.toLowerCase().includes('parse')) concepts.push('parsing');
        if (name.toLowerCase().includes('render')) concepts.push('rendering');
        if (name.toLowerCase().includes('handle')) concepts.push('event-handling');
        
        return concepts;
    }

    /**
     * Extract concepts from code patterns
     */
    extractPatternConcepts(analysis) {
        const concepts = [];
        
        // Analyze patterns detected in the code
        analysis.patterns.forEach(pattern => {
            switch (pattern) {
                case 'mvc':
                    concepts.push('model-view-controller', 'architecture', 'separation-of-concerns');
                    break;
                case 'singleton':
                    concepts.push('singleton-pattern', 'design-pattern', 'object-creation');
                    break;
                case 'factory':
                    concepts.push('factory-pattern', 'design-pattern', 'object-creation');
                    break;
                case 'observer':
                    concepts.push('observer-pattern', 'design-pattern', 'event-driven');
                    break;
                case 'middleware':
                    concepts.push('middleware-pattern', 'request-processing', 'pipeline');
                    break;
                case 'repository':
                    concepts.push('repository-pattern', 'data-access', 'abstraction');
                    break;
            }
        });
        
        // Analyze imports for framework/library concepts
        analysis.imports.forEach(importPath => {
            if (importPath.includes('react')) concepts.push('react', 'frontend', 'component-based');
            if (importPath.includes('express')) concepts.push('express', 'backend', 'web-server');
            if (importPath.includes('mongoose')) concepts.push('mongodb', 'database', 'orm');
            if (importPath.includes('lodash')) concepts.push('utility', 'functional-programming');
            if (importPath.includes('axios')) concepts.push('http-client', 'api-communication');
        });
        
        return concepts;
    }

    /**
     * Build relationships between symbols
     */
    async buildSymbolRelationships(projectMap, dependencyGraph) {
        for (const [filePath, analysis] of projectMap) {
            // Build relationships within the file
            this.buildIntraFileRelationships(filePath, analysis);
            
            // Build relationships across files using dependency graph
            if (dependencyGraph.has(filePath)) {
                const dependencies = dependencyGraph.get(filePath);
                this.buildInterFileRelationships(filePath, dependencies, projectMap);
            }
        }
    }

    /**
     * Build relationships within a single file
     */
    buildIntraFileRelationships(filePath, analysis) {
        const symbols = [...analysis.functions, ...analysis.classes];
        
        // Create relationships between symbols in the same file
        for (let i = 0; i < symbols.length; i++) {
            for (let j = i + 1; j < symbols.length; j++) {
                const symbol1 = `${filePath}:${symbols[i]}`;
                const symbol2 = `${filePath}:${symbols[j]}`;
                
                this.addSymbolRelationship(symbol1, symbol2, 'co-located', 0.3);
            }
        }
        
        // Create stronger relationships for symbols with similar concepts
        symbols.forEach(symbol => {
            const symbolConcepts = this.extractConceptsFromName(symbol);
            
            symbols.forEach(otherSymbol => {
                if (symbol !== otherSymbol) {
                    const otherConcepts = this.extractConceptsFromName(otherSymbol);
                    const conceptOverlap = this.calculateConceptOverlap(symbolConcepts, otherConcepts);
                    
                    if (conceptOverlap > 0.3) {
                        const symbol1 = `${filePath}:${symbol}`;
                        const symbol2 = `${filePath}:${otherSymbol}`;
                        this.addSymbolRelationship(symbol1, symbol2, 'concept-similar', conceptOverlap);
                    }
                }
            });
        });
    }

    /**
     * Add relationship between symbols
     */
    addSymbolRelationship(symbol1, symbol2, type, strength) {
        if (!this.symbolGraph.has(symbol1)) {
            this.symbolGraph.set(symbol1, new Map());
        }
        if (!this.symbolGraph.has(symbol2)) {
            this.symbolGraph.set(symbol2, new Map());
        }
        
        this.symbolGraph.get(symbol1).set(symbol2, { type, strength });
        this.symbolGraph.get(symbol2).set(symbol1, { type, strength });
    }

    /**
     * Search semantically related files
     */
    searchSemanticFiles(query, maxResults = 10) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const results = [];
        
        // Find concepts matching query terms
        const matchingConcepts = [];
        for (const [concept, conceptData] of this.semanticIndex) {
            for (const term of queryTerms) {
                if (concept.includes(term) || term.includes(concept)) {
                    matchingConcepts.push({
                        concept,
                        data: conceptData,
                        relevance: this.calculateQueryRelevance(concept, term, conceptData.weight)
                    });
                }
            }
        }
        
        // Sort by relevance
        matchingConcepts.sort((a, b) => b.relevance - a.relevance);
        
        // Collect files from top concepts
        const fileScores = new Map();
        for (const { concept, data, relevance } of matchingConcepts.slice(0, 20)) {
            for (const filePath of data.files) {
                const currentScore = fileScores.get(filePath) || 0;
                fileScores.set(filePath, currentScore + relevance);
            }
        }
        
        // Sort files by score
        const sortedFiles = Array.from(fileScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxResults);
        
        return sortedFiles.map(([filePath, score]) => ({
            path: filePath,
            relevance: score,
            matchingConcepts: this.getFileConceptMatches(filePath, queryTerms)
        }));
    }

    /**
     * Get related files based on semantic similarity
     */
    getRelatedFiles(filePath, maxResults = 5) {
        const fileConcepts = this.getFileConceptsFromIndex(filePath);
        const relatedFiles = new Map();
        
        // Find files sharing concepts
        for (const concept of fileConcepts) {
            if (this.semanticIndex.has(concept)) {
                const conceptData = this.semanticIndex.get(concept);
                for (const otherFile of conceptData.files) {
                    if (otherFile !== filePath) {
                        const currentScore = relatedFiles.get(otherFile) || 0;
                        relatedFiles.set(otherFile, currentScore + conceptData.weight);
                    }
                }
            }
        }
        
        // Sort by relevance
        return Array.from(relatedFiles.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxResults)
            .map(([path, score]) => ({ path, similarity: score }));
    }

    /**
     * Generate suggestions for code understanding
     */
    generateCodeSuggestions(filePath, context = '') {
        const suggestions = [];
        const fileConcepts = this.getFileConceptsFromIndex(filePath);
        
        // Suggest related concepts to explore
        const relatedConcepts = this.getRelatedConcepts(fileConcepts);
        relatedConcepts.slice(0, 5).forEach(concept => {
            suggestions.push({
                type: 'concept',
                title: `Explore ${concept.concept}`,
                description: `This concept appears in ${concept.data.files.size} files`,
                action: 'search',
                query: concept.concept
            });
        });
        
        // Suggest architectural patterns
        const patterns = this.detectArchitecturalPatterns(filePath);
        patterns.forEach(pattern => {
            suggestions.push({
                type: 'pattern',
                title: `Understand ${pattern.name}`,
                description: pattern.description,
                action: 'explain',
                target: pattern.name
            });
        });
        
        // Suggest entry points
        if (this.isComplexFile(filePath)) {
            suggestions.push({
                type: 'navigation',
                title: 'Find entry points',
                description: 'Discover main functions and public APIs',
                action: 'analyze',
                target: 'entry-points'
            });
        }
        
        return suggestions;
    }

    /**
     * Utility methods
     */
    normalizeConcept(concept) {
        return concept.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    isValidConcept(concept) {
        // Filter out common words and short concepts
        const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'cannot', 'cant', 'wont', 'dont', 'didnt', 'hasnt', 'havent', 'isnt', 'arent', 'wasnt', 'werent', 'let', 'var', 'const', 'if', 'else', 'for', 'while', 'try', 'catch', 'new', 'this', 'that', 'these', 'those'];
        
        return concept.length > 2 && 
               !commonWords.includes(concept) &&
               !concept.match(/^\d+$/); // Not just numbers
    }

    calculateConceptWeight(concept, analysis) {
        let weight = 1;
        
        // Weight based on file importance
        if (analysis.fileType === 'entry') weight += 5;
        if (analysis.fileType === 'config') weight += 3;
        if (analysis.fileType === 'source') weight += 2;
        
        // Weight based on symbol frequency
        const symbolCount = analysis.functions.length + analysis.classes.length;
        weight += Math.min(symbolCount * 0.1, 2);
        
        // Weight based on file size (larger files might be more important)
        if (analysis.lines > 100) weight += 1;
        if (analysis.lines > 500) weight += 1;
        
        return weight;
    }

    isSymbolRelatedToConcept(symbol, concept) {
        const symbolConcepts = this.extractConceptsFromName(symbol);
        return symbolConcepts.includes(concept);
    }

    calculateConceptOverlap(concepts1, concepts2) {
        const set1 = new Set(concepts1);
        const set2 = new Set(concepts2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    calculateQueryRelevance(concept, term, weight) {
        let relevance = weight;
        
        // Exact match gets higher score
        if (concept === term) relevance *= 2;
        
        // Partial match gets moderate score
        else if (concept.includes(term)) relevance *= 1.5;
        
        // Term includes concept gets lower score
        else if (term.includes(concept)) relevance *= 1.2;
        
        return relevance;
    }

    getFileConceptsFromIndex(filePath) {
        const concepts = [];
        for (const [concept, data] of this.semanticIndex) {
            if (data.files.has(filePath)) {
                concepts.push(concept);
            }
        }
        return concepts;
    }

    getRelatedConcepts(concepts) {
        const related = new Map();
        
        for (const concept of concepts) {
            if (this.conceptGraph.has(concept)) {
                const relatedConcepts = this.conceptGraph.get(concept);
                for (const [relatedConcept, strength] of relatedConcepts) {
                    const currentStrength = related.get(relatedConcept) || 0;
                    related.set(relatedConcept, currentStrength + strength);
                }
            }
        }
        
        return Array.from(related.entries())
            .map(([concept, strength]) => ({
                concept,
                strength,
                data: this.semanticIndex.get(concept) || { files: new Set(), symbols: new Set() }
            }))
            .sort((a, b) => b.strength - a.strength);
    }

    /**
     * Create concept clusters for better understanding
     */
    async createConceptClusters() {
        // Group related concepts together
        const clusters = new Map();
        
        for (const [concept, data] of this.semanticIndex) {
            const relatedConcepts = this.findSimilarConcepts(concept, data);
            
            if (relatedConcepts.length > 0) {
                const clusterKey = this.generateClusterKey(concept, relatedConcepts);
                
                if (!clusters.has(clusterKey)) {
                    clusters.set(clusterKey, {
                        mainConcept: concept,
                        relatedConcepts: relatedConcepts,
                        files: new Set(),
                        strength: 0
                    });
                }
                
                const cluster = clusters.get(clusterKey);
                data.files.forEach(file => cluster.files.add(file));
                cluster.strength += data.weight;
            }
        }
        
        this.conceptClusters = clusters;
    }

    /**
     * Find concepts that are semantically similar
     */
    findSimilarConcepts(concept, data) {
        const similar = [];
        
        for (const [otherConcept, otherData] of this.semanticIndex) {
            if (concept !== otherConcept) {
                // Check for string similarity
                if (this.areConceptsSimilar(concept, otherConcept)) {
                    similar.push(otherConcept);
                    continue;
                }
                
                // Check for file overlap
                const fileOverlap = this.calculateFileOverlap(data.files, otherData.files);
                if (fileOverlap > 0.3) {
                    similar.push(otherConcept);
                }
            }
        }
        
        return similar.slice(0, 5); // Limit to 5 similar concepts
    }

    areConceptsSimilar(concept1, concept2) {
        // Simple string similarity
        const maxLen = Math.max(concept1.length, concept2.length);
        const minLen = Math.min(concept1.length, concept2.length);
        
        if (maxLen - minLen > 3) return false; // Too different in length
        
        // Check for common substrings
        for (let i = 0; i < concept1.length - 2; i++) {
            const substr = concept1.substring(i, i + 3);
            if (concept2.includes(substr)) {
                return true;
            }
        }
        
        return false;
    }

    calculateFileOverlap(files1, files2) {
        const intersection = new Set([...files1].filter(x => files2.has(x)));
        const union = new Set([...files1, ...files2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    generateClusterKey(mainConcept, relatedConcepts) {
        const allConcepts = [mainConcept, ...relatedConcepts].sort();
        return allConcepts.slice(0, 3).join('-'); // Use first 3 concepts as key
    }

    /**
     * Get statistics about the semantic index
     */
    getIndexStats() {
        return {
            totalConcepts: this.semanticIndex.size,
            totalSymbols: this.symbolGraph.size,
            averageConceptWeight: this.calculateAverageConceptWeight(),
            topConcepts: this.getTopConcepts(10),
            conceptClusters: this.conceptClusters?.size || 0
        };
    }

    calculateAverageConceptWeight() {
        if (this.semanticIndex.size === 0) return 0;
        
        let totalWeight = 0;
        for (const [, data] of this.semanticIndex) {
            totalWeight += data.weight;
        }
        
        return totalWeight / this.semanticIndex.size;
    }

    getTopConcepts(limit = 10) {
        return Array.from(this.semanticIndex.entries())
            .sort((a, b) => b[1].weight - a[1].weight)
            .slice(0, limit)
            .map(([concept, data]) => ({
                concept,
                weight: data.weight,
                fileCount: data.files.size,
                symbolCount: data.symbols.size
            }));
    }

    /**
     * Check if the semantic index has been built
     */
    isIndexBuilt() {
        return this.semanticIndex.size > 0;
    }

    /**
     * Search for files semantically related to a query
     */
    searchSemanticFiles(query, maxResults = 20) {
        if (!this.isIndexBuilt()) {
            return [];
        }

        const results = [];
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);

        // Score files based on concept matches
        const fileScores = new Map();

        // Direct concept matches
        for (const [concept, data] of this.semanticIndex) {
            let conceptScore = 0;

            // Exact concept match
            if (concept.toLowerCase() === queryLower) {
                conceptScore = 1.0;
            }
            // Partial concept match
            else if (concept.toLowerCase().includes(queryLower)) {
                conceptScore = 0.8;
            }
            // Term-based matching
            else {
                const conceptTerms = concept.toLowerCase().split(/[_\-\s]+/);
                const matchingTerms = queryTerms.filter(term => 
                    conceptTerms.some(cTerm => cTerm.includes(term) || term.includes(cTerm))
                );
                if (matchingTerms.length > 0) {
                    conceptScore = 0.6 * (matchingTerms.length / queryTerms.length);
                }
            }

            if (conceptScore > 0) {
                // Add score to all files associated with this concept
                for (const filePath of data.files) {
                    const currentScore = fileScores.get(filePath) || 0;
                    const weightedScore = conceptScore * (data.weight / 10); // Normalize weight
                    fileScores.set(filePath, currentScore + weightedScore);
                }
            }
        }

        // Convert to results array with additional metadata
        for (const [filePath, relevance] of fileScores) {
            if (relevance > 0.1) { // Minimum relevance threshold
                const matchingConcepts = this.getFileMatchingConcepts(filePath, queryTerms);
                
                results.push({
                    path: filePath,
                    relevance: Math.min(relevance, 1.0), // Cap at 1.0
                    matchingConcepts: matchingConcepts,
                    score: relevance
                });
            }
        }

        // Sort by relevance and return top results
        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, maxResults);
    }

    /**
     * Get concepts from a file that match query terms
     */
    getFileMatchingConcepts(filePath, queryTerms) {
        const matchingConcepts = [];

        for (const [concept, data] of this.semanticIndex) {
            if (data.files.has(filePath)) {
                const conceptLower = concept.toLowerCase();
                const conceptTerms = conceptLower.split(/[_\-\s]+/);
                
                const hasMatch = queryTerms.some(term => 
                    conceptLower.includes(term) || 
                    conceptTerms.some(cTerm => cTerm.includes(term) || term.includes(cTerm))
                );
                
                if (hasMatch) {
                    matchingConcepts.push(concept);
                }
            }
        }

        return matchingConcepts.slice(0, 5); // Limit to 5 concepts
    }

    /**
     * Get related files for a given file path
     */
    getRelatedFiles(filePath, maxResults = 10) {
        if (!this.isIndexBuilt()) {
            return [];
        }

        const fileConcepts = this.getFileConceptsFromIndex(filePath);
        if (fileConcepts.length === 0) {
            return [];
        }

        const relatedFiles = new Map();

        // Find files that share concepts
        fileConcepts.forEach(concept => {
            const conceptData = this.semanticIndex.get(concept);
            if (conceptData) {
                conceptData.files.forEach(relatedFile => {
                    if (relatedFile !== filePath) {
                        const currentScore = relatedFiles.get(relatedFile) || 0;
                        relatedFiles.set(relatedFile, currentScore + conceptData.weight);
                    }
                });
            }
        });

        // Convert to array and sort by similarity
        return Array.from(relatedFiles.entries())
            .map(([path, score]) => ({
                path,
                similarity: Math.min(score / fileConcepts.length, 1.0)
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults);
    }

    /**
     * Get concepts associated with a file
     */
    getFileConceptsFromIndex(filePath) {
        const concepts = [];
        
        for (const [concept, data] of this.semanticIndex) {
            if (data.files.has(filePath)) {
                concepts.push(concept);
            }
        }

        return concepts.sort((a, b) => {
            const aData = this.semanticIndex.get(a);
            const bData = this.semanticIndex.get(b);
            return bData.weight - aData.weight;
        });
    }

    /**
     * Generate code suggestions based on semantic analysis
     */
    generateCodeSuggestions(filePath) {
        const suggestions = [];
        
        try {
            const fileConcepts = this.getFileConceptsFromIndex(filePath);
            const relatedFiles = this.getRelatedFiles(filePath, 5);

            // Suggest exploring related files
            if (relatedFiles.length > 0) {
                suggestions.push({
                    type: 'exploration',
                    title: 'Explore Related Files',
                    description: `Files with similar concepts: ${relatedFiles.map(f => f.path.split('/').pop()).join(', ')}`,
                    files: relatedFiles.map(f => f.path)
                });
            }

            // Suggest concepts to explore
            if (fileConcepts.length > 0) {
                const topConcepts = fileConcepts.slice(0, 3);
                suggestions.push({
                    type: 'concepts',
                    title: 'Key Concepts in This File',
                    description: `Main concepts: ${topConcepts.join(', ')}`,
                    concepts: topConcepts
                });
            }

            // Suggest similar patterns
            const patterns = this.findPatternsInFile(filePath);
            if (patterns.length > 0) {
                suggestions.push({
                    type: 'patterns',
                    title: 'Design Patterns Detected',
                    description: `Patterns found: ${patterns.join(', ')}`,
                    patterns: patterns
                });
            }

        } catch (error) {
            console.warn(`Error generating suggestions for ${filePath}:`, error);
        }

        return suggestions;
    }

    /**
     * Find design patterns in a specific file
     */
    findPatternsInFile(filePath) {
        const patterns = [];
        
        for (const [pattern, data] of this.codePatterns) {
            if (data.files && data.files.has(filePath)) {
                patterns.push(pattern);
            }
        }

        return patterns;
    }

    /**
     * Clear all indexes and caches
     */
    clearIndex() {
        this.semanticIndex.clear();
        this.symbolGraph.clear();
        this.conceptGraph.clear();
        this.codePatterns.clear();
        this.apiIndex.clear();
        this.cache.clear();
        this.conceptClusters = null;
    }

    /**
     * Get debug information about the index
     */
    getDebugInfo() {
        return {
            semanticIndexSize: this.semanticIndex.size,
            symbolGraphSize: this.symbolGraph.size,
            conceptGraphSize: this.conceptGraph.size,
            codePatternsSize: this.codePatterns.size,
            apiIndexSize: this.apiIndex.size,
            cacheSize: this.cache.size || 0,
            conceptClustersSize: this.conceptClusters?.size || 0,
            sampleConcepts: Array.from(this.semanticIndex.keys()).slice(0, 5),
            indexStats: this.getIndexStats()
        };
    }
}

// Export singleton instance
export const semanticIndexer = new SemanticIndexer();