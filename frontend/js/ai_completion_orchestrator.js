/**
 * AI Completion Orchestrator
 * Master coordinator for intelligent auto-completion with caching, streaming, and performance optimization
 */

import { LLMServiceFactory } from './llm/service_factory.js';
import { Settings } from './settings.js';
import { DbManager } from './db.js';
import { performanceOptimizer } from './performance_optimizer.js';

export class AiCompletionOrchestrator {
    constructor() {
        this.llmService = null;
        this.isInitialized = false;
        this.completionCache = new Map(); // LRU cache for completions
        this.contextCache = new Map(); // Cache for context analysis
        this.maxCacheSize = 500;
        this.cacheTTL = 3600000; // 1 hour in milliseconds
        
        // Performance tracking
        this.performanceMetrics = {
            totalCompletions: 0,
            cacheHits: 0,
            averageLatency: 0,
            successRate: 0
        };
        
        // Request management
        this.activeRequests = new Map();
        this.requestIdCounter = 0;
        
        // Configuration
        this.config = {
            debounceMs: 300,
            maxContextLength: 10000, // 10KB context window
            minTriggerLength: 1,
            maxCompletions: 10,
            enableStreaming: false, // Disabled for now to focus on core reliability
            enableCaching: false // Disabled for now to simplify logic
        };
    }

    /**
     * Initialize the completion orchestrator
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Initialize LLM service
            await this._initializeLLMService();
            
            // Load user preferences
            await this._loadConfiguration();
            
            // Setup performance monitoring
            this._setupPerformanceMonitoring();
            
            // Setup settings event listeners
            this._setupSettingsListeners();
            
            this.isInitialized = true;
            console.log('[AI Completion] Orchestrator initialized successfully');
        } catch (error) {
            console.error('[AI Completion] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Request completions for a given context
     * @param {Object} request - Completion request object
     * @returns {Promise<Array>} Array of completion items
     */
    async requestCompletions(request) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const requestId = this._generateRequestId();
        const startTime = performance.now();

        try {
            // Check cache first
            const cacheKey = this._generateCacheKey(request);
            if (this.config.enableCaching && this.completionCache.has(cacheKey)) {
                const cached = this.completionCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTTL) {
                    this.performanceMetrics.cacheHits++;
                    return cached.completions;
                }
            }

            // Cancel any conflicting requests
            this._cancelConflictingRequests(request);

            // Create abort controller for this request
            const abortController = new AbortController();
            this.activeRequests.set(requestId, {
                request,
                abortController,
                startTime
            });

            // Generate completions
            const completions = await this._generateCompletions(request, abortController.signal);

            // Cache the results
            if (this.config.enableCaching && completions.length > 0) {
                this._cacheCompletions(cacheKey, completions);
            }

            // Update performance metrics
            this._updatePerformanceMetrics(startTime, true);

            return completions;

        } catch (error) {
            if (error.name !== 'AbortError' && error.message !== 'Request was aborted') {
                console.error('[AI Completion] Request failed:', error);
                this._updatePerformanceMetrics(startTime, false);
            } else {
                console.debug('[AI Completion] Request was cancelled gracefully');
            }
            return [];
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    /**
     * Request streaming completions
     * @param {Object} request - Completion request object
     * @param {Function} onCompletions - Callback for completion updates
     * @returns {Promise<void>}
     */
    async requestStreamingCompletions(request, onCompletions) {
        if (!this.config.enableStreaming) {
            const completions = await this.requestCompletions(request);
            onCompletions(completions);
            return;
        }

        const requestId = this._generateRequestId();
        const startTime = performance.now();

        try {
            // Provide immediate basic completions
            const basicCompletions = await this._generateBasicCompletions(request);
            if (basicCompletions.length > 0) {
                onCompletions(basicCompletions);
            }

            // Then enhance with AI completions
            const aiCompletions = await this.requestCompletions(request);
            const mergedCompletions = this._mergeCompletions(basicCompletions, aiCompletions);
            onCompletions(mergedCompletions);

        } catch (error) {
            console.error('[AI Completion] Streaming request failed:', error);
            onCompletions([]);
        }
    }

    /**
     * Cancel all active completion requests
     */
    cancelAllRequests() {
        for (const [requestId, requestData] of this.activeRequests) {
            requestData.abortController.abort();
        }
        this.activeRequests.clear();
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Update configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this._saveConfiguration();
    }

    // Private methods

    async _initializeLLMService() {
        const llmSettings = Settings.getLLMSettings();
        this.llmService = LLMServiceFactory.create(llmSettings.provider, llmSettings);
        
        if (!await this.llmService.isConfigured()) {
            throw new Error('LLM service is not properly configured');
        }
    }

    async _loadConfiguration() {
        try {
            // Load saved configuration first
            const savedConfig = await DbManager.getSetting('aiCompletionConfig');
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
            }

            // Load settings from Settings module and merge
            const { Settings } = await import('./settings.js');
            const settingsConfig = Settings.getCompletionSettings();
            this.config = { ...this.config, ...settingsConfig };

        } catch (error) {
            console.warn('[AI Completion] Failed to load configuration:', error);
        }
    }

    async _saveConfiguration() {
        try {
            await DbManager.saveSetting('aiCompletionConfig', this.config);
        } catch (error) {
            console.warn('[AI Completion] Failed to save configuration:', error);
        }
    }

    _setupPerformanceMonitoring() {
        // Monitor and log performance every 5 minutes
        setInterval(() => {
            if (this.performanceMetrics.totalCompletions > 0) {
                console.log('[AI Completion] Performance:', this.performanceMetrics);
            }
        }, 300000);
    }

    _setupSettingsListeners() {
        // Listen for AI completion settings changes
        document.addEventListener('ai-completion-settings-updated', (event) => {
            const { settings } = event.detail;
            this.updateConfiguration(settings);
            console.log('[AI Completion] Settings updated:', settings);
        });

        // Listen for LLM settings changes (might affect completions)
        document.addEventListener('llm-settings-updated', async () => {
            try {
                await this._initializeLLMService();
                console.log('[AI Completion] LLM service reinitialized due to settings change');
            } catch (error) {
                console.error('[AI Completion] Failed to reinitialize LLM service:', error);
            }
        });
    }

    async _generateCompletions(request, abortSignal) {
        const { context, position, trigger, language, fullContext } = request;

        // Prepare completion prompt
        const prompt = this._buildCompletionPrompt(context, position, trigger, language, fullContext);
        
        // Call LLM service with correct message format
        const history = [{ role: 'user', parts: [{ text: prompt }] }];
        let fullResponse = '';
        try {
            for await (const chunk of this.llmService.sendMessageStream(history, [], abortSignal)) {
                if (chunk.text) {
                    fullResponse += chunk.text;
                }
            }
        } catch (error) {
            if (error.name === 'AbortError' || error.message === 'Request was aborted') {
                console.debug('[AI Completion] Request was cancelled');
                throw error;
            }
            console.error('[AI Completion] LLM request failed:', error);
        }

        const completions = this._parseCompletions(fullResponse, request);
        return this._rankAndFilterCompletions(completions, request);
    }

    async _generateBasicCompletions(request) {
        // Generate basic completions without AI (built-in Monaco completions)
        // This provides immediate feedback while AI processes
        return [];
    }

    _buildCompletionPrompt(context, position, trigger, language, fullContext) {
        // A simpler, more direct prompt to improve predictability and reduce complexity.
        return `You are a code completion assistant.
Provide a single, relevant code completion for the following context.
Return ONLY the raw code. Do not include explanations or formatting.

Language: ${language}
File Context:
---
${context}
---
The user's cursor is at line ${position.lineNumber}, column ${position.column}.
Complete the code.`;
    }

    _parseCompletions(text, request) {
        // Handle the entire block as a single completion
        const fullCompletion = text.trim();
        if (fullCompletion.length === 0) {
            return [];
        }

        // Create a single suggestion for the whole block
        return [{
            label: fullCompletion.split('\n')[0].trim() + '...', // Show first line as label
            kind: this._inferCompletionKind(fullCompletion, request),
            insertText: fullCompletion,
            detail: 'AI Multi-line Completion',
            sortText: 'ai_000', // Highest priority
            aiGenerated: true
        }];
    }

    _inferCompletionKind(completion, request) {
        // Simple heuristics to determine completion kind
        if (completion.includes('(')) return 'Function';
        if (completion.startsWith('import ')) return 'Module';
        if (completion.includes('class ')) return 'Class';
        if (completion.includes('const ') || completion.includes('let ') || completion.includes('var ')) return 'Variable';
        return 'Property';
    }

    _rankAndFilterCompletions(completions, request) {
        // Filter duplicates and invalid completions
        const seen = new Set();
        const filtered = completions.filter(completion => {
            if (seen.has(completion.label) || completion.label.length === 0) {
                return false;
            }
            seen.add(completion.label);
            return true;
        });

        // Sort by relevance (AI completions first, then alphabetically)
        return filtered.sort((a, b) => {
            if (a.aiGenerated && !b.aiGenerated) return -1;
            if (!a.aiGenerated && b.aiGenerated) return 1;
            return a.label.localeCompare(b.label);
        });
    }

    _mergeCompletions(basicCompletions, aiCompletions) {
        const merged = [...aiCompletions];
        
        // Add basic completions that don't conflict with AI completions
        const aiLabels = new Set(aiCompletions.map(c => c.label));
        basicCompletions.forEach(completion => {
            if (!aiLabels.has(completion.label)) {
                merged.push(completion);
            }
        });

        return merged;
    }

    _generateRequestId() {
        return ++this.requestIdCounter;
    }

    _generateCacheKey(request) {
        const { context, position, trigger, language } = request;
        const contextHash = this._simpleHash(context.substring(0, 1000)); // Use first 1KB for cache key
        return `${language}_${position.lineNumber}_${position.column}_${trigger}_${contextHash}`;
    }

    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    _cacheCompletions(cacheKey, completions) {
        // Implement LRU cache eviction
        if (this.completionCache.size >= this.maxCacheSize) {
            const oldestKey = this.completionCache.keys().next().value;
            this.completionCache.delete(oldestKey);
        }

        this.completionCache.set(cacheKey, {
            completions,
            timestamp: Date.now()
        });
    }

    _cancelConflictingRequests(newRequest) {
        // Cancel requests that are for the same position but older
        for (const [requestId, requestData] of this.activeRequests) {
            const { request } = requestData;
            if (request.position.lineNumber === newRequest.position.lineNumber &&
                Math.abs(request.position.column - newRequest.position.column) < 5) {
                requestData.abortController.abort();
                this.activeRequests.delete(requestId);
            }
        }
    }

    _updatePerformanceMetrics(startTime, success) {
        const duration = performance.now() - startTime;
        this.performanceMetrics.totalCompletions++;
        
        if (success) {
            this.performanceMetrics.averageLatency = 
                (this.performanceMetrics.averageLatency * (this.performanceMetrics.totalCompletions - 1) + duration) / 
                this.performanceMetrics.totalCompletions;
        }

        this.performanceMetrics.successRate = 
            (this.performanceMetrics.totalCompletions > 0) ? 
            ((this.performanceMetrics.totalCompletions - this.performanceMetrics.cacheHits) / this.performanceMetrics.totalCompletions) : 0;
    }
}

// Export singleton instance
export const aiCompletionOrchestrator = new AiCompletionOrchestrator();