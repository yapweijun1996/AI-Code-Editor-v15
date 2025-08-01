/**
 * Test Script for Task Management System
 * This script tests the functionality of the simplified task management system.
 */

import { simpleTaskManager } from './simple_task_manager.js';
import { simpleTodoListUI } from './simple_todo_list_ui.js';
import * as UI from './ui.js';

class TaskSystemTester {
    constructor() {
        this.testResults = [];
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('========================================');
        console.log('STARTING TASK SYSTEM TESTS');
        console.log('========================================');
        
        try {
            // Test task manager
            await this.testInitialization();
            
            // Test creating tasks
            await this.testTaskCreation();
            
            // Test updating tasks
            await this.testTaskUpdate();
            
            // Test deleting tasks
            await this.testTaskDeletion();
            
            // Test list management
            await this.testListManagement();
            
            // Test UI toggling
            this.testUIToggle();
            
            // Log summary of results
            this.logTestSummary();
            
            return this.testResults;
        } catch (error) {
            console.error('Test suite failed:', error);
            this.logResult('TestSuite', false, `Test suite failed: ${error.message}`);
            return this.testResults;
        }
    }

    /**
     * Log test result
     */
    logResult(testName, passed, message) {
        const result = {
            test: testName,
            passed,
            message,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        if (passed) {
            console.log(`✅ PASS: ${testName} - ${message}`);
        } else {
            console.error(`❌ FAIL: ${testName} - ${message}`);
        }
        
        return result;
    }

    /**
     * Log test summary
     */
    logTestSummary() {
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.passed).length;
        const failed = total - passed;
        
        console.log('========================================');
        console.log(`TEST SUMMARY: ${passed}/${total} tests passed (${failed} failed)`);
        console.log('========================================');
        
        if (failed > 0) {
            console.log('Failed tests:');
            this.testResults.filter(r => !r.passed).forEach(r => {
                console.log(`- ${r.test}: ${r.message}`);
            });
        }
    }

    /**
     * Test initialization of task manager
     */
    async testInitialization() {
        try {
            await simpleTaskManager.initialize();
            this.logResult('InitializeTaskManager', true, 'Task manager initialized');
        } catch (error) {
            this.logResult('InitializeTaskManager', false, `Failed to initialize task manager: ${error.message}`);
        }
    }

    /**
     * Test creating tasks in the system
     */
    async testTaskCreation() {
        try {
            const task = await simpleTaskManager.createTask({
                title: 'Test Task',
                description: 'This is a test task in the system',
                priority: 'medium'
            });
            
            const taskExists = simpleTaskManager.tasks.has(task.id);
            this.logResult('CreateTask', taskExists,
                taskExists ? `Task created with ID: ${task.id}` : 'Task not found after creation');
        } catch (error) {
            this.logResult('CreateTask', false, `Failed to create task: ${error.message}`);
        }
    }

    /**
     * Test updating tasks in the system
     */
    async testTaskUpdate() {
        try {
            // Find the task we created in the previous test
            const tasks = Array.from(simpleTaskManager.tasks.values())
                .filter(t => t.title === 'Test Task');
            
            if (tasks.length === 0) {
                this.logResult('UpdateTask', false, 'No test task found to update');
                return;
            }
            
            const task = tasks[0];
            await simpleTaskManager.updateTask(task.id, {
                status: 'in_progress',
                description: 'Updated description for task'
            });
            
            const updatedTask = simpleTaskManager.tasks.get(task.id);
            const updateSuccessful = updatedTask &&
                updatedTask.status === 'in_progress' &&
                updatedTask.description === 'Updated description for task';
            
            this.logResult('UpdateTask', updateSuccessful,
                updateSuccessful ? 'Task updated successfully' : 'Task update failed');
        } catch (error) {
            this.logResult('UpdateTask', false, `Failed to update task: ${error.message}`);
        }
    }

    /**
     * Test task deletion
     */
    async testTaskDeletion() {
        try {
            // Find the task we created in the previous test
            const tasks = Array.from(simpleTaskManager.tasks.values())
                .filter(t => t.title === 'Test Task');
            
            if (tasks.length === 0) {
                this.logResult('DeleteTask', false, 'No test task found to delete');
                return;
            }
            
            const task = tasks[0];
            await simpleTaskManager.deleteTask(task.id);
            
            const taskExists = simpleTaskManager.tasks.has(task.id);
            this.logResult('DeleteTask', !taskExists,
                !taskExists ? 'Task deleted successfully' : 'Task still exists after deletion');
            
            if (!taskExists) {
                // Create a new task for other tests
                await simpleTaskManager.createTask({
                    title: 'Test Task',
                    description: 'This is a new test task',
                    priority: 'medium'
                });
            }
        } catch (error) {
            this.logResult('DeleteTask', false, `Failed to delete task: ${error.message}`);
        }
    }

    /**
     * Test UI toggling
     */
    testUIToggle() {
        try {
            // Test UI
            simpleTodoListUI.show();
            const uiVisible = simpleTodoListUI.isVisible;
            this.logResult('ShowUI', uiVisible,
                uiVisible ? 'UI shown successfully' : 'Failed to show UI');
            
            simpleTodoListUI.hide();
            const uiHidden = !simpleTodoListUI.isVisible;
            this.logResult('HideUI', uiHidden,
                uiHidden ? 'UI hidden successfully' : 'Failed to hide UI');
            
            // Hide UI at the end
            simpleTodoListUI.hide();
        } catch (error) {
            this.logResult('TestUIToggle', false, `UI toggle test failed: ${error.message}`);
        }
    }
    
    /**
     * Test list creation and management
     */
    async testListManagement() {
        try {
            // Create a test list
            const listName = "Test List " + Date.now();
            const list = await simpleTaskManager.createList({
                name: listName
            });
            
            const lists = simpleTaskManager.getAllLists();
            const listExists = lists.some(l => l.id === list.id);
            
            this.logResult('CreateList', listExists,
                listExists ? `List created successfully: ${listName}` : 'List creation failed');
                
            // Test switching to the list
            if (listExists) {
                await simpleTaskManager.setCurrentList(list.id);
                const currentList = simpleTaskManager.currentListId;
                
                this.logResult('SwitchList', currentList === list.id,
                    currentList === list.id ? 'Successfully switched to new list' : 'Failed to switch to new list');
            }
        } catch (error) {
            this.logResult('TestListManagement', false, `List management test failed: ${error.message}`);
        }
    }
}

// Create and export tester
export const taskSystemTester = new TaskSystemTester();

// Make it available globally
window.testSystem = async () => {
    try {
        UI.showToast('Running task system tests...');
        const results = await taskSystemTester.runAllTests();
        const passedCount = results.filter(r => r.passed).length;
        const totalCount = results.length;
        
        if (passedCount === totalCount) {
            UI.showToast(`All ${totalCount} tests passed!`);
        } else {
            UI.showError(`${passedCount}/${totalCount} tests passed. Check console for details.`);
        }
        
        return `${passedCount}/${totalCount} tests passed`;
    } catch (error) {
        UI.showError(`Test execution failed: ${error.message}`);
        return `Test execution failed: ${error.message}`;
    }
};