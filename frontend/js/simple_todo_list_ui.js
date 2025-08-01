/**
 * Simplified Todo List UI Components and Interactions
 * Provides a streamlined task management interface
 */

import { simpleTaskManager } from './simple_task_manager.js';
import * as UI from './ui.js';

export class SimpleTodoListUI {
    constructor() {
        this.isVisible = false;
        this.currentView = 'list'; // list, create, edit
        this.selectedTodos = new Set();
        this.filterStatus = 'all';
        this.filterPriority = 'all';
        this.sortBy = 'priority';
        this.searchQuery = '';
        
        this.initialize();
    }

    /**
     * Initialize the todo list UI
     */
    initialize() {
        this.createOverlayStructure();
        this.bindEvents();
        this.setupKeyboardShortcuts();
        
        // Initialize task manager
        simpleTaskManager.initialize();
        simpleTaskManager.addEventListener((event, data) => {
            this.handleTaskManagerEvent(event, data);
        });
        
        console.log('[SimpleTodoListUI] Initialized');
    }

    /**
     * Create the overlay DOM structure
     */
    createOverlayStructure() {
        // Remove existing overlay if present
        const existing = document.getElementById('todo-list-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'todo-list-overlay';
        overlay.className = 'todo-overlay hidden';
        overlay.innerHTML = `
            <div class="todo-modal" onclick="event.stopPropagation()">
                <div class="todo-header">
                    <div class="todo-header-left">
                        <div class="todo-title-section">
                            <h2 class="todo-title">
                                <i class="fas fa-tasks todo-icon"></i>
                                Tasks
                            </h2>
                            <div class="todo-subtitle">Simple task management</div>
                        </div>
                        <div class="todo-list-selector">
                            <select id="todo-list-select" class="modern-select">
                                <option value="default">My Tasks</option>
                            </select>
                            <button id="new-list-btn" class="btn-icon-modern" title="Create New List">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="todo-header-right">
                        <div class="todo-stats-card">
                            <div class="stats-icon">
                                <i class="fas fa-chart-pie"></i>
                            </div>
                            <div class="stats-content">
                                <span id="todo-stats-text" class="stats-main">0 tasks</span>
                                <span id="todo-stats-detail" class="stats-detail">All up to date</span>
                            </div>
                        </div>
                        <button id="todo-close-btn" class="btn-close-modern" title="Close (Esc)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <div class="todo-toolbar">
                    <div class="todo-toolbar-left">
                        <div class="todo-select-all-container">
                            <input type="checkbox" id="todo-select-all-checkbox" class="modern-checkbox" title="Select All (Ctrl+A)">
                            <label for="todo-select-all-checkbox">Select All</label>
                        </div>
                        <div class="todo-search-modern">
                            <div class="search-input-container">
                                <i class="fas fa-search search-icon"></i>
                                <input type="text" id="todo-search-input" placeholder="Search tasks..." />
                                <button id="todo-search-clear" class="search-clear-btn" title="Clear search">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="todo-filters-modern">
                            <div class="filter-group">
                                <label class="filter-label">
                                    <i class="fas fa-filter"></i>
                                    Status
                                </label>
                                <select id="todo-filter-status" class="modern-select">
                                    <option value="all">All Status</option>
                                    <option value="pending">📋 Pending</option>
                                    <option value="in_progress">⚡ In Progress</option>
                                    <option value="completed">✅ Completed</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label class="filter-label">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    Priority
                                </label>
                                <select id="todo-filter-priority" class="modern-select">
                                    <option value="all">All Priority</option>
                                    <option value="urgent">🔴 Urgent</option>
                                    <option value="high">🟠 High</option>
                                    <option value="medium">🟡 Medium</option>
                                    <option value="low">🟢 Low</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label class="filter-label">
                                    <i class="fas fa-sort"></i>
                                    Sort
                                </label>
                                <select id="todo-sort-by" class="modern-select">
                                    <option value="priority">Priority</option>
                                    <option value="created">Created Date</option>
                                    <option value="updated">Last Updated</option>
                                    <option value="dueDate">Due Date</option>
                                    <option value="alphabetical">Alphabetical</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="todo-toolbar-right">
                        <button id="todo-new-btn" class="btn-primary-modern">
                            <i class="fas fa-plus btn-icon"></i>
                            <span>New Task</span>
                        </button>
                        <div class="todo-actions-dropdown">
                            <button id="todo-actions-btn" class="btn-secondary-modern">
                                <i class="fas fa-ellipsis-v"></i>
                                <span>Actions</span>
                                <i class="fas fa-chevron-down dropdown-arrow"></i>
                            </button>
                            <div class="dropdown-menu-modern" id="todo-actions-menu">
                                <div class="dropdown-section">
                                    <div class="dropdown-section-title">Bulk Actions</div>
                                    <button data-action="mark-complete" class="dropdown-item">
                                        <i class="fas fa-check"></i>
                                        Mark Selected Complete
                                    </button>
                                    <button data-action="mark-pending" class="dropdown-item">
                                        <i class="fas fa-clock"></i>
                                        Mark Selected Pending
                                    </button>
                                    <button data-action="delete-selected" class="dropdown-item danger">
                                        <i class="fas fa-trash"></i>
                                        Delete Selected
                                    </button>
                                </div>
                                <div class="dropdown-divider"></div>
                                <div class="dropdown-section">
                                    <div class="dropdown-section-title">Import/Export</div>
                                    <button data-action="export-json" class="dropdown-item">
                                        <i class="fas fa-download"></i>
                                        Export as JSON
                                    </button>
                                    <button data-action="export-markdown" class="dropdown-item">
                                        <i class="fab fa-markdown"></i>
                                        Export as Markdown
                                    </button>
                                    <button data-action="import" class="dropdown-item">
                                        <i class="fas fa-upload"></i>
                                        Import Tasks
                                    </button>
                                </div>
                                <div class="dropdown-divider"></div>
                                <div class="dropdown-section">
                                    <button data-action="clear-completed" class="dropdown-item">
                                        <i class="fas fa-broom"></i>
                                        Clear Completed Tasks
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="todo-content">
                    <!-- Main List View -->
                    <div id="todo-list-view" class="todo-view active">
                        <div class="todo-list-container">
                            <div id="todo-list-empty" class="todo-empty-state-modern hidden">
                                <div class="empty-illustration">
                                    <div class="empty-icon-large">
                                        <i class="fas fa-tasks"></i>
                                    </div>
                                    <div class="empty-sparkles">
                                        <i class="fas fa-star"></i>
                                        <i class="fas fa-star"></i>
                                        <i class="fas fa-star"></i>
                                    </div>
                                </div>
                                <div class="empty-content">
                                    <h3 class="empty-title">Ready to get organized?</h3>
                                    <p class="empty-description">
                                        Create your first task and start managing your work efficiently.
                                    </p>
                                    <div class="empty-actions">
                                        <button class="btn-primary-modern btn-large" onclick="simpleTodoListUI.showCreateView()">
                                            <i class="fas fa-plus"></i>
                                            Create Your First Task
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div id="todo-list-items" class="todo-items-modern"></div>
                        </div>
                    </div>

                    <!-- Create/Edit Task View -->
                    <div id="todo-create-view" class="todo-view">
                        <div class="todo-form">
                            <div class="form-group">
                                <label for="todo-form-title">Title *</label>
                                <input type="text" id="todo-form-title" placeholder="What needs to be done?" required />
                            </div>
                            <div class="form-group">
                                <label for="todo-form-description">Description</label>
                                <textarea id="todo-form-description" placeholder="Additional details..." rows="3"></textarea>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="todo-form-priority">Priority</label>
                                    <select id="todo-form-priority">
                                        <option value="low">Low</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="todo-form-due-date">Due Date</label>
                                    <input type="datetime-local" id="todo-form-due-date" />
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="todo-form-tags">Tags</label>
                                <input type="text" id="todo-form-tags" placeholder="tag1, tag2, tag3" />
                                <small>Separate tags with commas</small>
                            </div>
                            <div class="form-actions">
                                <button id="todo-form-cancel" class="btn-secondary">Cancel</button>
                                <button id="todo-form-save" class="btn-primary">Save Task</button>
                            </div>
                        </div>
                    </div>

                    <!-- Task Detail View -->
                    <div id="todo-detail-view" class="todo-view">
                        <div class="todo-detail-wrapper">
                            <div class="todo-detail-modern">
                                <div class="todo-detail-header-modern">
                                    <button id="todo-detail-back" class="btn-back-modern">
                                        <i class="fas fa-arrow-left"></i>
                                        <span>Back to Tasks</span>
                                    </button>
                                    <div class="todo-detail-actions-modern">
                                        <button id="todo-detail-edit" class="btn-secondary-modern">
                                            <i class="fas fa-edit"></i>
                                            <span>Edit</span>
                                        </button>
                                        <button id="todo-detail-delete" class="btn-danger-modern">
                                            <i class="fas fa-trash"></i>
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="todo-detail-content-modern">
                                    <div class="todo-detail-main">
                                        <div class="task-header-card">
                                            <div id="todo-detail-info" class="task-info-grid"></div>
                                        </div>
                                        
                                        <div class="task-details-grid">
                                            <div class="detail-section">
                                                <div class="section-header">
                                                    <i class="fas fa-info-circle"></i>
                                                    <h4>Task Details</h4>
                                                </div>
                                                <div id="todo-detail-details" class="details-content"></div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="todo-detail-sidebar">
                                        <div class="sidebar-section">
                                            <div class="section-header">
                                                <i class="fas fa-info-circle"></i>
                                                <h4>Quick Info</h4>
                                            </div>
                                            <div id="todo-detail-quick-info" class="quick-info-content"></div>
                                        </div>
                                        
                                        <div class="sidebar-section">
                                            <div class="section-header">
                                                <i class="fas fa-tags"></i>
                                                <h4>Tags</h4>
                                            </div>
                                            <div id="todo-detail-tags" class="tags-content"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="todo-footer">
                    <div class="todo-footer-left">
                        <span id="todo-filter-info">Showing all tasks</span>
                    </div>
                    <div class="todo-footer-right">
                        <span class="todo-hotkey">Ctrl+T to toggle</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        const overlay = document.getElementById('todo-list-overlay');
        
        // Close overlay when clicking background
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hide();
            }
        });

        // Header controls
        document.getElementById('todo-close-btn').addEventListener('click', () => this.hide());
        document.getElementById('new-list-btn').addEventListener('click', () => this.showCreateListDialog());
        document.getElementById('todo-list-select').addEventListener('change', (e) => {
            simpleTaskManager.setCurrentList(e.target.value);
        });

        // Toolbar controls
        document.getElementById('todo-search-input').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.applyFilters();
        });
        document.getElementById('todo-search-clear').addEventListener('click', () => {
            document.getElementById('todo-search-input').value = '';
            this.searchQuery = '';
            this.applyFilters();
        });

        document.getElementById('todo-select-all-checkbox').addEventListener('change', () => this.toggleSelectAll());

        document.getElementById('todo-filter-status').addEventListener('change', (e) => {
            this.filterStatus = e.target.value;
            this.applyFilters();
        });
        document.getElementById('todo-filter-priority').addEventListener('change', (e) => {
            this.filterPriority = e.target.value;
            this.applyFilters();
        });
        document.getElementById('todo-sort-by').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.applyFilters();
        });

        document.getElementById('todo-new-btn').addEventListener('click', () => this.showCreateView());

        // Actions dropdown
        document.getElementById('todo-actions-btn').addEventListener('click', (e) => {
            const menu = document.getElementById('todo-actions-menu');
            menu.classList.toggle('show');
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            document.getElementById('todo-actions-menu').classList.remove('show');
        });

        document.getElementById('todo-actions-menu').addEventListener('click', (e) => {
            if (e.target.dataset.action) {
                this.handleBulkAction(e.target.dataset.action);
            }
        });

        // Form controls
        document.getElementById('todo-form-cancel').addEventListener('click', () => this.showListView());
        document.getElementById('todo-form-save').addEventListener('click', () => this.handleSaveTask());

        // Detail view controls
        document.getElementById('todo-detail-back').addEventListener('click', () => this.showListView());
        document.getElementById('todo-detail-edit').addEventListener('click', () => this.showEditView());
        document.getElementById('todo-detail-delete').addEventListener('click', () => this.handleDeleteTask());
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+T to toggle todo list
            if (e.ctrlKey && e.key === 't' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                this.toggle();
                return;
            }

            // Only handle other shortcuts when todo list is visible
            if (!this.isVisible) return;

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    if (this.currentView === 'list') {
                        this.hide();
                    } else {
                        this.showListView();
                    }
                    break;
                
                case 'n':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.showCreateView();
                    }
                    break;
                
                case 'f':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        document.getElementById('todo-search-input').focus();
                    }
                    break;
                
                case 'Enter':
                    if (e.ctrlKey && this.currentView === 'create') {
                        e.preventDefault();
                        this.handleSaveTask();
                    }
                    break;
                
                case 'a':
                    if (e.ctrlKey && this.currentView === 'list') {
                        e.preventDefault();
                        this.toggleSelectAll();
                    }
                    break;
            }
        });
    }

    /**
     * Show/hide todo list overlay
     */
    show() {
        const overlay = document.getElementById('todo-list-overlay');
        overlay.classList.remove('hidden');
        this.isVisible = true;
        this.refreshUI();
        document.getElementById('todo-search-input').focus();
        console.log('[SimpleTodoListUI] Shown');
    }

    hide() {
        const overlay = document.getElementById('todo-list-overlay');
        overlay.classList.add('hidden');
        this.isVisible = false;
        console.log('[SimpleTodoListUI] Hidden');
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * View management
     */
    showListView() {
        this.setCurrentView('list');
        this.refreshTodoList();
    }

    showCreateView(todoId = null) {
        this.setCurrentView('create');
        this.editingTodoId = todoId;
        
        if (todoId) {
            // Load existing todo for editing
            const todo = simpleTaskManager.tasks.get(todoId);
            if (todo) {
                this.populateForm(todo);
            }
        } else {
            // Reset form for new todo
            this.resetForm();
        }
        
        setTimeout(() => {
            document.getElementById('todo-form-title').focus();
        }, 100);
    }

    showEditView(todoId) {
        this.showCreateView(todoId);
    }

    showDetailView(todoId) {
        this.setCurrentView('detail');
        this.currentTodoId = todoId;
        this.renderTodoDetail(todoId);
    }

    setCurrentView(view) {
        document.querySelectorAll('.todo-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`todo-${view}-view`).classList.add('active');
        this.currentView = view;
    }

    /**
     * UI refresh and rendering
     */
    refreshUI() {
        this.refreshLists();
        this.refreshStats();
        this.refreshTodoList();
    }

    refreshLists() {
        const select = document.getElementById('todo-list-select');
        const lists = simpleTaskManager.getAllLists();
        
        select.innerHTML = '';
        lists.forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            option.selected = list.id === simpleTaskManager.currentListId;
            select.appendChild(option);
        });
    }

    refreshStats() {
        const stats = simpleTaskManager.getStats();
        const statsText = document.getElementById('todo-stats-text');
        const statsDetail = document.getElementById('todo-stats-detail');
        
        let mainText = `${stats.total} task${stats.total !== 1 ? 's' : ''}`;
        let detailText = '';
        
        if (stats.total === 0) {
            detailText = 'All up to date';
        } else if (stats.in_progress > 0) {
            detailText = `${stats.in_progress} in progress`;
        } else if (stats.pending > 0) {
            detailText = `${stats.pending} pending`;
        } else if (stats.completed === stats.total) {
            detailText = 'All completed! 🎉';
        } else {
            detailText = `${stats.completed} completed`;
        }
        
        if (stats.overdue > 0) {
            detailText += ` • ${stats.overdue} overdue`;
        }
        
        statsText.textContent = mainText;
        statsDetail.textContent = detailText;
    }

    refreshTodoList() {
        const container = document.getElementById('todo-list-items');
        const emptyState = document.getElementById('todo-list-empty');
        
        const todos = this.getFilteredTodos();
        
        if (todos.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            this.updateFilterInfo('No tasks match current filters');
        } else {
            emptyState.classList.add('hidden');
            this.renderTodos(todos);
            this.updateFilterInfo(`Showing ${todos.length} of ${simpleTaskManager.getAllTasks().length} tasks`);
        }
        this.updateSelectionUI();
    }

    renderTodos(todos) {
        const container = document.getElementById('todo-list-items');
        
        container.innerHTML = todos.map(todo => this.createTodoItemHTML(todo)).join('');
        
        // Bind events for todo items
        container.querySelectorAll('.todo-item').forEach(item => {
            const todoId = item.dataset.todoId;
            
            // Checkbox toggle
            const checkbox = item.querySelector('.todo-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    simpleTaskManager.updateTask(todoId, { status: checkbox.checked ? 'completed' : 'pending' });
                });
            }
            
            // Select checkbox
            const selectCheckbox = item.querySelector('.todo-select');
            selectCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedTodos.add(todoId);
                } else {
                    this.selectedTodos.delete(todoId);
                }
                this.updateSelectionUI();
            });
            
            // Click to view details
            item.querySelector('.todo-content').addEventListener('click', () => {
                this.showDetailView(todoId);
            });
            
            // Quick actions
            const startBtn = item.querySelector('.todo-start-btn');
            if (startBtn) {
                startBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    simpleTaskManager.updateTask(todoId, { status: 'in_progress' });
                });
            }
            
            const editBtn = item.querySelector('.todo-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEditView(todoId);
                });
            }
            
            const deleteBtn = item.querySelector('.todo-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Delete this task?')) {
                        simpleTaskManager.deleteTask(todoId);
                    }
                });
            }
        });
    }

    createTodoItemHTML(todo) {
        const isCompleted = todo.status === 'completed';
        const isOverdue = todo.dueDate && todo.dueDate < Date.now() && !isCompleted;
        const priorityClass = `priority-${todo.priority}`;
        const statusClass = `status-${todo.status}`;
        
        const dueText = todo.dueDate ? 
            new Date(todo.dueDate).toLocaleDateString() : '';
        
        const tags = (todo.tags || []).map(tag => 
            `<span class="todo-tag">#${tag}</span>`
        ).join('');

        return `
            <div class="todo-item ${priorityClass} ${statusClass}" data-todo-id="${todo.id}">
                <div class="todo-item-left">
                    <input type="checkbox" class="todo-select" />
                    <input type="checkbox" class="todo-checkbox" ${isCompleted ? 'checked' : ''} />
                </div>
                <div class="todo-content">
                    <div class="todo-title">${this.escapeHtml(todo.title)}</div>
                    ${todo.description ? `<div class="todo-description">${this.escapeHtml(todo.description)}</div>` : ''}
                    <div class="todo-meta">
                        <span class="todo-priority priority-${todo.priority}">${todo.priority}</span>
                        ${dueText ? `<span class="todo-due ${isOverdue ? 'overdue' : ''}">${dueText}</span>` : ''}
                        ${tags}
                    </div>
                </div>
                <div class="todo-item-actions">
                    ${todo.status === 'pending' ? `<button class="todo-start-btn btn-icon" title="Start">▶</button>` : ''}
                    <button class="todo-edit-btn btn-icon" title="Edit">✏</button>
                    <button class="todo-delete-btn btn-icon" title="Delete">🗑</button>
                </div>
            </div>
        `;
    }

    renderTodoDetail(todoId) {
        const todo = simpleTaskManager.tasks.get(todoId);
        if (!todo) return;
        
        // Render task header
        this.renderTaskHeader(todo);
        
        // Render task details
        this.renderTaskDetails(todo);
        
        // Render sidebar
        this.renderTaskQuickInfo(todo);
        this.renderTaskTags(todo);
    }

    renderTaskHeader(todo) {
        const container = document.getElementById('todo-detail-info');
        const isCompleted = todo.status === 'completed';
        const isOverdue = todo.dueDate && todo.dueDate < Date.now() && !isCompleted;
        
        // Get status icon and color
        const statusIcons = {
            pending: 'fas fa-clock',
            in_progress: 'fas fa-play-circle',
            completed: 'fas fa-check-circle'
        };
        
        const priorityIcons = {
            urgent: 'fas fa-exclamation-triangle',
            high: 'fas fa-arrow-up',
            medium: 'fas fa-minus',
            low: 'fas fa-arrow-down'
        };
        
        container.innerHTML = `
            <div class="task-header-info">
                <div class="task-status-priority">
                    <div class="status-indicator status-${todo.status}">
                        <i class="${statusIcons[todo.status]}"></i>
                        <span class="status-text">${todo.status.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <div class="priority-indicator priority-${todo.priority}">
                        <i class="${priorityIcons[todo.priority]}"></i>
                        <span class="priority-text">${todo.priority.toUpperCase()}</span>
                    </div>
                </div>
                <h1 class="task-title">${this.escapeHtml(todo.title)}</h1>
                ${todo.description ? `
                    <div class="task-description">
                        <p>${this.escapeHtml(todo.description)}</p>
                    </div>
                ` : ''}
                ${isOverdue ? `
                    <div class="overdue-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>This task is overdue</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderTaskDetails(todo) {
        const container = document.getElementById('todo-detail-details');
        const createdTime = new Date(todo.createdTime);
        const updatedTime = new Date(todo.updatedTime);
        const completedTime = todo.completedTime ? new Date(todo.completedTime) : null;
        
        container.innerHTML = `
            <div class="details-grid">
                <div class="detail-item">
                    <div class="detail-label">Created</div>
                    <div class="detail-value">${createdTime.toLocaleString()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Last Updated</div>
                    <div class="detail-value">${updatedTime.toLocaleString()}</div>
                </div>
                ${completedTime ? `
                    <div class="detail-item">
                        <div class="detail-label">Completed</div>
                        <div class="detail-value">${completedTime.toLocaleString()}</div>
                    </div>
                ` : ''}
                ${todo.dueDate ? `
                    <div class="detail-item">
                        <div class="detail-label">Due Date</div>
                        <div class="detail-value">${new Date(todo.dueDate).toLocaleString()}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderTaskQuickInfo(todo) {
        const container = document.getElementById('todo-detail-quick-info');
        const createdTime = new Date(todo.createdTime);
        const updatedTime = new Date(todo.updatedTime);
        
        container.innerHTML = `
            <div class="quick-info-item">
                <div class="info-label">
                    <i class="fas fa-calendar-plus"></i>
                    Created
                </div>
                <div class="info-value">${createdTime.toLocaleDateString()}</div>
            </div>
            <div class="quick-info-item">
                <div class="info-label">
                    <i class="fas fa-clock"></i>
                    Last Updated
                </div>
                <div class="info-value">${updatedTime.toLocaleDateString()}</div>
            </div>
            <div class="quick-info-item">
                <div class="info-label">
                    <i class="fas fa-fingerprint"></i>
                    Task ID
                </div>
                <div class="info-value task-id">${todo.id}</div>
            </div>
        `;
    }

    renderTaskTags(todo) {
        const container = document.getElementById('todo-detail-tags');
        const tags = todo.tags || [];
        
        if (tags.length === 0) {
            container.innerHTML = `
                <div class="no-tags">
                    <i class="fas fa-tag"></i>
                    <span>No tags assigned</span>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="tags-list">
                ${tags.map(tag => `
                    <span class="tag-item">
                        <i class="fas fa-hashtag"></i>
                        ${this.escapeHtml(tag)}
                    </span>
                `).join('')}
            </div>
        `;
    }

    /**
     * Form handling
     */
    resetForm() {
        document.getElementById('todo-form-title').value = '';
        document.getElementById('todo-form-description').value = '';
        document.getElementById('todo-form-priority').value = 'medium';
        document.getElementById('todo-form-due-date').value = '';
        document.getElementById('todo-form-tags').value = '';
    }

    populateForm(todo) {
        document.getElementById('todo-form-title').value = todo.title;
        document.getElementById('todo-form-description').value = todo.description;
        document.getElementById('todo-form-priority').value = todo.priority;
        document.getElementById('todo-form-due-date').value = todo.dueDate ? 
            new Date(todo.dueDate).toISOString().slice(0, 16) : '';
        document.getElementById('todo-form-tags').value = (todo.tags || []).join(', ');
    }

    async handleSaveTask() {
        const title = document.getElementById('todo-form-title').value.trim();
        if (!title) {
            UI.showError('Title is required');
            return;
        }

        const description = document.getElementById('todo-form-description').value.trim();
        const priority = document.getElementById('todo-form-priority').value;
        const dueDateValue = document.getElementById('todo-form-due-date').value;
        const tagsValue = document.getElementById('todo-form-tags').value.trim();
        
        const dueDate = dueDateValue ? new Date(dueDateValue).getTime() : null;
        const tags = tagsValue ? tagsValue.split(',').map(t => t.trim()).filter(t => t) : [];

        try {
            if (this.editingTodoId) {
                // Update existing todo
                await simpleTaskManager.updateTask(this.editingTodoId, {
                    title,
                    description,
                    priority,
                    dueDate,
                    tags
                });
                UI.showToast('Task updated successfully');
            } else {
                // Create new todo
                await simpleTaskManager.createTask({
                    title,
                    description,
                    priority,
                    dueDate,
                    tags
                });
                UI.showToast('Task created successfully');
            }
            
            this.showListView();
        } catch (error) {
            UI.showError(`Failed to save task: ${error.message}`);
        }
    }

    async handleDeleteTask() {
        if (!this.currentTodoId) return;
        
        if (confirm('Are you sure you want to delete this task?')) {
            try {
                await simpleTaskManager.deleteTask(this.currentTodoId);
                UI.showToast('Task deleted successfully');
                this.showListView();
            } catch (error) {
                UI.showError(`Failed to delete task: ${error.message}`);
            }
        }
    }

    async showCreateListDialog() {
        const name = prompt('Enter list name:');
        if (!name) return;
        
        try {
            const list = await simpleTaskManager.createList({ name });
            await simpleTaskManager.setCurrentList(list.id);
            this.refreshUI();
            UI.showToast('List created successfully');
        } catch (error) {
            UI.showError(`Failed to create list: ${error.message}`);
        }
    }

    /**
     * Filtering and sorting
     */
    getFilteredTodos() {
        let todos = simpleTaskManager.getAllTasks();
        
        // Apply search filter
        if (this.searchQuery) {
            todos = todos.filter(todo => 
                (todo.title || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                (todo.description || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                (todo.tags || []).some(tag => tag.toLowerCase().includes(this.searchQuery.toLowerCase()))
            );
        }
        
        // Apply status filter
        if (this.filterStatus !== 'all') {
            todos = todos.filter(todo => todo.status === this.filterStatus);
        }
        
        // Apply priority filter
        if (this.filterPriority !== 'all') {
            todos = todos.filter(todo => todo.priority === this.filterPriority);
        }
        
        // Apply sorting
        todos.sort((a, b) => {
            switch (this.sortBy) {
                case 'priority':
                    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
                    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                    return priorityDiff !== 0 ? priorityDiff : a.createdTime - b.createdTime;
                    
                case 'created':
                    return b.createdTime - a.createdTime;
                    
                case 'updated':
                    return b.updatedTime - a.updatedTime;
                    
                case 'dueDate':
                    if (!a.dueDate && !b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return a.dueDate - b.dueDate;
                    
                case 'alphabetical':
                    return (a.title || '').localeCompare(b.title || '');
                    
                default:
                    return 0;
            }
        });
        
        return todos;
    }

    applyFilters() {
        this.refreshTodoList();
    }

    updateFilterInfo(text) {
        document.getElementById('todo-filter-info').textContent = text;
    }

    /**
     * Bulk actions
     */
    async handleBulkAction(action) {
        const selectedIds = Array.from(this.selectedTodos);
        if (selectedIds.length === 0 && ['mark-complete', 'mark-pending', 'delete-selected'].includes(action)) {
            UI.showError('No tasks selected');
            return;
        }

        try {
            switch (action) {
                case 'mark-complete':
                    await simpleTaskManager.bulkUpdateTasks(selectedIds, { status: 'completed' });
                    UI.showToast(`Marked ${selectedIds.length} tasks as complete`);
                    break;
                    
                case 'mark-pending':
                    await simpleTaskManager.bulkUpdateTasks(selectedIds, { status: 'pending' });
                    UI.showToast(`Marked ${selectedIds.length} tasks as pending`);
                    break;
                    
                case 'delete-selected':
                    if (confirm(`Delete ${selectedIds.length} selected tasks?`)) {
                        await simpleTaskManager.bulkDeleteTasks(selectedIds);
                        UI.showToast(`Deleted ${selectedIds.length} tasks`);
                    }
                    break;
                    
                case 'export-json':
                    this.handleExport('json');
                    break;
                    
                case 'export-markdown':
                    this.handleExport('markdown');
                    break;
                    
                case 'import':
                    this.handleImport();
                    break;
                    
                case 'clear-completed':
                    const completedTodos = simpleTaskManager.getAllTasks().filter(t => t.status === 'completed');
                    if (completedTodos.length > 0 && confirm(`Clear ${completedTodos.length} completed tasks?`)) {
                        const completedIds = completedTodos.map(t => t.id);
                        await simpleTaskManager.bulkDeleteTasks(completedIds);
                        UI.showToast(`Cleared ${completedIds.length} completed tasks`);
                    }
                    break;
            }
            
            this.selectedTodos.clear();
            this.refreshUI();
        } catch (error) {
            UI.showError(`Bulk action failed: ${error.message}`);
        }
    }

    handleExport(format) {
        try {
            const data = simpleTaskManager.exportTasks(format);
            const filename = `todos-${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'md'}`;
            
            const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/markdown' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            UI.showToast(`Exported as ${filename}`);
        } catch (error) {
            UI.showError(`Export failed: ${error.message}`);
        }
    }

    handleImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.md,.txt';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const format = file.name.endsWith('.json') ? 'json' : 'markdown';
                
                const imported = await simpleTaskManager.importTasks(text, format);
                UI.showToast(`Imported ${imported.length} tasks`);
                this.refreshUI();
            } catch (error) {
                UI.showError(`Import failed: ${error.message}`);
            }
        };
        
        input.click();
    }

    toggleSelectAll() {
        const todos = this.getFilteredTodos();
        const allSelected = todos.every(todo => this.selectedTodos.has(todo.id));
        
        if (allSelected) {
            this.selectedTodos.clear();
        } else {
            todos.forEach(todo => this.selectedTodos.add(todo.id));
        }
        
        this.updateSelectionUI();
        this.refreshTodoList();
    }

    updateSelectionUI() {
        const selectAllCheckbox = document.getElementById('todo-select-all-checkbox');
        const visibleTodos = this.getFilteredTodos();
        const allVisibleSelected = visibleTodos.length > 0 && visibleTodos.every(todo => this.selectedTodos.has(todo.id));

        if (selectAllCheckbox) {
            selectAllCheckbox.checked = allVisibleSelected;
        }

        // Update individual checkboxes
        document.querySelectorAll('.todo-item').forEach(item => {
            const todoId = item.dataset.todoId;
            const selectCheckbox = item.querySelector('.todo-select');
            if (selectCheckbox) {
                selectCheckbox.checked = this.selectedTodos.has(todoId);
            }
        });

        // Update bulk action button state
        const actionsButton = document.getElementById('todo-actions-btn');
        if (actionsButton) {
            actionsButton.disabled = this.selectedTodos.size === 0;
        }
    }

    /**
     * Event handlers for task manager events
     */
    handleTaskManagerEvent(event, data) {
        switch (event) {
            case 'task_created':
            case 'task_updated':
            case 'task_deleted':
            case 'list_created':
            case 'current_list_changed':
                if (this.isVisible) {
                    this.refreshUI();
                }
                break;
        }
    }

    /**
     * Utility methods
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
export const simpleTodoListUI = new SimpleTodoListUI();

// Export for global access
window.simpleTodoListUI = simpleTodoListUI;