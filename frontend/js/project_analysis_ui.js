/**
 * Project Analysis UI
 * User interface for project intelligence and AI context building
 */

import { projectIntelligence } from './project_intelligence.js';
import { semanticIndexer } from './semantic_indexer.js';
import { aiContextBuilder } from './ai_context_builder.js';
import { performanceOptimizer } from './performance_optimizer.js';

class ProjectAnalysisUI {
    constructor() {
        this.isVisible = false;
        this.analysisInProgress = false;
        this.init();
    }

    init() {
        this.createAnalysisPanel();
        this.setupEventListeners();
        
        // Auto-start analysis when project is loaded
        document.addEventListener('project-loaded', () => {
            this.startProjectAnalysis();
        });
    }

    createAnalysisPanel() {
        // Create floating analysis panel
        const panel = document.createElement('div');
        panel.id = 'project-analysis-panel';
        panel.className = 'project-analysis-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>🧠 Project Intelligence</h3>
                <div class="panel-controls">
                    <button id="analysis-settings-btn" title="Settings">⚙️</button>
                    <button id="analysis-toggle-btn" title="Toggle Panel">📊</button>
                    <button id="analysis-close-btn" title="Close">×</button>
                </div>
            </div>
            <div class="panel-content">
                <div class="analysis-status">
                    <div id="analysis-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill"></div>
                        </div>
                        <div class="progress-text" id="progress-text">Ready to analyze</div>
                    </div>
                    <button id="start-analysis-btn" class="primary-btn">Start Analysis</button>
                </div>
                
                <div class="analysis-results" id="analysis-results" style="display: none;">
                    <div class="tab-container">
                        <div class="tabs">
                            <button class="tab-btn active" data-tab="overview">Overview</button>
                            <button class="tab-btn" data-tab="architecture">Architecture</button>
                            <button class="tab-btn" data-tab="concepts">Concepts</button>
                            <button class="tab-btn" data-tab="suggestions">AI Context</button>
                        </div>
                        
                        <div class="tab-content active" id="overview-tab">
                            <div class="overview-stats" id="overview-stats"></div>
                            <div class="key-files" id="key-files"></div>
                        </div>
                        
                        <div class="tab-content" id="architecture-tab">
                            <div class="architecture-info" id="architecture-info"></div>
                            <div class="dependency-graph" id="dependency-graph"></div>
                        </div>
                        
                        <div class="tab-content" id="concepts-tab">
                            <div class="concept-cloud" id="concept-cloud"></div>
                            <div class="semantic-search">
                                <input type="text" id="concept-search" placeholder="Search concepts...">
                                <div id="concept-results"></div>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="suggestions-tab">
                            <div class="ai-context-preview" id="ai-context-preview"></div>
                            <div class="context-suggestions" id="context-suggestions"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
    }

    setupEventListeners() {
        // Panel controls
        document.getElementById('analysis-toggle-btn').addEventListener('click', () => {
            this.togglePanel();
        });
        
        document.getElementById('analysis-close-btn').addEventListener('click', () => {
            this.hidePanel();
        });
        
        document.getElementById('start-analysis-btn').addEventListener('click', () => {
            this.startProjectAnalysis();
        });
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Concept search
        const conceptSearch = document.getElementById('concept-search');
        conceptSearch.addEventListener('input', this.debounce((e) => {
            this.searchConcepts(e.target.value);
        }, 300));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+A to toggle analysis panel
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.togglePanel();
            }
        });
    }

    async startProjectAnalysis() {
        if (this.analysisInProgress) return;
        
        const rootHandle = window.appState?.rootDirectoryHandle;
        if (!rootHandle) {
            this.showError('No project loaded');
            return;
        }
        
        this.analysisInProgress = true;
        this.showPanel();
        this.updateProgress('Starting analysis...', 0);
        
        try {
            // Start project intelligence analysis
            const projectSummary = await projectIntelligence.analyzeProject(
                rootHandle, 
                (message, progress) => {
                    this.updateProgress(message, progress);
                }
            );
            
            // Build semantic index
            this.updateProgress('Building semantic index...', 85);
            await semanticIndexer.buildSemanticIndex(
                projectIntelligence.projectMap,
                projectIntelligence.dependencyGraph
            );
            
            // Analysis complete
            this.updateProgress('Analysis complete!', 100);
            this.displayResults(projectSummary);
            
        } catch (error) {
            console.error('Project analysis failed:', error);
            this.showError('Analysis failed: ' + error.message);
        } finally {
            this.analysisInProgress = false;
        }
    }

    updateProgress(message, progress) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = message;
        }
    }

    displayResults(projectSummary) {
        // Hide progress, show results
        document.querySelector('.analysis-status').style.display = 'none';
        document.getElementById('analysis-results').style.display = 'block';
        
        // Update overview tab
        this.updateOverviewTab(projectSummary);
        
        // Update architecture tab
        this.updateArchitectureTab(projectSummary);
        
        // Update concepts tab
        this.updateConceptsTab();
        
        // Update AI context tab
        this.updateAIContextTab();
    }

    updateOverviewTab(projectSummary) {
        const statsContainer = document.getElementById('overview-stats');
        const keyFilesContainer = document.getElementById('key-files');
        
        // Project statistics
        const stats = projectIntelligence.getProjectSummary();
        const indexStats = semanticIndexer.getIndexStats();
        
        statsContainer.innerHTML = `
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-value">${stats.totalFiles}</div>
                    <div class="stat-label">Files Analyzed</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.languages.length}</div>
                    <div class="stat-label">Languages</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.frameworks.length}</div>
                    <div class="stat-label">Frameworks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${indexStats.totalConcepts}</div>
                    <div class="stat-label">Concepts</div>
                </div>
            </div>
            
            <div class="languages-list">
                <h4>Languages:</h4>
                <div class="tag-list">
                    ${stats.languages.map(lang => `<span class="tag">${lang}</span>`).join('')}
                </div>
            </div>
            
            <div class="frameworks-list">
                <h4>Frameworks:</h4>
                <div class="tag-list">
                    ${stats.frameworks.map(fw => `<span class="tag">${fw}</span>`).join('')}
                </div>
            </div>
        `;
        
        // Key files
        const importantFiles = projectSummary.codebase?.mostImportantFiles || [];
        keyFilesContainer.innerHTML = `
            <h4>Key Files:</h4>
            <div class="file-list">
                ${importantFiles.slice(0, 10).map(file => `
                    <div class="file-item" data-path="${file.path}">
                        <div class="file-name">${file.name || file.path.split('/').pop()}</div>
                        <div class="file-role">${file.role || 'Unknown role'}</div>
                        <div class="file-importance">Importance: ${Math.round(file.importance || 0)}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add click handlers for files
        keyFilesContainer.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                const filePath = item.dataset.path;
                if (window.appState?.onFileSelect) {
                    window.appState.onFileSelect(filePath);
                }
            });
        });
    }

    updateArchitectureTab(projectSummary) {
        const architectureInfo = document.getElementById('architecture-info');
        
        const architecture = projectSummary.architecture || {};
        
        architectureInfo.innerHTML = `
            <div class="architecture-overview">
                <h4>Architecture Overview</h4>
                <p>${projectSummary.overview?.summary || 'Architecture analysis in progress...'}</p>
            </div>
            
            <div class="entry-points">
                <h4>Entry Points:</h4>
                <div class="entry-list">
                    ${(architecture.entryPoints || []).map(entry => `
                        <div class="entry-item">${entry}</div>
                    `).join('') || '<div class="no-data">No entry points detected</div>'}
                </div>
            </div>
            
            <div class="core-modules">
                <h4>Core Modules:</h4>
                <div class="module-list">
                    ${(architecture.coreModules || []).map(module => `
                        <div class="module-item">${module}</div>
                    `).join('') || '<div class="no-data">Core modules analysis in progress...</div>'}
                </div>
            </div>
        `;
    }

    updateConceptsTab() {
        const conceptCloud = document.getElementById('concept-cloud');
        const topConcepts = semanticIndexer.getIndexStats().topConcepts || [];
        
        conceptCloud.innerHTML = `
            <h4>Top Concepts in Your Project:</h4>
            <div class="concept-cloud-container">
                ${topConcepts.map(concept => {
                    const size = Math.min(Math.max(concept.weight * 2, 12), 24);
                    return `
                        <span class="concept-tag" 
                              style="font-size: ${size}px;" 
                              data-concept="${concept.concept}"
                              title="${concept.fileCount} files, ${concept.symbolCount} symbols">
                            ${concept.concept}
                        </span>
                    `;
                }).join('')}
            </div>
        `;
        
        // Add click handlers for concepts
        conceptCloud.querySelectorAll('.concept-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                this.searchConcepts(tag.dataset.concept);
            });
        });
    }

    updateAIContextTab() {
        const contextPreview = document.getElementById('ai-context-preview');
        const suggestions = document.getElementById('context-suggestions');
        
        // Generate sample AI context
        aiContextBuilder.buildAIContext({
            taskType: 'understanding',
            includeArchitecture: true,
            maxFiles: 10
        }).then(context => {
            contextPreview.innerHTML = `
                <h4>AI Context Summary:</h4>
                <div class="context-summary">
                    <div class="context-item">
                        <strong>Project Scale:</strong> ${context.projectOverview?.scale || 'Unknown'}
                    </div>
                    <div class="context-item">
                        <strong>Complexity:</strong> ${context.projectOverview?.complexity || 'Unknown'}
                    </div>
                    <div class="context-item">
                        <strong>Key Areas:</strong> ${(context.projectOverview?.keyAreas || []).join(', ') || 'None identified'}
                    </div>
                    <div class="context-item">
                        <strong>Context Size:</strong> ${Math.round((context.metadata?.contextSize || 0) / 1024)}KB
                    </div>
                    <div class="context-item">
                        <strong>Confidence:</strong> ${Math.round((context.metadata?.confidence || 0) * 100)}%
                    </div>
                </div>
            `;
            
            suggestions.innerHTML = `
                <h4>AI Suggestions:</h4>
                <div class="suggestions-list">
                    ${(context.suggestions || []).map(suggestion => `
                        <div class="suggestion-item">
                            <div class="suggestion-title">${suggestion.title}</div>
                            <div class="suggestion-desc">${suggestion.description}</div>
                            <div class="suggestion-type">${suggestion.type}</div>
                        </div>
                    `).join('') || '<div class="no-data">No suggestions available</div>'}
                </div>
            `;
        }).catch(error => {
            contextPreview.innerHTML = `<div class="error">Error building AI context: ${error.message}</div>`;
        });
    }

    searchConcepts(query) {
        if (!query.trim()) {
            document.getElementById('concept-results').innerHTML = '';
            return;
        }
        
        const results = semanticIndexer.searchSemanticFiles(query, 10);
        const resultsContainer = document.getElementById('concept-results');
        
        resultsContainer.innerHTML = `
            <h5>Files matching "${query}":</h5>
            <div class="search-results">
                ${results.map(result => `
                    <div class="result-item" data-path="${result.path}">
                        <div class="result-path">${result.path}</div>
                        <div class="result-relevance">Relevance: ${Math.round(result.relevance * 100)}%</div>
                        <div class="result-concepts">
                            ${(result.matchingConcepts || []).slice(0, 3).map(concept => 
                                `<span class="mini-tag">${concept}</span>`
                            ).join('')}
                        </div>
                    </div>
                `).join('') || '<div class="no-results">No matching files found</div>'}
            </div>
        `;
        
        // Add click handlers
        resultsContainer.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const filePath = item.dataset.path;
                if (window.appState?.onFileSelect) {
                    window.appState.onFileSelect(filePath);
                }
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    showPanel() {
        this.panel.style.display = 'block';
        this.isVisible = true;
    }

    hidePanel() {
        this.panel.style.display = 'none';
        this.isVisible = false;
    }

    togglePanel() {
        if (this.isVisible) {
            this.hidePanel();
        } else {
            this.showPanel();
        }
    }

    showError(message) {
        const progressText = document.getElementById('progress-text');
        if (progressText) {
            progressText.textContent = `Error: ${message}`;
            progressText.style.color = '#ff6b6b';
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

    // Public API for integration
    getProjectAnalysis() {
        return {
            intelligence: projectIntelligence,
            semantic: semanticIndexer,
            context: aiContextBuilder
        };
    }

    async buildContextForAI(options = {}) {
        return await aiContextBuilder.buildAIContext(options);
    }
}

// Create singleton instance
export const projectAnalysisUI = new ProjectAnalysisUI();