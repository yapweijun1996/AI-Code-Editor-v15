/**
 * Context Intelligence Engine
 * Advanced semantic context analysis for AI code completion using AST and symbol resolution
 */

import { symbolResolver } from './symbol_resolver.js';
import { codeComprehension } from './code_comprehension.js';
import { CodebaseIndexer } from './code_intel.js';
import { codeQualityAnalyzer } from './code_quality_analyzer.js';
import { dataFlowAnalyzer } from './data_flow_analyzer.js';
import { debuggingIntelligence } from './debugging_intelligence.js';
import * as Editor from './editor.js';
import * as FileSystem from './file_system.js';

export class ContextIntelligenceEngine {
    constructor() {
        this.contextCache = new Map();
        this.symbolCache = new Map();
        this.importGraph = new Map();
        this.maxContextSize = 10000; // 10KB context window
        this.analysisDepth = {
            shallow: 1,   // Current file only
            medium: 2,    // Current file + direct imports
            deep: 3       // Full dependency analysis
        };
    }

    /**
     * Analyze context for completion at a specific position
     * @param {Object} position - Monaco position object
     * @param {string} trigger - Trigger character or sequence
     * @returns {Object} Context analysis result
     */
    async analyzeCompletionContext(position, trigger) {
        const activeFile = Editor.getActiveFile();
        if (!activeFile) {
            return this._createEmptyContext();
        }

        const filePath = Editor.getActiveFilePath();
        const content = activeFile.model.getValue();
        const language = activeFile.model.getLanguageId();

        try {
            // Generate cache key
            const cacheKey = this._generateCacheKey(filePath, position, trigger, content.length);
            
            // Check cache first
            if (this.contextCache.has(cacheKey)) {
                const cached = this.contextCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 30000) { // 30 second cache
                    return cached.context;
                }
            }

            // Perform context analysis
            const context = await this._performContextAnalysis(
                filePath, content, language, position, trigger
            );

            // Cache the result
            this._cacheContext(cacheKey, context);

            return context;

        } catch (error) {
            console.error('[Context Intelligence] Analysis failed:', error);
            return this._createEmptyContext();
        }
    }

    /**
     * Get relevant context for a specific symbol or pattern
     * @param {string} symbol - Symbol to analyze
     * @param {string} filePath - Current file path
     * @returns {Object} Symbol context information
     */
    async getSymbolContext(symbol, filePath) {
        const cacheKey = `symbol_${symbol}_${filePath}`;
        
        if (this.symbolCache.has(cacheKey)) {
            return this.symbolCache.get(cacheKey);
        }

        try {
            const rootHandle = window.appState?.rootDirectoryHandle;
            if (!rootHandle) {
                return { symbol, definitions: [], usages: [], type: 'unknown' };
            }

            // Use existing code comprehension for symbol analysis
            const analysis = await codeComprehension.analyzeSymbol(symbol, filePath, rootHandle);
            
            // Cache the result
            this.symbolCache.set(cacheKey, analysis);
            
            return analysis;

        } catch (error) {
            console.error('[Context Intelligence] Symbol analysis failed:', error);
            return { symbol, definitions: [], usages: [], type: 'unknown' };
        }
    }

    /**
     * Analyze imports and dependencies for completion context
     * @param {string} filePath - Current file path
     * @param {string} content - File content
     * @returns {Object} Import analysis result
     */
    async analyzeImports(filePath, content) {
        try {
            // Build symbol table to extract imports
            const symbolTable = await symbolResolver.buildSymbolTable(content, filePath);
            
            // Handle case where symbol table couldn't be built (e.g., non-JS files or syntax errors)
            if (!symbolTable || symbolTable.parseError) {
                if (symbolTable && symbolTable.parseError) {
                    console.debug(`[Context Intelligence] Skipping import analysis for file with syntax errors: ${filePath}`);
                }
                return {
                    imports: [],
                    availableModules: [],
                    suggestedImports: [],
                    namespaces: new Map()
                };
            }
            
            const importAnalysis = {
                imports: symbolTable.imports || [],
                availableModules: [],
                suggestedImports: [],
                namespaces: new Map()
            };

            // Analyze each import
            for (const importInfo of importAnalysis.imports) {
                if (importInfo.source) {
                    // Resolve import path and analyze available exports
                    const moduleInfo = await this._analyzeModule(importInfo.source, filePath);
                    if (moduleInfo) {
                        importAnalysis.availableModules.push(moduleInfo);
                        
                        // Map imported symbols to their namespaces
                        if (importInfo.specifiers) {
                            importInfo.specifiers.forEach(spec => {
                                importAnalysis.namespaces.set(spec.local, {
                                    module: importInfo.source,
                                    original: spec.imported || spec.local,
                                    type: moduleInfo.type || 'module'
                                });
                            });
                        }
                    }
                }
            }

            return importAnalysis;

        } catch (error) {
            console.error('[Context Intelligence] Import analysis failed:', error);
            return { imports: [], availableModules: [], suggestedImports: [], namespaces: new Map() };
        }
    }

    /**
     * Get scope-aware completions for current position
     * @param {Object} position - Monaco position object
     * @param {string} content - File content
     * @param {string} language - Programming language
     * @returns {Object} Scope analysis result
     */
    async analyzeScopeContext(position, content, language) {
        try {
            // Build symbol table for scope analysis
            const symbolTable = await symbolResolver.buildSymbolTable(content, 'temp');
            
            // Handle case where symbol table couldn't be built or has parse errors
            if (!symbolTable || symbolTable.parseError) {
                if (symbolTable && symbolTable.parseError) {
                    console.debug(`[Context Intelligence] Skipping scope analysis due to syntax errors`);
                }
                return {
                    currentScope: 'global',
                    availableSymbols: [],
                    enclosingFunction: null,
                    enclosingClass: null,
                    localVariables: [],
                    parameters: []
                };
            }
            
            const scopeContext = {
                currentScope: 'global',
                availableSymbols: [],
                enclosingFunction: null,
                enclosingClass: null,
                localVariables: [],
                parameters: []
            };

            // Find current scope based on position
            const currentScope = this._findScopeAtPosition(symbolTable, position);
            if (currentScope) {
                scopeContext.currentScope = currentScope.type;
                scopeContext.availableSymbols = currentScope.symbols || [];
                
                // Find enclosing function or class
                scopeContext.enclosingFunction = this._findEnclosingFunction(symbolTable, position);
                scopeContext.enclosingClass = this._findEnclosingClass(symbolTable, position);
            }

            return scopeContext;

        } catch (error) {
            console.error('[Context Intelligence] Scope analysis failed:', error);
            return {
                currentScope: 'global',
                availableSymbols: [],
                enclosingFunction: null,
                enclosingClass: null,
                localVariables: [],
                parameters: []
            };
        }
    }

    /**
     * Analyze typing context for better completion suggestions
     * @param {Object} position - Monaco position object
     * @param {string} content - File content
     * @param {string} trigger - Trigger character
     * @returns {Object} Typing context analysis
     */
    analyzeTypingContext(position, content, trigger) {
        const lines = content.split('\n');
        const currentLine = lines[position.lineNumber - 1] || '';
        const beforeCursor = currentLine.substring(0, position.column - 1);
        const afterCursor = currentLine.substring(position.column - 1);

        const context = {
            trigger,
            currentLine,
            beforeCursor,
            afterCursor,
            context: this._determineContext(beforeCursor, trigger),
            expectedType: null,
            completionType: 'general'
        };

        // Determine completion type based on context
        if (trigger === '.') {
            context.completionType = 'member';
            context.objectName = this._extractObjectName(beforeCursor);
        } else if (trigger === '(' || beforeCursor.endsWith('(')) {
            context.completionType = 'parameter';
            context.functionName = this._extractFunctionName(beforeCursor);
        } else if (beforeCursor.includes('import ') || beforeCursor.includes('from ')) {
            context.completionType = 'import';
        } else if (this._isInComment(beforeCursor)) {
            context.completionType = 'comment';
        } else if (this._isInString(beforeCursor)) {
            context.completionType = 'string';
        }

        return context;
    }

    // Private methods

    async _performContextAnalysis(filePath, content, language, position, trigger) {
        const [
            scopeContext,
            importContext,
            typingContext,
            nearbyContext,
            qualityContext,
            dataFlowContext,
            debugContext
        ] = await Promise.all([
            this.analyzeScopeContext(position, content, language),
            this.analyzeImports(filePath, content),
            Promise.resolve(this.analyzeTypingContext(position, content, trigger)),
            this._analyzeNearbyContext(content, position),
            this._analyzeCodeQuality(content, filePath),
            this._analyzeDataFlow(content, position),
            this._analyzeDebuggingContext(content, position)
        ]);

        return {
            filePath,
            language,
            position,
            trigger,
            scope: scopeContext,
            imports: importContext,
            typing: typingContext,
            nearby: nearbyContext,
            quality: qualityContext,
            dataFlow: dataFlowContext,
            debugging: debugContext,
            contextWindow: this._buildContextWindow(content, position),
            timestamp: Date.now()
        };
    }

    _analyzeNearbyContext(content, position) {
        const lines = content.split('\n');
        const contextLines = 10; // Analyze 10 lines before and after
        
        const startLine = Math.max(0, position.lineNumber - contextLines - 1);
        const endLine = Math.min(lines.length, position.lineNumber + contextLines);
        
        const nearbyContent = lines.slice(startLine, endLine).join('\n');
        
        return {
            content: nearbyContent,
            startLine: startLine + 1,
            endLine,
            patterns: this._extractPatterns(nearbyContent),
            variables: this._extractVariables(nearbyContent),
            functions: this._extractFunctions(nearbyContent)
        };
    }

    _buildContextWindow(content, position) {
        const lines = content.split('\n');
        const contextSize = 50; // Lines of context
        
        const startLine = Math.max(0, position.lineNumber - contextSize - 1);
        const endLine = Math.min(lines.length, position.lineNumber + contextSize);
        
        const contextContent = lines.slice(startLine, endLine).join('\n');
        
        // Truncate if too large
        if (contextContent.length > this.maxContextSize) {
            return contextContent.substring(0, this.maxContextSize) + '...';
        }
        
        return contextContent;
    }

    async _analyzeModule(modulePath, currentFilePath) {
        try {
            // For now, return basic module info
            // This could be enhanced to actually analyze the module file
            return {
                path: modulePath,
                type: modulePath.startsWith('.') ? 'local' : 'external',
                exports: [],
                name: modulePath.split('/').pop()
            };
        } catch (error) {
            return null;
        }
    }

    _findScopeAtPosition(symbolTable, position) {
        // Find the most specific scope containing the position
        let currentScope = null;
        
        if (symbolTable.scopes) {
            for (const scope of symbolTable.scopes) {
                if (this._isPositionInRange(position, scope.range)) {
                    if (!currentScope || this._isMoreSpecific(scope, currentScope)) {
                        currentScope = scope;
                    }
                }
            }
        }
        
        return currentScope;
    }

    _findEnclosingFunction(symbolTable, position) {
        if (!symbolTable.functions) return null;
        
        for (const func of symbolTable.functions) {
            if (this._isPositionInRange(position, func.range)) {
                return func;
            }
        }
        return null;
    }

    _findEnclosingClass(symbolTable, position) {
        if (!symbolTable.classes) return null;
        
        for (const cls of symbolTable.classes) {
            if (this._isPositionInRange(position, cls.range)) {
                return cls;
            }
        }
        return null;
    }

    _isPositionInRange(position, range) {
        if (!range || !range.start || !range.end) return false;
        
        const pos = { line: position.lineNumber, column: position.column };
        const start = { line: range.start.line + 1, column: range.start.column + 1 };
        const end = { line: range.end.line + 1, column: range.end.column + 1 };
        
        if (pos.line < start.line || pos.line > end.line) return false;
        if (pos.line === start.line && pos.column < start.column) return false;
        if (pos.line === end.line && pos.column > end.column) return false;
        
        return true;
    }

    _isMoreSpecific(scope1, scope2) {
        if (!scope1.range || !scope2.range) return false;
        
        const size1 = (scope1.range.end.line - scope1.range.start.line) + 
                     (scope1.range.end.column - scope1.range.start.column);
        const size2 = (scope2.range.end.line - scope2.range.start.line) + 
                     (scope2.range.end.column - scope2.range.start.column);
        
        return size1 < size2;
    }

    _determineContext(beforeCursor, trigger) {
        if (beforeCursor.includes('function ')) return 'function-declaration';
        if (beforeCursor.includes('class ')) return 'class-declaration';
        if (beforeCursor.includes('const ') || beforeCursor.includes('let ') || beforeCursor.includes('var ')) return 'variable-declaration';
        if (beforeCursor.includes('import ')) return 'import-statement';
        if (trigger === '.') return 'member-access';
        return 'general';
    }

    _extractObjectName(beforeCursor) {
        const match = beforeCursor.match(/(\w+)\.$/);
        return match ? match[1] : null;
    }

    _extractFunctionName(beforeCursor) {
        const match = beforeCursor.match(/(\w+)\s*\($/);
        return match ? match[1] : null;
    }

    _isInComment(beforeCursor) {
        return beforeCursor.includes('//') || beforeCursor.includes('/*') || beforeCursor.includes('*');
    }

    _isInString(beforeCursor) {
        const singleQuotes = (beforeCursor.match(/'/g) || []).length;
        const doubleQuotes = (beforeCursor.match(/"/g) || []).length;
        const backticks = (beforeCursor.match(/`/g) || []).length;
        
        return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
    }

    _extractPatterns(content) {
        const patterns = [];
        
        // Extract common patterns like variable assignments, function calls, etc.
        const assignmentPattern = /(\w+)\s*=\s*([^;]+)/g;
        let match;
        while ((match = assignmentPattern.exec(content)) !== null) {
            patterns.push({ type: 'assignment', variable: match[1], value: match[2] });
        }
        
        return patterns;
    }

    _extractVariables(content) {
        const variables = [];
        const variablePattern = /(?:const|let|var)\s+(\w+)/g;
        let match;
        while ((match = variablePattern.exec(content)) !== null) {
            variables.push(match[1]);
        }
        return variables;
    }

    _extractFunctions(content) {
        const functions = [];
        const functionPattern = /function\s+(\w+)\s*\(/g;
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            functions.push(match[1]);
        }
        return functions;
    }

    _createEmptyContext() {
        return {
            filePath: null,
            language: 'plaintext',
            position: { lineNumber: 1, column: 1 },
            trigger: '',
            scope: { currentScope: 'global', availableSymbols: [] },
            imports: { imports: [], availableModules: [] },
            typing: { completionType: 'general' },
            nearby: { content: '', patterns: [], variables: [], functions: [] },
            contextWindow: '',
            timestamp: Date.now()
        };
    }

    _generateCacheKey(filePath, position, trigger, contentLength) {
        return `${filePath}_${position.lineNumber}_${position.column}_${trigger}_${contentLength}`;
    }

    _cacheContext(cacheKey, context) {
        // Simple LRU cache implementation
        if (this.contextCache.size > 100) {
            const firstKey = this.contextCache.keys().next().value;
            this.contextCache.delete(firstKey);
        }
        
        this.contextCache.set(cacheKey, {
            context,
            timestamp: Date.now()
        });
    }

    /**
     * Analyze code quality context for better completions
     */
    async _analyzeCodeQuality(content, filePath) {
        try {
            if (!codeQualityAnalyzer) {
                return { metrics: {}, suggestions: [], issues: [] };
            }

            const analysis = await codeQualityAnalyzer.analyzeCodeQuality(filePath, content);
            
            // Handle case where analysis returns null (e.g., non-JS files)
            if (!analysis) {
                return { metrics: {}, suggestions: [], issues: [] };
            }
            
            return {
                metrics: analysis.metrics || {},
                suggestions: analysis.suggestions || [],
                issues: analysis.issues || [],
                complexity: analysis.complexity || 'medium',
                maintainability: analysis.maintainability || 0.5
            };
        } catch (error) {
            console.warn('[Context Intelligence] Code quality analysis failed:', error);
            return { metrics: {}, suggestions: [], issues: [] };
        }
    }

    /**
     * Analyze data flow context for variable tracking
     */
    async _analyzeDataFlow(content, position) {
        try {
            if (!dataFlowAnalyzer) {
                return { variables: [], flows: [], dependencies: [] };
            }

            // For now, return basic analysis since traceVariableFlow needs specific variable name
            // TODO: Extract variable at position and call traceVariableFlow
            const analysis = { variables: [], flows: [], dependencies: [] };
            
            return {
                variables: analysis.variables || [],
                flows: analysis.flows || [],
                dependencies: analysis.dependencies || [],
                lifecycle: analysis.lifecycle || {}
            };
        } catch (error) {
            console.warn('[Context Intelligence] Data flow analysis failed:', error);
            return { variables: [], flows: [], dependencies: [] };
        }
    }

    /**
     * Analyze debugging context for error-aware completions
     */
    async _analyzeDebuggingContext(content, position) {
        try {
            if (!debuggingIntelligence) {
                return { errors: [], patterns: [], suggestions: [] };
            }

            // Get current file errors from Monaco
            const activeFile = Editor.getActiveFile();
            const errors = activeFile ? Editor.getFormattedErrors(Editor.getActiveFilePath()) : null;
            
            // For now, return basic debugging analysis
            // TODO: Implement proper error analysis with available methods
            const analysis = { errors: [], patterns: [], suggestions: [] };
            
            return {
                errors: analysis.errors || [],
                patterns: analysis.patterns || [],
                suggestions: analysis.suggestions || [],
                riskLevel: analysis.riskLevel || 'low'
            };
        } catch (error) {
            console.warn('[Context Intelligence] Debugging analysis failed:', error);
            return { errors: [], patterns: [], suggestions: [] };
        }
    }
}

// Export singleton instance
export const contextIntelligenceEngine = new ContextIntelligenceEngine();