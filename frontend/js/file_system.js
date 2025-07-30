export async function getIgnorePatterns(rootDirHandle) {
    try {
        const ignoreFileHandle = await rootDirHandle.getFileHandle('.ai_ignore');
        const file = await ignoreFileHandle.getFile();
        const content = await file.text();
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch (e) {
        return [];
    }
}

export async function getFileHandleFromPath(dirHandle, path, options = {}) {
    const parts = path.split('/').filter((p) => p);
    let currentHandle = dirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: options.create });
    }
    return await currentHandle.getFileHandle(parts[parts.length - 1], options);
}

export async function getParentDirectoryHandle(rootDirHandle, path) {
    const parts = path.split('/').filter((p) => p);
    if (parts.length === 0) {
        throw new Error('Invalid path provided. Cannot get parent of root.');
    }

    let currentHandle = rootDirHandle;
    // Traverse to the parent directory
    for (let i = 0; i < parts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }

    const entryName = parts[parts.length - 1];
    return { parentHandle: currentHandle, entryName };
}

export async function createDirectoryFromPath(dirHandle, path) {
    const parts = path.split('/').filter((p) => p);
    let currentHandle = dirHandle;
    for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
    return currentHandle;
}

export async function getDirectoryHandleFromPath(dirHandle, path) {
    const parts = path.split('/').filter((p) => p);
    let currentHandle = dirHandle;
    for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
    }
    return currentHandle;
}

async function getEntryHandleFromPath(rootDirHandle, path) {
    try {
        const handle = await getDirectoryHandleFromPath(rootDirHandle, path);
        return { handle, isDirectory: true };
    } catch (e) {
        if (e.name === 'TypeMismatchError' || e.name === 'NotFoundError') {
            try {
                const handle = await getFileHandleFromPath(rootDirHandle, path);
                return { handle, isDirectory: false };
            } catch (fileError) {
                throw new Error(`Entry not found at path: ${path}`);
            }
        }
        throw e;
    }
}

export async function renameEntry(rootDirHandle, oldPath, newPath) {
    const { handle: oldHandle, isDirectory } = await getEntryHandleFromPath(rootDirHandle, oldPath);

    if (isDirectory) {
        await createDirectoryFromPath(rootDirHandle, newPath);
        for await (const entry of oldHandle.values()) {
            await renameEntry(
                rootDirHandle,
                `${oldPath}/${entry.name}`,
                `${newPath}/${entry.name}`
            );
        }
    } else {
        const file = await oldHandle.getFile();
        const content = await file.arrayBuffer();
        const newFileHandle = await getFileHandleFromPath(rootDirHandle, newPath, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    await deleteEntry(rootDirHandle, oldPath);
}

export async function deleteEntry(rootDirHandle, path) {
    const { parentHandle, entryName } = await getParentDirectoryHandle(rootDirHandle, path);
    let isDirectory = false;
    try {
        await parentHandle.getDirectoryHandle(entryName);
        isDirectory = true;
    } catch (e) {
        // It's a file
    }
    await parentHandle.removeEntry(entryName, { recursive: isDirectory });
}


export async function searchInDirectory(
    dirHandle,
    searchTerm,
    currentPath,
    results,
    ignorePatterns,
    useRegex = false,
    caseSensitive = false
) {
    for await (const entry of dirHandle.values()) {
        const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        if (ignorePatterns.some(pattern => newPath.startsWith(pattern.replace(/\/$/, '')))) {
            continue;
        }

        if (entry.kind === 'file') {
            try {
                const file = await entry.getFile();
                const content = await file.text();
                const lines = content.split('\n');
                const fileMatches = [];
                for (let i = 0; i < lines.length; i++) {
                    if (useRegex) {
                        const regex = new RegExp(searchTerm, caseSensitive ? '' : 'i');
                        if (regex.test(lines[i])) {
                            fileMatches.push({
                                line_number: i + 1,
                                line_content: lines[i].trim(),
                            });
                        }
                    } else {
                        const line = caseSensitive ? lines[i] : lines[i].toLowerCase();
                        const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
                        if (line.includes(term)) {
                            fileMatches.push({
                                line_number: i + 1,
                                line_content: lines[i].trim(),
                            });
                        }
                    }
                }
                if (fileMatches.length > 0) {
                    results.push({
                        file: newPath,
                        matches: fileMatches,
                    });
                }
            } catch (readError) {
                console.warn(`Could not read file ${newPath}:`, readError);
                results.push({
                    file: newPath,
                    error: `Could not read file: ${readError.message}`
                });
            }
        } else if (entry.kind === 'directory') {
            await searchInDirectory(entry, searchTerm, newPath, results, ignorePatterns);
        }
    }
}


// Lazy loading configuration
const LAZY_LOADING_CONFIG = {
    maxDepth: 2, // Only load 2 levels deep initially
    maxChildrenPerDirectory: 1000, // Limit children per directory for performance
    batchSize: 500, // Load files in batches of 500
    enableProgressiveLoading: true
};

export const buildTree = async (dirHandle, ignorePatterns, currentPath = '', options = {}) => {
    const config = { ...LAZY_LOADING_CONFIG, ...options };
    
    const buildChildren = async (currentDirHandle, pathPrefix, depth = 0) => {
        const children = [];
        let childCount = 0;
        
        // Progress callback for large directories
        const progressCallback = options.progressCallback;
        
        for await (const entry of currentDirHandle.values()) {
            // Limit children per directory to prevent UI freeze
            if (childCount >= config.maxChildrenPerDirectory) {
                console.warn(`Directory ${pathPrefix} has more than ${config.maxChildrenPerDirectory} children. Some files may not be shown.`);
                children.push({
                    id: `${pathPrefix}/__more__`,
                    text: `... (${await countRemainingEntries(currentDirHandle, childCount)} more items)`,
                    type: 'placeholder',
                    li_attr: {
                        'data-path': pathPrefix,
                        'data-remaining': await countRemainingEntries(currentDirHandle, childCount),
                        'data-loaded': config.maxChildrenPerDirectory
                    }
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
                    li_attr: { 'data-path': newPath, 'data-handle': entry }
                };
                
                // Lazy loading: only load children up to maxDepth
                if (depth < config.maxDepth) {
                    folderNode.children = await buildChildren(entry, newPath, depth + 1);
                } else {
                    // Mark as lazy-loadable
                    folderNode.children = true; // JSTree lazy loading indicator
                    folderNode.li_attr['data-lazy'] = 'true';
                }
                
                children.push(folderNode);
            } else {
                children.push({
                    id: newPath,
                    text: entry.name,
                    type: 'file',
                    li_attr: { 'data-path': newPath, 'data-handle': entry },
                });
            }
            
            childCount++;
            
            // Progress reporting
            if (progressCallback && childCount % 50 === 0) {
                progressCallback(childCount, pathPrefix);
                // Yield to UI thread periodically
                await new Promise(resolve => setTimeout(resolve, 0));
            }
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

// Helper function to count remaining entries
async function countRemainingEntries(dirHandle, skipCount) {
    let count = 0;
    let current = 0;
    for await (const entry of dirHandle.values()) {
        if (current >= skipCount) {
            count++;
        }
        current++;
    }
    return count;
}

// New function for lazy loading directory children
export const loadDirectoryChildren = async (dirHandle, ignorePatterns, pathPrefix = '') => {
    const children = [];
    let childCount = 0;
    
    for await (const entry of dirHandle.values()) {
        if (childCount >= LAZY_LOADING_CONFIG.maxChildrenPerDirectory) {
            children.push({
                id: `${pathPrefix}/__more__`,
                text: `... (${await countRemainingEntries(dirHandle, childCount)} more items)`,
                type: 'placeholder',
                li_attr: {
                    'data-path': pathPrefix,
                    'data-remaining': await countRemainingEntries(dirHandle, childCount),
                    'data-loaded': LAZY_LOADING_CONFIG.maxChildrenPerDirectory
                }
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
                li_attr: { 'data-path': newPath, 'data-handle': entry, 'data-lazy': 'true' }
            });
        } else {
            children.push({
                id: newPath,
                text: entry.name,
                type: 'file',
                li_attr: { 'data-path': newPath, 'data-handle': entry },
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
export async function verifyAndRequestPermission(fileHandle, withWrite = false) {
    const options = { mode: withWrite ? 'readwrite' : 'read' };
    if (await fileHandle.queryPermission(options) === 'granted') {
        return true;
    }
    if (await fileHandle.requestPermission(options) === 'granted') {
        return true;
    }
    // The user didn't grant permission, so we can't proceed.
    return false;
}
/**
 * Creates a file system adapter for isomorphic-git to use the File System Access API.
 * @param {FileSystemDirectoryHandle} rootDirectoryHandle - The root directory handle.
 * @returns {object} An fs-like object for isomorphic-git.
 */
export function createFsAdapter(rootDirectoryHandle) {
    const getHandle = async (filepath, create = false) => {
        const parts = filepath.split('/').filter(p => p);
        let handle = rootDirectoryHandle;
        for (let i = 0; i < parts.length - 1; i++) {
            handle = await handle.getDirectoryHandle(parts[i], { create });
        }
        return { dir: handle, name: parts[parts.length - 1] };
    };

    return {
        promises: {
            async readFile(filepath, options) {
                try {
                    const { dir, name } = await getHandle(filepath);
                    const fileHandle = await dir.getFileHandle(name);
                    const file = await fileHandle.getFile();
                    const content = await file.text();
                    return options && options.encoding === 'utf8' ? content : new TextEncoder().encode(content);
                } catch (e) {
                    throw new Error(`ENOENT: no such file or directory, open '${filepath}'`);
                }
            },
            async writeFile(filepath, data) {
                const { dir, name } = await getHandle(filepath, true);
                const fileHandle = await dir.getFileHandle(name, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(data);
                await writable.close();
            },
            async unlink(filepath) {
                const { dir, name } = await getHandle(filepath);
                await dir.removeEntry(name);
            },
            async mkdir(filepath) {
                const parts = filepath.split('/').filter(p => p);
                let handle = rootDirectoryHandle;
                for (const part of parts) {
                    handle = await handle.getDirectoryHandle(part, { create: true });
                }
            },
            async rmdir(filepath) {
                const { dir, name } = await getHandle(filepath);
                await dir.removeEntry(name, { recursive: true });
            },
            async stat(filepath) {
                try {
                    const { dir, name } = await getHandle(filepath);
                    const handle = await dir.getDirectoryHandle(name).catch(() => dir.getFileHandle(name));
                    const file = handle.kind === 'file' ? await handle.getFile() : null;
                    return {
                        isFile: () => handle.kind === 'file',
                        isDirectory: () => handle.kind === 'directory',
                        size: file ? file.size : 0,
                        mtimeMs: file ? file.lastModified : 0,
                    };
                } catch (e) {
                     throw new Error(`ENOENT: no such file or directory, lstat '${filepath}'`);
                }
            },
            async lstat(filepath) {
                return this.stat(filepath); // Simplified for this use case
            },
            async readdir(filepath) {
                let handle = rootDirectoryHandle;
                if (filepath !== '.' && filepath !== '/') {
                    const parts = filepath.split('/').filter(p => p);
                    for (const part of parts) {
                       handle = await handle.getDirectoryHandle(part);
                    }
                }
                const entries = [];
                for await (const name of handle.keys()) {
                    entries.push(name);
                }
                return entries;
            },
        }
    };
}

// Functions for project structure tool
export async function buildStructureTree(dirHandle, ignorePatterns, currentPath = '') {
    const tree = { name: 'root', type: 'folder', children: [] };
    await buildStructureTreeRecursive(dirHandle, ignorePatterns, tree, currentPath);
    return tree;
}

async function buildStructureTreeRecursive(dirHandle, ignorePatterns, parentNode, currentPath = '') {
    for await (const entry of dirHandle.values()) {
        const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        
        // Check if this path should be ignored
        if (ignorePatterns.some(pattern => {
            const normalizedPattern = pattern.replace(/\/$/, '');
            return newPath.startsWith(normalizedPattern) || entry.name === normalizedPattern;
        })) {
            continue;
        }

        const node = {
            name: entry.name,
            type: entry.kind === 'directory' ? 'folder' : 'file',
            path: newPath
        };

        if (entry.kind === 'directory') {
            node.children = [];
            await buildStructureTreeRecursive(entry, ignorePatterns, node, newPath);
        }

        parentNode.children.push(node);
    }

    // Sort children: folders first, then files, both alphabetically
    parentNode.children.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
}

export function formatTreeToString(tree, indent = '', isLast = true) {
    if (!tree || tree.name === 'root') {
        // For root, just format its children
        if (!tree.children || tree.children.length === 0) {
            return 'Project directory is empty.';
        }
        return tree.children
            .map((child, index) => formatTreeToString(child, '', index === tree.children.length - 1))
            .join('\n');
    }

    const prefix = isLast ? '└── ' : '├── ';
    const nextIndent = indent + (isLast ? '    ' : '│   ');
    
    let result = indent + prefix + tree.name;
    
    if (tree.type === 'folder' && tree.children && tree.children.length > 0) {
        const childrenStr = tree.children
            .map((child, index) => formatTreeToString(child, nextIndent, index === tree.children.length - 1))
            .join('\n');
        result += '\n' + childrenStr;
    }
    
    return result;
}
