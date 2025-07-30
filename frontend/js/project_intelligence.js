/**
 * Project Intelligence System
 * Advanced code analysis and understanding for large projects
 */

import { performanceOptimizer } from './performance_optimizer.js';
import { progressiveLoader } from './progressive_loader.js';

class ProjectIntelligence {
    constructor() {
        this.projectMap = new Map(); // File path -> analysis data
        this.dependencyGraph = new Map(); // File -> dependencies
        this.symbolIndex = new Map(); // Symbol -> locations
        this.architecturePatterns = new Map(); // Pattern -> files
        this.projectMetadata = {
            totalFiles: 0,
            languages: new Set(),
            frameworks: new Set(),
            patterns: new Set(),
            entryPoints: [],
            configFiles: [],
            documentation: []
        };
        this.analysisCache = performanceOptimizer.createSmartCache(1000, 30 * 60 * 1000); // 30 min TTL
        this.isAnalyzing = false;
        this.analysisProgress = { current: 0, total: 0, stage: 'idle' };
    }

    /**
     * Analyze entire project structure and create intelligence map
     */
    async analyzeProject(rootHandle, progressCallback = null) {
        if (this.isAnalyzing) {
            console.log('Project analysis already in progress');
            return this.getProjectSummary();
        }

        this.isAnalyzing = true;
        this.analysisProgress = { current: 0, total: 0, stage: 'scanning' };
        
        try {
            performanceOptimizer.startTimer('projectAnalysis');
            
            // Stage 1: Scan all files
            if (progressCallback) progressCallback('Scanning project files...', 0);
            const allFiles = await this.scanAllFiles(rootHandle);
            this.analysisProgress.total = allFiles.length;
            
            // Stage 2: Detect project type and architecture
            if (progressCallback) progressCallback('Detecting project type...', 10);
            await this.detectProjectArchitecture(allFiles);
            
            // Stage 3: Analyze critical files first (entry points, configs)
            if (progressCallback) progressCallback('Analyzing critical files...', 20);
            await this.analyzeCriticalFiles(allFiles);
            
            // Stage 4: Build dependency graph
            if (progressCallback) progressCallback('Building dependency map...', 40);
            await this.buildDependencyGraph(allFiles);
            
            // Stage 5: Extract symbols and APIs
            if (progressCallback) progressCallback('Indexing symbols and APIs...', 60);
            await this.indexSymbolsAndAPIs(allFiles);
            
            // Stage 6: Detect architectural patterns
            if (progressCallback) progressCallback('Detecting patterns...', 80);
            await this.detectArchitecturalPatterns();
            
            // Stage 7: Generate project summary
            if (progressCallback) progressCallback('Generating summary...', 95);
            const summary = await this.generateProjectSummary();
            
            performanceOptimizer.endTimer('projectAnalysis');
            this.isAnalyzing = false;
            this.analysisProgress.stage = 'completed';
            
            if (progressCallback) progressCallback('Analysis complete!', 100);
            return summary;
            
        } catch (error) {
            console.error('Project analysis failed:', error);
            this.isAnalyzing = false;
            this.analysisProgress.stage = 'error';
            throw error;
        }
    }

    /**
     * Scan all files in the project
     */
    async scanAllFiles(rootHandle, currentPath = '', allFiles = []) {
        try {
            for await (const entry of rootHandle.values()) {
                const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                
                if (entry.kind === 'directory') {
                    // Skip common ignore directories
                    if (this.shouldIgnoreDirectory(entry.name)) {
                        continue;
                    }
                    
                    // Recursively scan subdirectories
                    await this.scanAllFiles(entry, fullPath, allFiles);
                } else {
                    // Analyze file
                    const fileInfo = this.analyzeFileName(entry.name, fullPath);
                    if (fileInfo.shouldAnalyze) {
                        allFiles.push({
                            handle: entry,
                            path: fullPath,
                            name: entry.name,
                            ...fileInfo
                        });
                    }
                }
                
                // Yield periodically for large projects
                if (allFiles.length % 100 === 0) {
                    await performanceOptimizer.yieldToUI();
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${currentPath}:`, error);
        }
        
        return allFiles;
    }

    /**
     * Analyze filename and determine file type/importance
     */
    analyzeFileName(fileName, fullPath) {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const baseName = fileName.toLowerCase();
        
        const analysis = {
            extension: ext,
            language: this.detectLanguage(ext),
            fileType: this.detectFileType(baseName, ext),
            importance: this.calculateImportance(baseName, fullPath),
            shouldAnalyze: true
        };
        
        // Skip binary files and irrelevant files
        if (this.isBinaryFile(ext) || this.isIrrelevantFile(baseName)) {
            analysis.shouldAnalyze = false;
        }
        
        return analysis;
    }

    /**
     * Detect programming language from extension
     */
    detectLanguage(ext) {
        const languageMap = {
            'js': 'JavaScript', 'jsx': 'JavaScript', 'ts': 'TypeScript', 'tsx': 'TypeScript',
            'py': 'Python', 'java': 'Java', 'c': 'C', 'cpp': 'C++', 'cc': 'C++', 'cxx': 'C++',
            'cs': 'C#', 'php': 'PHP', 'rb': 'Ruby', 'go': 'Go', 'rs': 'Rust', 'swift': 'Swift',
            'kt': 'Kotlin', 'scala': 'Scala', 'clj': 'Clojure', 'hs': 'Haskell', 'ml': 'OCaml',
            'dart': 'Dart', 'lua': 'Lua', 'r': 'R', 'jl': 'Julia', 'elm': 'Elm',
            'html': 'HTML', 'css': 'CSS', 'scss': 'SCSS', 'sass': 'SASS', 'less': 'LESS',
            'json': 'JSON', 'xml': 'XML', 'yaml': 'YAML', 'yml': 'YAML', 'toml': 'TOML',
            'md': 'Markdown', 'txt': 'Text', 'sql': 'SQL', 'sh': 'Shell', 'bash': 'Shell',
            'dockerfile': 'Docker', 'makefile': 'Makefile', 'cmake': 'CMake'
        };
        
        return languageMap[ext] || 'Unknown';
    }

    /**
     * Detect file type (config, entry point, test, etc.)
     */
    detectFileType(baseName, ext) {
        // Configuration files
        if (['package.json', 'composer.json', 'requirements.txt', 'cargo.toml', 'pom.xml', 
             'build.gradle', 'makefile', 'dockerfile', '.env', 'config.js', 'webpack.config.js'].includes(baseName)) {
            return 'config';
        }
        
        // Entry points
        if (['main.js', 'index.js', 'app.js', 'server.js', 'main.py', '__main__.py', 
             'main.java', 'main.go', 'main.rs'].includes(baseName)) {
            return 'entry';
        }
        
        // Test files
        if (baseName.includes('test') || baseName.includes('spec') || 
            baseName.endsWith('.test.js') || baseName.endsWith('.spec.js')) {
            return 'test';
        }
        
        // Documentation
        if (['readme.md', 'readme.txt', 'changelog.md', 'license', 'contributing.md'].includes(baseName)) {
            return 'documentation';
        }
        
        // Source code
        if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs'].includes(ext)) {
            return 'source';
        }
        
        return 'other';
    }

    /**
     * Calculate file importance based on various factors
     */
    calculateImportance(baseName, fullPath) {
        let importance = 1;
        
        // Entry points and main files
        if (['main', 'index', 'app', 'server'].some(term => baseName.includes(term))) {
            importance += 10;
        }
        
        // Configuration files
        if (['package.json', 'config', 'settings'].some(term => baseName.includes(term))) {
            importance += 8;
        }
        
        // API and service files
        if (['api', 'service', 'controller', 'router'].some(term => baseName.includes(term))) {
            importance += 6;
        }
        
        // Core/lib files
        if (['core', 'lib', 'utils', 'helpers'].some(term => fullPath.includes(term))) {
            importance += 4;
        }
        
        // Reduce importance for deeply nested files
        const depth = fullPath.split('/').length;
        if (depth > 5) importance -= 2;
        if (depth > 8) importance -= 3;
        
        return Math.max(1, importance);
    }

    /**
     * Detect project architecture and frameworks
     */
    async detectProjectArchitecture(allFiles) {
        const frameworks = new Set();
        const patterns = new Set();
        
        for (const file of allFiles) {
            // Detect frameworks from file names and paths
            if (file.name === 'package.json') {
                try {
                    const content = await this.readFileContent(file.handle);
                    const packageData = JSON.parse(content);
                    
                    // Extract dependencies
                    const deps = { ...packageData.dependencies, ...packageData.devDependencies };
                    Object.keys(deps).forEach(dep => {
                        if (this.isFramework(dep)) {
                            frameworks.add(dep);
                        }
                    });
                } catch (error) {
                    console.error('Error reading package.json:', error);
                }
            }
            
            // Detect patterns from directory structure
            const pathParts = file.path.split('/');
            pathParts.forEach(part => {
                if (this.isArchitecturalPattern(part)) {
                    patterns.add(part);
                }
            });
        }
        
        this.projectMetadata.frameworks = frameworks;
        this.projectMetadata.patterns = patterns;
    }

    /**
     * Analyze critical files (entry points, configs) first
     */
    async analyzeCriticalFiles(allFiles) {
        const criticalFiles = allFiles
            .filter(file => file.importance > 5)
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 50); // Analyze top 50 critical files
        
        for (const file of criticalFiles) {
            try {
                const analysis = await this.analyzeFileContent(file);
                this.projectMap.set(file.path, analysis);
                this.analysisProgress.current++;
            } catch (error) {
                console.error(`Error analyzing critical file ${file.path}:`, error);
            }
        }
    }

    /**
     * Analyze individual file content
     */
    async analyzeFileContent(file) {
        const cacheKey = `analysis_${file.path}`;
        
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey);
        }
        
        try {
            const content = await this.readFileContent(file.handle);
            const analysis = {
                path: file.path,
                language: file.language,
                fileType: file.fileType,
                size: content.length,
                lines: content.split('\n').length,
                exports: this.extractExports(content, file.language),
                imports: this.extractImports(content, file.language),
                functions: this.extractFunctions(content, file.language),
                classes: this.extractClasses(content, file.language),
                apis: this.extractAPIs(content, file.language),
                patterns: this.detectCodePatterns(content, file.language),
                complexity: this.calculateComplexity(content, file.language),
                lastAnalyzed: Date.now()
            };
            
            this.analysisCache.set(cacheKey, analysis);
            return analysis;
            
        } catch (error) {
            console.error(`Error analyzing file content ${file.path}:`, error);
            return this.createEmptyAnalysis(file);
        }
    }

    /**
     * Extract function definitions from code
     */
    extractFunctions(content, language) {
        const functions = [];
        
        if (language === 'JavaScript' || language === 'TypeScript') {
            // Function declarations
            const funcRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)|(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{)/g;
            let match;
            while ((match = funcRegex.exec(content)) !== null) {
                const funcName = match[1] || match[2] || match[3];
                if (funcName && !functions.includes(funcName)) {
                    functions.push(funcName);
                }
            }
        } else if (language === 'Python') {
            const funcRegex = /def\s+(\w+)\s*\(/g;
            let match;
            while ((match = funcRegex.exec(content)) !== null) {
                functions.push(match[1]);
            }
        }
        
        return functions;
    }

    /**
     * Extract class definitions from code
     */
    extractClasses(content, language) {
        const classes = [];
        
        if (language === 'JavaScript' || language === 'TypeScript') {
            const classRegex = /class\s+(\w+)/g;
            let match;
            while ((match = classRegex.exec(content)) !== null) {
                classes.push(match[1]);
            }
        } else if (language === 'Python') {
            const classRegex = /class\s+(\w+)/g;
            let match;
            while ((match = classRegex.exec(content)) !== null) {
                classes.push(match[1]);
            }
        }
        
        return classes;
    }

    /**
     * Extract import/require statements
     */
    extractImports(content, language) {
        const imports = [];
        
        if (language === 'JavaScript' || language === 'TypeScript') {
            // ES6 imports
            const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
            
            // CommonJS requires
            const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
            while ((match = requireRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
        } else if (language === 'Python') {
            const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1] || match[2]);
            }
        }
        
        return imports;
    }

    /**
     * Extract export statements
     */
    extractExports(content, language) {
        const exports = [];
        
        if (language === 'JavaScript' || language === 'TypeScript') {
            // Named exports
            const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
            let match;
            while ((match = namedExportRegex.exec(content)) !== null) {
                exports.push(match[1]);
            }
            
            // Export statements
            const exportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
            while ((match = exportRegex.exec(content)) !== null) {
                const exportList = match[1].split(',').map(exp => exp.trim().split(' as ')[0]);
                exports.push(...exportList);
            }
        }
        
        return exports;
    }

    /**
     * Build dependency graph between files
     */
    async buildDependencyGraph(allFiles) {
        for (const file of allFiles) {
            if (this.projectMap.has(file.path)) {
                const analysis = this.projectMap.get(file.path);
                const dependencies = [];
                
                // Resolve import paths to actual files
                for (const importPath of analysis.imports) {
                    const resolvedPath = this.resolveImportPath(importPath, file.path, allFiles);
                    if (resolvedPath) {
                        dependencies.push(resolvedPath);
                    }
                }
                
                this.dependencyGraph.set(file.path, dependencies);
            }
        }
    }

    /**
     * Generate comprehensive project summary for AI
     */
    async generateProjectSummary() {
        const summary = {
            overview: {
                totalFiles: this.projectMap.size,
                languages: Array.from(this.projectMetadata.languages),
                frameworks: Array.from(this.projectMetadata.frameworks),
                patterns: Array.from(this.projectMetadata.patterns)
            },
            architecture: {
                entryPoints: this.getEntryPoints(),
                coreModules: this.getCoreModules(),
                apiEndpoints: this.getAPIEndpoints(),
                dependencyHotspots: this.getDependencyHotspots()
            },
            codebase: {
                mostImportantFiles: this.getMostImportantFiles(20),
                commonPatterns: this.getCommonPatterns(),
                technicalDebt: this.assessTechnicalDebt(),
                complexity: this.getComplexityMetrics()
            },
            recommendations: {
                focusAreas: this.identifyFocusAreas(),
                refactoringOpportunities: this.identifyRefactoringOpportunities(),
                learningPath: this.generateLearningPath()
            }
        };
        
        return summary;
    }

    /**
     * Get contextual information for AI agent
     */
    getContextForAI(currentFile = null, query = null) {
        const context = {
            projectSummary: this.getProjectSummary(),
            relevantFiles: [],
            relatedSymbols: [],
            architecturalContext: {},
            suggestions: []
        };
        
        if (currentFile) {
            context.relevantFiles = this.getRelatedFiles(currentFile, 10);
            context.relatedSymbols = this.getRelatedSymbols(currentFile);
            context.architecturalContext = this.getArchitecturalContext(currentFile);
        }
        
        if (query) {
            context.relevantFiles.push(...this.searchRelevantFiles(query, 5));
            context.suggestions = this.generateQuerySuggestions(query);
        }
        
        return context;
    }

    /**
     * Utility methods
     */
    shouldIgnoreDirectory(dirName) {
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 
                           '.nuxt', 'vendor', '__pycache__', '.pytest_cache', 'target'];
        return ignoreDirs.includes(dirName) || dirName.startsWith('.');
    }

    isBinaryFile(ext) {
        const binaryExts = ['exe', 'bin', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 
                           'pdf', 'zip', 'tar', 'gz', 'mp3', 'mp4', 'avi', 'mov'];
        return binaryExts.includes(ext);
    }

    isFramework(depName) {
        const frameworks = ['react', 'vue', 'angular', 'express', 'koa', 'fastify', 
                           'django', 'flask', 'rails', 'laravel', 'spring', 'nestjs'];
        return frameworks.some(fw => depName.includes(fw));
    }

    async readFileContent(fileHandle) {
        const file = await fileHandle.getFile();
        return await file.text();
    }

    createEmptyAnalysis(file) {
        return {
            path: file.path,
            language: file.language,
            fileType: file.fileType,
            size: 0,
            lines: 0,
            exports: [],
            imports: [],
            functions: [],
            classes: [],
            apis: [],
            patterns: [],
            complexity: 1,
            lastAnalyzed: Date.now()
        };
    }

    // Additional helper methods...
    getProjectSummary() {
        return {
            totalFiles: this.projectMap.size,
            languages: Array.from(this.projectMetadata.languages),
            frameworks: Array.from(this.projectMetadata.frameworks),
            analysisComplete: !this.isAnalyzing
        };
    }

    getAnalysisProgress() {
        return { ...this.analysisProgress };
    }

    clearCache() {
        this.analysisCache.clear();
        this.projectMap.clear();
        this.dependencyGraph.clear();
        this.symbolIndex.clear();
        this.architecturePatterns.clear();
    }

    /**
     * Check if a file should be ignored
     */
    isIrrelevantFile(fileName) {
        const irrelevantPatterns = [
            // Temporary files
            /^\.#/, /~$/, /\.tmp$/, /\.temp$/,
            // OS files
            /^\.DS_Store$/, /^Thumbs\.db$/, /^desktop\.ini$/,
            // IDE files
            /^\.vscode/, /^\.idea/, /^\.eclipse/, /^\.project$/,
            // Version control
            /^\.git/, /^\.svn/, /^\.hg/, /^CVS$/,
            // Build outputs
            /^node_modules/, /^dist/, /^build/, /^out/, /^target/,
            // Logs
            /\.log$/, /^logs/,
            // Cache
            /^\.cache/, /^\.parcel-cache/, /^\.next/,
            // Lock files
            /package-lock\.json$/, /yarn\.lock$/, /composer\.lock$/,
            // Minified files
            /\.min\.(js|css)$/, /\.bundle\.(js|css)$/,
            // Map files
            /\.map$/,
            // Backup files
            /\.bak$/, /\.backup$/, /\.old$/,
            // Archive files
            /\.(zip|rar|7z|tar|gz|bz2)$/,
            // Large data files that shouldn't be analyzed
            /\.(sqlite|db|mdb)$/,
            // Documentation that's not code
            /^README/, /^CHANGELOG/, /^LICENSE/, /^CONTRIBUTING/
        ];

        return irrelevantPatterns.some(pattern => pattern.test(fileName));
    }

    /**
     * Index symbols and APIs from analyzed files
     */
    async indexSymbolsAndAPIs(allFiles) {
        this.updateProgress('Indexing symbols and APIs...', 85);
        
        try {
            // Clear existing index
            this.symbolIndex.clear();
            
            let processedFiles = 0;
            const totalFiles = allFiles.length;
            
            // Process files in batches for better performance
            const batchSize = 10;
            for (let i = 0; i < allFiles.length; i += batchSize) {
                const batch = allFiles.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (file) => {
                    if (!file.shouldAnalyze) return;
                    
                    try {
                        const analysis = this.projectMap.get(file.path);
                        if (!analysis) return;
                        
                        // Index exports (public API)
                        analysis.exports.forEach(exportName => {
                            if (!this.symbolIndex.has(exportName)) {
                                this.symbolIndex.set(exportName, []);
                            }
                            this.symbolIndex.get(exportName).push({
                                file: file.path,
                                type: 'export',
                                language: file.language
                            });
                        });
                        
                        // Index functions
                        analysis.functions.forEach(funcName => {
                            if (!this.symbolIndex.has(funcName)) {
                                this.symbolIndex.set(funcName, []);
                            }
                            this.symbolIndex.get(funcName).push({
                                file: file.path,
                                type: 'function',
                                language: file.language
                            });
                        });
                        
                        // Index classes
                        analysis.classes.forEach(className => {
                            if (!this.symbolIndex.has(className)) {
                                this.symbolIndex.set(className, []);
                            }
                            this.symbolIndex.get(className).push({
                                file: file.path,
                                type: 'class',
                                language: file.language
                            });
                        });
                        
                        // Index APIs
                        analysis.apis.forEach(api => {
                            const apiName = typeof api === 'string' ? api : api.name;
                            if (!this.symbolIndex.has(apiName)) {
                                this.symbolIndex.set(apiName, []);
                            }
                            this.symbolIndex.get(apiName).push({
                                file: file.path,
                                type: 'api',
                                language: file.language,
                                details: api
                            });
                        });
                        
                        processedFiles++;
                        
                        // Update progress periodically
                        if (processedFiles % 50 === 0) {
                            const progress = 85 + (processedFiles / totalFiles) * 10;
                            this.updateProgress(`Indexing symbols... ${processedFiles}/${totalFiles}`, progress);
                        }
                        
                    } catch (error) {
                        console.warn(`Error indexing symbols for ${file.path}:`, error);
                    }
                }));
                
                // Small delay between batches to prevent blocking
                if (i + batchSize < allFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 5));
                }
            }
            
            // Build dependency relationships from imports/exports
            this.buildDependencyRelationships(allFiles);
            
            console.log(`Symbol indexing complete. Indexed ${this.symbolIndex.size} unique symbols from ${processedFiles} files.`);
            
        } catch (error) {
            console.error('Error during symbol indexing:', error);
            throw error;
        }
    }

    /**
     * Build dependency relationships from imports and exports
     */
    buildDependencyRelationships(allFiles) {
        try {
            // Create a map of exports to files
            const exportMap = new Map();
            
            allFiles.forEach(file => {
                const analysis = this.projectMap.get(file.path);
                if (!analysis) return;
                
                analysis.exports.forEach(exportName => {
                    if (!exportMap.has(exportName)) {
                        exportMap.set(exportName, []);
                    }
                    exportMap.get(exportName).push(file.path);
                });
            });
            
            // Build dependency relationships
            allFiles.forEach(file => {
                const analysis = this.projectMap.get(file.path);
                if (!analysis) return;
                
                const dependencies = new Set();
                
                analysis.imports.forEach(importName => {
                    // Handle relative imports
                    if (importName.startsWith('./') || importName.startsWith('../')) {
                        const resolvedPath = this.resolveRelativeImport(file.path, importName);
                        if (resolvedPath) {
                            dependencies.add(resolvedPath);
                        }
                    } else {
                        // Handle named imports
                        const exportingFiles = exportMap.get(importName);
                        if (exportingFiles) {
                            exportingFiles.forEach(exportingFile => {
                                if (exportingFile !== file.path) {
                                    dependencies.add(exportingFile);
                                }
                            });
                        }
                    }
                });
                
                if (dependencies.size > 0) {
                    this.dependencyGraph.set(file.path, Array.from(dependencies));
                }
            });
            
        } catch (error) {
            console.warn('Error building dependency relationships:', error);
        }
    }

    /**
     * Resolve relative import paths
     */
    resolveRelativeImport(currentFile, importPath) {
        try {
            const currentDir = currentFile.split('/').slice(0, -1).join('/');
            const parts = importPath.split('/');
            const dirParts = currentDir.split('/');
            
            for (const part of parts) {
                if (part === '.') {
                    continue;
                } else if (part === '..') {
                    dirParts.pop();
                } else {
                    dirParts.push(part);
                }
            }
            
            const resolvedPath = dirParts.join('/');
            
            // Try common extensions if no extension provided
            if (!resolvedPath.includes('.')) {
                const commonExtensions = ['.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];
                for (const ext of commonExtensions) {
                    const candidate = resolvedPath + ext;
                    if (this.projectMap.has(candidate)) {
                        return candidate;
                    }
                }
            }
            
            return this.projectMap.has(resolvedPath) ? resolvedPath : null;
            
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if a directory name represents an architectural pattern
     */
    isArchitecturalPattern(directoryName) {
        const architecturalPatterns = [
            // MVC Pattern
            'models', 'model', 'views', 'view', 'controllers', 'controller',
            'mvc', 'mvp', 'mvvm',
            
            // Layered Architecture
            'presentation', 'business', 'data', 'service', 'services',
            'repository', 'repositories', 'dao', 'dto', 'entity', 'entities',
            'domain', 'application', 'infrastructure',
            
            // Component-based Architecture
            'components', 'component', 'widgets', 'elements', 'modules', 'module',
            'plugins', 'plugin', 'extensions', 'extension',
            
            // API/Service Architecture
            'api', 'apis', 'endpoints', 'routes', 'routing', 'middleware',
            'handlers', 'handler', 'processors', 'processor',
            
            // Common patterns
            'adapters', 'adapter', 'factories', 'factory', 'builders', 'builder',
            'observers', 'observer', 'decorators', 'decorator', 'proxies', 'proxy',
            'strategies', 'strategy', 'commands', 'command', 'facades', 'facade',
            
            // Frontend patterns
            'containers', 'container', 'layouts', 'layout', 'pages', 'page',
            'screens', 'screen', 'hooks', 'hook', 'providers', 'provider',
            'context', 'contexts', 'store', 'stores', 'reducers', 'reducer',
            'actions', 'action', 'selectors', 'selector',
            
            // Backend patterns
            'migrations', 'migration', 'seeds', 'seed', 'fixtures', 'fixture',
            'jobs', 'job', 'tasks', 'task', 'queues', 'queue', 'workers', 'worker',
            'schedulers', 'scheduler', 'cron', 'events', 'event', 'listeners', 'listener',
            
            // Testing patterns
            'tests', 'test', 'specs', 'spec', '__tests__', '__mocks__', 'mocks', 'mock',
            'fixtures', 'stubs', 'stub', 'doubles', 'double',
            
            // Configuration patterns
            'config', 'configuration', 'configs', 'settings', 'options',
            'environments', 'env', 'constants', 'const',
            
            // Utility patterns
            'utils', 'utilities', 'helpers', 'helper', 'shared', 'common',
            'lib', 'libs', 'library', 'libraries', 'core', 'base',
            
            // Asset patterns
            'assets', 'static', 'public', 'resources', 'media', 'images',
            'styles', 'css', 'sass', 'scss', 'less', 'stylesheets',
            
            // Build/Deploy patterns
            'build', 'dist', 'output', 'bin', 'release', 'deploy', 'deployment',
            'scripts', 'tools', 'webpack', 'rollup', 'babel', 'eslint',
            
            // Documentation patterns
            'docs', 'documentation', 'guides', 'examples', 'demo', 'demos'
        ];

        const lowerName = directoryName.toLowerCase();
        return architecturalPatterns.includes(lowerName);
    }

    /**
     * Extract API endpoints and service calls from code
     */
    extractAPIs(content, language) {
        const apis = [];
        
        try {
            if (language === 'JavaScript' || language === 'TypeScript') {
                // REST API patterns
                const restPatterns = [
                    // fetch API
                    /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
                    // axios
                    /axios\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
                    // $.ajax or jQuery
                    /\$\s*\.\s*ajax\s*\(\s*\{[^}]*url\s*:\s*['"`]([^'"`]+)['"`]/g,
                    // XMLHttpRequest
                    /open\s*\(\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g
                ];
                
                restPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        const url = match[2] || match[1];
                        if (url && !apis.find(api => api.endpoint === url)) {
                            apis.push({
                                type: 'REST',
                                method: match[1] || 'unknown',
                                endpoint: url,
                                line: this.getLineNumber(content, match.index)
                            });
                        }
                    }
                });
                
                // GraphQL patterns
                const graphqlPattern = /gql`([^`]+)`|graphql\s*\(\s*['"`]([^'"`]+)['"`]/g;
                let graphqlMatch;
                while ((graphqlMatch = graphqlPattern.exec(content)) !== null) {
                    const query = graphqlMatch[1] || graphqlMatch[2];
                    if (query) {
                        apis.push({
                            type: 'GraphQL',
                            query: query.substring(0, 100) + '...',
                            line: this.getLineNumber(content, graphqlMatch.index)
                        });
                    }
                }
                
            } else if (language === 'Python') {
                // Python API patterns
                const pythonPatterns = [
                    // requests library
                    /requests\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
                    // urllib
                    /urllib\.request\.urlopen\s*\(\s*['"`]([^'"`]+)['"`]/g,
                    // httpx
                    /httpx\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
                ];
                
                pythonPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        const url = match[2] || match[1];
                        if (url && !apis.find(api => api.endpoint === url)) {
                            apis.push({
                                type: 'REST',
                                method: match[1] || 'unknown',
                                endpoint: url,
                                line: this.getLineNumber(content, match.index)
                            });
                        }
                    }
                });
                
            } else if (language === 'Java') {
                // Java API patterns
                const javaPatterns = [
                    // Spring RestTemplate
                    /restTemplate\s*\.\s*(getForObject|postForObject|exchange)\s*\(\s*['"`]([^'"`]+)['"`]/g,
                    // OkHttp
                    /new\s+Request\s*\.\s*Builder\s*\(\s*\)\s*\.url\s*\(\s*['"`]([^'"`]+)['"`]/g,
                    // HttpURLConnection
                    /new\s+URL\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
                ];
                
                javaPatterns.forEach(pattern => {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        const url = match[2] || match[1];
                        if (url && !apis.find(api => api.endpoint === url)) {
                            apis.push({
                                type: 'REST',
                                endpoint: url,
                                line: this.getLineNumber(content, match.index)
                            });
                        }
                    }
                });
            }
            
            // Generic URL patterns (fallback)
            if (apis.length === 0) {
                const genericUrlPattern = /['"`](https?:\/\/[^'"`\s]+)['"`]/g;
                let genericMatch;
                while ((genericMatch = genericUrlPattern.exec(content)) !== null) {
                    const url = genericMatch[1];
                    if (url && !apis.find(api => api.endpoint === url)) {
                        apis.push({
                            type: 'URL',
                            endpoint: url,
                            line: this.getLineNumber(content, genericMatch.index)
                        });
                    }
                }
            }
            
        } catch (error) {
            console.warn('Error extracting APIs:', error);
        }
        
        return apis.slice(0, 20); // Limit to 20 APIs per file
    }

    /**
     * Get line number from character index
     */
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    /**
     * Detect common code patterns (e.g., Singleton, Factory)
     */
    detectCodePatterns(content, language) {
        const patterns = [];
        if (!content) {
            return patterns;
        }

        // Basic pattern detection (can be expanded)
        if (language === 'JavaScript' || language === 'TypeScript') {
            // Singleton-like pattern
            if (/(getInstance|get_instance)/.test(content) && /new this|new self/.test(content)) {
                patterns.push('Singleton');
            }
            // Factory pattern
            if (/create\w+/.test(content) && /new \w+/.test(content)) {
                patterns.push('Factory');
            }
        } else if (language === 'Python') {
            // Singleton
            if (/__new__/.test(content) && /_instance/.test(content)) {
                patterns.push('Singleton');
            }
        }
        
        return patterns;
    }

    /**
     * Calculate cyclomatic complexity (basic version)
     */
    calculateComplexity(content, language) {
        if (!content) {
            return 1;
        }

        let complexity = 1;
        const complexityPatterns = [
            /if\s*\(/g, /else\s*if\s*\(/g, /while\s*\(/g, /for\s*\(/g,
            /case\s+\S+:/g, /catch\s*\(/g, /\?\?/g, /&&/g, /\|\|/g
        ];

        complexityPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });

        return complexity;
    }

    /**
     * Detect architectural patterns from file analysis
     */
    async detectArchitecturalPatterns() {
        this.updateProgress('Detecting architectural patterns...', 90);
        
        try {
            this.architecturePatterns.clear();
            const analyzedFiles = Array.from(this.projectMap.values());

            for (const file of analyzedFiles) {
                if (file.patterns && file.patterns.length > 0) {
                    for (const pattern of file.patterns) {
                        if (!this.architecturePatterns.has(pattern)) {
                            this.architecturePatterns.set(pattern, []);
                        }
                        this.architecturePatterns.get(pattern).push(file.path);
                    }
                }
            }
            
            console.log(`Architectural pattern detection complete. Found ${this.architecturePatterns.size} patterns.`);
            this.updateProgress('Architectural pattern detection complete', 95);
            
        } catch (error) {
            console.error('Error detecting architectural patterns:', error);
            this.updateProgress('Error in pattern detection', 95, () => {});
        }
    }

    /**
     * Update analysis progress with callback support
     */
    updateProgress(message, progress, callback = null) {
        this.analysisProgress = {
            message: message,
            progress: Math.min(Math.max(progress, 0), 100),
            timestamp: Date.now()
        };
        
        // Call the callback if provided (for UI updates)
        if (callback && typeof callback === 'function') {
            try {
                callback(message, progress);
            } catch (error) {
                console.warn('Error in progress callback:', error);
            }
        }
        
        // Log progress for debugging
        if (progress % 25 === 0 || progress === 100) {
            console.log(`Project Analysis: ${message} (${progress}%)`);
        }
    }
}

// Export singleton instance
export const projectIntelligence = new ProjectIntelligence();