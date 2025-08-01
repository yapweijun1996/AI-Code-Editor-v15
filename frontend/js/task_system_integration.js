/**
 * Task Management System Integration
 * Provides integration between the old complex task management system
 * and the new simplified todo list implementation.
 */

import { taskManager } from './task_manager.js';
import { simpleTaskManager } from './simple_task_manager.js';
import { todoListUI } from './todo_list_ui.js';
import { simpleTodoListUI } from './simple_todo_list_ui.js';
import * as UI from './ui.js';

export class TaskSystemIntegration {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the integration
     */
    async initialize() {
        if (this.initialized) return;
        
        // Make sure both task managers are initialized
        await taskManager.initialize();
        await simpleTaskManager.initialize();
        
        this.initialized = true;
        console.log('[TaskSystemIntegration] Initialized');
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
}

// Create global instance
export const taskSystemIntegration = new TaskSystemIntegration();

// Register the simplified keyboard shortcut
taskSystemIntegration.registerSimplifiedShortcut();

// Add a toggle function to the window object for easy access
window.toggleSimplifiedTodoList = () => {
    simpleTodoListUI.toggle();
};

// Add a migration function to the window object
window.migrateToSimplifiedTaskSystem = async () => {
    try {
        const result = await taskSystemIntegration.transitionToSimplifiedSystem();
        return `Successfully migrated ${result} tasks to the simplified system.`;
    } catch (error) {
        return `Migration failed: ${error.message}`;
    }
};