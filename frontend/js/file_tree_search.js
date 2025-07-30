/**
 * File Tree Search
 * Enhanced search functionality for the file tree with semantic understanding
 */

import { semanticIndexer } from './semantic_indexer.js';
import { performanceOptimizer } from './performance_optimizer.js';

class FileTreeSearch {
    constructor() {
        this.searchCache = performanceOptimizer.createSmartCache(50, 5 * 60 * 1000);
        this.searchHistory = [];
        this.maxHistorySize = 20;
        this.init();
    }

    init() {
        this.setupSearchUI();
        this.setupEventListeners();
    }

    setupSearchUI() {
        // Create search container if it doesn't exist
        const existingSearch = document.getElementById('file-search-container');
        if (existingSearch) return;

        const searchContainer = document.createElement('div');
        searchContainer.id = 'file-search-container';
        searchContainer.className = 'file-search-container';
        searchContainer.innerHTML = `
            <div class="search-input-container">
                <input type="text" 
                       id="file-search-input" 
                       placeholder="Search files... (Ctrl+F)"
                       class="file-search-input">
                <button id="search-options-btn" class="search-options-btn" title="Search Options">⚙️</button>
                <button id="clear-search-btn" class="clear-search-btn" title="Clear Search">×</button>
            </div>
            <div class="search-options" id="search-options" style="display: none;">
                <label><input type="checkbox" id="search-content" checked> Search file content</label>
                <label><input type="checkbox" id="search-semantic" checked> Semantic search</label>
                <label><input type="checkbox" id="case-sensitive"> Case sensitive</label>
                <label><input type="checkbox" id="regex-search"> Regular expression</label>
            </div>
            <div class="search-results" id="search-results" style="display: none;">
                <div class="results-header">
                    <span class="results-count" id="results-count">0 results</span>
                    <div class="results-controls">
                        <button id="expand-all-results" title="Expand All">📂</button>
                        <button id="collapse-all-results" title="Collapse All">📁</button>
                    </div>
                </div>
                <div class="results-list" id="results-list"></div>
            </div>
        `;

        // Insert search container at the top of file tree
        const fileTreeContainer = document.getElementById('file-tree-container');
        if (fileTreeContainer) {
            fileTreeContainer.insertBefore(searchContainer, fileTreeContainer.firstChild);
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('file-search-input');
        const searchOptionsBtn = document.getElementById('search-options-btn');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const searchOptions = document.getElementById('search-options');

        if (!searchInput) return;

        // Search input handlers
        searchInput.addEventListener('input', this.debounce((e) => {
            this.performSearch(e.target.value);
        }, 300));

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(e.target.value, { immediate: true });
            }
            if (e.key === 'Escape') {
                this.clearSearch();
            }
        });

        // Options toggle
        if (searchOptionsBtn) {
            searchOptionsBtn.addEventListener('click', () => {
                const isVisible = searchOptions.style.display !== 'none';
                searchOptions.style.display = isVisible ? 'none' : 'block';
            });
        }

        // Clear search
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Search options change
        searchOptions?.addEventListener('change', () => {
            if (searchInput.value.trim()) {
                this.performSearch(searchInput.value);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+F to focus search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
        });
    }

    async performSearch(query, options = {}) {
        if (!query.trim()) {
            this.clearSearchResults();
            return;
        }

        const cacheKey = this.generateSearchCacheKey(query, options);
        if (this.searchCache.has(cacheKey) && !options.immediate) {
            this.displaySearchResults(this.searchCache.get(cacheKey), query);
            return;
        }

        try {
            performanceOptimizer.startTimer('fileTreeSearch');
            
            const searchOptions = this.getSearchOptions();
            const results = await this.executeSearch(query, searchOptions);
            
            // Cache results
            this.searchCache.set(cacheKey, results);
            
            // Add to search history
            this.addToSearchHistory(query);
            
            // Display results
            this.displaySearchResults(results, query);
            
            performanceOptimizer.endTimer('fileTreeSearch');
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showSearchError(error.message);
        }
    }

    async executeSearch(query, options) {
        const results = {
            files: [],
            totalMatches: 0,
            searchTime: Date.now()
        };

        // Get file tree data from the DOM or file system
        const fileTreeData = this.getFileTreeData();
        
        // File name search
        const nameMatches = this.searchFileNames(query, fileTreeData, options);
        results.files.push(...nameMatches);

        // Semantic search (if enabled and semantic indexer is available)
        if (options.semantic && semanticIndexer.isIndexBuilt()) {
            const semanticMatches = semanticIndexer.searchSemanticFiles(query, 20);
            const processedSemanticMatches = semanticMatches.map(match => ({
                path: match.path,
                name: match.path.split('/').pop(),
                type: 'semantic',
                relevance: match.relevance,
                matchingConcepts: match.matchingConcepts || [],
                highlights: []
            }));
            
            // Merge with existing results, avoiding duplicates
            this.mergeSearchResults(results.files, processedSemanticMatches);
        }

        // Content search (if enabled)
        if (options.content) {
            const contentMatches = await this.searchFileContent(query, options);
            this.mergeSearchResults(results.files, contentMatches);
        }

        // Sort results by relevance
        results.files.sort((a, b) => {
            // Prioritize exact name matches
            if (a.type === 'name' && b.type !== 'name') return -1;
            if (b.type === 'name' && a.type !== 'name') return 1;
            
            // Then by relevance score
            return (b.relevance || 0) - (a.relevance || 0);
        });

        results.totalMatches = results.files.length;
        return results;
    }

    searchFileNames(query, fileTreeData, options) {
        const matches = [];
        const queryLower = options.caseSensitive ? query : query.toLowerCase();
        const isRegex = options.regex;
        
        let searchPattern;
        if (isRegex) {
            try {
                searchPattern = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
            } catch (e) {
                // Invalid regex, fall back to string search
                isRegex = false;
            }
        }

        const searchFiles = (nodes) => {
            for (const node of nodes) {
                const fileName = node.text || node.name || '';
                const filePath = node.id || node.path || '';
                const searchTarget = options.caseSensitive ? fileName : fileName.toLowerCase();
                
                let isMatch = false;
                let highlights = [];
                
                if (isRegex && searchPattern) {
                    const regexMatches = [...fileName.matchAll(searchPattern)];
                    if (regexMatches.length > 0) {
                        isMatch = true;
                        highlights = regexMatches.map(match => ({
                            start: match.index,
                            length: match[0].length,
                            text: match[0]
                        }));
                    }
                } else {
                    const index = searchTarget.indexOf(queryLower);
                    if (index !== -1) {
                        isMatch = true;
                        highlights = [{
                            start: index,
                            length: query.length,
                            text: fileName.substring(index, index + query.length)
                        }];
                    }
                }
                
                if (isMatch) {
                    matches.push({
                        path: filePath,
                        name: fileName,
                        type: 'name',
                        relevance: this.calculateNameRelevance(fileName, query, highlights),
                        highlights: highlights,
                        isDirectory: node.type === 'folder',
                        parent: this.getParentPath(filePath)
                    });
                }
                
                // Recursively search children
                if (node.children && Array.isArray(node.children)) {
                    searchFiles(node.children);
                }
            }
        };

        searchFiles(fileTreeData);
        return matches;
    }

    async searchFileContent(query, options) {
        // This would require reading file contents
        // For now, return empty array as content search needs file system access
        return [];
    }

    displaySearchResults(results, query) {
        const resultsContainer = document.getElementById('search-results');
        const resultsCount = document.getElementById('results-count');
        const resultsList = document.getElementById('results-list');

        if (!resultsContainer || !resultsCount || !resultsList) return;

        resultsContainer.style.display = 'block';
        resultsCount.textContent = `${results.totalMatches} result${results.totalMatches !== 1 ? 's' : ''}`;

        if (results.totalMatches === 0) {
            resultsList.innerHTML = `
                <div class="no-results">
                    <p>No files found matching "${query}"</p>
                    <div class="search-suggestions">
                        <p>Try:</p>
                        <ul>
                            <li>Different keywords</li>
                            <li>Checking spelling</li>
                            <li>Using semantic search</li>
                            <li>Enabling content search</li>
                        </ul>
                    </div>
                </div>
            `;
            return;
        }

        const resultHTML = results.files.map(file => {
            const highlightedName = this.highlightMatches(file.name, file.highlights);
            const typeIcon = this.getFileTypeIcon(file);
            const relevanceBar = this.createRelevanceBar(file.relevance);
            
            return `
                <div class="search-result-item" data-path="${file.path}">
                    <div class="result-main">
                        <span class="result-icon">${typeIcon}</span>
                        <span class="result-name">${highlightedName}</span>
                        <span class="result-type">${file.type}</span>
                    </div>
                    <div class="result-details">
                        <div class="result-path">${file.path}</div>
                        ${relevanceBar}
                        ${file.matchingConcepts ? `
                            <div class="matching-concepts">
                                ${file.matchingConcepts.slice(0, 3).map(concept => 
                                    `<span class="concept-tag">${concept}</span>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        resultsList.innerHTML = resultHTML;

        // Add click handlers
        resultsList.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const filePath = item.dataset.path;
                this.openSearchResult(filePath);
            });
        });
    }

    clearSearch() {
        const searchInput = document.getElementById('file-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        this.clearSearchResults();
    }

    clearSearchResults() {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }

    // Utility methods
    getSearchOptions() {
        return {
            content: document.getElementById('search-content')?.checked || false,
            semantic: document.getElementById('search-semantic')?.checked || false,
            caseSensitive: document.getElementById('case-sensitive')?.checked || false,
            regex: document.getElementById('regex-search')?.checked || false
        };
    }

    getFileTreeData() {
        // Try to get data from JSTree instance
        const fileTree = document.getElementById('file-tree');
        if (fileTree && window.$ && window.$().jstree) {
            try {
                const jstreeInstance = window.$(fileTree).jstree(true);
                if (jstreeInstance) {
                    return jstreeInstance.get_json('#', { flat: false });
                }
            } catch (e) {
                console.warn('Could not get JSTree data:', e);
            }
        }
        
        // Fallback: parse DOM tree
        return this.parseFileTreeFromDOM();
    }

    parseFileTreeFromDOM() {
        const nodes = [];
        const fileTree = document.getElementById('file-tree');
        if (!fileTree) return nodes;

        const parseNode = (element) => {
            const anchor = element.querySelector('a');
            if (!anchor) return null;

            const node = {
                id: element.id,
                text: anchor.textContent.trim(),
                type: element.getAttribute('data-jstree') ? 
                      JSON.parse(element.getAttribute('data-jstree')).type : 'file',
                children: []
            };

            // Parse children
            const childList = element.querySelector('ul');
            if (childList) {
                const childNodes = childList.querySelectorAll('li');
                childNodes.forEach(childNode => {
                    const childData = parseNode(childNode);
                    if (childData) {
                        node.children.push(childData);
                    }
                });
            }

            return node;
        };

        const rootNodes = fileTree.querySelectorAll('ul > li');
        rootNodes.forEach(rootNode => {
            const nodeData = parseNode(rootNode);
            if (nodeData) {
                nodes.push(nodeData);
            }
        });

        return nodes;
    }

    calculateNameRelevance(fileName, query, highlights) {
        let relevance = 0;
        
        // Exact match gets highest score
        if (fileName.toLowerCase() === query.toLowerCase()) {
            relevance = 1.0;
        }
        // Starts with query
        else if (fileName.toLowerCase().startsWith(query.toLowerCase())) {
            relevance = 0.9;
        }
        // Contains query
        else {
            relevance = 0.7;
        }
        
        // Boost shorter file names (more specific matches)
        relevance += Math.max(0, (50 - fileName.length) / 100);
        
        // Boost multiple matches
        if (highlights.length > 1) {
            relevance += highlights.length * 0.1;
        }
        
        return Math.min(relevance, 1.0);
    }

    highlightMatches(text, highlights) {
        if (!highlights || highlights.length === 0) {
            return text;
        }
        
        // Sort highlights by position (descending) to avoid offset issues
        const sortedHighlights = [...highlights].sort((a, b) => b.start - a.start);
        
        let result = text;
        sortedHighlights.forEach(highlight => {
            const before = result.substring(0, highlight.start);
            const match = result.substring(highlight.start, highlight.start + highlight.length);
            const after = result.substring(highlight.start + highlight.length);
            result = before + `<mark class="search-highlight">${match}</mark>` + after;
        });
        
        return result;
    }

    getFileTypeIcon(file) {
        if (file.isDirectory) return '📁';
        
        const ext = file.name.split('.').pop()?.toLowerCase();
        const iconMap = {
            'js': '📄',
            'ts': '📄',
            'jsx': '⚛️',
            'tsx': '⚛️',
            'html': '🌐',
            'css': '🎨',
            'json': '📋',
            'md': '📝',
            'py': '🐍',
            'java': '☕',
            'cpp': '⚙️',
            'c': '⚙️',
            'php': '🐘',
            'rb': '💎',
            'go': '🐹',
            'rs': '🦀',
            'swift': '🦉',
            'kt': '🤖'
        };
        
        return iconMap[ext] || '📄';
    }

    createRelevanceBar(relevance) {
        const percentage = Math.round((relevance || 0) * 100);
        return `
            <div class="relevance-bar" title="Relevance: ${percentage}%">
                <div class="relevance-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    }

    mergeSearchResults(existingResults, newResults) {
        const existingPaths = new Set(existingResults.map(r => r.path));
        
        newResults.forEach(newResult => {
            if (!existingPaths.has(newResult.path)) {
                existingResults.push(newResult);
                existingPaths.add(newResult.path);
            } else {
                // Update existing result with higher relevance
                const existingIndex = existingResults.findIndex(r => r.path === newResult.path);
                if (existingIndex !== -1 && (newResult.relevance || 0) > (existingResults[existingIndex].relevance || 0)) {
                    existingResults[existingIndex] = { ...existingResults[existingIndex], ...newResult };
                }
            }
        });
    }

    openSearchResult(filePath) {
        // Close search results
        this.clearSearchResults();
        
        // Trigger file selection
        if (window.appState?.onFileSelect) {
            window.appState.onFileSelect(filePath);
        }
        
        // Highlight the file in the tree
        this.highlightFileInTree(filePath);
    }

    highlightFileInTree(filePath) {
        const fileTree = document.getElementById('file-tree');
        if (!fileTree) return;

        // Remove existing highlights
        fileTree.querySelectorAll('.search-highlighted').forEach(el => {
            el.classList.remove('search-highlighted');
        });

        // Add highlight to selected file
        const fileNode = fileTree.querySelector(`li[id="${filePath}"]`);
        if (fileNode) {
            fileNode.classList.add('search-highlighted');
            fileNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    addToSearchHistory(query) {
        // Remove existing occurrence
        this.searchHistory = this.searchHistory.filter(q => q !== query);
        
        // Add to beginning
        this.searchHistory.unshift(query);
        
        // Limit size
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
        }
    }

    generateSearchCacheKey(query, options) {
        const opts = this.getSearchOptions();
        return `${query}|${opts.content}|${opts.semantic}|${opts.caseSensitive}|${opts.regex}`;
    }

    getParentPath(filePath) {
        const parts = filePath.split('/');
        return parts.slice(0, -1).join('/');
    }

    showSearchError(message) {
        const resultsList = document.getElementById('results-list');
        if (resultsList) {
            resultsList.innerHTML = `
                <div class="search-error">
                    <p>Search failed: ${message}</p>
                </div>
            `;
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API
    search(query, options = {}) {
        return this.performSearch(query, options);
    }

    getSearchHistory() {
        return [...this.searchHistory];
    }

    clearHistory() {
        this.searchHistory = [];
    }
}

// Create and export singleton instance
export const fileTreeSearch = new FileTreeSearch();