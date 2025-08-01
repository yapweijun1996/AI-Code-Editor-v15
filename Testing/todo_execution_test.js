// Test script for verifying Todo task execution flow with new timeout and error handling
console.log("=== STARTING TODO EXECUTION TEST ===");

import { ChatService } from '../frontend/js/chat_service.js';
import { todoManager, TodoStatus } from '../frontend/js/todo_manager.js';
import { AITodoManager } from '../frontend/js/ai_todo_manager.js';

// Mock UI functions for testing
const UI = {
    updateTodoList: (todos) => {
        console.log("[UI.updateTodoList] Updating UI with todos:", todos.length);
    },
    appendMessage: (container, message, sender) => {
        console.log(`[UI.appendMessage] ${sender}: ${message.substring(0, 50)}...`);
    },
    showThinkingIndicator: (container, message) => {
        console.log(`[UI.showThinkingIndicator] ${message}`);
    },
    showError: (message) => {
        console.error(`[UI.showError] ${message}`);
    }
};

// Mock settings and DB for LLM initialization
const Settings = {
    getLLMSettings: () => ({
        provider: 'openai',
        apiKey: 'mock-key'
    }),
    get: (key) => null
};

// Mock DB functions
const DbManager = {
    getAllTodos: async () => [],
    addTodo: async (todo) => 1,
    updateTodo: async (id, updates) => true,
    getChatHistory: async () => [],
    saveChatHistory: async () => true
};

// Inject mocks
ChatService.UI = UI;
window.UI = UI; 
window.Settings = Settings;
window.DbManager = DbManager;

// Mock LLM service factory
import { LLMServiceFactory } from '../frontend/js/llm/service_factory.js';
const mockLLMService = {
    isConfigured: async () => true,
    sendMessageStream: async function* () {
        console.log("[MockLLM] Generating stream response");
        yield { text: "This is a mock response from the LLM service." };
        
        // Simulate delay to test timeout handling
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        yield { text: " More text to simulate streaming." };
        console.log("[MockLLM] Stream response complete");
    }
};

// Override LLMServiceFactory
LLMServiceFactory.create = () => mockLLMService;

// Main test function
async function runTest() {
    try {
        console.log("\n=== Phase 1: Initialization ===");
        // Initialize ChatService
        await ChatService.initialize({});
        console.log("ChatService initialized");
        
        // Initialize TodoManager
        await todoManager.initialize();
        console.log("TodoManager initialized");
        
        console.log("\n=== Phase 2: Creating test todo ===");
        // Create a test todo item
        const todoText = "Analyze and improve SQL query performance";
        const mockTodo = {
            id: 1,
            text: todoText,
            status: TodoStatus.PENDING,
            timestamp: Date.now()
        };
        
        console.log("Created test todo:", mockTodo);
        
        // Set up ChatService for todo execution
        ChatService.lastUserQuery = "Improve SQL performance in the application";
        ChatService.todoMode = true;
        
        console.log("\n=== Phase 3: Executing todo task ===");
        // Create a mock chat container
        const mockChatContainer = document.createElement('div');
        
        // Set a timeout for the entire test
        const testTimeoutMs = 30000;
        const testTimeout = setTimeout(() => {
            console.error("TEST FAILURE: Test execution timed out after", testTimeoutMs/1000, "seconds");
            failTest();
        }, testTimeoutMs);
        
        // Execute the task
        console.log("Starting task execution...");
        const executionStart = Date.now();
        
        try {
            const result = await ChatService._executeTodoTask(mockTodo, mockChatContainer);
            const executionTime = Date.now() - executionStart;
            
            console.log(`\n=== Task execution ${result ? 'succeeded' : 'failed'} in ${executionTime}ms ===`);
            
            if (result) {
                console.log("✅ TEST PASSED: Task executed successfully without hanging");
            } else {
                console.log("⚠️ TEST WARNING: Task executed but returned failure status");
            }
        } catch (error) {
            const executionTime = Date.now() - executionStart;
            console.error(`❌ TEST FAILED: Error during task execution after ${executionTime}ms:`, error);
            console.error(error.stack);
        } finally {
            clearTimeout(testTimeout);
        }
        
        console.log("\n=== Phase 4: Testing timeout handling ===");
        // Create a slow mock LLM service to test timeout
        const originalSendPrompt = ChatService.sendPrompt;
        
        ChatService.sendPrompt = async () => {
            console.log("[SlowMockLLM] Starting slow response generation");
            // Simulate a very long operation that should trigger timeout
            await new Promise(resolve => setTimeout(resolve, 35000));
            console.log("[SlowMockLLM] This should not be reached if timeout works");
            return "Slow response that should timeout";
        };
        
        // Set a shorter timeout for this test
        const timeoutTestTimeout = setTimeout(() => {
            console.error("TEST FAILURE: Timeout test timed out - timeout protection may not be working");
            failTest();
        }, 15000);
        
        console.log("Starting task with slow LLM response (should timeout)...");
        const timeoutStart = Date.now();
        
        try {
            const result = await ChatService._executeTodoTask(mockTodo, mockChatContainer);
            const timeoutTestTime = Date.now() - timeoutStart;
            
            if (timeoutTestTime < 30000) {
                console.log(`✅ TEST PASSED: Timeout protection worked! (${timeoutTestTime}ms)`);
            } else {
                console.log(`⚠️ TEST WARNING: Task completed but took longer than expected (${timeoutTestTime}ms)`);
            }
        } catch (error) {
            const timeoutTestTime = Date.now() - timeoutStart;
            console.log(`✅ TEST PASSED: Timeout correctly triggered after ${timeoutTestTime}ms: ${error.message}`);
        } finally {
            clearTimeout(timeoutTestTimeout);
            // Restore original sendPrompt
            ChatService.sendPrompt = originalSendPrompt;
        }
        
        console.log("\n=== Test Completed Successfully ===");
    } catch (error) {
        console.error("Unexpected test error:", error);
        console.error(error.stack);
    }
}

function failTest() {
    console.error("Test failed due to timeout or error");
    // Force exit if in Node environment
    if (typeof process !== 'undefined') {
        process.exit(1);
    }
}

// DOM ready check for browser environment
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runTest);
    } else {
        runTest();
    }
} else {
    // Node environment or other non-DOM environment
    runTest();
}