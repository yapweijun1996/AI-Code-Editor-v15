/**
 * Web Worker for handling File System Access API operations
 * This worker runs in the background to prevent blocking the main UI thread.
 */

// Configuration for lazy loading the file tree
const LAZY_LOADING_CONFIG = {
    maxDepth: 2, // Only load 2 levels deep initially
    maxChildrenPerDirectory: 1000, // Limit children per directory for performance
};

/**
 * Recursively builds a tree structure from a directory handle.
 * @param {FileSystemDirectoryHandle} dirHandle - The handle to the directory.
 * @param {Array<string>} ignorePatterns - Patterns to ignore.
 * @param {string} currentPath - The current path relative to the root.
 * @param {object} options - Additional options like progress callbacks.
 * @returns {Promise<Array<object>>} - A promise that resolves to the tree structure.
 */
const buildTree = async (dirHandle, ignorePatterns, currentPath = '', options = {}) => {
    const config = { ...LAZY_LOADING_CONFIG, ...options };

    const buildChildren = async (currentDirHandle, pathPrefix, depth = 0) => {
        const children = [];
        let childCount = 0;

        for await (const entry of currentDirHandle.values()) {
            if (childCount >= config.maxChildrenPerDirectory) {
                children.push({
                    id: `${pathPrefix}/__more__`,
                    text: `... (more items)`,
                    type: 'placeholder',
                });
                break;
            }

            const newPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
            if (ignorePatterns.some(pattern => newPath.startsWith(pattern.replace(/\/$/, '')))) {
                continue;
            }

            if (entry.kind === 'directory') {
                const folderNode = {
                    id: newPath,
                    text: entry.name,
                    type: 'folder',
                    li_attr: { 'data-path': newPath }
                };

                if (depth < config.maxDepth) {
                    folderNode.children = await buildChildren(entry, newPath, depth + 1);
                } else {
                    folderNode.children = true; // JSTree lazy loading indicator
                    folderNode.li_attr['data-lazy'] = 'true';
                }
                children.push(folderNode);
            } else {
                children.push({
                    id: newPath,
                    text: entry.name,
                    type: 'file',
                    li_attr: { 'data-path': newPath },
                });
            }
            childCount++;
        }

        children.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.text.localeCompare(b.text);
        });
        return children;
    };

    const rootChildren = await buildChildren(dirHandle, '', 0);
    return [{
        id: dirHandle.name,
        text: dirHandle.name,
        type: 'folder',
        state: { opened: true },
        children: rootChildren,
    }];
};

/**
 * Loads the children of a specific directory for lazy loading.
 * @param {FileSystemDirectoryHandle} dirHandle - The handle to the directory.
 * @param {Array<string>} ignorePatterns - Patterns to ignore.
 * @param {string} pathPrefix - The path of the directory being loaded.
 * @returns {Promise<Array<object>>} - A promise that resolves to the children nodes.
 */
const loadDirectoryChildren = async (dirHandle, ignorePatterns, pathPrefix = '') => {
    const children = [];
    let childCount = 0;

    for await (const entry of dirHandle.values()) {
        if (childCount >= LAZY_LOADING_CONFIG.maxChildrenPerDirectory) {
            children.push({
                id: `${pathPrefix}/__more__`,
                text: `... (more items)`,
                type: 'placeholder',
            });
            break;
        }

        const newPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
        if (ignorePatterns.some(pattern => newPath.startsWith(pattern.replace(/\/$/, '')))) {
            continue;
        }

        if (entry.kind === 'directory') {
            children.push({
                id: newPath,
                text: entry.name,
                type: 'folder',
                children: true, // Lazy loading indicator
                li_attr: { 'data-path': newPath, 'data-lazy': 'true' }
            });
        } else {
            children.push({
                id: newPath,
                text: entry.name,
                type: 'file',
                li_attr: { 'data-path': newPath },
            });
        }
        childCount++;
    }

    children.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.text.localeCompare(b.text);
    });

    return children;
};


// Main message handler for the worker
self.onmessage = async (event) => {
    const { command, payload } = event.data;

    try {
        let result;
        switch (command) {
            case 'buildTree':
                {
                    const { dirHandle, ignorePatterns, options } = payload;
                    result = await buildTree(dirHandle, ignorePatterns, '', options);
                    break;
                }
            case 'loadDirectoryChildren':
                {
                    const { dirHandle, ignorePatterns, pathPrefix } = payload;
                    result = await loadDirectoryChildren(dirHandle, ignorePatterns, pathPrefix);
                    break;
                }
            default:
                throw new Error(`Unknown command: ${command}`);
        }
        // Post the result back to the main thread
        self.postMessage({ status: 'success', command, result });
    } catch (error) {
        // Post any errors back to the main thread
        self.postMessage({ status: 'error', command, error: { message: error.message, stack: error.stack } });
    }
};
