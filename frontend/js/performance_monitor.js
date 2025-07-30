/**
 * Performance Monitor
 * Real-time performance monitoring and display
 */

import { performanceOptimizer } from './performance_optimizer.js';

class PerformanceMonitor {
    constructor() {
        this.isVisible = false;
        this.updateInterval = null;
        this.metricsElement = null;
        this.init();
    }

    init() {
        // Create performance metrics display element
        this.metricsElement = document.createElement('div');
        this.metricsElement.className = 'performance-metrics';
        this.metricsElement.innerHTML = this.getMetricsHTML();
        document.body.appendChild(this.metricsElement);

        // Add keyboard shortcut to toggle visibility (Ctrl+Shift+P)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                this.toggle();
            }
        });

        // Start monitoring if in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.start();
        }
    }

    start() {
        if (this.updateInterval) return;
        
        this.updateInterval = setInterval(() => {
            this.updateMetrics();
        }, 1000); // Update every second
    }

    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    toggle() {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.show();
            this.start();
        } else {
            this.hide();
            this.stop();
        }
    }

    show() {
        this.metricsElement.classList.add('show');
        this.isVisible = true;
    }

    hide() {
        this.metricsElement.classList.remove('show');
        this.isVisible = false;
    }

    updateMetrics() {
        if (!this.isVisible) return;
        
        this.metricsElement.innerHTML = this.getMetricsHTML();
    }

    getMetricsHTML() {
        const memoryInfo = this.getMemoryInfo();
        const performanceMetrics = performanceOptimizer.getMetrics();
        const domStats = this.getDOMStats();
        const fileTreeStats = this.getFileTreeStats();

        return `
            <div style="font-weight: bold; margin-bottom: 8px;">🔍 Performance Monitor</div>
            
            <div><strong>Memory:</strong></div>
            <div style="margin-left: 10px; font-size: 10px;">
                Used: ${memoryInfo.used}MB<br>
                Limit: ${memoryInfo.limit}MB<br>
                Usage: ${memoryInfo.percentage}%
            </div>
            
            <div style="margin-top: 8px;"><strong>DOM:</strong></div>
            <div style="margin-left: 10px; font-size: 10px;">
                Elements: ${domStats.elements}<br>
                File Tree Nodes: ${domStats.fileTreeNodes}
            </div>
            
            <div style="margin-top: 8px;"><strong>File Tree:</strong></div>
            <div style="margin-left: 10px; font-size: 10px;">
                Loaded Dirs: ${fileTreeStats.loadedDirectories}<br>
                Lazy Nodes: ${fileTreeStats.lazyNodes}
            </div>
            
            <div style="margin-top: 8px;"><strong>Recent Operations:</strong></div>
            <div style="margin-left: 10px; font-size: 10px;">
                ${this.getRecentOperationsHTML(performanceMetrics)}
            </div>
            
            <div style="margin-top: 8px; font-size: 9px; color: var(--secondary);">
                Press Ctrl+Shift+P to toggle
            </div>
        `;
    }

    getMemoryInfo() {
        if ('memory' in performance) {
            const memInfo = performance.memory;
            const used = Math.round(memInfo.usedJSHeapSize / 1024 / 1024);
            const limit = Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024);
            const percentage = Math.round((used / limit) * 100);
            
            return { used, limit, percentage };
        }
        
        return { used: 'N/A', limit: 'N/A', percentage: 'N/A' };
    }

    getDOMStats() {
        const elements = document.querySelectorAll('*').length;
        const fileTreeNodes = document.querySelectorAll('#file-tree .jstree-node').length;
        
        return { elements, fileTreeNodes };
    }

    getFileTreeStats() {
        const fileTreeNodes = document.querySelectorAll('#file-tree .jstree-node');
        let lazyNodes = 0;
        let loadedDirectories = 0;
        
        fileTreeNodes.forEach(node => {
            const li = node.querySelector('li');
            if (li && li.getAttribute('data-lazy') === 'true') {
                lazyNodes++;
            }
            if (node.classList.contains('jstree-open')) {
                loadedDirectories++;
            }
        });
        
        return { loadedDirectories, lazyNodes };
    }

    getRecentOperationsHTML(metrics) {
        const operations = Object.entries(metrics)
            .sort(([,a], [,b]) => b.timestamp - a.timestamp)
            .slice(0, 3)
            .map(([operation, data]) => {
                const duration = data.duration ? data.duration.toFixed(1) + 'ms' : 'ongoing';
                const name = operation.replace(/^(openFile_|loadFullFile_|directoryRestore)/, '');
                return `${name}: ${duration}`;
            });
        
        return operations.length > 0 ? operations.join('<br>') : 'None';
    }

    // Method to show performance warning
    showPerformanceWarning(message, type = 'warning') {
        const warning = document.createElement('div');
        warning.className = 'large-file-warning';
        warning.textContent = message;
        warning.style.position = 'fixed';
        warning.style.top = '60px';
        warning.style.right = '10px';
        warning.style.zIndex = '1001';
        warning.style.maxWidth = '300px';
        
        if (type === 'error') {
            warning.style.background = 'var(--danger, #dc3545)';
        }
        
        document.body.appendChild(warning);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (warning.parentNode) {
                warning.parentNode.removeChild(warning);
            }
        }, 5000);
        
        // Click to dismiss
        warning.addEventListener('click', () => {
            if (warning.parentNode) {
                warning.parentNode.removeChild(warning);
            }
        });
    }

    // Method to monitor large file operations
    monitorLargeFileOperation(filePath, fileSize) {
        if (fileSize > 10 * 1024 * 1024) { // 10MB+
            this.showPerformanceWarning(
                `Opening very large file (${Math.round(fileSize / 1024 / 1024)}MB). Performance may be affected.`,
                'warning'
            );
        }
    }

    // Method to monitor memory usage
    monitorMemoryUsage() {
        const memoryInfo = this.getMemoryInfo();
        if (memoryInfo.percentage > 80) {
            this.showPerformanceWarning(
                `High memory usage detected (${memoryInfo.percentage}%). Consider closing some tabs.`,
                'error'
            );
        }
    }

    // Method to log performance metrics to console
    logPerformanceMetrics() {
        const metrics = performanceOptimizer.getMetrics();
        const memoryInfo = this.getMemoryInfo();
        const domStats = this.getDOMStats();
        
        console.group('🔍 Performance Metrics');
        console.log('Memory Usage:', memoryInfo);
        console.log('DOM Stats:', domStats);
        console.log('Operation Timings:', metrics);
        console.groupEnd();
    }

    // Cleanup method
    destroy() {
        this.stop();
        if (this.metricsElement && this.metricsElement.parentNode) {
            this.metricsElement.parentNode.removeChild(this.metricsElement);
        }
    }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();