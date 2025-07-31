import { getFileHandleFromPath } from './file_system.js';
import { ChatService } from './chat_service.js';
import * as UI from './ui.js';
import { monacoModelManager } from './monaco_model_manager.js';
import { appState } from './main.js';
import { aiCompletionProvider } from './ai_completion_provider.js';

const MONACO_CDN_PATH = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs';

let editor;
let openFiles = new Map(); // Key: filePath (string), Value: { handle, name, model, viewState }
let activeFilePath = null;
let codeLensProvider = null;

function getLanguageFromExtension(ext) {
    return ({
        cfm: 'html',
        cfml: 'html',
        js: 'javascript',
        ts: 'typescript',
        java: 'java',
        py: 'python',
        html: 'html',
        css: 'css',
        json: 'json',
        md: 'markdown',
        php: 'php',
    })[ext] || 'plaintext';
}

function renderTabs(tabBarContainer, onTabClick, onTabClose) {
    tabBarContainer.innerHTML = '';
    openFiles.forEach((fileData, filePath) => {
        const tab = document.createElement('div');
        tab.className = 'tab' + (filePath === activeFilePath ? ' active' : '');
        tab.textContent = fileData.name;
        tab.onclick = () => onTabClick(filePath);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            onTabClose(filePath);
        };

        tab.appendChild(closeBtn);
        tabBarContainer.appendChild(tab);
    });
}

export function clearEditor() {
    if (editor) {
        // Use managed model instead of creating directly
        const placeholderModel = monacoModelManager.getModel(
            '__placeholder__', 
            '// Select a file to view its content',
            'plaintext'
        );
        editor.setModel(placeholderModel);
        editor.updateOptions({ readOnly: true });
    }
    
    // Dispose AI completion provider
    if (aiCompletionProvider) {
        aiCompletionProvider.dispose();
    }
    
    // Properly dispose of all open file models
    for (const [filePath] of openFiles) {
        monacoModelManager.disposeModel(filePath);
    }
    
    activeFilePath = null;
    openFiles = new Map();
}

export function initializeEditor(editorContainer, tabBarContainer, appState) {
    return new Promise((resolve) => {
        require.config({ paths: { 'vs': MONACO_CDN_PATH } });
        require(['vs/editor/editor.main'], async () => {
            monaco.editor.defineTheme('cfmlTheme', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'tag', foreground: '569cd6' },
                    { token: 'delimiter', foreground: 'd4d4d4' },
                    { token: 'attribute.name', foreground: '9cdcfe' },
                    { token: 'attribute.value', foreground: 'ce9178' },
                    { token: 'string', foreground: 'd69d85' },
                    { token: 'number', foreground: 'b5cea8' },
                    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
                ],
                colors: {
                    'editor.foreground': '#D4D4D4',
                    'editor.background': '#1E1E1E',
                    'editor.lineHighlightBackground': '#2c313c',
                    'editorCursor.foreground': '#528BFF',
                    'editorWhitespace.foreground': '#3B4048',
                    'editor.selectionBackground': '#264F78',
                    'editor.inactiveSelectionBackground': '#3A3D41',
                },
            });
            monaco.editor.setTheme('cfmlTheme');
            editor = monaco.editor.create(editorContainer, {
                value: `<!-- Click "Open Project Folder" to start -->`,
                language: 'html',
                theme: 'cfmlTheme',
                readOnly: true,
            });
            
            const onTabClick = (filePath) => switchTab(filePath, tabBarContainer);
            const onTabClose = (filePath) => closeTab(filePath, tabBarContainer);
            
            // Initial render
            renderTabs(tabBarContainer, onTabClick, onTabClose);

            // --- COMMAND REGISTRATION ---
            // All commands that will be used by providers MUST be registered before the providers themselves.

            // 1. Register 'Fix with AI' command
            editor.addCommand(0, function(ed, marker) {
                console.log('[Editor] Executing fixErrorWithAI command with marker:', marker);
                const model = ed.getModel();
                if (!model) return;
                const lineContent = model.getLineContent(marker.startLineNumber);
                
                const selection = new monaco.Selection(marker.startLineNumber, 1, marker.startLineNumber, model.getLineMaxColumn(marker.startLineNumber));
                ed.setSelection(selection);

                const prompt = `The following line of code in the file "${getActiveFilePath()}" on line ${marker.startLineNumber} has an error:\n\n` +
                               `\`\`\`\n${lineContent}\n\`\`\`\n\n` +
                               `The error message is: "${marker.message}".\n\n` +
                               `Please provide a fix for this error.`;

                const chatInput = document.getElementById('chat-input');
                chatInput.value = prompt;
                ChatService.sendMessage(chatInput, document.getElementById('chat-messages'), document.getElementById('chat-send-button'), document.getElementById('chat-cancel-button'), null, appState.clearImagePreview);
            }, 'editor.action.fixErrorWithAI');
            console.log('[Editor] Command "editor.action.fixErrorWithAI" registered.');

            // 2. Register 'Track Acceptance' command
            editor.addCommand(0, async function(ed, ...args) {
                console.log('[Editor] ai-completion.track-acceptance command executed.');
                const [completion, context, action] = args;
                try {
                    const { userAdaptationSystem } = await import('./user_adaptation_system.js');
                    await userAdaptationSystem.recordCompletionInteraction({
                        completion,
                        context,
                        action,
                        timingMs: Date.now() - (completion.requestTime || Date.now()),
                        position: ed.getPosition()
                    });
                } catch (error) {
                    console.error('[AI Completion] Failed to track interaction:', error);
                }
            }, 'ai-completion.track-acceptance');
            console.log('[Editor] Command "ai-completion.track-acceptance" registered.');

            // --- PROVIDER REGISTRATION ---
            // Now that commands are registered, we can safely register the providers that use them.

            // 1. Register Code Lens Provider
            if (codeLensProvider) codeLensProvider.dispose();
            codeLensProvider = monaco.languages.registerCodeLensProvider(['javascript', 'typescript', 'python', 'java', 'html', 'css'], {
                provideCodeLenses: function(model, token) {
                    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
                    return {
                        lenses: markers
                            .filter(marker => marker.severity === monaco.MarkerSeverity.Error)
                            .map(marker => ({
                                range: {
                                    startLineNumber: marker.startLineNumber,
                                    startColumn: marker.startColumn,
                                    endLineNumber: marker.endLineNumber,
                                    endColumn: marker.endColumn
                                },
                                id: `fixErrorLens_${marker.startLineNumber}`,
                                command: {
                                    id: "editor.action.fixErrorWithAI",
                                    title: "✨ Fix with AI",
                                    arguments: [marker]
                                }
                            })),
                        dispose: () => {}
                    };
                }
            });
            console.log('[Editor] CodeLens provider registered.');

            // --- OTHER ACTIONS ---
            // These do not depend on the critical command-provider chain.

            // Register toggle command for AI completions
            editor.addAction({
                id: 'ai-completion.toggle',
                label: 'Toggle AI Completions',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA],
                run: function() {
                    const currentState = aiCompletionProvider.isEnabled;
                    aiCompletionProvider.setEnabled(!currentState);
                    UI.showInfo(`AI Completions ${!currentState ? 'enabled' : 'disabled'}`);
                }
            });

            // Register "Ask AI to fix this code" context menu action
            editor.addAction({
                id: 'ai-completion.fix-selected-code',
                label: 'Ask AI to fix this code',
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.6,
                precondition: 'editorHasSelection',
                run: function(ed) {
                    const selection = ed.getSelection();
                    const model = ed.getModel();
                    if (!selection || selection.isEmpty()) return;
                    
                    const selectedText = model.getValueInRange(selection);
                    const prompt = `I need help fixing this code from "${getActiveFilePath()}" (lines ${selection.startLineNumber}-${selection.endLineNumber}):\n\n` +
                                  `\`\`\`${model.getLanguageId()}\n${selectedText}\n\`\`\`\n\n` +
                                  `Please analyze this code, identify any issues, and provide a corrected version.`;
                    
                    const chatInput = document.getElementById('chat-input');
                    chatInput.value = prompt;
                    ChatService.sendMessage(chatInput, document.getElementById('chat-messages'), document.getElementById('chat-send-button'), document.getElementById('chat-cancel-button'), null, appState.clearImagePreview);
                }
            });

            // 2. Register AI Completion Provider - THIS MUST BE LAST
            console.log('[Editor] All commands and actions registered. Now registering AI Completion Provider.');
            try {
                const registered = await aiCompletionProvider.register();
                if (registered) {
                    console.log('[Editor] AI completion provider registered successfully');
                } else {
                    console.warn('[Editor] AI completion provider registration failed.');
                }
            } catch (error) {
                console.error('[Editor] Failed to initialize AI completion provider:', error);
                UI.showError('Failed to initialize AI completions.');
            }

            resolve(editor);
        });
    });
}

export async function openFile(fileHandle, filePath, tabBarContainer, focusEditor = true) {
    if (openFiles.has(filePath)) {
        await switchTab(filePath, tabBarContainer, focusEditor);
        return;
    }

    try {
        const file = await fileHandle.getFile();
        const content = await file.text();

        // Use managed model creation
        const model = monacoModelManager.getModel(
            filePath,
            content,
            getLanguageFromExtension(file.name.split('.').pop())
        );

        openFiles.set(filePath, {
            handle: fileHandle,
            name: file.name,
            model: model,
            viewState: null,
        });

        await switchTab(filePath, tabBarContainer, focusEditor);
    } catch (error) {
        console.error(`Failed to open file ${filePath}:`, error);
        UI.showError(`Failed to open file: ${error.message}`);
    }
}

export async function switchTab(filePath, tabBarContainer, focusEditor = true) {
    if (activeFilePath && openFiles.has(activeFilePath)) {
        openFiles.get(activeFilePath).viewState = editor.saveViewState();
    }

    activeFilePath = filePath;
    const fileData = openFiles.get(filePath);

    editor.setModel(fileData.model);
    if (fileData.viewState) {
        editor.restoreViewState(fileData.viewState);
    }
    if (focusEditor) {
        editor.focus();
    }
    editor.updateOptions({ readOnly: false });
    
    const onTabClick = (fp) => switchTab(fp, tabBarContainer, true); // User clicks always focus
    const onTabClose = (fp) => closeTab(fp, tabBarContainer);
    renderTabs(tabBarContainer, onTabClick, onTabClose);
}

export function updateTabId(oldPath, newPath, newName) {
    if (openFiles.has(oldPath)) {
        const fileData = openFiles.get(oldPath);
        openFiles.delete(oldPath);

        fileData.name = newName;
        openFiles.set(newPath, fileData);

        monacoModelManager.renameModel(oldPath, newPath);

        if (activeFilePath === oldPath) {
            activeFilePath = newPath;
        }

        const tabBarContainer = document.getElementById('tab-bar');
        const onTabClick = (fp) => switchTab(fp, tabBarContainer);
        const onTabClose = (fp) => closeTab(fp, tabBarContainer);
        renderTabs(tabBarContainer, onTabClick, onTabClose);
    }
}

export function updateTabPathsForFolderRename(oldFolderPath, newFolderPath) {
    const tabBarContainer = document.getElementById('tab-bar');
    const onTabClick = (fp) => switchTab(fp, tabBarContainer);
    const onTabClose = (fp) => closeTab(fp, tabBarContainer);
    const pathsToUpdate = [];

    for (const [filePath, fileData] of openFiles.entries()) {
        if (filePath.startsWith(oldFolderPath + '/')) {
            pathsToUpdate.push(filePath);
        }
    }

    if (pathsToUpdate.length > 0) {
        for (const oldPath of pathsToUpdate) {
            const newPath = oldPath.replace(oldFolderPath, newFolderPath);
            const fileData = openFiles.get(oldPath);
            
            openFiles.delete(oldPath);
            openFiles.set(newPath, fileData);
            monacoModelManager.renameModel(oldPath, newPath);

            if (activeFilePath === oldPath) {
                activeFilePath = newPath;
            }
        }
        renderTabs(tabBarContainer, onTabClick, onTabClose);
    }
}

export function closeTab(filePath, tabBarContainer) {
    const fileData = openFiles.get(filePath);
    if (fileData && fileData.model) {
        // Use model manager for proper disposal
        monacoModelManager.disposeModel(filePath);
    }
    openFiles.delete(filePath);

    if (activeFilePath === filePath) {
        activeFilePath = null;
        const nextFile = openFiles.keys().next().value;
        if (nextFile) {
            switchTab(nextFile, tabBarContainer);
        } else {
            clearEditor();
            renderTabs(tabBarContainer, () => {}, () => {});
        }
    } else {
        const onTabClick = (fp) => switchTab(fp, tabBarContainer);
        const onTabClose = (fp) => closeTab(fp, tabBarContainer);
        renderTabs(tabBarContainer, onTabClick, onTabClose);
    }
}

export async function saveActiveFile() {
    if (!activeFilePath) return;
    try {
        const fileData = openFiles.get(activeFilePath);
        const writable = await fileData.handle.createWritable();
        await writable.write(fileData.model.getValue());
        await writable.close();
        console.log(`File '${fileData.name}' saved successfully`);
    } catch (error) {
        console.error(`Failed to save file:`, error);
    }
}

export async function saveAllOpenFiles() {
    for (const [filePath, fileData] of openFiles.entries()) {
        try {
            const writable = await fileData.handle.createWritable();
            await writable.write(fileData.model.getValue());
            await writable.close();
            console.log(`File '${fileData.name}' saved successfully.`);
        } catch (error) {
            console.error(`Failed to save file '${fileData.name}':`, error);
        }
    }
}

export function getActiveFile() {
    if (!activeFilePath) return null;
    return openFiles.get(activeFilePath);
}

export function getEditorInstance() {
    return editor;
}

export function getOpenFiles() {
    return openFiles;
}

export function getActiveFilePath() {
    return activeFilePath;
}

export function getPrettierParser(filename) {
    const extension = filename.split('.').pop();
    switch (extension) {
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
        return 'babel';
        case 'html':
        return 'html';
        case 'css':
        case 'scss':
        case 'less':
        return 'css';
        case 'json':
        return 'json';
        case 'md':
        return 'markdown';
        default:
        return 'babel';
    }
}

export function getEditorState() {
    if (activeFilePath && openFiles.has(activeFilePath)) {
        openFiles.get(activeFilePath).viewState = editor.saveViewState();
    }

    const files = [];
    for (const [path, data] of openFiles.entries()) {
        files.push({
            path: path,
            content: data.model.getValue(),
            viewState: data.viewState,
        });
    }

    return {
        openFiles: files,
        activeFile: activeFilePath,
    };
}

export async function restoreEditorState(state, rootHandle, tabBarContainer) {
    if (!state || !state.openFiles) return;

    for (const fileData of state.openFiles) {
        try {
            const fileHandle = await getFileHandleFromPath(rootHandle, fileData.path, { create: true });
            // Use managed model creation
            const model = monacoModelManager.getModel(
                fileData.path,
                fileData.content,
                getLanguageFromExtension(fileData.path.split('.').pop())
            );
            openFiles.set(fileData.path, {
                handle: fileHandle,
                name: fileHandle.name,
                model: model,
                viewState: fileData.viewState,
            });
        } catch (error) {
            console.error(`Could not restore file ${fileData.path}:`, error);
        }
    }

    if (state.activeFile && openFiles.has(state.activeFile)) {
        await switchTab(state.activeFile, tabBarContainer, true);
    } else if (openFiles.size > 0) {
        // If active file is gone, open the first available one
        const firstFile = openFiles.keys().next().value;
        await switchTab(firstFile, tabBarContainer, true);
    } else {
        // No files to restore, just render empty tabs
        renderTabs(tabBarContainer, () => {}, () => {});
    }
}
export async function restoreCheckpointState(state, rootHandle, tabBarContainer) {
    // Close all current tabs without saving their state
    const currentFiles = Array.from(openFiles.keys());
    for (const filePath of currentFiles) {
        const fileData = openFiles.get(filePath);
        if (fileData && fileData.model) {
            // Use model manager for proper disposal
            monacoModelManager.disposeModel(filePath);
        }
        openFiles.delete(filePath);
    }
    activeFilePath = null;

    // Restore files from the checkpoint state
    await restoreEditorState(state, rootHandle, tabBarContainer);
}

export function getModelMarkers(filePath) {
    const fileData = openFiles.get(filePath);
    if (!fileData || !fileData.model) {
        return [];
    }
    return monaco.editor.getModelMarkers({ resource: fileData.model.uri });
}

export function getFormattedErrors(filePath) {
    const markers = getModelMarkers(filePath);
    const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error);

    if (errors.length === 0) {
        return null;
    }

    return errors.map(e => `- Line ${e.startLineNumber}, Col ${e.startColumn}: ${e.message}`).join('\n');
}
