/**
 * Unified Task Management System
 * Merges AI-driven task breakdown with a user-facing todo list.
 * This system serves as the single source of truth for all tasks,
 * whether created by the user or the AI.
 */
import { DbManager } from './db.js';

class TaskManager {
    constructor() {
        this.tasks = new Map();
        this.lists = new Map();
        this.currentListId = 'default';
        this.activeTask = null; // The task the AI is currently focused on
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
        if (!this.lists.has('default')) {
            this.lists.set('default', {
                id: 'default',
                name: 'My Tasks',
                createdTime: Date.now()
            });
        }

        this.isInitialized = true;
        console.log('[TaskManager] System initialized');
    }

    /**
     * Create a new task. Can be a main goal or a subtask.
     */
    async createTask(data) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const targetListId = data.listId || this.currentListId;

        const task = {
            id: taskId,
            listId: targetListId,
            title: data.title.trim(),
            description: (data.description || '').trim(),
            status: data.status || 'pending', // pending, in_progress, completed, failed, awaiting_approval
            priority: data.priority || 'medium', // low, medium, high, urgent
            confidence: data.confidence || 1.0, // 0.0 to 1.0
            dependencies: data.dependencies || [],
            subtasks: [],
            parentId: data.parentId || null,
            createdTime: Date.now(),
            updatedTime: Date.now(),
            startTime: null,
            completedTime: null,
            dueDate: data.dueDate || null,
            estimatedTime: data.estimatedTime || null,
            actualTime: null,
            tags: data.tags || [],
            notes: [],
            results: {} // To store outcomes
        };

        this.tasks.set(taskId, task);

        if (task.parentId && this.tasks.has(task.parentId)) {
            const parent = this.tasks.get(task.parentId);
            parent.subtasks.push(taskId);
        }

        await this.saveToStorage();
        this.notifyListeners('task_created', task);
        console.log(`[TaskManager] Created: "${task.title}"`);
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

        if (updates.status && updates.status !== oldStatus) {
            this.handleStatusChange(task, oldStatus);
        }

        await this.saveToStorage();
        this.notifyListeners('task_updated', task);
        return task;
    }

    /**
     * Handles the logic when a task's status changes.
     */
    handleStatusChange(task, oldStatus) {
        if (task.status === 'in_progress' && oldStatus !== 'in_progress') {
            task.startTime = Date.now();
            this.activeTask = task.id;
        } else if (task.status === 'completed' || task.status === 'failed') {
            task.completedTime = Date.now();
            if (this.activeTask === task.id) {
                this.activeTask = null;
            }
        }
    }

    /**
     * Delete a task and all its subtasks recursively.
     */
    async deleteTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        // Recursively delete subtasks
        for (const subtask_id of task.subtasks) {
            await this.deleteTask(subtask_id);
        }

        // Remove from parent's subtask list
        if (task.parentId && this.tasks.has(task.parentId)) {
            const parent = this.tasks.get(task.parentId);
            parent.subtasks = parent.subtasks.filter(id => id !== taskId);
        }

        this.tasks.delete(taskId);
        await this.saveToStorage();
        this.notifyListeners('task_deleted', task);
        console.log(`[TaskManager] Deleted: "${task.title}"`);
        return task;
    }

    /**
     * AI-driven function to break a main goal into subtasks.
     */
    async breakdownGoal(mainTask) {
        console.log(`[TaskManager] Breaking down goal: "${mainTask.title}"`);
        
        // Enhanced task patterns with more comprehensive coverage
        const taskPatterns = {
            'optimize|refactor|improve|enhance|performance': [
                { title: 'Analyze current implementation and identify issues', priority: 'high', description: 'Review existing code and performance bottlenecks' },
                { title: 'Plan optimization strategy', priority: 'high', description: 'Define approach and expected improvements' },
                { title: 'Implement optimizations', priority: 'high', description: 'Apply performance improvements and refactoring' },
                { title: 'Test and verify improvements', priority: 'medium', description: 'Validate that optimizations work correctly' },
                { title: 'Document changes and cleanup', priority: 'low', description: 'Update documentation and remove dead code' }
            ],
            'implement|create|add|build|develop': [
                { title: 'Analyze requirements and plan approach', priority: 'high', description: 'Understand what needs to be built and how' },
                { title: 'Set up project structure and files', priority: 'high', description: 'Create necessary files and directories' },
                { title: 'Implement core functionality', priority: 'high', description: 'Write the main logic and features' },
                { title: 'Add error handling and validation', priority: 'medium', description: 'Ensure robust error handling' },
                { title: 'Test implementation', priority: 'medium', description: 'Verify functionality works as expected' },
                { title: 'Update documentation', priority: 'low', description: 'Document the new functionality' }
            ],
            'fix|debug|resolve|repair|solve': [
                { title: 'Reproduce and understand the issue', priority: 'high', description: 'Identify the exact problem and conditions' },
                { title: 'Analyze root cause', priority: 'high', description: 'Find the underlying cause of the issue' },
                { title: 'Design and implement solution', priority: 'high', description: 'Create a fix for the identified problem' },
                { title: 'Test the fix thoroughly', priority: 'medium', description: 'Ensure the fix works and doesn\'t break anything' },
                { title: 'Add preventive measures', priority: 'medium', description: 'Add tests or checks to prevent regression' }
            ],
            'review|audit|analyze|examine|inspect': [
                { title: 'Gather and examine all relevant files', priority: 'high', description: 'Collect and review all related code/documents' },
                { title: 'Analyze structure and implementation', priority: 'high', description: 'Understand the current architecture and design' },
                { title: 'Identify issues and improvements', priority: 'medium', description: 'Document problems and potential enhancements' },
                { title: 'Provide recommendations', priority: 'medium', description: 'Suggest specific improvements and next steps' }
            ],
            'test|validate|verify|check': [
                { title: 'Plan testing strategy', priority: 'high', description: 'Define what and how to test' },
                { title: 'Create test cases', priority: 'high', description: 'Write comprehensive test scenarios' },
                { title: 'Execute tests', priority: 'medium', description: 'Run tests and collect results' },
                { title: 'Analyze results and report findings', priority: 'medium', description: 'Document test outcomes and issues found' }
            ]
        };

        const goalLower = mainTask.title.toLowerCase();
        let matchedPattern = [];
        let matchedKeyword = '';
        
        // Find the best matching pattern
        for (const [keyword, steps] of Object.entries(taskPatterns)) {
            if (keyword.split('|').some(k => goalLower.includes(k))) {
                matchedPattern = steps;
                matchedKeyword = keyword;
                break;
            }
        }

        // Fallback for unmatched patterns
        if (matchedPattern.length === 0) {
            matchedPattern = [
                { title: 'Analyze the task requirements', priority: 'high', description: 'Understand what needs to be done', confidence: 0.9 },
                { title: 'Execute the main task', priority: 'high', description: 'Perform the requested work', confidence: 0.8 },
                { title: 'Verify completion', priority: 'medium', description: 'Ensure the task was completed successfully', confidence: 0.95 }
            ];
        }

        console.log(`[TaskManager] Using pattern "${matchedKeyword}" for breakdown`);

        const subtasks = [];
        let prevTaskId = null;

        // Insert an approval task before implementation for critical operations
        const criticalKeywords = ['refactor', 'implement', 'create', 'add', 'build', 'develop', 'fix', 'delete', 'remove'];
        const isCritical = criticalKeywords.some(k => goalLower.includes(k));

        if (isCritical) {
            const approvalTask = await this.createTask({
                title: 'User Approval: Review and confirm the execution plan',
                description: `The AI has proposed a plan to "${mainTask.title}". Please review the subtasks and approve to proceed.`,
                priority: 'high',
                status: 'awaiting_approval',
                parentId: mainTask.id,
                listId: mainTask.listId,
                tags: ['ai-generated', 'approval']
            });
            subtasks.push(approvalTask);
            prevTaskId = approvalTask.id;
        }
        
        for (let i = 0; i < matchedPattern.length; i++) {
            const step = matchedPattern[i];
            const subtask = await this.createTask({
                title: step.title,
                description: step.description || '',
                priority: step.priority || 'medium',
                confidence: step.confidence || 0.9,
                parentId: mainTask.id,
                listId: mainTask.listId,
                dependencies: prevTaskId ? [prevTaskId] : [],
                tags: ['ai-generated', 'subtask']
            });
            subtasks.push(subtask);
            prevTaskId = subtask.id;
        }

        // Update parent task to show it has been broken down
        const breakdownNote = {
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: `Task broken down into ${subtasks.length} subtasks`,
            type: 'system',
            timestamp: Date.now()
        };
        
        mainTask.notes = mainTask.notes || [];
        mainTask.notes.push(breakdownNote);
        
        await this.updateTask(mainTask.id, {
            status: 'in_progress'
        });

        this.notifyListeners('tasks_updated', { mainTask, subtasks });
        console.log(`[TaskManager] Created ${subtasks.length} subtasks for "${mainTask.title}"`);
        return subtasks;
    }

    /**
     * Find the next logical task for the AI to execute.
     */
    getNextTask() {
        const pendingTasks = Array.from(this.tasks.values()).filter(t => t.status === 'pending' || t.status === 'awaiting_approval');
        
        // Sort by priority, then creation time
        const sortedTasks = pendingTasks.sort((a, b) => {
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            const priorityA = priorityOrder[a.priority] || 0;
            const priorityB = priorityOrder[b.priority] || 0;
            if (priorityB !== priorityA) return priorityB - priorityA;
            return a.createdTime - b.createdTime;
        });

        // Find the first task with all dependencies met
        for (const task of sortedTasks) {
            // If a task is awaiting approval, it is the next blocking task.
            if (task.status === 'awaiting_approval') {
                return task;
            }

            const deps = task.dependencies || [];
            const depsMet = deps.every(depId => {
                const depTask = this.tasks.get(depId);
                return depTask && depTask.status === 'completed';
            });

            if (depsMet) {
                return task;
            }
        }
        return null;
    }
    
    /**
     * Storage operations
     */
    async saveToStorage() {
        try {
            const data = {
                tasks: Array.from(this.tasks.entries()),
                lists: Array.from(this.lists.entries()),
                currentListId: this.currentListId,
            };
            await DbManager.saveSetting('taskManager_data', data);
        } catch (error) {
            console.error('[TaskManager] Save failed:', error);
        }
    }

    async loadFromStorage() {
        try {
            const data = await DbManager.getSetting('taskManager_data');
            if (!data) return;

            if (data.tasks) {
                this.tasks = new Map(data.tasks);
                // Ensure all tasks have required properties for backward compatibility
                for (const [taskId, task] of this.tasks) {
                    if (!task.tags) task.tags = [];
                    if (!task.notes) task.notes = [];
                    if (task.dueDate === undefined) task.dueDate = null;
                    if (task.estimatedTime === undefined) task.estimatedTime = null;
                    if (task.actualTime === undefined) task.actualTime = null;
                }
            }
            if (data.lists) this.lists = new Map(data.lists);
            if (data.currentListId) this.currentListId = data.currentListId;

            console.log(`[TaskManager] Loaded ${this.tasks.size} tasks and ${this.lists.size} lists.`);
        } catch (error) {
            console.error('[TaskManager] Load failed:', error);
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
                console.error('[TaskManager] Listener error:', error);
            }
        });
    }

    // --- Getters for UI ---
    getAllTasks(listId = null) {
        const targetListId = listId || this.currentListId;
        return Array.from(this.tasks.values()).filter(t => t.listId === targetListId);
    }
    
    getAllLists() {
        return Array.from(this.lists.values());
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
            failed: tasks.filter(t => t.status === 'failed').length,
            awaiting_approval: tasks.filter(t => t.status === 'awaiting_approval').length,
            overdue: tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'completed').length
        };
    }

    /**
     * Create a new list
     */
    async createList(data) {
        const listId = `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const list = {
            id: listId,
            name: data.name.trim(),
            description: (data.description || '').trim(),
            color: data.color || '#3498db',
            createdTime: Date.now(),
            updatedTime: Date.now()
        };

        this.lists.set(listId, list);
        await this.saveToStorage();
        this.notifyListeners('list_created', list);
        console.log(`[TaskManager] Created list: "${list.name}"`);
        return list;
    }

    /**
     * Set the current active list
     */
    async setCurrentList(listId) {
        if (!this.lists.has(listId)) {
            throw new Error(`List not found: ${listId}`);
        }
        
        this.currentListId = listId;
        await this.saveToStorage();
        this.notifyListeners('current_list_changed', { listId });
        console.log(`[TaskManager] Switched to list: ${listId}`);
    }

    /**
     * Add a note to a task
     */
    async addNote(taskId, content, type = 'user') {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        const note = {
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: content.trim(),
            type: type, // user, system, ai
            timestamp: Date.now()
        };

        if (!task.notes) task.notes = [];
        task.notes.push(note);
        task.updatedTime = Date.now();

        await this.saveToStorage();
        this.notifyListeners('task_updated', task);
        return note;
    }

    /**
     * Bulk update multiple tasks
     */
    async bulkUpdateTasks(taskIds, updates) {
        const updatedTasks = [];
        
        for (const taskId of taskIds) {
            const task = this.tasks.get(taskId);
            if (task) {
                const oldStatus = task.status;
                Object.assign(task, updates, { updatedTime: Date.now() });
                
                if (updates.status && updates.status !== oldStatus) {
                    this.handleStatusChange(task, oldStatus);
                }
                
                updatedTasks.push(task);
            }
        }

        await this.saveToStorage();
        this.notifyListeners('tasks_updated', updatedTasks);
        console.log(`[TaskManager] Bulk updated ${updatedTasks.length} tasks`);
        return updatedTasks;
    }

    /**
     * Bulk delete multiple tasks
     */
    async bulkDeleteTasks(taskIds) {
        const deletedTasks = [];
        
        for (const taskId of taskIds) {
            const task = this.tasks.get(taskId);
            if (task) {
                // Recursively delete subtasks
                for (const subtaskId of task.subtasks) {
                    await this.deleteTask(subtaskId);
                }

                // Remove from parent's subtask list
                if (task.parentId && this.tasks.has(task.parentId)) {
                    const parent = this.tasks.get(task.parentId);
                    parent.subtasks = parent.subtasks.filter(id => id !== taskId);
                }

                this.tasks.delete(taskId);
                deletedTasks.push(task);
            }
        }

        await this.saveToStorage();
        this.notifyListeners('tasks_deleted', deletedTasks);
        console.log(`[TaskManager] Bulk deleted ${deletedTasks.length} tasks`);
        return deletedTasks;
    }

    /**
     * Export tasks in various formats
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
                completed: tasks.filter(t => t.status === 'completed'),
                failed: tasks.filter(t => t.status === 'failed')
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
                        if ((task.tags || []).length > 0) meta.push(`Tags: ${(task.tags || []).map(t => `#${t}`).join(' ')}`);
                        
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

    /**
     * Import tasks from various formats
     */
    async importTasks(data, format = 'json') {
        const importedTasks = [];
        
        if (format === 'json') {
            try {
                const parsed = JSON.parse(data);
                const tasks = parsed.tasks || parsed; // Handle both wrapped and direct arrays
                
                for (const taskData of tasks) {
                    // Generate new IDs to avoid conflicts
                    const newTask = {
                        ...taskData,
                        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        listId: this.currentListId,
                        createdTime: Date.now(),
                        updatedTime: Date.now(),
                        parentId: null, // Reset parent relationships for now
                        subtasks: [],
                        notes: taskData.notes || []
                    };
                    
                    this.tasks.set(newTask.id, newTask);
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
        console.log(`[TaskManager] Imported ${importedTasks.length} tasks`);
        return importedTasks;
    }
}

// Create global instance
export const taskManager = new TaskManager();

// Export convenience methods for tool integration
export const TaskTools = {
    create: (data) => taskManager.createTask(data),
    update: (id, updates) => taskManager.updateTask(id, updates),
    delete: (id) => taskManager.deleteTask(id),
    breakdown: (task) => taskManager.breakdownGoal(task),
    getNext: () => taskManager.getNextTask(),
    getById: (id) => taskManager.tasks.get(id),
    getAll: (listId) => taskManager.getAllTasks(listId),
    replan: async (newTasks) => {
        for (const taskData of newTasks) {
            await taskManager.createTask(taskData);
        }
        return `Replanned and added ${newTasks.length} new tasks.`;
    }
};
