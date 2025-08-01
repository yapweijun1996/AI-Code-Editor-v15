/**
 * Task Management System Integration
 * Provides complete replacement of the complex task management system
 * with the simplified todo list implementation.
 *
 * This module handles the migration of data and the transition to the
 * simplified system exclusively.
 */

import { taskManager } from './task_manager.js';
import { simpleTaskManager } from './simple_task_manager.js';
import { todoListUI } from './todo_list_ui.js';
import { simpleTodoListUI } from './simple_todo_list_ui.js';
import * as UI from './ui.js';

export class TaskSystemIntegration {
    constructor() {
        this.initialized = false;
        this.migrationComplete = false;
    }

    /**
     * Initialize the integration
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize only the necessary system based on migration status
            if (await this.isMigrationComplete()) {
                // If migration is complete, only initialize the simplified system
                await simpleTaskManager.initialize();
                this.migrationComplete = true;
                
                // Disable the complex system
                this.disableComplexSystem();
            } else {
                // If migration is not complete, initialize both systems
                await taskManager.initialize();
                await simpleTaskManager.initialize();
            }
            
            this.initialized = true;
            console.log('[TaskSystemIntegration] Initialized');
        } catch (error) {
            console.error('[TaskSystemIntegration] Initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Check if migration has been completed
     */
    async isMigrationComplete() {
        try {
            // Check a flag in localStorage to determine if migration is complete
            return localStorage.getItem('taskSystem_migrationComplete') === 'true';
        } catch (error) {
            console.error('[TaskSystemIntegration] Error checking migration status:', error);
            return false;
        }
    }
    
    /**
     * Set the migration status
     */
    async setMigrationComplete(complete = true) {
        try {
            localStorage.setItem('taskSystem_migrationComplete', complete ? 'true' : 'false');
            this.migrationComplete = complete;
            console.log(`[TaskSystemIntegration] Migration status set to: ${complete}`);
        } catch (error) {
            console.error('[TaskSystemIntegration] Error setting migration status:', error);
        }
    }

    /**
     * Migrate data from the complex task manager to the simplified version
     */
    async migrateData() {
        await this.initialize();
        
        try {
            console.log('[TaskSystemIntegration] Starting data migration...');
            
            // Migrate lists first
            const oldLists = taskManager.getAllLists();
            console.log(`[TaskSystemIntegration] Found ${oldLists.length} lists to migrate`);
            
            // Map of old list IDs to new list IDs
            const listIdMap = new Map();
            
            // Create default list mapping (both use 'default')
            listIdMap.set('default', 'default');
            
            // Migrate each list (except default which already exists)
            for (const oldList of oldLists) {
                if (oldList.id === 'default') continue;
                
                const newList = await simpleTaskManager.createList({
                    name: oldList.name
                });
                
                listIdMap.set(oldList.id, newList.id);
                console.log(`[TaskSystemIntegration] Migrated list: ${oldList.name}`);
            }
            
            // Set current list
            const currentListId = listIdMap.get(taskManager.currentListId) || 'default';
            await simpleTaskManager.setCurrentList(currentListId);
            
            // Migrate tasks (only top-level tasks, not subtasks)
            const allTasks = Array.from(taskManager.tasks.values())
                .filter(task => !task.parentId);
            
            console.log(`[TaskSystemIntegration] Found ${allTasks.length} top-level tasks to migrate`);
            
            let migratedCount = 0;
            for (const oldTask of allTasks) {
                try {
                    // Map the old list ID to the new list ID
                    const newListId = listIdMap.get(oldTask.listId) || 'default';
                    
                    // Skip system tasks and list containers
                    if (oldTask.status === 'system' || oldTask.isListContainer) continue;
                    
                    // Create new task with simplified data
                    await simpleTaskManager.createTask({
                        title: oldTask.title,
                        description: oldTask.description || '',
                        status: oldTask.status === 'failed' ? 'pending' : oldTask.status,
                        priority: oldTask.priority || 'medium',
                        dueDate: oldTask.dueDate,
                        tags: (oldTask.tags || []).slice(0, 5), // Limit to 5 tags
                        listId: newListId
                    });
                    
                    migratedCount++;
                } catch (error) {
                    console.error(`[TaskSystemIntegration] Error migrating task "${oldTask.title}":`, error);
                }
            }
            
            console.log(`[TaskSystemIntegration] Successfully migrated ${migratedCount} tasks`);
            return migratedCount;
        } catch (error) {
            console.error('[TaskSystemIntegration] Migration failed:', error);
            throw error;
        }
    }

    /**
     * Switch the UI from the old system to the new simplified system
     */
    switchToSimplifiedUI() {
        // Hide the old UI if it's visible
        if (todoListUI.isVisible) {
            todoListUI.hide();
        }
        
        // Show the new simplified UI
        simpleTodoListUI.show();
        
        console.log('[TaskSystemIntegration] Switched to simplified UI');
    }

    /**
     * Switch back to the original complex UI
     */
    switchToOriginalUI() {
        // Hide the simplified UI if it's visible
        if (simpleTodoListUI.isVisible) {
            simpleTodoListUI.hide();
        }
        
        // Show the original UI
        todoListUI.show();
        
        console.log('[TaskSystemIntegration] Switched to original UI');
    }

    /**
     * Complete transition to the simplified system
     * This migrates all data and shows the new UI
     */
    async transitionToSimplifiedSystem() {
        try {
            UI.showToast('Migrating task data...');
            
            // Migrate the data
            const migratedCount = await this.migrateData();
            
            // Switch to the new UI
            this.switchToSimplifiedUI();
            
            UI.showToast(`Migrated ${migratedCount} tasks to simplified system`);
            return migratedCount;
        } catch (error) {
            UI.showError(`Transition failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Register simplified todo list keyboard shortcut
     * This will use Alt+T instead of Ctrl+T to avoid conflict
     */
    registerSimplifiedShortcut() {
        document.addEventListener('keydown', (e) => {
            // Alt+T to toggle simplified todo list
            if (e.altKey && e.key === 't' && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                simpleTodoListUI.toggle();
            }
        });
        
        console.log('[TaskSystemIntegration] Registered Alt+T shortcut for simplified todo list');
    }
    /**
     * Disable the complex task management system completely
     * This function ensures the old system can no longer be activated
     */
    disableComplexSystem() {
        try {
            // Remove event listeners for the complex system
            this.removeComplexSystemKeyboardShortcuts();
            
            // Nullify the todoListUI toggle function to prevent it from being used
            if (window.todoListUI) {
                const originalToggle = window.todoListUI.toggle;
                window.todoListUI.toggle = () => {
                    console.log('[TaskSystemIntegration] Complex task system has been replaced. Using simplified system instead.');
                    simpleTodoListUI.toggle();
                };
                
                window.todoListUI.show = () => {
                    console.log('[TaskSystemIntegration] Complex task system has been replaced. Using simplified system instead.');
                    simpleTodoListUI.show();
                };
                
                // Block all methods that modify tasks
                window.todoListUI.handleSaveTask = () => {
                    console.log('[TaskSystemIntegration] Complex task system has been replaced. Using simplified system instead.');
                    return false;
                };
            }
            
            console.log('[TaskSystemIntegration] Complex task system disabled successfully');
        } catch (error) {
            console.error('[TaskSystemIntegration] Error disabling complex system:', error);
        }
    }
    
    /**
     * Remove keyboard shortcuts for the complex system
     */
    removeComplexSystemKeyboardShortcuts() {
        try {
            // Create a new replacement keyboard handler that redirects to the simplified system
            const replacementHandler = (e) => {
                // Intercept Ctrl+T for the complex system and redirect to the simplified system
                if (e.ctrlKey && e.key === 't' && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    console.log('[TaskSystemIntegration] Redirecting shortcut to simplified system');
                    simpleTodoListUI.toggle();
                }
            };
            
            // Replace the existing event listeners - we can't directly remove the old ones
            // so we add our interceptor that will run first
            document.addEventListener('keydown', replacementHandler, true);
            
            console.log('[TaskSystemIntegration] Complex system keyboard shortcuts redirected');
        } catch (error) {
            console.error('[TaskSystemIntegration] Error removing complex system shortcuts:', error);
        }
    }
    
    /**
     * Update keyboard shortcuts to use Ctrl+T for the simplified system
     */
    updateKeyboardShortcuts() {
        try {
            // Add Ctrl+T listener for the simplified system
            document.addEventListener('keydown', (e) => {
                // Ctrl+T to toggle simplified todo list
                if (e.ctrlKey && e.key === 't' && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                    simpleTodoListUI.toggle();
                }
            });
            
            console.log('[TaskSystemIntegration] Updated keyboard shortcuts to use Ctrl+T for simplified system');
        } catch (error) {
            console.error('[TaskSystemIntegration] Error updating keyboard shortcuts:', error);
        }
    }
    
    /**
     * Update entry points throughout the codebase
     * This replaces references to the complex system with the simplified one
     */
    updateSystemReferences() {
        try {
            // Replace global references
            if (window.taskManager) {
                // Create proxies that redirect to simpleTaskManager
                window.taskManager = new Proxy({}, {
                    get: function(target, prop) {
                        console.log(`[TaskSystemIntegration] Redirecting taskManager.${prop} to simpleTaskManager`);
                        return simpleTaskManager[prop];
                    }
                });
            }
            
            // Replace TodoListUI with SimpleTodoListUI
            if (window.todoListUI) {
                window.todoListUI = new Proxy({}, {
                    get: function(target, prop) {
                        console.log(`[TaskSystemIntegration] Redirecting todoListUI.${prop} to simpleTodoListUI`);
                        return simpleTodoListUI[prop];
                    }
                });
            }
            
            console.log('[TaskSystemIntegration] System references updated successfully');
            return true;
        } catch (error) {
            console.error('[TaskSystemIntegration] Error updating system references:', error);
            return false;
        }
    }
}

// Create global instance
export const taskSystemIntegration = new TaskSystemIntegration();

// Add a migration function to the window object
window.migrateToSimplifiedTaskSystem = async () => {
    try {
        // Perform the migration
        const result = await taskSystemIntegration.transitionToSimplifiedSystem();
        
        // Disable the complex system
        taskSystemIntegration.disableComplexSystem();
        
        // Update keyboard shortcuts
        taskSystemIntegration.updateKeyboardShortcuts();
        
        // Update system references
        taskSystemIntegration.updateSystemReferences();
        
        // Mark migration as complete
        await taskSystemIntegration.setMigrationComplete(true);
        
        return `Successfully migrated ${result} tasks to the simplified system. The complex system has been completely replaced.`;
    } catch (error) {
        return `Migration failed: ${error.message}`;
    }
};

// Alias for convenience - allows existing code to work while using the simplified system
window.toggleTodoList = () => simpleTodoListUI.toggle();