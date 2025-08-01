// === IndexedDB Manager for API Keys                            ===
// =================================================================
export const DbManager = {
    db: null,
    dbName: 'CodeEditorDB',
    stores: {
        handles: 'fileHandles',
        codeIndex: 'codeIndex',
        sessionState: 'sessionState',
        checkpoints: 'checkpoints',
        settings: 'settings',
        customRules: 'customRules',
        chatHistory: 'chatHistory',
        toolLogs: 'tool_logs',
        todos: 'todos',
    },
    async openDb() {
        return new Promise((resolve, reject) => {
            if (this.db) return resolve(this.db);
            const request = indexedDB.open(this.dbName, 12); // Increased version to 12 for the new todos store
            request.onerror = () => reject('Error opening IndexedDB.');
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.stores.handles)) {
                    db.createObjectStore(this.stores.handles, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.stores.codeIndex)) {
                    db.createObjectStore(this.stores.codeIndex, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.stores.sessionState)) {
                    db.createObjectStore(this.stores.sessionState, { keyPath: 'id' });
                }
                if (db.objectStoreNames.contains(this.stores.checkpoints)) {
                    db.deleteObjectStore(this.stores.checkpoints);
                }
                db.createObjectStore(
                    this.stores.checkpoints,
                    { autoIncrement: true, keyPath: 'id' },
                );
                if (!db.objectStoreNames.contains(this.stores.settings)) {
                    db.createObjectStore(this.stores.settings, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.stores.customRules)) {
                    db.createObjectStore(this.stores.customRules, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.stores.chatHistory)) {
                    db.createObjectStore(this.stores.chatHistory, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.stores.toolLogs)) {
                    const logStore = db.createObjectStore(this.stores.toolLogs, { autoIncrement: true, keyPath: 'id' });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                    logStore.createIndex('toolName', 'toolName', { unique: false });
                }
                if (!db.objectStoreNames.contains(this.stores.todos)) {
                    const todoStore = db.createObjectStore(this.stores.todos, { autoIncrement: true, keyPath: 'id' });
                    todoStore.createIndex('timestamp', 'timestamp', { unique: false });
                    todoStore.createIndex('status', 'status', { unique: false });
                }
            };
        });
    },
    async saveDirectoryHandle(handle) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
            .transaction(this.stores.handles, 'readwrite')
            .objectStore(this.stores.handles)
            .put({ id: 'rootDirectory', handle });
            request.onerror = () => reject('Error saving directory handle.');
            request.onsuccess = () => resolve();
        });
    },
    async getDirectoryHandle() {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
            .transaction(this.stores.handles, 'readonly')
            .objectStore(this.stores.handles)
            .get('rootDirectory');
            request.onerror = () => resolve(null);
            request.onsuccess = () =>
            resolve(request.result ? request.result.handle : null);
        });
    },
    async clearDirectoryHandle() {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
            .transaction(this.stores.handles, 'readwrite')
            .objectStore(this.stores.handles)
            .delete('rootDirectory');
            request.onerror = () => reject('Error clearing directory handle.');
            request.onsuccess = () => resolve();
        });
    },
    async saveCodeIndex(index) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
            .transaction(this.stores.codeIndex, 'readwrite')
            .objectStore(this.stores.codeIndex)
            .put({ id: 'fullCodeIndex', index });
            request.onerror = () => reject('Error saving code index.');
            request.onsuccess = () => resolve();
        });
    },
    async getCodeIndex() {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
            .transaction(this.stores.codeIndex, 'readonly')
            .objectStore(this.stores.codeIndex)
            .get('fullCodeIndex');
            request.onerror = () => resolve(null);
            request.onsuccess = () =>
            resolve(request.result ? request.result.index : null);
        });
    },
    async saveLastIndexTimestamp(timestamp) {
        return this.saveSetting('lastIndexTimestamp', timestamp);
    },
    async getLastIndexTimestamp() {
        return this.getSetting('lastIndexTimestamp');
    },
    async saveSessionState(state) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
                .transaction(this.stores.sessionState, 'readwrite')
                .objectStore(this.stores.sessionState)
                .put(state);
            request.onerror = () => reject('Error saving session state.');
            request.onsuccess = () => resolve();
        });
    },
    async getSessionState() {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(this.stores.sessionState, 'readonly')
                .objectStore(this.stores.sessionState)
                .get('lastSession');
            request.onerror = () => resolve(null);
            request.onsuccess = () => resolve(request.result || null);
        });
    },
    async saveCheckpoint(checkpointData) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
                .transaction(this.stores.checkpoints, 'readwrite')
                .objectStore(this.stores.checkpoints)
                .add(checkpointData);
            request.onerror = () => reject('Error saving checkpoint.');
            request.onsuccess = () => resolve();
        });
    },
    async getCheckpoints() {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(this.stores.checkpoints, 'readonly')
                .objectStore(this.stores.checkpoints)
                .getAll();
            request.onerror = () => resolve([]);
            request.onsuccess = () => resolve(request.result || []);
        });
    },
    async getCheckpointById(id) {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(this.stores.checkpoints, 'readonly')
                .objectStore(this.stores.checkpoints)
                .get(id);
            request.onerror = () => resolve(null);
            request.onsuccess = () => resolve(request.result || null);
        });
    },
    async deleteCheckpoint(id) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
                .transaction(this.stores.checkpoints, 'readwrite')
                .objectStore(this.stores.checkpoints)
                .delete(id);
            request.onerror = () => reject('Error deleting checkpoint.');
            request.onsuccess = () => resolve();
        });
    },

    async getAllFromStore(storeName) {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(storeName, 'readonly')
                .objectStore(storeName)
                .getAll();
            request.onerror = () => resolve([]);
            request.onsuccess = () => resolve(request.result || []);
        });
    },

    async saveSetting(settingId, value) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
                .transaction(this.stores.settings, 'readwrite')
                .objectStore(this.stores.settings)
                .put({ id: settingId, value: value });
            request.onerror = () => reject('Error saving setting.');
            request.onsuccess = () => resolve();
        });
    },
    async getSetting(settingId) {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(this.stores.settings, 'readonly')
                .objectStore(this.stores.settings)
                .get(settingId);
            request.onerror = () => resolve(null);
            request.onsuccess = () =>
                resolve(request.result ? request.result.value : null);
        });
    },

    async saveMultipleSettings(settings) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.stores.settings, 'readwrite');
            const store = transaction.objectStore(this.stores.settings);
            settings.forEach(setting => {
                store.put({ id: setting.id, value: setting.value });
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject('Error saving multiple settings.');
        });
    },
    async saveChatHistory(history) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
                .transaction(this.stores.chatHistory, 'readwrite')
                .objectStore(this.stores.chatHistory)
                .put({ id: 'current_chat', history });
            request.onerror = () => reject('Error saving chat history.');
            request.onsuccess = () => resolve();
        });
    },
    async getChatHistory() {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(this.stores.chatHistory, 'readonly')
                .objectStore(this.stores.chatHistory)
                .get('current_chat');
            request.onerror = () => resolve([]);
            request.onsuccess = () =>
                resolve(request.result ? request.result.history : []);
        });
    },
    async clearChatHistory() {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
                .transaction(this.stores.chatHistory, 'readwrite')
                .objectStore(this.stores.chatHistory)
                .delete('current_chat');
            request.onerror = () => reject('Error clearing chat history.');
            request.onsuccess = () => resolve();
        });
    },

    // Todo CRUD operations
    async getAllTodos() {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(this.stores.todos, 'readonly')
                .objectStore(this.stores.todos)
                .getAll();
            request.onerror = () => resolve([]);
            request.onsuccess = () => resolve(request.result || []);
        });
    },

    async addTodo(todoData) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.stores.todos, 'readwrite');
            const store = transaction.objectStore(this.stores.todos);
            const request = store.add({
                ...todoData,
                timestamp: todoData.timestamp || Date.now()
            });
            request.onerror = () => reject('Error adding todo item.');
            request.onsuccess = (event) => resolve(event.target.result); // Returns the auto-generated ID
        });
    },

    async updateTodo(id, todoData) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.stores.todos, 'readwrite');
            const store = transaction.objectStore(this.stores.todos);
            const request = store.get(id);
            
            request.onerror = () => reject('Error getting todo item for update.');
            request.onsuccess = () => {
                const data = request.result;
                if (!data) {
                    reject('Todo item not found.');
                    return;
                }
                
                const updatedTodo = { ...data, ...todoData };
                const updateRequest = store.put(updatedTodo);
                updateRequest.onerror = () => reject('Error updating todo item.');
                updateRequest.onsuccess = () => resolve();
            };
        });
    },

    async deleteTodo(id) {
        const db = await this.openDb();
        return new Promise((resolve, reject) => {
            const request = db
                .transaction(this.stores.todos, 'readwrite')
                .objectStore(this.stores.todos)
                .delete(id);
            request.onerror = () => reject('Error deleting todo item.');
            request.onsuccess = () => resolve();
        });
    },

    async getTodoById(id) {
        const db = await this.openDb();
        return new Promise((resolve) => {
            const request = db
                .transaction(this.stores.todos, 'readonly')
                .objectStore(this.stores.todos)
                .get(id);
            request.onerror = () => resolve(null);
            request.onsuccess = () => resolve(request.result || null);
        });
    },
};
