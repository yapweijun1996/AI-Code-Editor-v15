// AI Todo Manager - Handles integration between AI and Todo functionality
import { todoManager, TodoStatus } from './todo_manager.js';
import * as UI from './ui.js';

/**
 * AI Todo Manager - Provides functionality for AI to create and manage todo lists
 */
export const AITodoManager = {
    /**
     * Active todo plan information
     */
    activePlan: null,

    /**
     * Analyzes a user query to determine if it should be approached with a todo list
     * @param {string} query - The user's query text
     * @returns {Object} Analysis result with shouldCreateTodoList and reason properties
     */
    analyzeQuery(query) {
        // Keywords that suggest a task-based approach would be beneficial
        const taskKeywords = [
            'create', 'make', 'build', 'implement', 'develop', 'setup', 'configure',
            'organize', 'plan', 'optimize', 'improve', 'refactor', 'update', 'add',
            'step by step', 'todo', 'task list', 'checklist', 'roadmap'
        ];

        // Check if query is complex enough for a todo list approach
        const isComplex = query.length > 100 || query.split(' ').length > 15;
        
        // Check if query contains multiple distinct actions
        const actionCount = this._countDistinctActions(query);
        
        // Check if query matches task keywords
        const containsTaskKeywords = taskKeywords.some(keyword => 
            query.toLowerCase().includes(keyword)
        );
        
        // Determine if query would benefit from a todo approach
        const shouldCreateTodoList = (isComplex && containsTaskKeywords) || 
                                    (actionCount >= 3) || 
                                    query.toLowerCase().includes('todo');
        
        return {
            shouldCreateTodoList,
            reason: shouldCreateTodoList 
                ? `Query is ${isComplex ? 'complex' : 'simple'} with ${actionCount} actions and ${containsTaskKeywords ? 'contains' : 'lacks'} task keywords.`
                : 'Query is simple and direct, not requiring a todo list approach.'
        };
    },

    /**
     * Count the number of distinct actions/verbs in a query
     * This is a simple heuristic - a more sophisticated approach would use NLP
     * @param {string} query - The user query
     * @returns {number} Estimated number of distinct actions
     */
    _countDistinctActions(query) {
        // This is a simple heuristic - look for common verbs and action phrases
        const commonVerbs = [
            'create', 'make', 'build', 'implement', 'develop', 'update', 'add',
            'remove', 'delete', 'modify', 'change', 'fix', 'improve', 'optimize',
            'refactor', 'restructure', 'organize', 'configure', 'setup'
        ];
        
        let count = 0;
        const queryLower = query.toLowerCase();
        const sentences = queryLower.split(/[.!?]+/);
        
        // Count sentences as potential actions
        count += sentences.filter(s => s.trim().length > 0).length;
        
        // Count verbs as potential actions
        commonVerbs.forEach(verb => {
            if (queryLower.includes(verb)) count++;
        });
        
        // Normalize the count to avoid overestimation
        return Math.min(Math.ceil(count / 2), 10); // Cap at 10 to prevent extremes
    },

    /**
     * Generate a todo list plan based on user query
     * @param {string} query - The user's query
     * @param {string} aiResponse - The AI's initial analysis of the query
     * @returns {Promise<Array>} Array of generated todo items
     */
    async generateTodoList(query, aiResponse) {
        // Extract key goals and tasks from the AI response
        const tasks = this._extractTasksFromResponse(aiResponse);
        
        // Create todo items for each task
        const todoItems = [];
        
        for (const task of tasks) {
            try {
                const newTodo = await todoManager.aiCreateTodo(task, TodoStatus.PENDING);
                todoItems.push(newTodo);
            } catch (error) {
                console.error('Failed to create todo item:', error);
            }
        }
        
        // Create plan metadata
        this.activePlan = {
            query,
            startTime: Date.now(),
            todoItems: todoItems.map(item => item.id),
            currentTaskIndex: 0,
            status: 'active'
        };
        
        return todoItems;
    },

    /**
     * Extract tasks from AI response
     * @param {string} response - The AI's response text
     * @returns {Array<string>} Array of task descriptions
     */
    _extractTasksFromResponse(response) {
        // Handle empty or invalid response
        if (!response || typeof response !== 'string') {
            console.error('Invalid AI response for task extraction');
            return [];
        }
        
        const tasks = [];
        
        try {
            // Look for numbered lists (1. Task)
            const numberedListPattern = /\d+\.\s+([^\n]+)/g;
            let match;
            while ((match = numberedListPattern.exec(response)) !== null) {
                tasks.push(match[1].trim());
            }
            
            // Look for bullet points (• Task or - Task)
            const bulletListPattern = /[•\-]\s+([^\n]+)/g;
            while ((match = bulletListPattern.exec(response)) !== null) {
                tasks.push(match[1].trim());
            }
            
            // If no structured lists found, try to break by sentences
            if (tasks.length === 0) {
                const sentences = response.split(/[.!?]+/);
                for (const sentence of sentences) {
                    const trimmed = sentence.trim();
                    if (trimmed.length > 10 && /\b(need to|should|must|will|can|task|step)\b/i.test(trimmed)) {
                        tasks.push(trimmed);
                    }
                }
            }
            
            // If still no tasks found, create a generic task
            if (tasks.length === 0) {
                console.warn('No tasks could be extracted from AI response, using fallback');
                tasks.push('Review and implement solution');
            }
        } catch (error) {
            console.error('Error extracting tasks from AI response:', error);
            tasks.push('Review and implement solution');
        }
        
        return tasks;
    },

    /**
     * Update the status of a todo item and the active plan
     * @param {number} todoId - The ID of the todo item
     * @param {string} newStatus - The new status (from TodoStatus enum)
     * @param {string} aiComment - Optional AI comment about the update
     * @returns {Promise<Object>} The updated todo item
     */
    async updateTodoStatus(todoId, newStatus, aiComment = '') {
        try {
            // Validate the todoId exists
            const todoExists = await todoManager.getTodoById(todoId);
            if (!todoExists) {
                throw new Error(`Todo item with ID ${todoId} not found`);
            }
            
            // Validate the newStatus
            if (!Object.values(TodoStatus).includes(newStatus)) {
                throw new Error(`Invalid status: ${newStatus}`);
            }
            
            // Update the todo item status
            const updatedTodo = await todoManager.aiUpdateTodoStatus(todoId, newStatus);
            
            // If we have an active plan, update its metadata
            if (this.activePlan && this.activePlan.todoItems && this.activePlan.todoItems.includes(todoId)) {
                // If marking as completed, advance to next task
                if (newStatus === TodoStatus.COMPLETED) {
                    try {
                        // Find the next pending task
                        const allTodos = await todoManager.getAllTodos();
                        const planTodos = allTodos.filter(todo =>
                            this.activePlan.todoItems.includes(todo.id)
                        );
                        
                        if (planTodos.length === 0) {
                            console.warn('No todos found in active plan');
                            return updatedTodo;
                        }
                        
                        const pendingTasks = planTodos.filter(todo => todo.status === TodoStatus.PENDING);
                        if (pendingTasks.length > 0) {
                            // Mark the next task as in progress
                            const nextTask = pendingTasks[0];
                            await todoManager.aiUpdateTodoStatus(nextTask.id, TodoStatus.IN_PROGRESS);
                        } else {
                            // No more pending tasks, plan is complete
                            this.activePlan.status = 'completed';
                            this.activePlan.endTime = Date.now();
                        }
                    } catch (error) {
                        console.error('Error advancing to next task:', error);
                        // Continue anyway to return the updated todo
                    }
                }
            } else if (this.activePlan && (!this.activePlan.todoItems || !Array.isArray(this.activePlan.todoItems))) {
                console.error('Active plan has invalid todoItems array');
            }
            
            return updatedTodo;
        } catch (error) {
            console.error('Error updating todo status:', error);
            throw error;
        }
    },

    /**
     * Check if all todos in the active plan are completed
     * @returns {Promise<boolean>} True if plan is complete
     */
    async isPlanComplete() {
        try {
            if (!this.activePlan) return false;
            if (!this.activePlan.todoItems || !Array.isArray(this.activePlan.todoItems)) {
                console.error('Active plan has invalid todoItems array');
                return false;
            }
            if (this.activePlan.todoItems.length === 0) {
                console.warn('Active plan has no todo items');
                return false;
            }
            
            const allTodos = await todoManager.getAllTodos();
            const planTodos = allTodos.filter(todo => this.activePlan.todoItems.includes(todo.id));
            
            // If no todos found in the plan, something is wrong
            if (planTodos.length === 0) {
                console.warn('No todos found for active plan in database');
                return false;
            }
            
            // Check if all todos are completed
            return planTodos.every(todo => todo.status === TodoStatus.COMPLETED);
        } catch (error) {
            console.error('Error checking plan completion:', error);
            return false;
        }
    },

    /**
     * Generate a plan completion summary
     * @returns {Promise<string>} Summary text
     */
    async generatePlanSummary() {
        try {
            if (!this.activePlan) return 'No active plan to summarize.';
            
            // Validate that todoItems exists and is an array
            if (!this.activePlan.todoItems || !Array.isArray(this.activePlan.todoItems)) {
                return 'Unable to generate summary: Plan data is invalid.';
            }
            
            const allTodos = await todoManager.getAllTodos();
            const planTodos = allTodos.filter(todo =>
                this.activePlan.todoItems.includes(todo.id)
            );
            
            // Handle case where no todos are found
            if (planTodos.length === 0) {
                return 'Unable to generate summary: No todo items found for this plan.';
            }
            
            const completedCount = planTodos.filter(todo => todo.status === TodoStatus.COMPLETED).length;
            const totalTime = this.activePlan.endTime
                ? (this.activePlan.endTime - this.activePlan.startTime) / 1000
                : (Date.now() - this.activePlan.startTime) / 1000;
            
            let summary = `# Plan Completion Summary\n\n`;
            summary += `**Original Query:** ${this.activePlan.query || 'Unknown query'}\n\n`;
            
            // Guard against division by zero
            const completionPercentage = planTodos.length > 0
                ? Math.round(completedCount/planTodos.length*100)
                : 0;
                
            summary += `**Completion Rate:** ${completedCount}/${planTodos.length} tasks (${completionPercentage}%)\n`;
            summary += `**Total Time:** ${Math.round(totalTime)} seconds\n\n`;
            summary += `## Completed Tasks\n\n`;
            
            for (const todo of planTodos) {
                const statusEmoji = todo.status === TodoStatus.COMPLETED ? '✅' :
                                   todo.status === TodoStatus.IN_PROGRESS ? '⏳' : '⏱️';
                summary += `${statusEmoji} ${todo.text}\n`;
            }
            
            // Reset the active plan
            this.activePlan = null;
            
            return summary;
        } catch (error) {
            console.error('Error generating plan summary:', error);
            this.activePlan = null; // Reset on error too
            return 'An error occurred while generating the plan summary.';
        }
    },

    /**
     * Format AI responses for todo list interactions
     * @param {string} responseType - The type of response (initial, progress, completion)
     * @param {Array} todoItems - The todo items
     * @param {string} customMessage - Optional custom message
     * @returns {string} Formatted response
     */
    formatAIResponse(responseType, todoItems = [], customMessage = '') {
        let response = '';
        
        switch (responseType) {
            case 'initial':
                response = `# Task Planning\n\n`;
                response += `I'll help you accomplish this by breaking it down into manageable tasks:\n\n`;
                
                todoItems.forEach((todo, index) => {
                    response += `${index + 1}. ${todo.text}\n`;
                });
                
                response += `\n${customMessage}\n\nI'll work through these tasks one by one and keep you updated on progress.`;
                break;
                
            case 'progress':
                response = `# Task Progress Update\n\n`;
                
                const pendingTasks = todoItems.filter(todo => todo.status === TodoStatus.PENDING);
                const inProgressTasks = todoItems.filter(todo => todo.status === TodoStatus.IN_PROGRESS);
                const completedTasks = todoItems.filter(todo => todo.status === TodoStatus.COMPLETED);
                
                if (completedTasks.length > 0) {
                    response += `## Completed:\n`;
                    completedTasks.forEach(todo => response += `✅ ${todo.text}\n`);
                    response += `\n`;
                }
                
                if (inProgressTasks.length > 0) {
                    response += `## In Progress:\n`;
                    inProgressTasks.forEach(todo => response += `⏳ ${todo.text}\n`);
                    response += `\n`;
                }
                
                if (pendingTasks.length > 0) {
                    response += `## Pending:\n`;
                    pendingTasks.forEach(todo => response += `⏱️ ${todo.text}\n`);
                    response += `\n`;
                }
                
                response += customMessage;
                break;
                
            case 'completion':
                response = customMessage || '# All Tasks Completed\n\nAll planned tasks have been successfully completed.';
                break;
                
            default:
                response = customMessage;
        }
        
        return response;
    },

    /**
     * Reset any active plan and associated data
     */
    reset() {
        this.activePlan = null;
    }
};