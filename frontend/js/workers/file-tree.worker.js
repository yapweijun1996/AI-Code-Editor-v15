self.onmessage = async (event) => {
    const { dirHandle, ignorePatterns } = event.data;
    try {
        const treeData = await buildTree(dirHandle, ignorePatterns);
        self.postMessage({ success: true, treeData });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};

async function buildTree(dirHandle, ignorePatterns, currentPath = '') {
    const children = [];
    for await (const entry of dirHandle.values()) {
        const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        if (ignorePatterns.some(pattern => newPath.startsWith(pattern.replace(/\/$/, '')))) {
            continue;
        }
        if (entry.kind === 'directory') {
            children.push({
                id: newPath,
                text: entry.name,
                type: 'folder',
                children: await buildTree(entry, ignorePatterns, newPath),
            });
        } else {
            children.push({
                id: newPath,
                text: entry.name,
                type: 'file',
                li_attr: { 'data-path': newPath },
            });
        }
    }
    // Sort so folders appear before files
    children.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.text.localeCompare(b.text);
    });
    return children;
}
