import { DbManager } from './db.js';
import { ApiKeyManager } from './api_manager.js';

export const Settings = {
    // Default settings
    defaults: {
        'llm.provider': 'gemini',
        'llm.gemini.model': 'gemini-2.5-flash',
        'llm.openai.model': 'gpt-4o',
        'llm.ollama.model': 'llama3',
        'llm.ollama.baseURL': 'http://localhost:11434',
        'ui.theme': 'dark',
        // AI Completion settings
        'completion.enabled': true,
        'completion.debounceMs': 300,
        'completion.maxCompletions': 10,
        'completion.enableStreaming': true,
        'completion.enableCaching': true,
        'completion.minTriggerLength': 1,
        'completion.maxContextLength': 10000,
        'completion.enablePersonalization': true,
        'completion.autoTrigger': true,
        'completion.aggressiveTriggering': false, // Default to less "noisy" completions
        'completion.triggerCharacters': ['.', '(', '[', '{', ':', ' ', '<'],
        'custom.amend.rules': `You are in "Amend Mode" - optimized for fast, precise debugging and code changes.

🎯 PRIMARY OBJECTIVES:
- Make surgical, targeted changes with minimal risk
- Prefer faster debugging methods while maintaining accuracy
- Use the most efficient tools for each situation

🔧 PREFERRED TOOL WORKFLOW:
1. ALWAYS start with 'read_file' (with include_line_numbers=true) to get precise context
2. Use 'search_in_file' for targeted searches within specific files
3. Use 'apply_diff' for surgical changes - this is the SAFEST and FASTEST method
4. Only use 'edit_file' with edits array for complex multi-line changes

⚡ PERFORMANCE OPTIMIZATIONS:
- Cache read operations when possible
- Use line-numbered reads for accurate targeting
- Prefer apply_diff over full file rewrites
- Batch related changes when safe to do so

🚫 FORBIDDEN ACTIONS:
- NEVER use 'rewrite_file' or 'write_to_file'
- NEVER make changes without reading the current file content first
- NEVER guess at line numbers - always verify with read_file

💡 SMART DEBUGGING:
- If an error occurs repeatedly, try alternative approaches
- Use performance metrics to optimize tool selection
- Learn from previous successful patterns`,
    },

    // In-memory cache for settings
    cache: new Map(),

    /**
     * Initializes the settings module, loading all settings from the database.
     */
    async initialize() {
        // 1. Load all default settings into the cache first.
        for (const key in this.defaults) {
            this.cache.set(key, this.defaults[key]);
        }

        // 2. Fetch all stored settings from the database.
        const allSettings = await DbManager.getAllFromStore(DbManager.stores.settings);

        // 3. Overwrite the defaults with any stored values.
        for (const setting of allSettings) {
            this.cache.set(setting.id, setting.value);
        }
        console.log('Settings initialized and loaded into cache.');
        
        // Initialize missing AI completion settings
        await this.initializeCompletionSettings();
        
        // ApiKeyManager is now loaded on-demand, no explicit initialization needed.
    },

    /**
     * Initialize AI completion settings in the database if they don't exist
     */
    async initializeCompletionSettings() {
        const completionSettingKeys = [
            'completion.enabled',
            'completion.debounceMs',
            'completion.maxCompletions',
            'completion.enableStreaming',
            'completion.enableCaching',
            'completion.minTriggerLength',
            'completion.maxContextLength',
            'completion.enablePersonalization',
            'completion.autoTrigger',
            'completion.aggressiveTriggering',
            'completion.triggerCharacters'
        ];

        for (const key of completionSettingKeys) {
            if (!this.cache.has(key)) {
                // Set the default value in the database
                await this.set(key, this.defaults[key]);
                console.log(`[Settings] Initialized ${key} with default value:`, this.defaults[key]);
            }
        }
    },

    /**
     * Gets a setting value by key.
     * @param {string} key - The key of the setting to retrieve.
     * @returns {any} The value of the setting.
     */
    get(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        console.warn(`Setting with key "${key}" not found. Returning default.`);
        return this.defaults[key];
    },

    /**
     * Sets a setting value by key and saves it to the database.
     * @param {string} key - The key of the setting to save.
     * @param {any} value - The value to save.
     */
    async set(key, value) {
        const valueToSave = typeof value === 'string' ? value.trim() : value;
        this.cache.set(key, valueToSave);
        await DbManager.saveSetting(key, valueToSave);
        if (key.includes('apiKey')) {
            console.log(`Setting "${key}" updated to "[REDACTED]".`);
        } else {
            console.log(`Setting "${key}" updated to "${value}".`);
        }
    },

    async setMultiple(settings) {
        const settingsToSave = [];
        for (const key in settings) {
            const value = settings[key];
            const valueToSave = typeof value === 'string' ? value.trim() : value;
            this.cache.set(key, valueToSave);
            settingsToSave.push({ id: key, value: valueToSave });
            if (key.includes('apiKey')) {
                console.log(`Setting "${key}" updated to "[REDACTED]".`);
            } else {
                console.log(`Setting "${key}" updated to "${value}".`);
            }
        }
        await DbManager.saveMultipleSettings(settingsToSave);
    },

    /**
     * Gets all settings required to configure an LLM service.
     * This abstracts the underlying storage from the consumers.
     * @returns {object} An object containing all necessary LLM settings.
     */
    getLLMSettings() {
        return {
            provider: this.get('llm.provider'),
            apiKeyManager: ApiKeyManager, // Pass the singleton instance
            gemini: {
                model: this.get('llm.gemini.model'),
            },
            openai: {
                model: this.get('llm.openai.model'),
            },
            ollama: {
                model: this.get('llm.ollama.model'),
                baseURL: this.get('llm.ollama.baseURL'),
            },
        };
    },

    /**
     * Gets AI completion-specific settings.
     * @returns {Object} AI completion settings
     */
    getCompletionSettings() {
        return {
            enabled: this.get('completion.enabled'),
            debounceMs: this.get('completion.debounceMs'),
            maxCompletions: this.get('completion.maxCompletions'),
            enableStreaming: this.get('completion.enableStreaming'),
            enableCaching: this.get('completion.enableCaching'),
            minTriggerLength: this.get('completion.minTriggerLength'),
            maxContextLength: this.get('completion.maxContextLength'),
            enablePersonalization: this.get('completion.enablePersonalization'),
            autoTrigger: this.get('completion.autoTrigger'),
            aggressiveTriggering: this.get('completion.aggressiveTriggering'),
            triggerCharacters: this.get('completion.triggerCharacters')
        };
    },

    /**
     * Updates AI completion settings and notifies components
     * @param {Object} newSettings - New completion settings
     */
    async updateCompletionSettings(newSettings) {
        const updates = {};
        for (const [key, value] of Object.entries(newSettings)) {
            const settingKey = `completion.${key}`;
            updates[settingKey] = value;
        }
        
        await this.setMultiple(updates);
        
        // Dispatch event to notify AI completion components
        document.dispatchEvent(new CustomEvent('ai-completion-settings-updated', {
            detail: { settings: this.getCompletionSettings() }
        }));
    }
};

// Custom event to signal that LLM settings have been updated.
export const dispatchLLMSettingsUpdated = () => {
    document.dispatchEvent(new CustomEvent('llm-settings-updated'));
};
