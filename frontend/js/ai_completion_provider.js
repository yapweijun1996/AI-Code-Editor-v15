/**
 * AI Completion Provider for Monaco Editor
 * Enhanced completion provider with smart triggering and rich UI integration
 */

import { aiCompletionOrchestrator } from './ai_completion_orchestrator.js';
import { contextIntelligenceEngine } from './context_intelligence_engine.js';
import { completionModelManager } from './completion_model_manager.js';
import { userAdaptationSystem } from './user_adaptation_system.js';
import * as Editor from './editor.js';

export class AiCompletionProvider {
    constructor() {
        this.disposables = [];
        this.activeRequests = new Map();
        this.isEnabled = true;
        this.debounceTimeout = null;
        this.debounceMs = 300;
        
        // Trigger configuration
        this.triggerCharacters = ['.', '(', '[', '{', ':', ' ', '<'];
        this.smartTriggers = {
            memberAccess: ['.', '->'],
            functionCall: ['('],
            importStatement: ['/', '"', "'"],
            templateLiteral: ['`', '${'],
            typeAnnotation: [':'],
            generics: ['<']
        };
        
        // UI configuration - will be initialized when Monaco is available
        this.completionKinds = null;
    }

    /**
     * Initialize Monaco-dependent properties
     */
    _initializeMonacoProperties() {
        if (!this.completionKinds && typeof monaco !== 'undefined') {
            this.completionKinds = {
                'Function': monaco.languages.CompletionItemKind.Function,
                'Method': monaco.languages.CompletionItemKind.Method,
                'Variable': monaco.languages.CompletionItemKind.Variable,
                'Property': monaco.languages.CompletionItemKind.Property,
                'Class': monaco.languages.CompletionItemKind.Class,
                'Interface': monaco.languages.CompletionItemKind.Interface,
                'Module': monaco.languages.CompletionItemKind.Module,
                'Keyword': monaco.languages.CompletionItemKind.Keyword,
                'Snippet': monaco.languages.CompletionItemKind.Snippet,
                'Text': monaco.languages.CompletionItemKind.Text
            };
        }
    }

    /**
     * Register the AI completion provider with Monaco Editor
     */
    async register() {
        try {
            // Check if Monaco is available
            if (typeof monaco === 'undefined') {
                console.warn('[AI Completion Provider] Monaco Editor not available yet');
                return false;
            }

            // Initialize Monaco-dependent properties
            this._initializeMonacoProperties();

            // Load enabled state from settings
            await this._loadEnabledState();

            // Register for multiple languages
            const languages = ['javascript', 'typescript', 'python', 'java', 'html', 'css', 'json', 'markdown'];
            
            languages.forEach(language => {
                const disposable = monaco.languages.registerCompletionItemProvider(language, {
                    triggerCharacters: this.triggerCharacters,
                    provideCompletionItems: (model, position, context, token) => 
                        this._provideCompletionItems(model, position, context, token),
                    resolveCompletionItem: (item, token) => 
                        this._resolveCompletionItem(item, token)
                });
                
                this.disposables.push(disposable);
            });

            // Register inline completion provider (for streaming completions)
            if (monaco.languages.registerInlineCompletionItemProvider) {
                const inlineDisposable = monaco.languages.registerInlineCompletionItemProvider(
                    { pattern: '**' },
                    {
                        provideInlineCompletionItems: (model, position, context, token) =>
                            this._provideInlineCompletionItems(model, position, context, token)
                    }
                );
                this.disposables.push(inlineDisposable);
            }

            console.log('[AI Completion Provider] Registered successfully');
            return true;
        } catch (error) {
            console.error('[AI Completion Provider] Registration failed:', error);
            return false;
        }
    }

    /**
     * Dispose of all registered providers
     */
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        
        // Cancel any active requests
        this.activeRequests.forEach(controller => controller.abort());
        this.activeRequests.clear();
        
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
    }

    /**
     * Enable or disable AI completions
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            // Cancel active requests
            this.activeRequests.forEach(controller => controller.abort());
            this.activeRequests.clear();
        }
    }

    /**
     * Update provider configuration
     */
    updateConfiguration(config) {
        if (config.debounceMs !== undefined) {
            this.debounceMs = config.debounceMs;
        }
        if (config.triggerCharacters) {
            this.triggerCharacters = config.triggerCharacters;
        }
    }

    // Private methods

    async _provideCompletionItems(model, position, context, token) {
        if (!this.isEnabled) {
            return { suggestions: [] };
        }

        try {
            // Check if we should trigger completion
            if (!this._shouldTriggerCompletion(model, position, context)) {
                return { suggestions: [] };
            }

            // Cancel conflicting requests
            this._cancelConflictingRequests(model.uri.toString(), position);

            // Create abort controller for this request
            const abortController = new AbortController();
            const requestKey = `${model.uri.toString()}_${position.lineNumber}_${position.column}`;
            this.activeRequests.set(requestKey, abortController);

            // Combine token cancellation with our abort controller
            const combinedToken = this._combineTokens(token, abortController.signal);

            // Analyze context - handle syntax errors gracefully
            let context_analysis;
            try {
                context_analysis = await contextIntelligenceEngine.analyzeCompletionContext(
                    position,
                    context.triggerCharacter || ''
                );
            } catch (error) {
                console.warn('[AI Completion Provider] Context analysis failed, using fallback:', error.message);
                // Create fallback context for files with syntax errors
                context_analysis = {
                    contextWindow: model.getValueInRange({
                        startLineNumber: Math.max(1, position.lineNumber - 10),
                        startColumn: 1,
                        endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 10),
                        endColumn: 1
                    }),
                    currentLine: model.getLineContent(position.lineNumber),
                    beforeCursor: model.getLineContent(position.lineNumber).substring(0, position.column - 1),
                    afterCursor: model.getLineContent(position.lineNumber).substring(position.column - 1),
                    language: model.getLanguageId(),
                    filePath: model.uri.path,
                    position,
                    parseError: true
                };
            }

            if (combinedToken.isCancellationRequested) {
                return { suggestions: [] };
            }

            // Get completions from orchestrator
            const completions = await aiCompletionOrchestrator.requestCompletions({
                context: context_analysis.contextWindow,
                position,
                trigger: context.triggerCharacter || '',
                language: model.getLanguageId(),
                fullContext: context_analysis
            });

            // Clean up request
            this.activeRequests.delete(requestKey);

            if (combinedToken.isCancellationRequested) {
                return { suggestions: [] };
            }

            // Apply personalized rankings
            const personalizedCompletions = userAdaptationSystem.getPersonalizedRankings(completions, context_analysis);

            // Convert to Monaco format
            const suggestions = this._convertToMonacoSuggestions(personalizedCompletions, model, position, context_analysis);

            return {
                suggestions,
                incomplete: false
            };

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('[AI Completion Provider] Completion failed:', error);
            }
            return { suggestions: [] };
        }
    }

    async _provideInlineCompletionItems(model, position, context, token) {
        if (!this.isEnabled || !context.triggerKind) {
            return { items: [] };
        }

        try {
            // Only provide inline completions for automatic triggers
            if (context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Automatic) {
                return { items: [] };
            }

            // Get streaming completions
            const items = [];
            const requestKey = `inline_${model.uri.toString()}_${position.lineNumber}_${position.column}`;
            
            await aiCompletionOrchestrator.requestStreamingCompletions({
                context: model.getValueInRange({
                    startLineNumber: Math.max(1, position.lineNumber - 20),
                    startColumn: 1,
                    endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 20),
                    endColumn: 1
                }),
                position,
                trigger: '',
                language: model.getLanguageId()
            }, (completions) => {
                if (completions.length > 0 && !token.isCancellationRequested) {
                    const bestCompletion = completions[0];
                    items.push({
                        insertText: bestCompletion.insertText || bestCompletion.label,
                        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                        command: {
                            id: 'ai-completion.accept',
                            title: 'AI Completion Accepted'
                        }
                    });
                }
            });

            return { items };

        } catch (error) {
            console.error('[AI Completion Provider] Inline completion failed:', error);
            return { items: [] };
        }
    }

    async _resolveCompletionItem(item, token) {
        try {
            // Add detailed information for AI-generated completions
            if (item.aiGenerated) {
                item.documentation = {
                    value: `**AI Generated Completion**\n\nConfidence: ${item.confidence || 'Medium'}\n\n${item.detail || ''}`,
                    isTrusted: true
                };

                // Add additional details based on completion type
                if (item.completionType) {
                    item.documentation.value += `\n\nType: ${item.completionType}`;
                }
            }

            return item;
        } catch (error) {
            console.error('[AI Completion Provider] Resolution failed:', error);
            return item;
        }
    }

    _shouldTriggerCompletion(model, position, context) {
        const line = model.getLineContent(position.lineNumber);
        const beforeCursor = line.substring(0, position.column - 1);
        
        // Don't trigger in comments (basic check)
        if (beforeCursor.includes('//') || beforeCursor.includes('/*')) {
            return false;
        }

        // Don't trigger in strings (basic check)
        const inString = this._isInString(beforeCursor);
        if (inString && context.triggerCharacter !== '"' && context.triggerCharacter !== "'") {
            return false;
        }

        // Always trigger on explicit invocation
        if (context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke) {
            return true;
        }

        // Check smart triggers
        if (context.triggerCharacter) {
            return this._isSmartTrigger(beforeCursor, context.triggerCharacter);
        }

        // Check if enough characters typed
        const wordAtPosition = model.getWordAtPosition(position);
        if (wordAtPosition && wordAtPosition.word.length >= 2) {
            return true;
        }

        return false;
    }

    _isSmartTrigger(beforeCursor, triggerChar) {
        switch (triggerChar) {
            case '.':
                // Trigger for member access
                return /\w+\.$/.test(beforeCursor);
            
            case '(':
                // Trigger for function calls
                return /\w+\($/.test(beforeCursor);
            
            case '[':
                // Trigger for array access
                return /\w+\[$/.test(beforeCursor);
            
            case '{':
                // Trigger for object literals
                return true;
            
            case ':':
                // Trigger for object properties or type annotations
                return /\w+\s*:$/.test(beforeCursor) || /:\s*$/.test(beforeCursor);
            
            case '<':
                // Trigger for generics or JSX
                return /\w+<$/.test(beforeCursor);
            
            case ' ':
                // Trigger after keywords
                return /(import|from|extends|implements|new|return|const|let|var)\s+$/.test(beforeCursor);
            
            default:
                return false;
        }
    }

    _isInString(beforeCursor) {
        const singleQuotes = (beforeCursor.match(/'/g) || []).length;
        const doubleQuotes = (beforeCursor.match(/"/g) || []).length;
        const backticks = (beforeCursor.match(/`/g) || []).length;
        
        return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
    }

    _convertToMonacoSuggestions(completions, model, position, context) {
        // Ensure Monaco properties are initialized
        this._initializeMonacoProperties();
        
        return completions.map((completion, index) => {
            const suggestion = {
                label: completion.label,
                kind: (this.completionKinds && this.completionKinds[completion.kind]) || 
                      (typeof monaco !== 'undefined' ? monaco.languages.CompletionItemKind.Text : 0),
                insertText: completion.insertText || completion.label,
                detail: completion.detail || 'AI Completion',
                sortText: completion.sortText || `ai_${index.toString().padStart(3, '0')}`,
                range: this._getInsertionRange(model, position, completion),
                
                // Custom properties
                aiGenerated: completion.aiGenerated || false,
                confidence: completion.confidence,
                completionType: context.typing?.completionType
            };

            // Add snippet support if needed
            if (completion.insertText && completion.insertText.includes('$')) {
                suggestion.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
            }

            // Add command for tracking acceptance
            suggestion.command = {
                id: 'ai-completion.track-acceptance',
                title: 'Track AI Completion Acceptance',
                arguments: [completion, context, 'accepted', model.uri.toString(), position]
            };

            return suggestion;
        });
    }

    _getInsertionRange(model, position, completion) {
        const wordAtPosition = model.getWordAtPosition(position);
        
        if (wordAtPosition) {
            // Replace the current word
            return new monaco.Range(
                position.lineNumber,
                wordAtPosition.startColumn,
                position.lineNumber,
                wordAtPosition.endColumn
            );
        } else {
            // Insert at current position
            return new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
            );
        }
    }

    _cancelConflictingRequests(modelUri, position) {
        const keysToCancel = [];
        
        for (const [key, controller] of this.activeRequests) {
            if (key.startsWith(modelUri)) {
                // Cancel requests for the same model
                controller.abort();
                keysToCancel.push(key);
            }
        }
        
        keysToCancel.forEach(key => this.activeRequests.delete(key));
    }

    _combineTokens(monacoToken, abortSignal) {
        const combined = {
            isCancellationRequested: false,
            onCancellationRequested: () => {}
        };

        const updateCancellation = () => {
            combined.isCancellationRequested = 
                (monacoToken && monacoToken.isCancellationRequested) || 
                (abortSignal && abortSignal.aborted);
        };

        if (monacoToken && monacoToken.onCancellationRequested) {
            monacoToken.onCancellationRequested(updateCancellation);
        }

        if (abortSignal) {
            abortSignal.addEventListener('abort', updateCancellation);
        }

        updateCancellation();
        return combined;
    }

    /**
     * Load enabled state from settings
     */
    async _loadEnabledState() {
        try {
            const { Settings } = await import('./settings.js');
            const completionSettings = Settings.getCompletionSettings();
            this.isEnabled = completionSettings.enabled;
            console.log(`[AI Completion Provider] Loaded enabled state: ${this.isEnabled}`);
        } catch (error) {
            console.warn('[AI Completion Provider] Failed to load enabled state, using default:', error);
            this.isEnabled = true; // Default to enabled
        }
    }
}

// Create and export singleton instance
let _aiCompletionProvider = null;

export const aiCompletionProvider = {
    get instance() {
        if (!_aiCompletionProvider) {
            _aiCompletionProvider = new AiCompletionProvider();
        }
        return _aiCompletionProvider;
    },
    
    // Delegate methods to the instance
    async register() {
        return await this.instance.register();
    },
    
    dispose() {
        return this.instance.dispose();
    },
    
    setEnabled(enabled) {
        return this.instance.setEnabled(enabled);
    },
    
    updateConfiguration(config) {
        return this.instance.updateConfiguration(config);
    },
    
    get isEnabled() {
        return this.instance.isEnabled;
    }
};