/**
 * AI Completion Settings UI
 * Handles the user interface for AI completion configuration
 */

import { Settings } from './settings.js';

export class AiCompletionSettingsUI {
    constructor() {
        this.initialized = false;
        this.elements = {};
        this.statsUpdateInterval = null;
    }

    /**
     * Initialize the AI completion settings UI
     */
    async initialize() {
        if (this.initialized) return;

        try {
            this._bindElements();
            this._setupEventListeners();
            await this._loadSettings();
            this._startStatsUpdates();
            
            this.initialized = true;
            console.log('[AI Completion Settings UI] Initialized successfully');
        } catch (error) {
            console.error('[AI Completion Settings UI] Initialization failed:', error);
        }
    }

    /**
     * Bind DOM elements
     */
    _bindElements() {
        this.elements = {
            // Main settings
            enabled: document.getElementById('completion-enabled'),
            debounce: document.getElementById('completion-debounce'),
            maxItems: document.getElementById('completion-max-items'),
            
            // Feature toggles
            streaming: document.getElementById('completion-streaming'),
            personalization: document.getElementById('completion-personalization'),
            autoTrigger: document.getElementById('completion-auto-trigger'),
            aggressiveTrigger: document.getElementById('completion-aggressive-trigger'),
            
            // Advanced settings
            contextLength: document.getElementById('completion-context-length'),
            caching: document.getElementById('completion-caching'),
            minTrigger: document.getElementById('completion-min-trigger'),
            
            // Stats elements
            statsContainer: document.getElementById('completion-stats'),
            statAcceptanceRate: document.getElementById('stat-acceptance-rate'),
            statTotalCompletions: document.getElementById('stat-total-completions'),
            statAvgResponseTime: document.getElementById('stat-avg-response-time'),
            statCacheHitRate: document.getElementById('stat-cache-hit-rate')
        };

        // Check if all elements exist
        const missingElements = [];
        for (const [key, element] of Object.entries(this.elements)) {
            if (!element) {
                missingElements.push(key);
            }
        }

        if (missingElements.length > 0) {
            console.warn('[AI Completion Settings UI] Missing elements:', missingElements);
        }
    }

    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        // Main toggle
        if (this.elements.enabled) {
            this.elements.enabled.addEventListener('change', (e) => {
                this._handleEnabledToggle(e.target.checked);
            });
        }

        // Performance settings
        if (this.elements.debounce) {
            this.elements.debounce.addEventListener('change', (e) => {
                this._handleSettingChange('debounceMs', parseInt(e.target.value));
            });
        }

        if (this.elements.maxItems) {
            this.elements.maxItems.addEventListener('change', (e) => {
                this._handleSettingChange('maxCompletions', parseInt(e.target.value));
            });
        }

        // Feature toggles
        if (this.elements.streaming) {
            this.elements.streaming.addEventListener('change', (e) => {
                this._handleSettingChange('enableStreaming', e.target.checked);
            });
        }

        if (this.elements.personalization) {
            this.elements.personalization.addEventListener('change', (e) => {
                this._handleSettingChange('enablePersonalization', e.target.checked);
            });
        }

        if (this.elements.autoTrigger) {
            this.elements.autoTrigger.addEventListener('change', (e) => {
                this._handleSettingChange('autoTrigger', e.target.checked);
            });
        }

        if (this.elements.aggressiveTrigger) {
           this.elements.aggressiveTrigger.addEventListener('change', (e) => {
               this._handleSettingChange('aggressiveTriggering', e.target.checked);
           });
       }

        // Advanced settings
        if (this.elements.contextLength) {
            this.elements.contextLength.addEventListener('change', (e) => {
                this._handleSettingChange('maxContextLength', parseInt(e.target.value));
            });
        }

        if (this.elements.caching) {
            this.elements.caching.addEventListener('change', (e) => {
                this._handleSettingChange('enableCaching', e.target.checked);
            });
        }

        if (this.elements.minTrigger) {
            this.elements.minTrigger.addEventListener('change', (e) => {
                this._handleSettingChange('minTriggerLength', parseInt(e.target.value));
            });
        }

        // Listen for external settings updates
        document.addEventListener('ai-completion-settings-updated', (event) => {
            this._onSettingsUpdated(event.detail.settings);
        });
    }

    /**
     * Load current settings from Settings module
     */
    async _loadSettings() {
        try {
            const settings = Settings.getCompletionSettings();
            this._updateUI(settings);
        } catch (error) {
            console.error('[AI Completion Settings UI] Failed to load settings:', error);
        }
    }

    /**
     * Update UI elements with current settings
     */
    _updateUI(settings) {
        if (this.elements.enabled) {
            this.elements.enabled.checked = settings.enabled;
        }

        if (this.elements.debounce) {
            this.elements.debounce.value = settings.debounceMs;
        }

        if (this.elements.maxItems) {
            this.elements.maxItems.value = settings.maxCompletions;
        }

        if (this.elements.streaming) {
            this.elements.streaming.checked = settings.enableStreaming;
        }

        if (this.elements.personalization) {
            this.elements.personalization.checked = settings.enablePersonalization;
        }

        if (this.elements.autoTrigger) {
            this.elements.autoTrigger.checked = settings.autoTrigger;
        }

        if (this.elements.aggressiveTrigger) {
           this.elements.aggressiveTrigger.checked = settings.aggressiveTriggering;
       }

        if (this.elements.contextLength) {
            this.elements.contextLength.value = settings.maxContextLength;
        }

        if (this.elements.caching) {
            this.elements.caching.checked = settings.enableCaching;
        }

        if (this.elements.minTrigger) {
            this.elements.minTrigger.value = settings.minTriggerLength;
        }
    }

    /**
     * Handle the main enabled/disabled toggle
     */
    async _handleEnabledToggle(enabled) {
        try {
            await Settings.updateCompletionSettings({ enabled });
            
            // Also toggle the AI completion provider
            if (typeof window !== 'undefined' && window.aiCompletionProvider) {
                window.aiCompletionProvider.setEnabled(enabled);
            } else {
                // Try to import and toggle the provider
                try {
                    const { aiCompletionProvider } = await import('./ai_completion_provider.js');
                    aiCompletionProvider.setEnabled(enabled);
                } catch (error) {
                    console.warn('[AI Completion Settings UI] Could not toggle provider:', error);
                }
            }

            console.log(`[AI Completion Settings UI] AI completions ${enabled ? 'enabled' : 'disabled'}`);
            
            // Show user feedback
            this._showFeedback(`AI Completions ${enabled ? 'Enabled' : 'Disabled'}`, enabled ? 'success' : 'info');
            
        } catch (error) {
            console.error('[AI Completion Settings UI] Failed to toggle enabled state:', error);
            this._showFeedback('Failed to update setting', 'error');
        }
    }

    /**
     * Handle individual setting changes
     */
    async _handleSettingChange(key, value) {
        try {
            const update = {};
            update[key] = value;
            await Settings.updateCompletionSettings(update);
            
            console.log(`[AI Completion Settings UI] Updated ${key} to:`, value);
        } catch (error) {
            console.error(`[AI Completion Settings UI] Failed to update ${key}:`, error);
            this._showFeedback('Failed to update setting', 'error');
        }
    }

    /**
     * Handle external settings updates
     */
    _onSettingsUpdated(settings) {
        this._updateUI(settings);
    }

    /**
     * Start periodic stats updates
     */
    _startStatsUpdates() {
        // Update stats immediately
        this._updateStats();
        
        // Then update every 30 seconds
        this.statsUpdateInterval = setInterval(() => {
            this._updateStats();
        }, 30000);
    }

    /**
     * Update performance statistics
     */
    async _updateStats() {
        try {
            // Import the modules dynamically to avoid circular dependencies
            const [
                { aiCompletionOrchestrator },
                { userAdaptationSystem },
                { completionModelManager }
            ] = await Promise.all([
                import('./ai_completion_orchestrator.js'),
                import('./user_adaptation_system.js'), 
                import('./completion_model_manager.js')
            ]);

            // Get metrics from various systems
            const orchestratorMetrics = aiCompletionOrchestrator.getPerformanceMetrics();
            const adaptationInsights = userAdaptationSystem.getAdaptationInsights();
            const modelMetrics = completionModelManager.getPerformanceMetrics();

            // Update UI elements
            if (this.elements.statAcceptanceRate) {
                const acceptanceRate = adaptationInsights.metrics.contextualAccuracy || 0;
                this.elements.statAcceptanceRate.textContent = `${(acceptanceRate * 100).toFixed(1)}%`;
            }

            if (this.elements.statTotalCompletions) {
                const totalCompletions = orchestratorMetrics.totalCompletions || 0;
                this.elements.statTotalCompletions.textContent = totalCompletions.toString();
            }

            if (this.elements.statAvgResponseTime) {
                const avgLatency = orchestratorMetrics.averageLatency || 0;
                this.elements.statAvgResponseTime.textContent = `${avgLatency.toFixed(0)}ms`;
            }

            if (this.elements.statCacheHitRate) {
                const cacheHits = orchestratorMetrics.cacheHits || 0;
                const totalRequests = orchestratorMetrics.totalCompletions || 1;
                const cacheHitRate = (cacheHits / totalRequests) * 100;
                this.elements.statCacheHitRate.textContent = `${cacheHitRate.toFixed(1)}%`;
            }

            // Show stats container if it has data
            if (this.elements.statsContainer && orchestratorMetrics.totalCompletions > 0) {
                this.elements.statsContainer.style.display = 'block';
            }

        } catch (error) {
            console.error('[AI Completion Settings UI] Failed to update stats:', error);
        }
    }

    /**
     * Show user feedback message
     */
    _showFeedback(message, type = 'info') {
        // Try to use existing UI feedback system
        if (typeof window !== 'undefined' && window.UI && window.UI.showInfo) {
            if (type === 'success') {
                window.UI.showInfo(message);
            } else if (type === 'error') {
                window.UI.showError(message);
            } else {
                window.UI.showInfo(message);
            }
        } else {
            // Fallback to console
            console.log(`[AI Completion Settings UI] ${message}`);
        }
    }

    /**
     * Cleanup resources
     */
    dispose() {
        if (this.statsUpdateInterval) {
            clearInterval(this.statsUpdateInterval);
            this.statsUpdateInterval = null;
        }
        this.initialized = false;
    }
}

// Export singleton instance
export const aiCompletionSettingsUI = new AiCompletionSettingsUI();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other systems to initialize
    setTimeout(async () => {
        try {
            await aiCompletionSettingsUI.initialize();
        } catch (error) {
            console.error('[AI Completion Settings UI] Auto-initialization failed:', error);
        }
    }, 1000);
});

console.log('[AI Completion Settings UI] Module loaded');