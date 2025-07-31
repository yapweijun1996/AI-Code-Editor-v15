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
        this.aggressiveTriggering = false; // Default to non-aggressive
        this.debounceTimeout = null;
        this.debounceMs = 300;
        this.editor = null; // Will hold the editor instance
        
        // Trigger characters will be set dynamically based on settings
        this.triggerCharacters = ['.'];
        
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
     * Ensures that all necessary commands for the provider are registered with the editor.
     * This is done only once to prevent errors on re-registration.
     */
    _registerCommands() {
        if (!this.editor) {
            console.warn('[AI Completion Provider] Cannot register commands without an editor instance.');
            return;
        }

        // Re-register the command every time. Monaco's addCommand safely overwrites existing commands.
        // This is more robust than using a static flag and prevents race conditions on re-initialization.
        console.log('[AI Completion Provider] Registering "ai-completion.track-acceptance" command...');
        
        this.editor.addCommand(0, async (ed, ...args) => {
            console.log('[AI Completion Provider] "ai-completion.track-acceptance" command executed with args:', args);
            const [completion, context, action] = args;
            try {
                const { userAdaptationSystem } = await import('./user_adaptation_system.js');
                await userAdaptationSystem.recordCompletionInteraction({
                    completion,
                    context,
                    action,
                    timingMs: Date.now() - (completion.requestTime || Date.now()),
                    position: ed.getPosition()
                });
            } catch (error) {
                console.error('[AI Completion Provider] Failed to track interaction:', error);
            }
        }, 'ai-completion.track-acceptance');

        console.log('[AI Completion Provider] Command "ai-completion.track-acceptance" is registered.');
    }

    /**
     * Register the AI completion provider with Monaco Editor
     * @param {monaco.editor.IStandaloneCodeEditor} [editor] - The editor instance. Required on first call.
     */
    async register(editor) {
        try {
            // Store the editor instance if provided
            if (editor) {
                this.editor = editor;
            }

            // Ensure the editor instance exists before proceeding
            if (!this.editor) {
                console.error('[AI Completion Provider] Registration failed: Editor instance is not available.');
                return false;
            }

            // Check if Monaco is available
            if (typeof monaco === 'undefined') {
                console.warn('[AI Completion Provider] Monaco Editor not available yet');
                return false;
            }

            // Ensure commands are registered
            this._registerCommands();

            // Initialize Monaco-dependent properties
            this._initializeMonacoProperties();

            // Load settings and configure triggers
            await this._loadAndConfigure();

            // Listen for future settings changes (if not already listening)
            this._setupSettingsListener();

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

            console.log(`[AI Completion Provider] Registered successfully. Aggressive: ${this.aggressiveTriggering}`);
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
        // Temporarily disabled to simplify the user experience and stabilize the core features.
        // This can be re-enabled and improved in the future.
        return { items: [] };
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
        // Always trigger on explicit invocation (e.g., Ctrl+Space)
        if (context.triggerKind === monaco.languages.CompletionTriggerKind.Invoke) {
            console.log('[AI Completion] Triggered by explicit invocation.');
            return true;
        }

        // Trigger automatically only for specified characters
        if (context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter) {
            const line = model.getLineContent(position.lineNumber);
            const beforeCursor = line.substring(0, position.column - 1);

            // Don't trigger inside comments or strings
            if (this._isInCommentOrString(beforeCursor)) {
                return false;
            }
            
            console.log(`[AI Completion] Triggered by character: "${context.triggerCharacter}"`);
            return true; // Simplified: if it's a trigger character, and not in a comment/string, trigger.
        }

        return false;
    }

    _isInCommentOrString(beforeCursor) {
        // Basic check for comments
        if (beforeCursor.includes('//') || beforeCursor.includes('/*')) {
            return true;
        }
        // Basic check for strings
        const singleQuotes = (beforeCursor.match(/'/g) || []).length;
        const doubleQuotes = (beforeCursor.match(/"/g) || []).length;
        const backticks = (beforeCursor.match(/`/g) || []).length;
        
        return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
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
        const line = model.getLineContent(position.lineNumber);
        const beforeCursor = line.substring(0, position.column - 1);
        
        // New logic to prevent duplicate brackets
        const lastChar = beforeCursor.trim().slice(-1);
        const insertText = completion.insertText || completion.label;
        if (['{', '(', '['].includes(lastChar) && insertText.startsWith(lastChar)) {
             // The user typed an opening bracket and the AI is suggesting something that also starts with it.
             // Replace the user's bracket with the AI's suggestion.
            return new monaco.Range(
                position.lineNumber,
                position.column - 1,
                position.lineNumber,
                position.column
            );
        }

        const wordAtPosition = model.getWordAtPosition(position);
        
        // If the cursor is inside a word, replace the whole word.
        if (wordAtPosition && position.column > wordAtPosition.startColumn && position.column <= wordAtPosition.endColumn) {
            return new monaco.Range(
                position.lineNumber,
                wordAtPosition.startColumn,
                position.lineNumber,
                wordAtPosition.endColumn
            );
        }
        
        // If there's a partial word right before the cursor, replace it.
        const partialWordMatch = beforeCursor.match(/(\w+)$/);
        if (partialWordMatch) {
            const partialWord = partialWordMatch[1];
            // Ensure the completion starts with the partial word, otherwise, don't replace.
            if (insertText.toLowerCase().startsWith(partialWord.toLowerCase())) {
                const startColumn = position.column - partialWord.length;
                return new monaco.Range(
                    position.lineNumber,
                    startColumn,
                    position.lineNumber,
                    position.column
                );
            }
        }
        
        // Default: insert at the current cursor position.
        return new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
        );
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
     * Load settings and configure the provider accordingly.
     */
    async _loadAndConfigure() {
        try {
            const { Settings } = await import('./settings.js');
            const settings = Settings.getCompletionSettings();
            
            this.isEnabled = settings.enabled;
            this.aggressiveTriggering = settings.aggressiveTriggering;
            this.debounceMs = settings.debounceMs;

            if (this.aggressiveTriggering) {
                this.triggerCharacters = ['.', '(', '[', '{', ':', ' ', '<'];
            } else {
                this.triggerCharacters = ['.'];
            }

            console.log(`[AI Completion Provider] Configured with aggressive triggering: ${this.aggressiveTriggering}`);

        } catch (error) {
            console.warn('[AI Completion Provider] Failed to load settings, using defaults:', error);
            this.isEnabled = true;
            this.aggressiveTriggering = false;
        }
    }

    /**
     * Listen for settings changes and re-register the provider if necessary.
     */
    _setupSettingsListener() {
        // Ensure the listener is only added once
        if (this.settingsListenerAttached) {
            return;
        }

        document.addEventListener('ai-completion-settings-updated', async (event) => {
            console.log('[AI Completion Provider] Settings updated, re-configuring...');
            
            // Dispose existing providers before re-registering
            this.dispose();
            
            // Re-register with new settings. The editor instance is already stored.
            await this.register();
        });

        this.settingsListenerAttached = true;
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
    async register(editor) {
        return await this.instance.register(editor);
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