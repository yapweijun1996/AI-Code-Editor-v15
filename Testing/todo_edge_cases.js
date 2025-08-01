/**
 * Edge case tests for Todo functionality
 * This script contains tests for edge cases and error handling in the Todo system
 */

import { todoManager, TodoStatus } from '../frontend/js/todo_manager.js';
import { AITodoManager } from '../frontend/js/ai_todo_manager.js';

/**
 * Run edge case tests for the Todo system
 */
async function runEdgeTests() {
    console.log('=== Running Todo Edge Case Tests ===');
    
    try {
        // Initialize the todo manager
        await todoManager.initialize();
        console.log('TodoManager initialized successfully');
        
        // Test 1: Empty input handling
        console.log('\nTest 1: Empty input handling');
        try {
            await todoManager.createTodo('');
            console.error('❌ Failed: Empty todo creation should throw an error');
        } catch (error) {
            console.log('✅ Success: Empty todo creation properly rejected');
        }
        
        // Test 2: Invalid todo ID handling
        console.log('\nTest 2: Invalid todo ID handling');
        try {
            await todoManager.updateTodo(9999, { text: 'This should fail' });
            console.error('❌ Failed: Invalid todo ID update should throw an error');
        } catch (error) {
            console.log('✅ Success: Invalid todo ID update properly rejected');
        }
        
        // Test 3: Todo status transition
        console.log('\nTest 3: Todo status transition');
        const todo = await todoManager.createTodo('Test status transitions');
        console.log(`Created todo with ID ${todo.id} and status ${todo.status}`);
        
        // Verify initial status is PENDING
        if (todo.status === TodoStatus.PENDING) {
            console.log('✅ Initial status is correctly set to PENDING');
        } else {
            console.error(`❌ Initial status should be PENDING but was ${todo.status}`);
        }
        
        // Test status transitions
        await todoManager.toggleTodoStatus(todo.id);
        let updatedTodo = await todoManager.getTodoById(todo.id);
        if (updatedTodo.status === TodoStatus.IN_PROGRESS) {
            console.log('✅ Status correctly transitioned to IN_PROGRESS');
        } else {
            console.error(`❌ Status should be IN_PROGRESS but was ${updatedTodo.status}`);
        }
        
        await todoManager.toggleTodoStatus(todo.id);
        updatedTodo = await todoManager.getTodoById(todo.id);
        if (updatedTodo.status === TodoStatus.COMPLETED) {
            console.log('✅ Status correctly transitioned to COMPLETED');
        } else {
            console.error(`❌ Status should be COMPLETED but was ${updatedTodo.status}`);
        }
        
        await todoManager.toggleTodoStatus(todo.id);
        updatedTodo = await todoManager.getTodoById(todo.id);
        if (updatedTodo.status === TodoStatus.PENDING) {
            console.log('✅ Status correctly cycled back to PENDING');
        } else {
            console.error(`❌ Status should cycle back to PENDING but was ${updatedTodo.status}`);
        }
        
        // Test 4: AI Todo query analysis
        console.log('\nTest 4: AI Todo query analysis');
        const simpleQuery = 'What is JavaScript?';
        const simpleAnalysis = AITodoManager.analyzeQuery(simpleQuery);
        if (!simpleAnalysis.shouldCreateTodoList) {
            console.log('✅ Simple query correctly identified as not needing a todo list');
        } else {
            console.error('❌ Simple query incorrectly identified as needing a todo list');
        }
        
        const complexQuery = 'Create a complex web application with user authentication, database integration, and responsive UI components that work on mobile and desktop.';
        const complexAnalysis = AITodoManager.analyzeQuery(complexQuery);
        if (complexAnalysis.shouldCreateTodoList) {
            console.log('✅ Complex query correctly identified as needing a todo list');
        } else {
            console.error('❌ Complex query incorrectly identified as not needing a todo list');
        }
        
        // Test 5: Todo list extraction from AI response
        console.log('\nTest 5: Todo list extraction from AI response');
        const aiResponse = `
        Here's how to approach this task:
        
        1. Set up the project structure
        2. Install necessary dependencies
        3. Create the authentication system
        4. Design and implement the database
        5. Build the responsive UI components
        
        Let's start with setting up the project structure.
        `;
        
        const extractedTasks = AITodoManager._extractTasksFromResponse(aiResponse);
        if (extractedTasks.length === 5) {
            console.log(`✅ Successfully extracted ${extractedTasks.length} tasks from AI response`);
        } else {
            console.error(`❌ Should have extracted 5 tasks but got ${extractedTasks.length}`);
        }
        
        // Test 6: Plan completion detection
        console.log('\nTest 6: Plan completion detection');
        // First create a plan with multiple todos
        AITodoManager.activePlan = {
            query: 'Test plan',
            startTime: Date.now(),
            todoItems: [],
            currentTaskIndex: 0,
            status: 'active'
        };
        
        const todo1 = await todoManager.aiCreateTodo('Plan task 1');
        const todo2 = await todoManager.aiCreateTodo('Plan task 2');
        AITodoManager.activePlan.todoItems = [todo1.id, todo2.id];
        
        // Check plan completion when not all tasks are complete
        let isComplete = await AITodoManager.isPlanComplete();
        if (!isComplete) {
            console.log('✅ Plan correctly identified as incomplete when tasks are pending');
        } else {
            console.error('❌ Plan incorrectly identified as complete when tasks are pending');
        }
        
        // Complete all tasks and check again
        await todoManager.aiUpdateTodoStatus(todo1.id, TodoStatus.COMPLETED);
        await todoManager.aiUpdateTodoStatus(todo2.id, TodoStatus.COMPLETED);
        
        isComplete = await AITodoManager.isPlanComplete();
        if (isComplete) {
            console.log('✅ Plan correctly identified as complete when all tasks are completed');
        } else {
            console.error('❌ Plan incorrectly identified as incomplete when all tasks are completed');
        }
        
        // Cleanup: Delete test todos
        await todoManager.deleteTodo(todo.id);
        await todoManager.deleteTodo(todo1.id);
        await todoManager.deleteTodo(todo2.id);
        
        console.log('\n=== Edge Case Tests Completed ===');
    } catch (error) {
        console.error('Error running edge case tests:', error);
    }
}

// Export the test function
export { runEdgeTests };