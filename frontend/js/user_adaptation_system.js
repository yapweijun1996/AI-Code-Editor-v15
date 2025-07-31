/**
 * User Adaptation System
 * Learning system for personalized AI code completions based on user behavior patterns
 */

import { DbManager } from './db.js';
import { completionModelManager } from './completion_model_manager.js';

export class UserAdaptationSystem {
    constructor() {
        this.userPatterns = new Map();
        this.completionHistory = [];
        this.maxHistorySize = 1000;
        this.learningWeights = {
            acceptance: 0.4,      // Weight for completion acceptance
            timing: 0.2,          // Weight for selection timing
            context: 0.3,         // Weight for contextual relevance
            frequency: 0.1        // Weight for pattern frequency
        };
        
        this.adaptationMetrics = {
            totalCompletions: 0,
            acceptedCompletions: 0,
            rejectedCompletions: 0,
            averageAcceptanceTime: 0,
            contextualAccuracy: 0
        };

        this.initialized = false;
    }

    /**
     * Initialize the adaptation system
     */
    async initialize() {
        if (this.initialized) return;

        try {
            await this._loadUserPatterns();
            await this._loadCompletionHistory();
            await this._loadAdaptationMetrics();
            
            this.initialized = true;
            console.log('[User Adaptation] System initialized successfully');
        } catch (error) {
            console.error('[User Adaptation] Initialization failed:', error);
        }
    }

    /**
     * Record a completion interaction
     * @param {Object} interaction - Completion interaction data
     */
    async recordCompletionInteraction(interaction) {
        if (!this.initialized) {
            await this.initialize();
        }

        const {
            completion,
            context,
            action, // 'accepted', 'rejected', 'ignored'
            timingMs,
            position
        } = interaction;

        // Record in history
        const historyEntry = {
            completion: completion.label,
            context: this._extractContextKey(context),
            action,
            timingMs,
            timestamp: Date.now(),
            language: context.language,
            completionType: context.typing?.completionType || 'general',
            confidence: completion.confidence || 0.5
        };

        this.completionHistory.push(historyEntry);
        
        // Maintain history size
        if (this.completionHistory.length > this.maxHistorySize) {
            this.completionHistory.shift();
        }

        // Update adaptation metrics
        this._updateAdaptationMetrics(historyEntry);

        // Learn from interaction
        await this._learnFromInteraction(historyEntry, context);

        // Update model feedback
        completionModelManager.updateModelFeedback(
            this._getModelKey(completion),
            {
                success: action === 'accepted',
                latency: timingMs,
                userAccepted: action === 'accepted',
                qualityScore: this._calculateQualityScore(historyEntry)
            }
        );

        // Save periodically
        if (this.completionHistory.length % 10 === 0) {
            await this._saveUserData();
        }
    }

    /**
     * Get personalized completion rankings
     * @param {Array} completions - Array of completion items
     * @param {Object} context - Current completion context
     * @returns {Array} Re-ranked completions
     */
    getPersonalizedRankings(completions, context) {
        if (!this.initialized || completions.length === 0) {
            return completions;
        }

        const contextKey = this._extractContextKey(context);
        const userPattern = this.userPatterns.get(contextKey);

        return completions.map(completion => {
            const personalizedScore = this._calculatePersonalizedScore(completion, context, userPattern);
            return {
                ...completion,
                personalizedScore,
                sortText: `${personalizedScore.toFixed(3)}_${completion.sortText || completion.label}`
            };
        }).sort((a, b) => b.personalizedScore - a.personalizedScore);
    }

    /**
     * Get user preferences for completion types
     * @param {string} language - Programming language
     * @returns {Object} User preferences
     */
    getUserPreferences(language) {
        const preferences = {
            preferredCompletionTypes: [],
            avoidedPatterns: [],
            preferredTriggers: [],
            averageAcceptanceTime: this.adaptationMetrics.averageAcceptanceTime,
            contextualStrengths: new Map()
        };

        // Analyze completion history for language-specific preferences
        const languageHistory = this.completionHistory.filter(entry => entry.language === language);
        
        if (languageHistory.length > 0) {
            // Find preferred completion types
            const typeFrequency = new Map();
            const typeAcceptance = new Map();

            languageHistory.forEach(entry => {
                const type = entry.completionType;
                typeFrequency.set(type, (typeFrequency.get(type) || 0) + 1);
                
                if (entry.action === 'accepted') {
                    typeAcceptance.set(type, (typeAcceptance.get(type) || 0) + 1);
                }
            });

            // Calculate acceptance rates
            for (const [type, frequency] of typeFrequency) {
                const acceptance = typeAcceptance.get(type) || 0;
                const rate = acceptance / frequency;
                
                if (rate > 0.6 && frequency > 5) { // 60% acceptance rate, minimum 5 occurrences
                    preferences.preferredCompletionTypes.push({ type, rate, frequency });
                }
            }

            // Sort by acceptance rate
            preferences.preferredCompletionTypes.sort((a, b) => b.rate - a.rate);
        }

        return preferences;
    }

    /**
     * Get adaptation insights for debugging and optimization
     * @returns {Object} Adaptation insights
     */
    getAdaptationInsights() {
        const insights = {
            metrics: { ...this.adaptationMetrics },
            topPatterns: [],
            improvementSuggestions: [],
            languageStrengths: new Map()
        };

        // Analyze top patterns
        const patternScores = new Map();
        for (const [pattern, data] of this.userPatterns) {
            if (data.totalOccurrences > 3) {
                patternScores.set(pattern, {
                    pattern,
                    score: data.score,
                    occurrences: data.totalOccurrences,
                    acceptance: data.acceptanceRate
                });
            }
        }

        insights.topPatterns = Array.from(patternScores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        // Language analysis
        const languageStats = new Map();
        this.completionHistory.forEach(entry => {
            if (!languageStats.has(entry.language)) {
                languageStats.set(entry.language, { total: 0, accepted: 0 });
            }
            const stats = languageStats.get(entry.language);
            stats.total++;
            if (entry.action === 'accepted') {
                stats.accepted++;
            }
        });

        for (const [language, stats] of languageStats) {
            insights.languageStrengths.set(language, {
                acceptanceRate: stats.accepted / stats.total,
                totalCompletions: stats.total
            });
        }

        // Generate improvement suggestions
        insights.improvementSuggestions = this._generateImprovementSuggestions(insights);

        return insights;
    }

    /**
     * Reset user adaptation data
     */
    async resetAdaptation() {
        this.userPatterns.clear();
        this.completionHistory = [];
        this.adaptationMetrics = {
            totalCompletions: 0,
            acceptedCompletions: 0,
            rejectedCompletions: 0,
            averageAcceptanceTime: 0,
            contextualAccuracy: 0
        };

        await this._saveUserData();
        console.log('[User Adaptation] User data reset');
    }

    // Private methods

    async _loadUserPatterns() {
        try {
            const saved = await DbManager.getSetting('userCompletionPatterns');
            if (saved) {
                this.userPatterns = new Map(Object.entries(saved));
            }
        } catch (error) {
            console.warn('[User Adaptation] Failed to load patterns:', error);
        }
    }

    async _loadCompletionHistory() {
        try {
            const saved = await DbManager.getSetting('completionHistory');
            if (saved && Array.isArray(saved)) {
                this.completionHistory = saved.slice(-this.maxHistorySize);
            }
        } catch (error) {
            console.warn('[User Adaptation] Failed to load history:', error);
        }
    }

    async _loadAdaptationMetrics() {
        try {
            const saved = await DbManager.getSetting('adaptationMetrics');
            if (saved) {
                this.adaptationMetrics = { ...this.adaptationMetrics, ...saved };
            }
        } catch (error) {
            console.warn('[User Adaptation] Failed to load metrics:', error);
        }
    }

    async _saveUserData() {
        try {
            // Save patterns
            const patternsObj = Object.fromEntries(this.userPatterns);
            await DbManager.saveSetting('userCompletionPatterns', patternsObj);

            // Save history
            await DbManager.saveSetting('completionHistory', this.completionHistory);

            // Save metrics
            await DbManager.saveSetting('adaptationMetrics', this.adaptationMetrics);

        } catch (error) {
            console.warn('[User Adaptation] Failed to save data:', error);
        }
    }

    _extractContextKey(context) {
        // Create a simplified context key for pattern matching
        const parts = [
            context.language || 'unknown',
            context.typing?.completionType || 'general',
            context.trigger || '',
            context.scope?.currentScope || 'global'
        ];
        return parts.join('|');
    }

    _updateAdaptationMetrics(historyEntry) {
        this.adaptationMetrics.totalCompletions++;
        
        if (historyEntry.action === 'accepted') {
            this.adaptationMetrics.acceptedCompletions++;
            
            // Update average acceptance time
            const currentAvg = this.adaptationMetrics.averageAcceptanceTime;
            const newCount = this.adaptationMetrics.acceptedCompletions;
            this.adaptationMetrics.averageAcceptanceTime = 
                (currentAvg * (newCount - 1) + historyEntry.timingMs) / newCount;
        } else if (historyEntry.action === 'rejected') {
            this.adaptationMetrics.rejectedCompletions++;
        }

        // Update contextual accuracy
        this.adaptationMetrics.contextualAccuracy = 
            this.adaptationMetrics.acceptedCompletions / this.adaptationMetrics.totalCompletions;
    }

    async _learnFromInteraction(historyEntry, context) {
        const contextKey = this._extractContextKey(context);
        
        if (!this.userPatterns.has(contextKey)) {
            this.userPatterns.set(contextKey, {
                totalOccurrences: 0,
                acceptedOccurrences: 0,
                rejectedOccurrences: 0,
                averageTimingMs: 0,
                score: 0.5,
                acceptanceRate: 0.5,
                lastUpdated: Date.now()
            });
        }

        const pattern = this.userPatterns.get(contextKey);
        pattern.totalOccurrences++;
        pattern.lastUpdated = Date.now();

        if (historyEntry.action === 'accepted') {
            pattern.acceptedOccurrences++;
            pattern.averageTimingMs = 
                (pattern.averageTimingMs * (pattern.acceptedOccurrences - 1) + historyEntry.timingMs) / 
                pattern.acceptedOccurrences;
        } else if (historyEntry.action === 'rejected') {
            pattern.rejectedOccurrences++;
        }

        // Update acceptance rate
        pattern.acceptanceRate = pattern.acceptedOccurrences / pattern.totalOccurrences;

        // Calculate composite score
        pattern.score = this._calculatePatternScore(pattern, historyEntry);
    }

    _calculatePatternScore(pattern, historyEntry) {
        let score = 0;

        // Acceptance component
        score += this.learningWeights.acceptance * pattern.acceptanceRate;

        // Timing component (faster acceptance is better)
        const timingScore = Math.max(0, 1 - (pattern.averageTimingMs / 5000)); // 5 seconds max
        score += this.learningWeights.timing * timingScore;

        // Context component (based on confidence)
        score += this.learningWeights.context * (historyEntry.confidence || 0.5);

        // Frequency component (more frequent patterns are more reliable)
        const frequencyScore = Math.min(1, pattern.totalOccurrences / 50); // Cap at 50 occurrences
        score += this.learningWeights.frequency * frequencyScore;

        return Math.max(0, Math.min(1, score));
    }

    _calculatePersonalizedScore(completion, context, userPattern) {
        let score = completion.confidence || 0.5;

        // Apply user pattern learning
        if (userPattern) {
            score = score * 0.6 + userPattern.score * 0.4;
        }

        // Boost score for AI completions based on historical acceptance
        if (completion.aiGenerated) {
            const aiAcceptanceRate = this.adaptationMetrics.contextualAccuracy;
            score = score * 0.8 + aiAcceptanceRate * 0.2;
        }

        // Apply language-specific adjustments
        const languagePrefs = this.getUserPreferences(context.language);
        const preferredTypes = languagePrefs.preferredCompletionTypes.map(p => p.type);
        
        if (preferredTypes.includes(context.typing?.completionType)) {
            score *= 1.2;
        }

        return Math.max(0, Math.min(1, score));
    }

    _calculateQualityScore(historyEntry) {
        let quality = 0.5;

        // Higher quality for accepted completions
        if (historyEntry.action === 'accepted') {
            quality = 0.8;
            
            // Even higher if accepted quickly
            if (historyEntry.timingMs < 2000) {
                quality = 0.9;
            }
        } else if (historyEntry.action === 'rejected') {
            quality = 0.2;
        }

        // Adjust for confidence
        quality = quality * 0.7 + (historyEntry.confidence || 0.5) * 0.3;

        return quality;
    }

    _getModelKey(completion) {
        return completion.modelSource || 'unknown';
    }

    _generateImprovementSuggestions(insights) {
        const suggestions = [];

        // Check acceptance rate
        if (insights.metrics.contextualAccuracy < 0.4) {
            suggestions.push({
                type: 'low_acceptance',
                message: 'Low completion acceptance rate. Consider adjusting AI model or trigger sensitivity.',
                priority: 'high'
            });
        }

        // Check timing
        if (insights.metrics.averageAcceptanceTime > 3000) {
            suggestions.push({
                type: 'slow_acceptance',
                message: 'Users take long to accept completions. Improve relevance and ranking.',
                priority: 'medium'
            });
        }

        // Check language performance
        for (const [language, stats] of insights.languageStrengths) {
            if (stats.acceptanceRate < 0.3 && stats.totalCompletions > 20) {
                suggestions.push({
                    type: 'language_weakness',
                    message: `Poor completion performance for ${language}. Consider language-specific improvements.`,
                    priority: 'medium',
                    language
                });
            }
        }

        return suggestions;
    }
}

// Export singleton instance
export const userAdaptationSystem = new UserAdaptationSystem();