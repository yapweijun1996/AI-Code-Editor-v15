/**
 * Test Script for Task Management System
 * This script tests the functionality of both the complex and simplified task systems,
 * as well as the migration functionality.
 */

import { taskManager } from './task_manager.js';
import { simpleTaskManager } from './simple_task_manager.js';
import { todoListUI } from './todo_list_ui.js';
import { simpleTodoListUI } from './simple_todo_list_ui.js';
import { taskSystemIntegration } from './task_system_integration.js';
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
            // Initialize both task managers
            await this.testInitialization();
            
            // Test creating tasks in both systems
            await this.testTaskCreation();
            
            // Test updating tasks in both systems
            await this.testTaskUpdate();
            
            // Test migration functionality
            await this.testMigration();
            
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
     * Test initialization of both task managers
     */
    async testInitialization() {
        try {
            await taskManager.initialize();
            this.logResult('InitializeComplexTaskManager', true, 'Complex task manager initialized');
        } catch (error) {
            this.logResult('InitializeComplexTaskManager', false, `Failed to initialize complex task manager: ${error.message}`);
        }
        
        try {
            await simpleTaskManager.initialize();
            this.logResult('InitializeSimpleTaskManager', true, 'Simple task manager initialized');
        } catch (error) {
            this.logResult('InitializeSimpleTaskManager', false, `Failed to initialize simple task manager: ${error.message}`);
        }
        
        try {
            await taskSystemIntegration.initialize();
            this.logResult('InitializeIntegration', true, 'Task system integration initialized');
        } catch (error) {
            this.logResult('InitializeIntegration', false, `Failed to initialize integration: ${error.message}`);
        }
    }

    /**
     * Test creating tasks in both systems
     */
    async testTaskCreation() {
        // Test complex task manager
        try {
            const complexTask = await taskManager.createTask({
                title: 'Test Complex Task',
                description: 'This is a test task in the complex system',
                priority: 'high'
            });
            
            const complexTaskExists = taskManager.tasks.has(complexTask.id);
            this.logResult('CreateComplexTask', complexTaskExists, 
                complexTaskExists ? `Complex task created with ID: ${complexTask.id}` : 'Complex task not found after creation');
        } catch (error) {
            this.logResult('CreateComplexTask', false, `Failed to create complex task: ${error.message}`);
        }
        
        // Test simple task manager
        try {
            const simpleTask = await simpleTaskManager.createTask({
                title: 'Test Simple Task',
                description: 'This is a test task in the simplified system',
                priority: 'medium'
            });
            
            const simpleTaskExists = simpleTaskManager.tasks.has(simpleTask.id);
            this.logResult('CreateSimpleTask', simpleTaskExists, 
                simpleTaskExists ? `Simple task created with ID: ${simpleTask.id}` : 'Simple task not found after creation');
        } catch (error) {
            this.logResult('CreateSimpleTask', false, `Failed to create simple task: ${error.message}`);
        }
    }

    /**
     * Test updating tasks in both systems
     */
    async testTaskUpdate() {
        // Test complex task manager update
        try {
            // Find the task we created in the previous test
            const complexTasks = Array.from(taskManager.tasks.values())
                .filter(t => t.title === 'Test Complex Task');
            
            if (complexTasks.length === 0) {
                this.logResult('UpdateComplexTask', false, 'No complex test task found to update');
                return;
            }
            
            const complexTask = complexTasks[0];
            await taskManager.updateTask(complexTask.id, {
                status: 'completed',
                description: 'Updated description for complex task'
            });
            
            const updatedTask = taskManager.tasks.get(complexTask.id);
            const updateSuccessful = updatedTask && 
                updatedTask.status === 'completed' && 
                updatedTask.description === 'Updated description for complex task';
            
            this.logResult('UpdateComplexTask', updateSuccessful, 
                updateSuccessful ? 'Complex task updated successfully' : 'Complex task update failed');
        } catch (error) {
            this.logResult('UpdateComplexTask', false, `Failed to update complex task: ${error.message}`);
        }
        
        // Test simple task manager update
        try {
            // Find the task we created in the previous test
            const simpleTasks = Array.from(simpleTaskManager.tasks.values())
                .filter(t => t.title === 'Test Simple Task');
            
            if (simpleTasks.length === 0) {
                this.logResult('UpdateSimpleTask', false, 'No simple test task found to update');
                return;
            }
            
            const simpleTask = simpleTasks[0];
            await simpleTaskManager.updateTask(simpleTask.id, {
                status: 'in_progress',
                description: 'Updated description for simple task'
            });
            
            const updatedTask = simpleTaskManager.tasks.get(simpleTask.id);
            const updateSuccessful = updatedTask && 
                updatedTask.status === 'in_progress' && 
                updatedTask.description === 'Updated description for simple task';
            
            this.logResult('UpdateSimpleTask', updateSuccessful, 
                updateSuccessful ? 'Simple task updated successfully' : 'Simple task update failed');
        } catch (error) {
            this.logResult('UpdateSimpleTask', false, `Failed to update simple task: ${error.message}`);
        }
    }

    /**
     * Test migration functionality
     */
    async testMigration() {
        try {
            // Count tasks before migration
            const beforeComplexCount = taskManager.getAllTasks().length;
            const beforeSimpleCount = simpleTaskManager.getAllTasks().length;
            
            this.logResult('CountBeforeMigration', true, 
                `Before migration: Complex: ${beforeComplexCount} tasks, Simple: ${beforeSimpleCount} tasks`);
            
            // Run migration
            const migratedCount = await taskSystemIntegration.migrateData();
            
            // Count tasks after migration
            const afterComplexCount = taskManager.getAllTasks().length;
            const afterSimpleCount = simpleTaskManager.getAllTasks().length;
            
            const expectedSimpleCount = beforeSimpleCount + beforeComplexCount;
            const migrationSuccessful = afterSimpleCount >= expectedSimpleCount;
            
            this.logResult('MigrationCount', migrationSuccessful,
                `Migration reported ${migratedCount} tasks migrated. After migration: Complex: ${afterComplexCount}, Simple: ${afterSimpleCount}`);
            
            // Check that task titles were migrated correctly
            const complexTaskTitles = new Set(taskManager.getAllTasks().map(t => t.title));
            const simpleTaskTitles = new Set(simpleTaskManager.getAllTasks().map(t => t.title));
            
            let allTitlesMigrated = true;
            for (const title of complexTaskTitles) {
                if (!simpleTaskTitles.has(title)) {
                    allTitlesMigrated = false;
                    this.logResult('MigrationTitleCheck', false, `Task title "${title}" not found in migrated tasks`);
                }
            }
            
            if (allTitlesMigrated) {
                this.logResult('MigrationTitleCheck', true, 'All task titles successfully migrated');
            }
        } catch (error) {
            this.logResult('TestMigration', false, `Migration test failed: ${error.message}`);
        }
    }

    /**
     * Test UI toggling
     */
    testUIToggle() {
        try {
            // Test original UI
            todoListUI.show();
            const originalUIVisible = todoListUI.isVisible;
            this.logResult('ShowOriginalUI', originalUIVisible, 
                originalUIVisible ? 'Original UI shown successfully' : 'Failed to show original UI');
            
            todoListUI.hide();
            const originalUIHidden = !todoListUI.isVisible;
            this.logResult('HideOriginalUI', originalUIHidden, 
                originalUIHidden ? 'Original UI hidden successfully' : 'Failed to hide original UI');
            
            // Test simplified UI
            simpleTodoListUI.show();
            const simplifiedUIVisible = simpleTodoListUI.isVisible;
            this.logResult('ShowSimplifiedUI', simplifiedUIVisible, 
                simplifiedUIVisible ? 'Simplified UI shown successfully' : 'Failed to show simplified UI');
            
            simpleTodoListUI.hide();
            const simplifiedUIHidden = !simpleTodoListUI.isVisible;
            this.logResult('HideSimplifiedUI', simplifiedUIHidden, 
                simplifiedUIHidden ? 'Simplified UI hidden successfully' : 'Failed to hide simplified UI');
            
            // Test switching
            taskSystemIntegration.switchToSimplifiedUI();
            const switchedToSimplified = simpleTodoListUI.isVisible && !todoListUI.isVisible;
            this.logResult('SwitchToSimplifiedUI', switchedToSimplified,
                switchedToSimplified ? 'Successfully switched to simplified UI' : 'Failed to switch to simplified UI');
            
            taskSystemIntegration.switchToOriginalUI();
            const switchedToOriginal = todoListUI.isVisible && !simpleTodoListUI.isVisible;
            this.logResult('SwitchToOriginalUI', switchedToOriginal,
                switchedToOriginal ? 'Successfully switched to original UI' : 'Failed to switch to original UI');
            
            // Hide both UIs at the end
            todoListUI.hide();
            simpleTodoListUI.hide();
        } catch (error) {
            this.logResult('TestUIToggle', false, `UI toggle test failed: ${error.message}`);
        }
    }
}

// Create and export tester
export const taskSystemTester = new TaskSystemTester();

// Make it available globally
window.testTaskSystem = async () => {
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

// Run tests automatically when this script is loaded in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Development environment detected, running tests automatically in 2 seconds...');
    setTimeout(() => window.testTaskSystem(), 2000);
}