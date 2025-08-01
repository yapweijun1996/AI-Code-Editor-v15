// AI Todo Manager - Handles integration between AI and Todo functionality
import { todoManager, TodoStatus } from './todo_manager.js';
import * as UI from './ui.js';
import { errorHandler, ErrorCategory, ErrorSeverity, logAIServiceError } from './core/error_handler.js';

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
     * Uses Claude Code's superior logic: simple, context-aware, proactive
     * @param {string} query - The user's query text
     * @returns {Object} Analysis result with shouldCreateTodoList and reason properties
     */
    analyzeQuery(query) {
        if (!query || typeof query !== 'string') {
            return { shouldCreateTodoList: false, reason: 'Invalid query input' };
        }

        const queryLower = query.toLowerCase().trim();
        const words = queryLower.split(/\s+/);
        const sentences = query.split(/[.!?]+/).filter(s => s.trim());
        
        // 1. Explicit todo requests
        if (queryLower.match(/\b(todo|task list|checklist|plan|step by step|break.*down)\b/)) {
            return {
                shouldCreateTodoList: true,
                reason: 'User explicitly requested task planning'
            };
        }
        
        // 2. Multiple tasks pattern (comma-separated or numbered)
        const hasMultipleTasks = queryLower.match(/\d+[.)]/g) || 
                                queryLower.includes(' and ') ||
                                (queryLower.split(',').length > 2);
        
        if (hasMultipleTasks) {
            return {
                shouldCreateTodoList: true,
                reason: 'Query contains multiple distinct tasks'
            };
        }
        
        // 3. Complex multi-step tasks (3+ distinct actions)
        const actionVerbs = queryLower.match(/\b(create|build|implement|develop|setup|configure|install|deploy|test|optimize|refactor|update|add|remove|fix|improve|analyze|design|integrate)\b/g) || [];
        const uniqueActions = [...new Set(actionVerbs)];
        
        if (uniqueActions.length >= 3) {
            return {
                shouldCreateTodoList: true,
                reason: `Query contains ${uniqueActions.length} distinct actions requiring systematic approach`
            };
        }
        
        // 4. Non-trivial technical tasks
        const technicalIndicators = queryLower.match(/\b(api|database|component|module|system|architecture|algorithm|framework|library|schema|endpoint|integration|performance|security|testing|deployment)\b/g) || [];
        const complexityIndicators = words.length > 20 || sentences.length > 2;
        
        if (technicalIndicators.length >= 2 && (complexityIndicators || uniqueActions.length >= 2)) {
            return {
                shouldCreateTodoList: true,
                reason: 'Complex technical task requiring systematic breakdown'
            };
        }
        
        // 5. Feature implementation requests
        const featurePatterns = [
            /implement.*feature/,
            /build.*(application|app|system)/,
            /create.*(application|app|system|website|web)/,
            /develop.*(solution|application|app|system)/,
            /add.*functionality/,
            /(create|build|develop|implement).*(web|mobile|desktop).*(app|application)/
        ];
        
        if (featurePatterns.some(pattern => pattern.test(queryLower))) {
            return {
                shouldCreateTodoList: true,
                reason: 'Feature implementation requires structured approach'
            };
        }
        
        // Default: simple, direct tasks don't need todo lists
        return {
            shouldCreateTodoList: false,
            reason: 'Query is straightforward and can be handled directly'
        };
    },

    /**
     * Intelligently break down a query into actionable tasks
     * Based on Claude Code's approach: context-aware, specific, manageable
     * @param {string} query - The user query
     * @param {string} aiResponse - Optional AI analysis to extract tasks from
     * @returns {Array<string>} Array of specific, actionable tasks
     */
    _intelligentTaskBreakdown(query, aiResponse = '') {
        const tasks = [];
        const queryLower = query.toLowerCase();
        
        // 1. Extract from explicit numbered/bulleted lists in query or AI response
        const textToAnalyze = (aiResponse + ' ' + query).replace(/\n/g, ' ');
        const numberedTasks = textToAnalyze.match(/\d+[.)][^\d.]+/g) || [];
        const bulletedTasks = textToAnalyze.match(/[•\-*][^•\-*\n]+/g) || [];
        
        [...numberedTasks, ...bulletedTasks].forEach(task => {
            const cleanTask = task.replace(/^[\d.)•\-*\s]+/, '').trim();
            if (cleanTask.length > 10) {
                tasks.push(cleanTask);
            }
        });
        
        // 2. If no structured tasks found, create logical breakdown
        if (tasks.length === 0) {
            // Feature implementation pattern
            if (queryLower.match(/\b(build|create|implement|develop)\b.*\b(app|application|system|feature|component)\b/)) {
                const subject = queryLower.match(/\b(build|create|implement|develop)\s+(?:a\s+)?([^,.\n]+)/)?.[2] || 'the feature';
                tasks.push(`Plan and design ${subject}`);
                tasks.push(`Implement core functionality`);
                tasks.push(`Add styling and user interface`);
                tasks.push(`Test and validate implementation`);
            }
            // API/Integration pattern
            else if (queryLower.match(/\b(api|endpoint|integration|database)\b/)) {
                tasks.push('Design data structure and API endpoints');
                tasks.push('Implement backend/database logic');
                tasks.push('Create frontend interaction');
                tasks.push('Test integration and error handling');
            }
            // Bug fix pattern
            else if (queryLower.match(/\b(fix|debug|resolve|solve)\b/)) {
                tasks.push('Analyze and reproduce the issue');
                tasks.push('Identify root cause');
                tasks.push('Implement fix');
                tasks.push('Test and verify solution');
            }
            // Optimization pattern
            else if (queryLower.match(/\b(optimize|improve|enhance|refactor)\b/)) {
                tasks.push('Analyze current implementation');
                tasks.push('Identify improvement opportunities');
                tasks.push('Implement optimizations');
                tasks.push('Measure and validate improvements');
            }
            // Generic multi-action pattern
            else {
                const actions = queryLower.match(/\b(create|build|implement|develop|setup|configure|install|deploy|test|optimize|refactor|update|add|remove|fix|improve|analyze|design|integrate)\b/g) || [];
                if (actions.length >= 2) {
                    actions.forEach(action => {
                        tasks.push(`${action.charAt(0).toUpperCase() + action.slice(1)} the required components`);
                    });
                } else {
                    // Fallback: single comprehensive task
                    tasks.push(`Complete the requested task: ${query}`);
                }
            }
        }
        
        // 3. Ensure tasks are specific and actionable
        return tasks.filter(task => task.length > 5).slice(0, 8); // Limit to 8 tasks max
    },

    /**
     * Generate a todo list plan based on user query
     * Uses intelligent task breakdown for better planning
     * @param {string} query - The user's query
     * @param {string} aiResponse - The AI's initial analysis of the query
     * @returns {Promise<Array>} Array of generated todo items
     */
    async generateTodoList(query, aiResponse) {
        // Use intelligent task breakdown instead of simple extraction
        const tasks = this._intelligentTaskBreakdown(query, aiResponse);
        
        // Create todo items for each task
        const todoItems = [];
        
        for (const task of tasks) {
            try {
                const newTodo = await todoManager.aiCreateTodo(task, TodoStatus.PENDING);
                todoItems.push(newTodo);
            } catch (error) {
                console.error('Failed to create todo item:', error);
                logAIServiceError(error, {
                    context: 'generateTodoList',
                    task: task,
                    severity: ErrorSeverity.MEDIUM
                });
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
            logAIServiceError(error, {
                context: '_extractTasksFromResponse',
                responseLength: response?.length || 0,
                severity: ErrorSeverity.MEDIUM
            });
            tasks.push('Review and implement solution');
        }
        
        return tasks;
    },

    /**
     * Ensure only one task is in progress at a time (Claude Code pattern)
     * @param {number} newInProgressId - ID of task to set as in progress
     * @returns {Promise<void>}
     */
    async _ensureSingleInProgressTask(newInProgressId) {
        if (!this.activePlan?.todoItems) return;
        
        const allTodos = todoManager.getAllTodos();
        const planTodos = allTodos.filter(todo => 
            this.activePlan.todoItems.includes(todo.id) && 
            todo.id !== newInProgressId &&
            todo.status === TodoStatus.IN_PROGRESS
        );
        
        // Set other in-progress tasks back to pending
        for (const todo of planTodos) {
            await todoManager.aiUpdateTodoStatus(todo.id, TodoStatus.PENDING);
        }
    },

    /**
     * Update the status of a todo item and the active plan
     * Follows Claude Code pattern: only one task in progress at a time
     * @param {number} todoId - The ID of the todo item
     * @param {string} newStatus - The new status (from TodoStatus enum)
     * @param {string} aiComment - Optional AI comment about the update
     * @returns {Promise<Object>} The updated todo item
     */
    async updateTodoStatus(todoId, newStatus, aiComment = '') {
        try {
            // Validate the todoId exists using the proper TodoManager API
            // TodoManager doesn't have getTodoById, so we use getAllTodos and find instead
            const allTodos = await todoManager.getAllTodos();
            const todoExists = allTodos.find(todo => todo.id === todoId);
            
            if (!todoExists) {
                console.error(`Todo item with ID ${todoId} not found`);
                throw new Error(`Todo item with ID ${todoId} not found`);
            }
            
            // Validate the newStatus
            if (!Object.values(TodoStatus).includes(newStatus)) {
                throw new Error(`Invalid status: ${newStatus}`);
            }
            
            // Ensure only one task is in progress at a time
            if (newStatus === TodoStatus.IN_PROGRESS) {
                await this._ensureSingleInProgressTask(todoId);
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
                        logAIServiceError(error, {
                            context: 'updateTodoStatus_nextTask',
                            todoId: todoId,
                            severity: ErrorSeverity.MEDIUM
                        });
                        // Continue anyway to return the updated todo
                    }
                }
            } else if (this.activePlan && (!this.activePlan.todoItems || !Array.isArray(this.activePlan.todoItems))) {
                console.error('Active plan has invalid todoItems array');
            }
            
            return updatedTodo;
        } catch (error) {
            console.error('Error updating todo status:', error);
            // Log detailed error information to console
            console.error(`[ERROR] updateTodoStatus details:`, {
                todoId,
                requestedStatus: newStatus,
                errorMessage: error.message,
                errorStack: error.stack,
                activePlan: this.activePlan ? {
                    todoItems: this.activePlan.todoItems,
                    status: this.activePlan.status
                } : 'No active plan'
            });
            
            // Log to central error handling system
            logAIServiceError(error, {
                context: 'updateTodoStatus',
                todoId: todoId,
                requestedStatus: newStatus,
                hasPlan: !!this.activePlan,
                severity: ErrorSeverity.HIGH
            });
            
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
            logAIServiceError(error, {
                context: 'isPlanComplete',
                planStatus: this.activePlan?.status || 'No plan',
                todoItems: this.activePlan?.todoItems?.length || 0,
                severity: ErrorSeverity.MEDIUM
            });
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
            logAIServiceError(error, {
                context: 'generatePlanSummary',
                planStatus: this.activePlan?.status || 'No plan',
                todoCount: this.activePlan?.todoItems?.length || 0,
                severity: ErrorSeverity.MEDIUM
            });
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
                const errorTasks = todoItems.filter(todo => todo.status === TodoStatus.ERROR);
                
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
                
                if (errorTasks.length > 0) {
                    response += `## Failed Tasks:\n`;
                    errorTasks.forEach(todo => response += `❌ ${todo.text} (Click retry in the sidebar)\n`);
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
                
            case 'error':
                response = `# Task Execution Error\n\n`;
                response += `I encountered an error while executing the current task. ${customMessage}\n\n`;
                response += `You can:\n`;
                response += `1. Retry the current task\n`;
                response += `2. Skip to the next task\n`;
                response += `3. Provide more details to help me complete this task\n\n`;
                
                // Add current progress summary if we have todo items
                if (todoItems && todoItems.length > 0) {
                    const completedTasks = todoItems.filter(todo => todo.status === TodoStatus.COMPLETED);
                    const totalTasks = todoItems.length;
                    response += `Current progress: ${completedTasks.length}/${totalTasks} tasks completed.`;
                }
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
    },
    
    /**
     * Retry a failed todo task
     * @param {number} todoId - The ID of the failed todo item to retry
     * @returns {Promise<boolean>} Success status of the retry operation
     */
    async retryFailedTask(todoId) {
        try {
            console.log(`[DEBUG] Retrying failed task: ${todoId}`);
            
            // Validate the todoId exists
            const allTodos = await todoManager.getAllTodos();
            const todoItem = allTodos.find(todo => todo.id === todoId);
            
            if (!todoItem) {
                console.error(`Todo item with ID ${todoId} not found for retry`);
                return false;
            }
            
            // Only retry tasks that are in ERROR status
            if (todoItem.status !== TodoStatus.ERROR) {
                console.warn(`Cannot retry task ${todoId} because it's not in ERROR status (current: ${todoItem.status})`);
                return false;
            }
            
            // Update status to IN_PROGRESS to retry
            await this.updateTodoStatus(todoId, TodoStatus.IN_PROGRESS, "Retrying task after failure");
            
            // Return success
            return true;
        } catch (error) {
            console.error(`[ERROR] Failed to retry task ${todoId}:`, error);
            console.error(`[ERROR] Stack trace:`, error.stack);
            
            logAIServiceError(error, {
                context: 'retryFailedTask',
                todoId: todoId,
                severity: ErrorSeverity.HIGH
            });
            
            return false;
        }
    },
    
    /**
     * Skip a failed todo task and move to the next task
     * @param {number} todoId - The ID of the failed todo item to skip
     * @returns {Promise<boolean>} Success status of the skip operation
     */
    async skipFailedTask(todoId) {
        try {
            console.log(`[DEBUG] Skipping failed task: ${todoId}`);
            
            // Validate the todoId exists
            const allTodos = await todoManager.getAllTodos();
            const todoItem = allTodos.find(todo => todo.id === todoId);
            
            if (!todoItem) {
                console.error(`Todo item with ID ${todoId} not found for skipping`);
                return false;
            }
            
            // Update the active plan to mark the task as skipped
            if (this.activePlan && this.activePlan.todoItems) {
                // Find the next pending task
                const planTodos = allTodos.filter(todo =>
                    this.activePlan.todoItems.includes(todo.id) &&
                    todo.status === TodoStatus.PENDING
                );
                
                if (planTodos.length > 0) {
                    // Move to the next task
                    const nextTask = planTodos[0];
                    await todoManager.aiUpdateTodoStatus(nextTask.id, TodoStatus.IN_PROGRESS);
                    console.log(`[DEBUG] Moving to next task: ${nextTask.id} - ${nextTask.text}`);
                    
                    // Maintain the error status on the skipped task for reference
                    return true;
                } else {
                    console.warn(`No pending tasks available to move to after skipping ${todoId}`);
                    return false;
                }
            } else {
                console.warn(`No active plan to update when skipping task ${todoId}`);
                return false;
            }
        } catch (error) {
            console.error(`[ERROR] Failed to skip task ${todoId}:`, error);
            console.error(`[ERROR] Stack trace:`, error.stack);
            
            logAIServiceError(error, {
                context: 'skipFailedTask',
                todoId: todoId,
                severity: ErrorSeverity.MEDIUM
            });
            
            return false;
        }
    }
};