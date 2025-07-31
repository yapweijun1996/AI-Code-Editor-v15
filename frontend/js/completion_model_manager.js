/**
 * Completion Model Manager
 * AI model optimization, provider selection, and specialized prompting for code completion
 */

import { LLMServiceFactory } from './llm/service_factory.js';
import { Settings } from './settings.js';
import { DbManager } from './db.js';
import { performanceOptimizer } from './performance_optimizer.js';

export class CompletionModelManager {
    constructor() {
        this.primaryService = null;
        this.fallbackService = null;
        this.modelCapabilities = new Map();
        this.promptTemplates = new Map();
        this.performanceMetrics = new Map();
        
        // Model selection strategy
        this.selectionStrategy = {
            fast: ['gemini-2.5-flash', 'gpt-4o-mini'],
            balanced: ['gemini-2.5-flash', 'gpt-4o'],
            quality: ['gemini-2.5-pro', 'gpt-4o', 'gpt-4-turbo']
        };

        this.initialized = false;
        this._initializePromptTemplates();
        this._initializeModelCapabilities();
    }

    /**
     * Initialize the model manager
     */
    async initialize() {
        if (this.initialized) return;

        try {
            await this._setupPrimaryService();
            await this._setupFallbackService();
            await this._loadPerformanceMetrics();
            
            this.initialized = true;
            console.log('[Completion Model Manager] Initialized successfully');
        } catch (error) {
            console.error('[Completion Model Manager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Generate completions using optimized model selection
     * @param {Object} context - Completion context from ContextIntelligenceEngine
     * @param {AbortSignal} abortSignal - Abort signal for cancellation
     * @returns {AsyncGenerator} Stream of completion chunks
     */
    async* generateCompletions(context, abortSignal) {
        if (!this.initialized) {
            await this.initialize();
        }

        const startTime = performance.now();
        let selectedService = this._selectOptimalService(context);
        let prompt = this._buildEnhancedPrompt(context);

        try {
            // Track model performance
            const modelKey = this._getModelKey(selectedService);
            performanceOptimizer.startTimer(`completion_${modelKey}`);

            // Prepare messages for the selected service
            const messages = this._prepareMessages(prompt, context);
            
            // Generate completions
            let hasResults = false;
            for await (const chunk of selectedService.sendMessageStream(messages, [], abortSignal)) {
                hasResults = true;
                yield this._processChunk(chunk, context);
            }

            // Track success
            this._updatePerformanceMetrics(modelKey, startTime, true, hasResults);
            performanceOptimizer.endTimer(`completion_${modelKey}`);

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn(`[Completion Model Manager] Primary service failed:`, error);
                
                // Try fallback service if available
                if (this.fallbackService && selectedService !== this.fallbackService) {
                    try {
                        selectedService = this.fallbackService;
                        prompt = this._buildFallbackPrompt(context);
                        const messages = this._prepareMessages(prompt, context);
                        
                        for await (const chunk of selectedService.sendMessageStream(messages, [], abortSignal)) {
                            yield this._processChunk(chunk, context);
                        }
                        
                        this._updatePerformanceMetrics(this._getModelKey(selectedService), startTime, true, true);
                    } catch (fallbackError) {
                        console.error('[Completion Model Manager] Fallback also failed:', fallbackError);
                        this._updatePerformanceMetrics(this._getModelKey(selectedService), startTime, false, false);
                        throw fallbackError;
                    }
                } else {
                    this._updatePerformanceMetrics(this._getModelKey(selectedService), startTime, false, false);
                    throw error;
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * Get model recommendations based on context
     * @param {Object} context - Completion context
     * @returns {Object} Model recommendations
     */
    getModelRecommendations(context) {
        const complexity = this._assessComplexity(context);
        const urgency = this._assessUrgency(context);
        
        let recommendedStrategy = 'balanced';
        
        if (urgency === 'high' && complexity === 'low') {
            recommendedStrategy = 'fast';
        } else if (complexity === 'high') {
            recommendedStrategy = 'quality';
        }
        
        return {
            strategy: recommendedStrategy,
            models: this.selectionStrategy[recommendedStrategy],
            reasoning: this._getRecommendationReasoning(complexity, urgency)
        };
    }

    /**
     * Update model performance feedback
     * @param {string} modelKey - Model identifier
     * @param {Object} feedback - Performance feedback
     */
    updateModelFeedback(modelKey, feedback) {
        if (!this.performanceMetrics.has(modelKey)) {
            this.performanceMetrics.set(modelKey, {
                totalRequests: 0,
                successfulRequests: 0,
                averageLatency: 0,
                qualityScore: 0,
                userAcceptanceRate: 0
            });
        }

        const metrics = this.performanceMetrics.get(modelKey);
        metrics.totalRequests++;
        
        if (feedback.success) {
            metrics.successfulRequests++;
        }
        
        if (feedback.latency) {
            metrics.averageLatency = (metrics.averageLatency * (metrics.totalRequests - 1) + feedback.latency) / metrics.totalRequests;
        }
        
        if (feedback.qualityScore) {
            metrics.qualityScore = (metrics.qualityScore * (metrics.totalRequests - 1) + feedback.qualityScore) / metrics.totalRequests;
        }
        
        if (feedback.userAccepted !== undefined) {
            const acceptanceCount = metrics.userAcceptanceRate * (metrics.totalRequests - 1) + (feedback.userAccepted ? 1 : 0);
            metrics.userAcceptanceRate = acceptanceCount / metrics.totalRequests;
        }

        // Save metrics periodically
        this._savePerformanceMetrics();
    }

    /**
     * Get current performance metrics
     * @returns {Object} Performance metrics by model
     */
    getPerformanceMetrics() {
        const metrics = {};
        for (const [modelKey, data] of this.performanceMetrics) {
            metrics[modelKey] = { ...data };
        }
        return metrics;
    }

    // Private methods

    async _setupPrimaryService() {
        const llmSettings = Settings.getLLMSettings();
        this.primaryService = LLMServiceFactory.create(llmSettings.provider, llmSettings);
        
        if (!await this.primaryService.isConfigured()) {
            throw new Error('Primary LLM service is not configured');
        }
    }

    async _setupFallbackService() {
        try {
            const llmSettings = Settings.getLLMSettings();
            
            // Setup fallback with different provider if possible
            if (llmSettings.provider !== 'gemini') {
                const fallbackSettings = { ...llmSettings, provider: 'gemini' };
                this.fallbackService = LLMServiceFactory.create('gemini', fallbackSettings);
            } else if (llmSettings.provider !== 'openai') {
                const fallbackSettings = { ...llmSettings, provider: 'openai' };
                this.fallbackService = LLMServiceFactory.create('openai', fallbackSettings);
            }
        } catch (error) {
            console.warn('[Completion Model Manager] Fallback service setup failed:', error);
        }
    }

    _selectOptimalService(context) {
        const recommendations = this.getModelRecommendations(context);
        
        // For now, use primary service (could be enhanced to select different services based on recommendations)
        return this.primaryService;
    }

    _buildOptimizedPrompt(context) {
        const template = this._getPromptTemplate(context);
        return this._populateTemplate(template, context);
    }

    _buildEnhancedPrompt(context) {
        let prompt = this._buildOptimizedPrompt(context);
        
        // Add Senior Engineer AI context enhancements
        if (context.quality && context.quality.suggestions.length > 0) {
            prompt += `\n\nCode Quality Context:\n`;
            prompt += context.quality.suggestions.slice(0, 3).map(s => `- ${s}`).join('\n');
        }

        if (context.debugging && context.debugging.errors.length > 0) {
            prompt += `\n\nError Context:\n`;
            prompt += context.debugging.errors.slice(0, 2).map(e => `- ${e}`).join('\n');
            prompt += `\nSuggest completions that help resolve these issues.`;
        }

        if (context.dataFlow && context.dataFlow.variables.length > 0) {
            prompt += `\n\nVariable Flow Context:\n`;
            const recentVars = context.dataFlow.variables.slice(0, 5).map(v => v.name || v).join(', ');
            prompt += `Recent variables: ${recentVars}`;
        }

        return prompt;
    }

    _buildFallbackPrompt(context) {
        // Simplified prompt for fallback scenarios
        return this._populateTemplate(this.promptTemplates.get('simple'), context);
    }

    _getPromptTemplate(context) {
        const { language, typing, scope } = context;
        
        // Select appropriate template based on context
        if (typing.completionType === 'member') {
            return this.promptTemplates.get('member_access');
        } else if (typing.completionType === 'import') {
            return this.promptTemplates.get('import_completion');
        } else if (typing.completionType === 'parameter') {
            return this.promptTemplates.get('parameter_completion');
        } else if (scope.currentScope === 'function' || scope.enclosingFunction) {
            return this.promptTemplates.get('function_scope');
        } else {
            return this.promptTemplates.get('general');
        }
    }

    _populateTemplate(template, context) {
        let prompt = template;
        
        // Replace template variables
        prompt = prompt.replace('{language}', context.language || 'javascript');
        prompt = prompt.replace('{contextWindow}', context.contextWindow || '');
        prompt = prompt.replace('{currentLine}', context.typing.currentLine || '');
        prompt = prompt.replace('{beforeCursor}', context.typing.beforeCursor || '');
        prompt = prompt.replace('{trigger}', context.trigger || '');
        
        // Add scope-specific information
        if (context.scope.availableSymbols.length > 0) {
            const symbols = context.scope.availableSymbols.slice(0, 20).join(', ');
            prompt = prompt.replace('{availableSymbols}', `Available symbols: ${symbols}\n`);
        } else {
            prompt = prompt.replace('{availableSymbols}', '');
        }
        
        // Add import information
        if (context.imports.imports.length > 0) {
            const imports = context.imports.imports.map(imp => imp.source).slice(0, 10).join(', ');
            prompt = prompt.replace('{imports}', `Current imports: ${imports}\n`);
        } else {
            prompt = prompt.replace('{imports}', '');
        }
        
        return prompt;
    }

    _prepareMessages(prompt, context) {
        return [
            {
                role: 'system',
                content: 'You are a code completion AI. Provide only relevant code completions without explanations. Return completions one per line.'
            },
            {
                role: 'user',
                content: prompt
            }
        ];
    }

    _processChunk(chunk, context) {
        // Process and validate completion chunk
        if (chunk.type === 'text' && chunk.text) {
            return {
                type: 'completion',
                text: chunk.text,
                context: context.typing.completionType,
                confidence: this._calculateConfidence(chunk.text, context)
            };
        }
        return chunk;
    }

    _calculateConfidence(completion, context) {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence based on context matching
        if (context.typing.completionType === 'member' && completion.includes('.')) {
            confidence += 0.2;
        }
        
        if (context.scope.availableSymbols.some(symbol => completion.includes(symbol))) {
            confidence += 0.3;
        }
        
        return Math.min(confidence, 1.0);
    }

    _assessComplexity(context) {
        let complexityScore = 0;
        
        // Factor in context size
        if (context.contextWindow.length > 5000) complexityScore += 2;
        else if (context.contextWindow.length > 2000) complexityScore += 1;
        
        // Factor in scope depth
        if (context.scope.enclosingClass && context.scope.enclosingFunction) complexityScore += 2;
        else if (context.scope.enclosingFunction) complexityScore += 1;
        
        // Factor in imports
        if (context.imports.imports.length > 10) complexityScore += 1;
        
        return complexityScore >= 3 ? 'high' : complexityScore >= 1 ? 'medium' : 'low';
    }

    _assessUrgency(context) {
        // Assess based on typing patterns and context
        // For now, default to medium urgency
        return 'medium';
    }

    _getRecommendationReasoning(complexity, urgency) {
        if (urgency === 'high' && complexity === 'low') {
            return 'Fast models recommended for quick, simple completions';
        } else if (complexity === 'high') {
            return 'Quality models recommended for complex context analysis';
        } else {
            return 'Balanced approach for general completions';
        }
    }

    _getModelKey(service) {
        return `${service.constructor.name}_${service.model || 'default'}`;
    }

    _updatePerformanceMetrics(modelKey, startTime, success, hasResults) {
        const latency = performance.now() - startTime;
        
        this.updateModelFeedback(modelKey, {
            success,
            latency,
            hasResults,
            qualityScore: hasResults ? 0.8 : 0.2 // Basic quality scoring
        });
    }

    async _loadPerformanceMetrics() {
        try {
            const saved = await DbManager.getSetting('completionModelMetrics');
            if (saved) {
                this.performanceMetrics = new Map(Object.entries(saved));
            }
        } catch (error) {
            console.warn('[Completion Model Manager] Failed to load metrics:', error);
        }
    }

    async _savePerformanceMetrics() {
        try {
            const metricsObj = Object.fromEntries(this.performanceMetrics);
            await DbManager.saveSetting('completionModelMetrics', metricsObj);
        } catch (error) {
            console.warn('[Completion Model Manager] Failed to save metrics:', error);
        }
    }

    _initializePromptTemplates() {
        this.promptTemplates.set('general', `Complete the following {language} code:

{availableSymbols}{imports}Context:
\`\`\`{language}
{contextWindow}
\`\`\`

Current line: {currentLine}
Before cursor: {beforeCursor}
Trigger: "{trigger}"

Provide up to 10 relevant completions. Return only the completion text, one per line:`);

        this.promptTemplates.set('member_access', `Provide member completions for {language} code:

{availableSymbols}{imports}Context:
\`\`\`{language}
{contextWindow}
\`\`\`

Object access: {beforeCursor}
Complete the member access after the dot. Return only property/method names, one per line:`);

        this.promptTemplates.set('import_completion', `Suggest import completions for {language}:

Current imports:
{imports}

Context:
\`\`\`{language}
{contextWindow}
\`\`\`

Import statement: {beforeCursor}
Suggest relevant modules or specific imports. Return one per line:`);

        this.promptTemplates.set('parameter_completion', `Suggest parameter completions for {language} function call:

{availableSymbols}Context:
\`\`\`{language}
{contextWindow}
\`\`\`

Function call: {beforeCursor}
Suggest appropriate parameters or values. Return one per line:`);

        this.promptTemplates.set('function_scope', `Complete code within function scope in {language}:

{availableSymbols}Context:
\`\`\`{language}
{contextWindow}
\`\`\`

Current line: {currentLine}
Within function scope. Suggest relevant completions one per line:`);

        this.promptTemplates.set('simple', `Complete this {language} code:
{contextWindow}

Current: {beforeCursor}
Completions:`);
    }

    _initializeModelCapabilities() {
        // Define capabilities for different models
        this.modelCapabilities.set('gemini-2.5-flash', {
            speed: 'fast',
            quality: 'good',
            contextWindow: 32000,
            codingStrength: 'high'
        });

        this.modelCapabilities.set('gemini-2.5-pro', {
            speed: 'medium',
            quality: 'excellent',
            contextWindow: 128000,
            codingStrength: 'excellent'
        });

        this.modelCapabilities.set('gpt-4o', {
            speed: 'medium',
            quality: 'excellent',
            contextWindow: 128000,
            codingStrength: 'excellent'
        });

        this.modelCapabilities.set('gpt-4o-mini', {
            speed: 'fast',
            quality: 'good',
            contextWindow: 128000,
            codingStrength: 'good'
        });
    }
}

// Export singleton instance
export const completionModelManager = new CompletionModelManager();