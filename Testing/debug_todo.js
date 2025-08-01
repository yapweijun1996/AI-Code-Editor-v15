// Debug script for AI Todo Manager functionality
console.log("Starting AI Todo Manager debug test");

import { AITodoManager } from '../frontend/js/ai_todo_manager.js';
import { todoManager, TodoStatus } from '../frontend/js/todo_manager.js';

// Mock UI functions so we can test without actual DOM elements
const UI = {
    updateTodoList: (todos) => {
        console.log("[UI.updateTodoList] Updating UI with todos:", todos);
    },
    appendMessage: (container, message, sender) => {
        console.log(`[UI.appendMessage] Sender: ${sender}, Message: ${message}`);
    },
    showThinkingIndicator: (container, message) => {
        console.log(`[UI.showThinkingIndicator] Message: ${message}`);
    }
};

// Mock ChatService methods relevant to todo functionality
const ChatService = {
    lastUserQuery: '',
    todoMode: false,
    
    // Simplified version of sendPrompt for testing
    async sendPrompt(prompt, options = {}) {
        console.log("[ChatService.sendPrompt] Prompt:", prompt);
        // Return a mocked AI response for task planning
        return `# Task Analysis\n\nHere's a plan to accomplish this:\n\n1. Analyze the current SQL logic\n2. Identify performance bottlenecks\n3. Optimize the query structure\n4. Implement and test changes`;
    },
    
    // Simulate the ChatService._handleTodoListQuery method
    async _handleTodoListQuery(userQuery) {
        console.log("[ChatService._handleTodoListQuery] Processing query:", userQuery);
        try {
            // Get initial AI analysis of the query for task planning
            console.log("[DEBUG] Showing thinking indicator and preparing AI prompt");
            
            const initialPrompt = `
                Analyze the following user request and break it down into a clear, sequential task list.
                For each task, provide a brief, actionable description.
                Present your response as a numbered list of tasks, with 3-7 specific steps.
                
                User request: ${userQuery}
                
                Response format:
                # Task Analysis
                
                Here's a plan to accomplish this:
                
                1. First task
                2. Second task
                ...
            `;
            
            console.log("[DEBUG] Sending initial prompt to AI for task planning");
            const initialResponse = await this.sendPrompt(initialPrompt, {
                customRules: 'You are a task planning assistant that breaks down complex requests into clear, actionable steps.'
            });
            console.log("[DEBUG] Received AI response for task planning:", initialResponse);
            
            // Generate todo items from the AI response
            console.log("[DEBUG] Generating todo items from AI response");
            const todoItems = await AITodoManager.generateTodoList(userQuery, initialResponse);
            console.log("[DEBUG] Generated todo items:", todoItems);
            
            // Update the UI with todo list
            console.log("[DEBUG] Updating UI with todo list");
            UI.updateTodoList(todoItems);
            
            // Set todo mode active
            console.log("[DEBUG] Setting todo mode to active");
            this.todoMode = true;
            
            return todoItems;
        } catch (error) {
            console.error("[ERROR] in handleTodoListQuery:", error);
            return [];
        }
    }
};

// Initialize todo manager
async function initialize() {
    console.log("Initializing todo manager...");
    await todoManager.initialize();
    runTests();
}

// Run various test cases
async function runTests() {
    console.log("\n=== Testing query analysis ===");
    
    // Test case 1: Simple query that shouldn't trigger todo
    const simpleQuery = "What is JavaScript?";
    console.log("\nTesting simple query:", simpleQuery);
    const simpleAnalysis = AITodoManager.analyzeQuery(simpleQuery);
    console.log("Simple query result:", simpleAnalysis);
    
    // Test case 2: Complex query with task keywords that should trigger todo
    const complexQuery = "Create a responsive website with HTML, CSS, and JavaScript that includes a navigation menu, hero section, and contact form.";
    console.log("\nTesting complex query:", complexQuery);
    const complexAnalysis = AITodoManager.analyzeQuery(complexQuery);
    console.log("Complex query result:", complexAnalysis);
    
    // Test case 3: Query explicitly mentioning todo
    const todoQuery = "Please create a todo list for building a simple web app";
    console.log("\nTesting explicit todo query:", todoQuery);
    const todoAnalysis = AITodoManager.analyzeQuery(todoQuery);
    console.log("Todo query result:", todoAnalysis);
    
    // Test case 4: The example query from the task
    const taskQuery = "improve inc_scm_soe_track_querymain.cfm sql logic";
    console.log("\nTesting task query from bug report:", taskQuery);
    const taskAnalysis = AITodoManager.analyzeQuery(taskQuery);
    console.log("Task query result:", taskAnalysis);
    
    // Test the full workflow for the query from the bug report
    console.log("\n=== Testing full workflow with bug report query ===");
    console.log("Query:", taskQuery);
    ChatService.lastUserQuery = taskQuery;
    
    if (taskAnalysis.shouldCreateTodoList) {
        console.log("Analysis indicates this should be handled as a todo task");
        const todoItems = await ChatService._handleTodoListQuery(taskQuery);
        console.log("Todo items created:", todoItems.length);
    } else {
        console.log("Analysis indicates this should NOT be handled as a todo task");
        console.log("This could explain why todo functionality isn't being triggered for this query");
    }
}

// Start tests
initialize().catch(err => console.error("Test failed:", err));