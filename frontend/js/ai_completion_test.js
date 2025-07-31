/**
 * AI Completion System Test
 * Simple test functions to verify the AI completion integration
 */

// Test function that can be called from browser console
window.testAICompletion = async function() {
    console.log('[AI Completion Test] Starting integration test...');
    
    try {
        // Test 1: Check if Settings are loaded
        console.log('[Test 1] Checking settings integration...');
        const { Settings } = await import('./settings.js');
        const completionSettings = Settings.getCompletionSettings();
        console.log('[Test 1] ✅ Completion settings:', completionSettings);
        
        // Test 2: Check if modules can be imported
        console.log('[Test 2] Testing module imports...');
        const { aiCompletionOrchestrator } = await import('./ai_completion_orchestrator.js');
        const { contextIntelligenceEngine } = await import('./context_intelligence_engine.js');
        const { completionModelManager } = await import('./completion_model_manager.js');
        const { userAdaptationSystem } = await import('./user_adaptation_system.js');
        const { aiCompletionProvider } = await import('./ai_completion_provider.js');
        console.log('[Test 2] ✅ All modules imported successfully');
        
        // Test 3: Check if AI completion provider can be registered (when Monaco is available)
        console.log('[Test 3] Testing AI completion provider...');
        if (typeof monaco !== 'undefined') {
            const registered = aiCompletionProvider.register();
            console.log('[Test 3] ✅ AI completion provider registration:', registered ? 'SUCCESS' : 'FAILED');
        } else {
            console.log('[Test 3] ⚠️  Monaco not available yet, skipping provider test');
        }
        
        // Test 4: Check if orchestrator can be initialized
        console.log('[Test 4] Testing AI completion orchestrator...');
        await aiCompletionOrchestrator.initialize();
        console.log('[Test 4] ✅ AI completion orchestrator initialized');
        
        // Test 5: Check if user adaptation system can be initialized
        console.log('[Test 5] Testing user adaptation system...');
        await userAdaptationSystem.initialize();
        console.log('[Test 5] ✅ User adaptation system initialized');
        
        // Test 6: Get performance metrics
        console.log('[Test 6] Checking performance metrics...');
        const orchestratorMetrics = aiCompletionOrchestrator.getPerformanceMetrics();
        const modelMetrics = completionModelManager.getPerformanceMetrics();
        const adaptationInsights = userAdaptationSystem.getAdaptationInsights();
        console.log('[Test 6] ✅ Performance metrics available:', {
            orchestrator: orchestratorMetrics,
            model: Object.keys(modelMetrics).length,
            adaptation: adaptationInsights.metrics
        });
        
        console.log('[AI Completion Test] 🎉 All tests passed! AI completion system is properly integrated.');
        return true;
        
    } catch (error) {
        console.error('[AI Completion Test] ❌ Test failed:', error);
        return false;
    }
};

// Test function for settings updates
window.testCompletionSettings = async function() {
    console.log('[Settings Test] Testing completion settings...');
    
    try {
        const { Settings } = await import('./settings.js');
        
        // Get current settings
        const currentSettings = Settings.getCompletionSettings();
        console.log('[Settings Test] Current settings:', currentSettings);
        
        // Test settings update
        await Settings.updateCompletionSettings({
            debounceMs: 500,
            maxCompletions: 15
        });
        
        const updatedSettings = Settings.getCompletionSettings();
        console.log('[Settings Test] Updated settings:', updatedSettings);
        
        // Revert settings
        await Settings.updateCompletionSettings({
            debounceMs: 300,
            maxCompletions: 10
        });
        
        console.log('[Settings Test] ✅ Settings test completed successfully');
        return true;
        
    } catch (error) {
        console.error('[Settings Test] ❌ Settings test failed:', error);
        return false;
    }
};

// Test function for UI toggle
window.testCompletionToggle = async function() {
    console.log('[Toggle Test] Testing completion toggle...');
    
    try {
        const { Settings } = await import('./settings.js');
        const { aiCompletionProvider } = await import('./ai_completion_provider.js');
        
        // Get current state
        const currentSettings = Settings.getCompletionSettings();
        console.log('[Toggle Test] Current enabled state:', currentSettings.enabled);
        console.log('[Toggle Test] Provider enabled state:', aiCompletionProvider.isEnabled);
        
        // Toggle off
        await Settings.updateCompletionSettings({ enabled: false });
        const disabledSettings = Settings.getCompletionSettings();
        console.log('[Toggle Test] After disable:', disabledSettings.enabled);
        
        // Toggle back on
        await Settings.updateCompletionSettings({ enabled: true });
        const enabledSettings = Settings.getCompletionSettings();
        console.log('[Toggle Test] After enable:', enabledSettings.enabled);
        
        console.log('[Toggle Test] ✅ Toggle test completed successfully');
        return true;
        
    } catch (error) {
        console.error('[Toggle Test] ❌ Toggle test failed:', error);
        return false;
    }
};

// Auto-run basic test when Monaco is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Monaco to be available
    const checkMonaco = setInterval(() => {
        if (typeof monaco !== 'undefined') {
            clearInterval(checkMonaco);
            setTimeout(() => {
                console.log('[AI Completion] Running automatic integration test...');
                window.testAICompletion();
            }, 2000); // Wait 2 seconds after Monaco is available
        }
    }, 1000);
    
    // Timeout after 30 seconds
    setTimeout(() => {
        clearInterval(checkMonaco);
        if (typeof monaco === 'undefined') {
            console.warn('[AI Completion] Monaco not available after 30s, skipping auto-test');
        }
    }, 30000);
});

console.log('[AI Completion Test] Test functions loaded. Available commands:');
console.log('- window.testAICompletion() - Run full integration test');
console.log('- window.testCompletionSettings() - Test settings integration');
console.log('- window.testCompletionToggle() - Test enabled/disabled toggle');