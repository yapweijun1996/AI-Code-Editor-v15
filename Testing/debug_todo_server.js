// Server-side debug script for AI Todo Manager functionality
// Run with: node debug_todo_server.js

import { AITodoManager } from '../frontend/js/ai_todo_manager.js';
import { todoManager, TodoStatus } from '../frontend/js/todo_manager.js';

// Start the test
console.log("===== AI Todo Manager Debug Test (Server-side) =====");

// Run diagnostic tests
async function runTests() {
    console.log("\n--- Testing Query Analysis Logic ---");
    
    // Test case 1: Simple query that shouldn't trigger todo
    const simpleQuery = "What is JavaScript?";
    console.log("\nTest 1: Simple query:", simpleQuery);
    const simpleAnalysis = AITodoManager.analyzeQuery(simpleQuery);
    console.log("Results:", simpleAnalysis);
    
    // Test case 2: Complex query with task keywords that should trigger todo
    const complexQuery = "Create a responsive website with HTML, CSS, and JavaScript that includes a navigation menu, hero section, and contact form.";
    console.log("\nTest 2: Complex query:", complexQuery);
    const complexAnalysis = AITodoManager.analyzeQuery(complexQuery);
    console.log("Results:", complexAnalysis);
    
    // Test case 3: Query explicitly mentioning todo
    const todoQuery = "Please create a todo list for building a simple web app";
    console.log("\nTest 3: Explicit todo query:", todoQuery);
    const todoAnalysis = AITodoManager.analyzeQuery(todoQuery);
    console.log("Results:", todoAnalysis);
    
    // Test case 4: The example query from the task
    const taskQuery = "improve inc_scm_soe_track_querymain.cfm sql logic";
    console.log("\nTest 4: Task query from bug report:", taskQuery);
    const taskAnalysis = AITodoManager.analyzeQuery(taskQuery);
    console.log("Results:", taskAnalysis);
    
    // Test additional permutations of the problem query
    console.log("\n--- Testing Additional Permutations ---");
    
    // Test case 5: Problem query with more complexity
    const longerTaskQuery = "improve the inc_scm_soe_track_querymain.cfm sql logic by optimizing performance and ensuring proper indexing";
    console.log("\nTest 5: Longer version of problem query:", longerTaskQuery);
    const longerTaskAnalysis = AITodoManager.analyzeQuery(longerTaskQuery);
    console.log("Results:", longerTaskAnalysis);
    
    // Test case 6: Problem query with explicit todo mention
    const todoTaskQuery = "create a todo list to improve inc_scm_soe_track_querymain.cfm sql logic";
    console.log("\nTest 6: Problem query with todo mention:", todoTaskQuery);
    const todoTaskAnalysis = AITodoManager.analyzeQuery(todoTaskQuery);
    console.log("Results:", todoTaskAnalysis);
}

// Run the tests
runTests()
    .then(() => console.log("\n===== Test Completed ====="))
    .catch(err => console.error("Test failed:", err));