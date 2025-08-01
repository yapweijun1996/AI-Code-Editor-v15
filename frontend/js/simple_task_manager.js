/**
 * Simplified Task Management System
 * Provides basic todo list functionality without the complexity
 * of AI-driven task breakdown and other advanced features.
 */
import { DbManager } from './db.js';

class SimpleTaskManager {
    constructor() {
        this.tasks = new Map();
        this.currentListId = 'default';
        this.listeners = [];
        this.isInitialized = false;
    }

    /**
     * Initialize the system from storage.
     */
    async initialize() {
        if (this.isInitialized) return;

        await this.loadFromStorage();

        // Ensure default list exists
        if (!this.tasks.has('default')) {
            this.createList({
                id: 'default',
                name: 'My Tasks',
            });
        }

        this.isInitialized = true;
        console.log('[SimpleTaskManager] System initialized');
    }

    /**
     * Create a new task.
     */
    async createTask(data) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const task = {
            id: taskId,
            listId: data.listId || this.currentListId,
            title: data.title.trim(),
            description: (data.description || '').trim(),
            status: data.status || 'pending', // pending, in_progress, completed
            priority: data.priority || 'medium', // low, medium, high, urgent
            createdTime: Date.now(),
            updatedTime: Date.now(),
            completedTime: null,
            dueDate: data.dueDate || null,
            tags: data.tags || []
        };

        this.tasks.set(taskId, task);
        await this.saveToStorage();
        this.notifyListeners('task_created', task);
        console.log(`[SimpleTaskManager] Created: "${task.title}"`);
        return task;
    }

    /**
     * Update an existing task.
     */
    async updateTask(taskId, updates) {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        const oldStatus = task.status;
        Object.assign(task, updates, { updatedTime: Date.now() });

        // Handle status changes
        if (updates.status && updates.status !== oldStatus) {
            if (updates.status === 'completed' && oldStatus !== 'completed') {
                task.completedTime = Date.now();
            }
        }

        await this.saveToStorage();
        this.notifyListeners('task_updated', task);
        return task;
    }

    /**
     * Delete a task.
     */
    async deleteTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        this.tasks.delete(taskId);
        await this.saveToStorage();
        this.notifyListeners('task_deleted', task);
        console.log(`[SimpleTaskManager] Deleted: "${task.title}"`);
        return task;
    }

    /**
     * Create a new list.
     */
    async createList(data) {
        const listId = data.id || `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const list = {
            id: listId,
            name: data.name.trim(),
            createdTime: Date.now()
        };

        // Store list data in a special task that represents the list
        const listTask = {
            id: listId,
            listId: 'system',
            title: list.name,
            description: 'List container',
            status: 'system',
            createdTime: Date.now(),
            updatedTime: Date.now(),
            isListContainer: true,
            listData: list
        };

        this.tasks.set(listId, listTask);
        await this.saveToStorage();
        this.notifyListeners('list_created', list);
        console.log(`[SimpleTaskManager] Created list: "${list.name}"`);
        return list;
    }

    /**
     * Set the current active list
     */
    async setCurrentList(listId) {
        const lists = this.getAllLists();
        const listExists = lists.some(list => list.id === listId);
        
        if (!listExists) {
            throw new Error(`List not found: ${listId}`);
        }
        
        this.currentListId = listId;
        await this.saveToStorage();
        this.notifyListeners('current_list_changed', { listId });
        console.log(`[SimpleTaskManager] Switched to list: ${listId}`);
    }

    /**
     * Storage operations
     */
    async saveToStorage() {
        try {
            const data = {
                tasks: Array.from(this.tasks.entries()),
                currentListId: this.currentListId,
            };
            await DbManager.saveSetting('simpleTaskManager_data', data);
        } catch (error) {
            console.error('[SimpleTaskManager] Save failed:', error);
        }
    }

    async loadFromStorage() {
        try {
            const data = await DbManager.getSetting('simpleTaskManager_data');
            if (!data) return;

            if (data.tasks) {
                this.tasks = new Map(data.tasks);
            }
            
            if (data.currentListId) {
                this.currentListId = data.currentListId;
            }

            console.log(`[SimpleTaskManager] Loaded ${this.tasks.size} tasks.`);
        } catch (error) {
            console.error('[SimpleTaskManager] Load failed:', error);
        }
    }

    /**
     * Event listener management
     */
    addEventListener(callback) {
        this.listeners.push(callback);
    }

    removeEventListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) this.listeners.splice(index, 1);
    }

    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('[SimpleTaskManager] Listener error:', error);
            }
        });
    }

    /**
     * Data access methods
     */
    getAllTasks(listId = null) {
        const targetListId = listId || this.currentListId;
        return Array.from(this.tasks.values())
            .filter(t => !t.isListContainer && t.listId === targetListId);
    }
    
    getAllLists() {
        return Array.from(this.tasks.values())
            .filter(t => t.isListContainer)
            .map(t => t.listData);
    }

    /**
     * Get statistics for current tasks
     */
    getStats(listId = null) {
        const tasks = this.getAllTasks(listId);
        const now = Date.now();
        
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            overdue: tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'completed').length
        };
    }

    /**
     * Bulk actions
     */
    async bulkUpdateTasks(taskIds, updates) {
        const updatedTasks = [];
        
        for (const taskId of taskIds) {
            const task = this.tasks.get(taskId);
            if (task) {
                const oldStatus = task.status;
                Object.assign(task, updates, { updatedTime: Date.now() });
                
                // Handle status changes
                if (updates.status && updates.status !== oldStatus) {
                    if (updates.status === 'completed' && oldStatus !== 'completed') {
                        task.completedTime = Date.now();
                    }
                }
                
                updatedTasks.push(task);
            }
        }

        await this.saveToStorage();
        this.notifyListeners('tasks_updated', updatedTasks);
        console.log(`[SimpleTaskManager] Bulk updated ${updatedTasks.length} tasks`);
        return updatedTasks;
    }

    async bulkDeleteTasks(taskIds) {
        const deletedTasks = [];
        
        for (const taskId of taskIds) {
            const task = this.tasks.get(taskId);
            if (task && !task.isListContainer) {
                this.tasks.delete(taskId);
                deletedTasks.push(task);
            }
        }

        await this.saveToStorage();
        this.notifyListeners('tasks_deleted', deletedTasks);
        console.log(`[SimpleTaskManager] Bulk deleted ${deletedTasks.length} tasks`);
        return deletedTasks;
    }

    /**
     * Export/Import functionality 
     */
    exportTasks(format = 'json', listId = null) {
        const tasks = this.getAllTasks(listId);
        
        if (format === 'json') {
            return JSON.stringify({
                exportDate: new Date().toISOString(),
                listId: listId || this.currentListId,
                tasks: tasks
            }, null, 2);
        } else if (format === 'markdown') {
            let md = `# Tasks Export\n\nExported on: ${new Date().toLocaleString()}\n\n`;
            
            const groupedTasks = {
                pending: tasks.filter(t => t.status === 'pending'),
                in_progress: tasks.filter(t => t.status === 'in_progress'),
                completed: tasks.filter(t => t.status === 'completed')
            };

            for (const [status, statusTasks] of Object.entries(groupedTasks)) {
                if (statusTasks.length > 0) {
                    md += `## ${status.replace('_', ' ').toUpperCase()}\n\n`;
                    
                    for (const task of statusTasks) {
                        const checkbox = status === 'completed' ? '[x]' : '[ ]';
                        md += `- ${checkbox} **${task.title}**\n`;
                        
                        if (task.description) {
                            md += `  ${task.description}\n`;
                        }
                        
                        const meta = [];
                        if (task.priority !== 'medium') meta.push(`Priority: ${task.priority}`);
                        if (task.dueDate) meta.push(`Due: ${new Date(task.dueDate).toLocaleDateString()}`);
                        if (task.tags.length > 0) meta.push(`Tags: ${task.tags.map(t => `#${t}`).join(' ')}`);
                        
                        if (meta.length > 0) {
                            md += `  *${meta.join(' • ')}*\n`;
                        }
                        
                        md += '\n';
                    }
                }
            }
            
            return md;
        }
        
        throw new Error(`Unsupported export format: ${format}`);
    }

    async importTasks(data, format = 'json') {
        const importedTasks = [];
        
        if (format === 'json') {
            try {
                const parsed = JSON.parse(data);
                const tasks = parsed.tasks || parsed; // Handle both wrapped and direct arrays
                
                for (const taskData of tasks) {
                    // Generate new IDs to avoid conflicts
                    const newTask = await this.createTask({
                        title: taskData.title,
                        description: taskData.description || '',
                        status: taskData.status || 'pending',
                        priority: taskData.priority || 'medium',
                        dueDate: taskData.dueDate,
                        tags: taskData.tags || []
                    });
                    
                    importedTasks.push(newTask);
                }
            } catch (error) {
                throw new Error(`Invalid JSON format: ${error.message}`);
            }
        } else if (format === 'markdown') {
            // Basic markdown parsing - extract tasks from lines starting with - [ ] or - [x]
            const lines = data.split('\n');
            
            for (const line of lines) {
                const match = line.match(/^-\s*\[([ x])\]\s*(.+)$/i);
                if (match) {
                    const [, checked, title] = match;
                    const status = checked.toLowerCase() === 'x' ? 'completed' : 'pending';
                    
                    const newTask = await this.createTask({
                        title: title.trim(),
                        status: status,
                        priority: 'medium'
                    });
                    
                    importedTasks.push(newTask);
                }
            }
        } else {
            throw new Error(`Unsupported import format: ${format}`);
        }

        await this.saveToStorage();
        this.notifyListeners('tasks_imported', importedTasks);
        console.log(`[SimpleTaskManager] Imported ${importedTasks.length} tasks`);
        return importedTasks;
    }
}

// Create global instance
export const simpleTaskManager = new SimpleTaskManager();

// Export convenience methods for tool integration
export const SimpleTasks = {
    create: (data) => simpleTaskManager.createTask(data),
    update: (id, updates) => simpleTaskManager.updateTask(id, updates),
    delete: (id) => simpleTaskManager.deleteTask(id),
    getById: (id) => simpleTaskManager.tasks.get(id),
    getAll: (listId) => simpleTaskManager.getAllTasks(listId)
};