/**
 * AI Task Management System
 * Allows AI agents to autonomously break down complex tasks into manageable subtasks,
 * track progress, and ensure systematic completion without getting lost.
 */

import { DbManager } from './db.js';
import * as UI from './ui.js';

export class AITaskManager {
    constructor() {
        this.currentSession = null;
        this.tasks = new Map();
        this.listeners = [];
    }

    /**
     * Start a new task session with automatic breakdown
     */
    async startTaskSession(mainGoal, context = {}) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.currentSession = {
            id: sessionId,
            mainGoal,
            context,
            startTime: Date.now(),
            status: 'active',
            totalTasks: 0,
            completedTasks: 0,
            currentTask: null
        };

        // Auto-breakdown the main goal into subtasks
        const subtasks = await this.analyzeAndBreakdownTask(mainGoal, context);
        
        for (const task of subtasks) {
            await this.addTask(task);
        }

        await this.saveSession();
        this.notifyListeners('session_started', this.currentSession);
        
        console.log(`🚀 AI Task Session Started: "${mainGoal}"`);
        console.log(`📋 Generated ${subtasks.length} subtasks`);
        
        return sessionId;
    }

    /**
     * Intelligent task breakdown using AI analysis
     */
    async analyzeAndBreakdownTask(mainGoal, context) {
        const taskPatterns = {
            // File processing patterns
            'optimize.*report.*performance': [
                { title: 'Analyze current report structure', priority: 'high', estimatedTime: 5 },
                { title: 'Identify performance bottlenecks (N+1 queries, loops)', priority: 'high', estimatedTime: 10 },
                { title: 'Refactor database queries for efficiency', priority: 'high', estimatedTime: 20 },
                { title: 'Optimize data processing logic', priority: 'medium', estimatedTime: 15 },
                { title: 'Test performance improvements', priority: 'medium', estimatedTime: 10 },
                { title: 'Document changes and best practices', priority: 'low', estimatedTime: 5 }
            ],
            
            // Code review patterns
            'review.*files.*improve': [
                { title: 'Get project structure and file inventory', priority: 'high', estimatedTime: 2 },
                { title: 'Identify critical files for review', priority: 'high', estimatedTime: 3 },
                { title: 'Analyze code quality and patterns', priority: 'high', estimatedTime: 15 },
                { title: 'Identify improvement opportunities', priority: 'medium', estimatedTime: 10 },
                { title: 'Implement priority improvements', priority: 'medium', estimatedTime: 20 },
                { title: 'Verify changes and run tests', priority: 'low', estimatedTime: 5 }
            ],

            // Feature implementation patterns
            'implement.*feature|add.*functionality': [
                { title: 'Understand requirements and scope', priority: 'high', estimatedTime: 5 },
                { title: 'Design system architecture', priority: 'high', estimatedTime: 10 },
                { title: 'Create core functionality', priority: 'high', estimatedTime: 20 },
                { title: 'Add user interface components', priority: 'medium', estimatedTime: 15 },
                { title: 'Implement error handling and validation', priority: 'medium', estimatedTime: 10 },
                { title: 'Write tests and documentation', priority: 'low', estimatedTime: 8 }
            ],

            // Debugging patterns
            'fix.*bug|debug.*issue': [
                { title: 'Reproduce and understand the issue', priority: 'high', estimatedTime: 10 },
                { title: 'Analyze error logs and stack traces', priority: 'high', estimatedTime: 5 },
                { title: 'Identify root cause', priority: 'high', estimatedTime: 15 },
                { title: 'Implement fix', priority: 'high', estimatedTime: 10 },
                { title: 'Test fix thoroughly', priority: 'medium', estimatedTime: 8 },
                { title: 'Update documentation if needed', priority: 'low', estimatedTime: 3 }
            ]
        };

        // Find matching pattern
        let matchedTasks = [];
        const goalLower = mainGoal.toLowerCase();
        
        for (const [pattern, tasks] of Object.entries(taskPatterns)) {
            if (new RegExp(pattern, 'i').test(goalLower)) {
                matchedTasks = [...tasks];
                break;
            }
        }

        // If no pattern matches, create generic breakdown
        if (matchedTasks.length === 0) {
            matchedTasks = [
                { title: 'Analyze the problem/requirement', priority: 'high', estimatedTime: 10 },
                { title: 'Plan the solution approach', priority: 'high', estimatedTime: 5 },
                { title: 'Implement the solution', priority: 'high', estimatedTime: 20 },
                { title: 'Test and validate results', priority: 'medium', estimatedTime: 10 },
                { title: 'Document changes', priority: 'low', estimatedTime: 5 }
            ];
        }

        // Enhance tasks with context-specific details
        return matchedTasks.map((task, index) => ({
            ...task,
            id: `task_${Date.now()}_${index}`,
            sessionId: this.currentSession?.id,
            status: 'pending',
            dependencies: index > 0 ? [`task_${Date.now()}_${index-1}`] : [],
            createdTime: Date.now(),
            context: context
        }));
    }

    /**
     * Add a new task to the current session
     */
    async addTask(taskData) {
        if (!this.currentSession) {
            throw new Error('No active task session. Call startTaskSession() first.');
        }

        const task = {
            id: taskData.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.currentSession.id,
            title: taskData.title,
            description: taskData.description || '',
            priority: taskData.priority || 'medium',
            status: taskData.status || 'pending',
            estimatedTime: taskData.estimatedTime || 10,
            actualTime: 0,
            dependencies: taskData.dependencies || [],
            context: taskData.context || {},
            createdTime: Date.now(),
            startTime: null,
            completedTime: null,
            notes: [],
            subTasks: []
        };

        this.tasks.set(task.id, task);
        this.currentSession.totalTasks++;
        
        await this.saveSession();
        this.notifyListeners('task_added', task);
        
        return task.id;
    }

    /**
     * Start working on the next available task
     */
    async startNextTask() {
        if (!this.currentSession) return null;

        // Find next available task (pending, no incomplete dependencies)
        const nextTask = this.findNextAvailableTask();
        if (!nextTask) return null;

        return await this.startTask(nextTask.id);
    }

    /**
     * Start working on a specific task
     */
    async startTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        if (task.status !== 'pending') {
            throw new Error(`Task ${taskId} is not in pending status: ${task.status}`);
        }

        // Check dependencies
        const incompleteDeps = task.dependencies.filter(depId => {
            const dep = this.tasks.get(depId);
            return !dep || dep.status !== 'completed';
        });

        if (incompleteDeps.length > 0) {
            throw new Error(`Task ${taskId} has incomplete dependencies: ${incompleteDeps.join(', ')}`);
        }

        task.status = 'in_progress';
        task.startTime = Date.now();
        this.currentSession.currentTask = taskId;

        await this.saveSession();
        this.notifyListeners('task_started', task);

        console.log(`🎯 Started Task: "${task.title}"`);
        return task;
    }

    /**
     * Complete a task with optional notes
     */
    async completeTask(taskId, notes = '', results = {}) {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        if (task.status !== 'in_progress') {
            console.warn(`Task ${taskId} is not in progress, but marking as completed anyway`);
        }

        task.status = 'completed';
        task.completedTime = Date.now();
        task.actualTime = task.startTime ? task.completedTime - task.startTime : 0;
        task.results = results;
        
        if (notes) {
            task.notes.push({
                type: 'completion',
                content: notes,
                timestamp: Date.now()
            });
        }

        this.currentSession.completedTasks++;
        this.currentSession.currentTask = null;

        await this.saveSession();
        this.notifyListeners('task_completed', task);

        console.log(`✅ Completed Task: "${task.title}" (${Math.round(task.actualTime / 1000)}s)`);
        
        // Auto-start next task if available
        const nextTask = await this.startNextTask();
        if (nextTask) {
            console.log(`🔄 Auto-starting next task: "${nextTask.title}"`);
        } else if (this.isSessionComplete()) {
            await this.completeSession();
        }

        return task;
    }

    /**
     * Add a note to a task
     */
    async addTaskNote(taskId, note, type = 'info') {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);

        task.notes.push({
            type,
            content: note,
            timestamp: Date.now()
        });

        await this.saveSession();
        this.notifyListeners('task_updated', task);
    }

    /**
     * Get current progress summary
     */
    getProgressSummary() {
        if (!this.currentSession) return null;

        const tasks = Array.from(this.tasks.values())
            .filter(t => t.sessionId === this.currentSession.id);

        const byStatus = {
            pending: tasks.filter(t => t.status === 'pending').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            blocked: tasks.filter(t => t.status === 'blocked').length
        };

        const progress = this.currentSession.totalTasks > 0 
            ? Math.round((byStatus.completed / this.currentSession.totalTasks) * 100)
            : 0;

        return {
            sessionId: this.currentSession.id,
            mainGoal: this.currentSession.mainGoal,
            progress,
            totalTasks: this.currentSession.totalTasks,
            byStatus,
            currentTask: this.currentSession.currentTask ? 
                this.tasks.get(this.currentSession.currentTask) : null,
            nextTask: this.findNextAvailableTask(),
            elapsedTime: Date.now() - this.currentSession.startTime
        };
    }

    /**
     * Find the next available task to work on
     */
    findNextAvailableTask() {
        const tasks = Array.from(this.tasks.values())
            .filter(t => t.sessionId === this.currentSession?.id && t.status === 'pending');

        // Sort by priority and dependencies
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        
        return tasks
            .filter(task => {
                // Check if all dependencies are completed
                return task.dependencies.every(depId => {
                    const dep = this.tasks.get(depId);
                    return dep && dep.status === 'completed';
                });
            })
            .sort((a, b) => {
                // Sort by priority first, then by creation time
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return a.createdTime - b.createdTime;
            })[0] || null;
    }

    /**
     * Check if current session is complete
     */
    isSessionComplete() {
        if (!this.currentSession) return false;
        return this.currentSession.completedTasks >= this.currentSession.totalTasks;
    }

    /**
     * Complete the current session
     */
    async completeSession() {
        if (!this.currentSession) return;

        this.currentSession.status = 'completed';
        this.currentSession.endTime = Date.now();
        this.currentSession.totalTime = this.currentSession.endTime - this.currentSession.startTime;

        await this.saveSession();
        this.notifyListeners('session_completed', this.currentSession);

        console.log(`🎉 Task Session Completed: "${this.currentSession.mainGoal}"`);
        console.log(`📊 Stats: ${this.currentSession.completedTasks}/${this.currentSession.totalTasks} tasks in ${Math.round(this.currentSession.totalTime / 1000)}s`);
    }

    /**
     * Save current session to storage
     */
    async saveSession() {
        if (!this.currentSession) return;

        const sessionData = {
            session: this.currentSession,
            tasks: Array.from(this.tasks.values())
                .filter(t => t.sessionId === this.currentSession.id)
        };

        await DbManager.saveSetting(`task_session_${this.currentSession.id}`, sessionData);
    }

    /**
     * Load a previous session
     */
    async loadSession(sessionId) {
        const sessionData = await DbManager.getSetting(`task_session_${sessionId}`);
        if (!sessionData) throw new Error(`Session not found: ${sessionId}`);

        this.currentSession = sessionData.session;
        this.tasks.clear();
        
        for (const task of sessionData.tasks) {
            this.tasks.set(task.id, task);
        }

        this.notifyListeners('session_loaded', this.currentSession);
        return this.currentSession;
    }

    /**
     * Get formatted progress report for UI display
     */
    getProgressReport() {
        const summary = this.getProgressSummary();
        if (!summary) return 'No active task session';

        const { progress, byStatus, currentTask, nextTask, elapsedTime } = summary;
        const elapsedMin = Math.round(elapsedTime / 60000);

        let report = `## 📋 Task Progress Report\n\n`;
        report += `**Goal:** ${summary.mainGoal}\n`;
        report += `**Progress:** ${progress}% (${byStatus.completed}/${summary.totalTasks} tasks)\n`;
        report += `**Elapsed Time:** ${elapsedMin} minutes\n\n`;

        if (currentTask) {
            report += `**🎯 Current Task:** ${currentTask.title}\n`;
        }

        if (nextTask) {
            report += `**⏭️ Next Task:** ${nextTask.title}\n`;
        }

        report += `\n**Status Breakdown:**\n`;
        report += `- ✅ Completed: ${byStatus.completed}\n`;
        report += `- 🔄 In Progress: ${byStatus.in_progress}\n`;
        report += `- ⏳ Pending: ${byStatus.pending}\n`;
        if (byStatus.blocked > 0) {
            report += `- 🚫 Blocked: ${byStatus.blocked}\n`;
        }

        return report;
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
                console.error('Task manager listener error:', error);
            }
        });
    }

    /**
     * Utility method to display progress in chat
     */
    async displayProgressInChat() {
        const report = this.getProgressReport();
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages && UI.appendMessage) {
            UI.appendMessage(chatMessages, report, 'ai');
        }
        return report;
    }
}

// Create global instance
export const aiTaskManager = new AITaskManager();

// Export convenience methods for tool integration
export const TaskManagerTools = {
    startSession: (goal, context) => aiTaskManager.startTaskSession(goal, context),
    addTask: (task) => aiTaskManager.addTask(task),
    startNext: () => aiTaskManager.startNextTask(),
    complete: (taskId, notes, results) => aiTaskManager.completeTask(taskId, notes, results),
    addNote: (taskId, note, type) => aiTaskManager.addTaskNote(taskId, note, type),
    getProgress: () => aiTaskManager.getProgressSummary(),
    getReport: () => aiTaskManager.getProgressReport(),
    displayProgress: () => aiTaskManager.displayProgressInChat()
};