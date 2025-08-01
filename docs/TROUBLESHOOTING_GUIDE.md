# Tool System Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues when using the AI Code Editor's tool system. It provides systematic approaches to identify problems, understand error messages, and implement effective solutions.

## Quick Diagnosis

### Error Categories and Quick Fixes

| Error Type | Quick Identification | Immediate Action |
|------------|---------------------|------------------|
| **Permission Denied** | "User activation required" | Click in editor/file tree |
| **File Not Found** | "ENOENT" or "NotFoundError" | Verify file path exists |
| **Network Issues** | "fetch failed" or timeout | Check internet connection |
| **Syntax Errors** | "SyntaxError" or "ParseError" | Review code syntax |
| **Memory Issues** | "out of memory" or "heap" | Use smaller operations |
| **Parameter Errors** | "required parameter" | Check function parameters |

## Common Error Scenarios

### 1. File Operation Errors

#### Permission Denied Errors
```
Error: Permission to write to the file was denied.
Error: User activation is required to request permissions.
```

**Cause:** Browser security requires user interaction before file system access.

**Solutions:**
```javascript
// ✅ Solution 1: User activation
// 1. Click anywhere in the editor or file tree
// 2. Then retry the operation

// ✅ Solution 2: Check if project is loaded
if (!toolExecutor.isInitialized) {
  await toolExecutor.initialize(projectHandle);
}

// ✅ Solution 3: Verify file handle permissions
try {
  const result = await toolExecutor.executeTool('create_file', {
    filename: 'test.js',
    content: 'console.log("test");'
  });
} catch (error) {
  if (error.message.includes('User activation')) {
    console.log('Please click in the editor first, then retry');
  }
}
```

#### File Not Found Errors
```
Error: File 'src/component.jsx' does not exist.
Error: ENOENT: no such file or directory
```

**Diagnosis:**
```javascript
// ✅ Check if file exists first
const fileInfo = await toolExecutor.executeTool('get_file_info', {
  filename: 'src/component.jsx'
});

if (!fileInfo.success) {
  console.log('File does not exist');
  // Create it or check the path
}
```

**Solutions:**
```javascript
// ✅ Solution 1: Verify the correct path
const projectStructure = await toolExecutor.executeTool('get_project_structure');
console.log('Available files:', projectStructure.data.structure);

// ✅ Solution 2: Create the file if it should exist
await toolExecutor.executeTool('create_file', {
  filename: 'src/component.jsx',
  content: 'export default function Component() { return <div>Hello</div>; }'
});

// ✅ Solution 3: Check for typos in filename
const searchResult = await toolExecutor.executeTool('search_code', {
  query: 'component',
  file_pattern: '*.jsx'
});
```

#### Large File Handling Issues
```
Error: File size exceeds maximum limit
Warning: File is large - showing preview content
```

**Solutions:**
```javascript
// ✅ Use appropriate tool for large files
// Instead of read_file for large files:
const result = await toolExecutor.executeTool('read_file_lines', {
  filename: 'large-file.js',
  start_line: 1,
  end_line: 100
});

// ✅ For editing large files, use streaming:
await toolExecutor.executeTool('edit_file', {
  filename: 'large-file.js',
  edits: [
    {
      type: 'replace_lines',
      start_line: 50,
      end_line: 52,
      new_content: 'new content here'
    }
  ]
}); // Automatically uses streaming
```

### 2. Code Analysis Errors

#### AST Parsing Failures
```
Error: Failed to parse AST: Unexpected token
Warning: AST analysis failed, falling back to basic analysis
```

**Diagnosis:**
```javascript
// ✅ Check syntax first
const validation = await toolExecutor.executeTool('validate_syntax', {
  file_path: 'problematic-file.js'
});

if (!validation.valid) {
  console.log('Syntax errors found:', validation.errors);
}
```

**Solutions:**
```javascript
// ✅ Solution 1: Fix syntax errors first
// Review the syntax errors and fix them

// ✅ Solution 2: Use fallback analysis
// The system automatically falls back to regex-based analysis

// ✅ Solution 3: Analyze in smaller chunks
const result = await toolExecutor.executeTool('read_file_lines', {
  filename: 'large-file.js',
  start_line: 1,
  end_line: 50
});
// Then analyze the smaller section
```

#### Memory Issues During Analysis
```
Error: Maximum call stack size exceeded
Error: out of memory
```

**Solutions:**
```javascript
// ✅ Use batch processing with smaller chunks
const result = await toolExecutor.executeTool('batch_analyze_files', {
  filenames: largeFileList.slice(0, 5), // Process in smaller batches
  analysis_types: ['ast'] // Limit analysis types
});

// ✅ Clear cache if memory is low
const stats = toolExecutor.getPerformanceStats();
if (stats.memoryUsage > 0.8) {
  // System will automatically trigger cleanup
  console.log('High memory usage detected, cleanup will be triggered');
}
```

### 3. Network and Research Errors

#### URL Reading Failures
```
Error: Failed to read URL: Network request failed
Error: Access denied to https://example.com
Error: URL not found: 404
```

**Diagnosis:**
```javascript
// ✅ Test URL accessibility
try {
  const result = await toolExecutor.executeTool('read_url', {
    url: 'https://example.com/test'
  });
} catch (error) {
  if (error.message.includes('403') || error.message.includes('401')) {
    console.log('Access denied - authentication required');
  } else if (error.message.includes('404')) {
    console.log('URL not found - check the URL');
  } else if (error.message.includes('network')) {
    console.log('Network issue - check internet connection');
  }
}
```

**Solutions:**
```javascript
// ✅ Solution 1: Use retry with backoff (automatic)
// The system automatically retries network operations

// ✅ Solution 2: Try alternative URLs
const alternativeUrls = [
  'https://api.example.com/v1/data',
  'https://api.example.com/v2/data',
  'https://backup-api.example.com/data'
];

for (const url of alternativeUrls) {
  try {
    const result = await toolExecutor.executeTool('read_url', { url });
    if (result.success) break;
  } catch (error) {
    console.log(`Failed to read ${url}, trying next...`);
  }
}

// ✅ Solution 3: Check URL format
function validateUrl(url) {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}
```

#### Research Timeout Issues
```
Error: Research operation timed out
Warning: Operation is taking longer than expected
```

**Solutions:**
```javascript
// ✅ Solution 1: Reduce scope
await toolExecutor.executeTool('perform_research', {
  query: 'specific focused query', // More specific
  max_results: 3, // Reduced from default 5
  depth: 1 // Reduced from default 2
});

// ✅ Solution 2: Use progress monitoring
await toolExecutor.executeTool('perform_research', {
  query: 'research topic'
}, {
  timeout: 90000, // 90 seconds
  progressCallback: (progress) => {
    console.log('Research progress:', progress.message);
    if (progress.type === 'warning') {
      console.log('Taking longer than expected...');
    }
  }
});

// ✅ Solution 3: Break into smaller research tasks
const topics = ['topic1', 'topic2', 'topic3'];
for (const topic of topics) {
  await toolExecutor.executeTool('perform_research', {
    query: topic,
    max_results: 2,
    depth: 1
  });
}
```

### 4. Parameter and Validation Errors

#### Missing Required Parameters
```
Error: The 'filename' parameter is required for read_file.
Error: Parameter validation failed: missing required parameter 'content'
```

**Solutions:**
```javascript
// ✅ Always validate parameters before calling
function validateReadFileParams(params) {
  if (!params.filename) {
    throw new Error('filename is required');
  }
  if (typeof params.filename !== 'string') {
    throw new Error('filename must be a string');
  }
  return true;
}

// ✅ Use parameter validation helper
const params = { filename: 'test.js' };
validateReadFileParams(params);
const result = await toolExecutor.executeTool('read_file', params);
```

#### Type Validation Errors
```
Error: The 'line_number' parameter must be a number for read_file_lines.
Error: The 'filenames' parameter must be an array for read_multiple_files.
```

**Solutions:**
```javascript
// ✅ Ensure correct parameter types
const params = {
  filename: 'test.js',
  start_line: parseInt(userInput.startLine), // Convert to number
  end_line: parseInt(userInput.endLine),
  include_line_numbers: Boolean(userInput.includeNumbers) // Convert to boolean
};

// ✅ Validate arrays
const filenames = Array.isArray(userInput) ? userInput : [userInput];
await toolExecutor.executeTool('read_multiple_files', { filenames });
```

### 5. Diff and Edit Operation Errors

#### Diff Application Failures
```
Error: Search content does not match at line 15
Error: Could not find search content around line 25
```

**Diagnosis:**
```javascript
// ✅ Check current file content first
const currentContent = await toolExecutor.executeTool('read_file_lines', {
  filename: 'target-file.js',
  start_line: 10,
  end_line: 30
});

console.log('Current content around target lines:');
console.log(currentContent.data.content);
```

**Solutions:**
```javascript
// ✅ Solution 1: Use exact content matching
// Make sure your SEARCH content exactly matches the file:
const diff = `<<<<<<< SEARCH
:start_line:15
-------
function oldFunction() {
  return 'old value';
}
=======
function newFunction() {
  return 'new value';
}
>>>>>>> REPLACE`;

// ✅ Solution 2: Use find_and_replace for simple changes
await toolExecutor.executeTool('find_and_replace', {
  filename: 'target-file.js',
  find_text: 'oldFunction',
  replace_text: 'newFunction',
  all_occurrences: true
});

// ✅ Solution 3: Use smart_replace for fuzzy matching
await toolExecutor.executeTool('smart_replace', {
  filename: 'target-file.js',
  old_content: 'function oldFunction() {\n  return \'old value\';\n}',
  new_content: 'function newFunction() {\n  return \'new value\';\n}',
  similarity_threshold: 0.8
});
```

#### Line Number Mismatches
```
Error: Invalid start_line 150. File has 100 lines.
Error: start_line (50) cannot be greater than end_line (30)
```

**Solutions:**
```javascript
// ✅ Always check file length first
const fileInfo = await toolExecutor.executeTool('get_file_info', {
  filename: 'target-file.js'
});

const fileContent = await toolExecutor.executeTool('read_file', {
  filename: 'target-file.js'
});

const lineCount = fileContent.data.content.split('\n').length;
console.log(`File has ${lineCount} lines`);

// ✅ Validate line ranges
function validateLineRange(startLine, endLine, maxLines) {
  if (startLine < 1) throw new Error('start_line must be >= 1');
  if (endLine < 1) throw new Error('end_line must be >= 1');
  if (startLine > endLine) throw new Error('start_line must be <= end_line');
  if (startLine > maxLines) throw new Error(`start_line exceeds file length (${maxLines})`);
  if (endLine > maxLines) {
    console.warn(`end_line exceeds file length, clamping to ${maxLines}`);
    return { startLine, endLine: maxLines };
  }
  return { startLine, endLine };
}
```

## Systematic Debugging Approach

### Step 1: Identify the Error Category

```javascript
function categorizeError(error) {
  const message = error.message.toLowerCase();
  
  if (message.includes('permission') || message.includes('activation')) {
    return 'permission';
  } else if (message.includes('not found') || message.includes('enoent')) {
    return 'file_not_found';
  } else if (message.includes('network') || message.includes('fetch')) {
    return 'network';
  } else if (message.includes('syntax') || message.includes('parse')) {
    return 'syntax';
  } else if (message.includes('memory') || message.includes('heap')) {
    return 'memory';
  } else if (message.includes('parameter') || message.includes('required')) {
    return 'parameter';
  } else if (message.includes('timeout')) {
    return 'timeout';
  }
  
  return 'unknown';
}
```

### Step 2: Apply Category-Specific Solutions

```javascript
async function handleToolError(toolName, params, error) {
  const category = categorizeError(error);
  
  switch (category) {
    case 'permission':
      console.log('🔒 Permission issue detected');
      console.log('Solution: Click in the editor or file tree, then retry');
      break;
      
    case 'file_not_found':
      console.log('📁 File not found');
      console.log('Checking project structure...');
      const structure = await toolExecutor.executeTool('get_project_structure');
      console.log('Available files:', structure.data.structure);
      break;
      
    case 'network':
      console.log('🌐 Network issue detected');
      console.log('The system will automatically retry with exponential backoff');
      break;
      
    case 'syntax':
      console.log('⚠️ Syntax error detected');
      if (params.filename) {
        const validation = await toolExecutor.executeTool('validate_syntax', {
          file_path: params.filename
        });
        console.log('Validation result:', validation);
      }
      break;
      
    case 'memory':
      console.log('💾 Memory issue detected');
      console.log('Try using smaller operations or streaming approaches');
      break;
      
    case 'parameter':
      console.log('📝 Parameter validation failed');
      console.log('Check that all required parameters are provided with correct types');
      console.log('Parameters provided:', Object.keys(params));
      break;
      
    case 'timeout':
      console.log('⏱️ Operation timed out');
      console.log('Try reducing scope or increasing timeout');
      break;
      
    default:
      console.log('❓ Unknown error category');
      console.log('Error details:', error.message);
  }
}
```

### Step 3: Implement Recovery Strategies

```javascript
async function executeWithRecovery(toolName, params, options = {}) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: ${toolName}`);
      
      const result = await toolExecutor.executeTool(toolName, params, options);
      
      if (result.success) {
        if (attempt > 1) {
          console.log(`✅ Success on attempt ${attempt}`);
        }
        return result;
      } else {
        throw new Error(result.message);
      }
      
    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      // Apply recovery strategies based on error type
      const category = categorizeError(error);
      
      if (category === 'permission' && attempt === 1) {
        console.log('Waiting for user activation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      if (category === 'network' && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (category === 'file_not_found' && toolName === 'read_file') {
        console.log('Trying alternative file reading approach...');
        try {
          return await toolExecutor.executeTool('get_project_structure');
        } catch (altError) {
          console.log('Alternative approach also failed');
        }
      }
      
      if (attempt === maxRetries) {
        console.log('All retry attempts exhausted');
        await handleToolError(toolName, params, error);
        break;
      }
    }
  }
  
  throw lastError;
}
```

## Performance Troubleshooting

### Slow Operations

```javascript
// ✅ Monitor execution time
async function monitoredExecution(toolName, params) {
  const startTime = Date.now();
  
  try {
    const result = await toolExecutor.executeTool(toolName, params);
    const duration = Date.now() - startTime;
    
    if (duration > 10000) { // > 10 seconds
      console.warn(`⚠️ Slow execution: ${toolName} took ${duration}ms`);
      
      // Suggest optimizations
      if (toolName === 'read_file' && params.filename) {
        console.log('💡 Consider using read_file_lines for large files');
      } else if (toolName === 'perform_research') {
        console.log('💡 Consider reducing max_results or depth');
      }
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${toolName} failed after ${duration}ms: ${error.message}`);
    throw error;
  }
}
```

### Memory Issues

```javascript
// ✅ Monitor memory usage
function checkMemoryUsage() {
  const stats = toolExecutor.getPerformanceStats();
  
  if (stats.memoryUsage > 0.8) {
    console.warn('⚠️ High memory usage detected');
    console.log('Recommendations:');
    console.log('- Use streaming operations for large files');
    console.log('- Process files in smaller batches');
    console.log('- Clear browser cache if needed');
    
    return true; // High memory usage
  }
  
  return false;
}

// ✅ Use before large operations
async function memoryAwareOperation(toolName, params) {
  const highMemory = checkMemoryUsage();
  
  if (highMemory && toolName === 'read_multiple_files') {
    // Process in smaller batches
    const batchSize = 3;
    const filenames = params.filenames;
    const results = [];
    
    for (let i = 0; i < filenames.length; i += batchSize) {
      const batch = filenames.slice(i, i + batchSize);
      const result = await toolExecutor.executeTool(toolName, {
        ...params,
        filenames: batch
      });
      results.push(result);
    }
    
    return results;
  }
  
  return await toolExecutor.executeTool(toolName, params);
}
```

## Emergency Recovery Procedures

### System Reset
```javascript
// ✅ Reset tool executor state
function emergencyReset() {
  console.log('🚨 Performing emergency reset...');
  
  // Clean up executor state
  toolExecutor.cleanup();
  
  // Clear any cached data
  if (typeof localStorage !== 'undefined') {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('tool_cache_') || key.startsWith('operation_')) {
        localStorage.removeItem(key);
      }
    });
  }
  
  console.log('✅ Emergency reset completed');
  console.log('Please reinitialize the tool executor');
}
```

### Diagnostic Information Collection
```javascript
// ✅ Collect diagnostic information
function collectDiagnostics() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    memory: performance.memory ? {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit
    } : 'not available',
    toolExecutor: {
      initialized: toolExecutor.isInitialized,
      hasProject: !!toolExecutor.projectHandle,
      checkpoints: toolExecutor.checkpoints.size
    },
    performance: toolExecutor.getPerformanceStats(),
    localStorage: typeof localStorage !== 'undefined' ? {
      available: true,
      usage: JSON.stringify(localStorage).length
    } : { available: false }
  };
  
  console.log('🔍 Diagnostic Information:');
  console.log(JSON.stringify(diagnostics, null, 2));
  
  return diagnostics;
}
```

## Getting Help

### When to Seek Additional Support

1. **Persistent errors** that don't match any patterns in this guide
2. **Performance issues** that don't improve with optimization
3. **Security concerns** about tool usage
4. **Integration problems** with external systems

### Information to Provide

When reporting issues, include:

```javascript
// ✅ Collect this information for support
const supportInfo = {
  error: {
    message: error.message,
    stack: error.stack,
    category: categorizeError(error)
  },
  tool: {
    name: toolName,
    parameters: params,
    options: options
  },
  environment: collectDiagnostics(),
  steps: [
    'Step 1: What you were trying to do',
    'Step 2: What you expected to happen',
    'Step 3: What actually happened',
    'Step 4: What you tried to fix it'
  ]
};
```

This troubleshooting guide should help you resolve most common issues with the AI Code Editor's tool system. Remember to always check the error category first, then apply the appropriate recovery strategies.