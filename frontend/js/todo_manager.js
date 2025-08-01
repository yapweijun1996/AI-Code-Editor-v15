// TodoManager.js - Handles Todo list functionality with CRUD operations
import { DbManager } from './db.js';

/**
 * TodoStatus - Enum for todo item statuses
 */
export const TodoStatus = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    ERROR: 'error'
};

/**
 * Class to manage Todo items with CRUD operations
 */
export class TodoManager {
    constructor() {
        this.todos = [];
        this.listeners = [];
    }

    /**
     * Initialize the TodoManager by loading todos from the database
     */
    async initialize() {
        try {
            this.todos = await DbManager.getAllTodos();
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('Failed to initialize TodoManager:', error);
            return false;
        }
    }

    /**
     * Get all todo items
     * @returns {Array} Array of todo items
     */
    getAllTodos() {
        return [...this.todos];
    }

    /**
     * Create a new todo item
     * @param {string} text - The text content of the todo item
     * @returns {Promise<Object>} The created todo item
     */
    async createTodo(text) {
        // Validate input - don't allow empty text
        if (!text || text.trim() === '') {
            const error = new Error('Todo text cannot be empty');
            console.error('Failed to create todo:', error);
            throw error;
        }
        
        const todoItem = {
            text,
            status: TodoStatus.PENDING,
            timestamp: Date.now()
        };

        try {
            const id = await DbManager.addTodo(todoItem);
            const newTodo = { ...todoItem, id };
            this.todos.push(newTodo);
            this.notifyListeners();
            return newTodo;
        } catch (error) {
            console.error('Failed to create todo:', error);
            throw error;
        }
    }

    /**
     * Update an existing todo item
     * @param {number} id - The ID of the todo item to update
     * @param {Object} updates - The properties to update
     * @returns {Promise<Object>} The updated todo item
     */
    async updateTodo(id, updates) {
        try {
            await DbManager.updateTodo(id, updates);
            
            const index = this.todos.findIndex(todo => todo.id === id);
            if (index !== -1) {
                this.todos[index] = { ...this.todos[index], ...updates };
                this.notifyListeners();
                return this.todos[index];
            }
            throw new Error('Todo item not found');
        } catch (error) {
            console.error('Failed to update todo:', error);
            throw error;
        }
    }

    /**
     * Delete a todo item
     * @param {number} id - The ID of the todo item to delete
     * @returns {Promise<boolean>} Whether the deletion was successful
     */
    async deleteTodo(id) {
        try {
            await DbManager.deleteTodo(id);
            
            const index = this.todos.findIndex(todo => todo.id === id);
            if (index !== -1) {
                this.todos.splice(index, 1);
                this.notifyListeners();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to delete todo:', error);
            throw error;
        }
    }

    /**
     * Toggle the status of a todo item
     * @param {number} id - The ID of the todo item
     * @returns {Promise<Object>} The updated todo item
     */
    async toggleTodoStatus(id) {
        const todo = this.todos.find(todo => todo.id === id);
        if (!todo) {
            throw new Error('Todo item not found');
        }

        const newStatus = this.getNextStatus(todo.status);
        return this.updateTodo(id, { status: newStatus });
    }

    /**
     * Get the next status in the cycle: pending -> in_progress -> completed -> pending
     * @param {string} currentStatus - The current status
     * @returns {string} The next status
     */
    getNextStatus(currentStatus) {
        switch (currentStatus) {
            case TodoStatus.PENDING:
                return TodoStatus.IN_PROGRESS;
            case TodoStatus.IN_PROGRESS:
                return TodoStatus.COMPLETED;
            case TodoStatus.COMPLETED:
                return TodoStatus.PENDING;
            case TodoStatus.ERROR:
                return TodoStatus.PENDING; // Reset error tasks to pending
            default:
                return TodoStatus.PENDING;
        }
    }

    /**
     * Add a listener for todo list changes
     * @param {Function} listener - Callback function to be called when todos change
     */
    addChangeListener(listener) {
        if (typeof listener === 'function' && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
    }

    /**
     * Remove a change listener
     * @param {Function} listener - The listener to remove
     */
    removeChangeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Notify all listeners of changes to the todo list
     */
    notifyListeners() {
        const todos = this.getAllTodos();
        this.listeners.forEach(listener => listener(todos));
    }

    // AI integration API methods

    /**
     * Create a todo item through AI integration
     * @param {string} text - The text content of the todo item
     * @param {string} status - Optional initial status
     * @returns {Promise<Object>} The created todo item
     */
    async aiCreateTodo(text, status = TodoStatus.PENDING) {
        // Validate input - don't allow empty text
        if (!text || text.trim() === '') {
            const error = new Error('Todo text cannot be empty');
            console.error('Failed to create todo via AI:', error);
            throw error;
        }
        
        const todoItem = {
            text,
            status,
            timestamp: Date.now(),
            createdByAI: true
        };

        try {
            const id = await DbManager.addTodo(todoItem);
            const newTodo = { ...todoItem, id };
            this.todos.push(newTodo);
            this.notifyListeners();
            return newTodo;
        } catch (error) {
            console.error('Failed to create todo via AI:', error);
            throw error;
        }
    }

    /**
     * Update todo status through AI integration
     * @param {number} id - The ID of the todo item
     * @param {string} status - The new status
     * @returns {Promise<Object>} The updated todo item
     */
    async aiUpdateTodoStatus(id, status) {
        if (!Object.values(TodoStatus).includes(status)) {
            throw new Error('Invalid todo status');
        }

        return this.updateTodo(id, { 
            status,
            updatedByAI: true,
            lastAIUpdate: Date.now() 
        });
    }
}

// Create a singleton instance
export const todoManager = new TodoManager();