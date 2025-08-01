# Tool Usage Best Practices Guide

## Overview

This guide provides best practices for using the AI Code Editor's tool system effectively, safely, and efficiently. Following these practices will help you avoid common pitfalls, optimize performance, and maintain code quality.

## General Principles

### 1. **Choose the Right Tool for the Job**
Always select the most appropriate tool based on your specific needs:

```javascript
// ✅ Good: Use targeted tool for specific task
await toolExecutor.executeTool('read_file_lines', {
  filename: 'large-file.js',
  start_line: 100,
  end_line: 150
});

// ❌ Bad: Use general tool for specific task
await toolExecutor.executeTool('read_file', {
  filename: 'large-file.js' // Will be truncated
});
```

### 2. **Validate Parameters Before Execution**
Always validate your parameters to prevent errors:

```javascript
// ✅ Good: Validate parameters
const filename = 'src/component.jsx';
if (!filename || typeof filename !== 'string') {
  throw new Error('Invalid filename');
}

await toolExecutor.executeTool('read_file', { filename });

// ❌ Bad: No validation
await toolExecutor.executeTool('read_file', { filename: null });
```

### 3. **Handle Errors Gracefully**
Always implement proper error handling:

```javascript
// ✅ Good: Comprehensive error handling
try {
  const result = await toolExecutor.executeTool('create_file', {
    filename: 'new-component.jsx',
    content: componentCode
  });
  
  if (result.success) {
    console.log('File created successfully');
    if (result.data.checkpointId) {
      console.log('Undo checkpoint created:', result.data.checkpointId);
    }
  } else {
    console.error('Creation failed:', result.message);
    
    // Use error analysis for recovery
    if (result.errorAnalysis) {
      console.log('Recovery suggestions:', result.errorAnalysis.recoverySuggestions);
      
      if (result.errorAnalysis.retryable) {
        console.log('Operation can be retried');
      }
    }
  }
} catch (error) {
  console.error('Unexpected error:', error.message);
}

// ❌ Bad: No error handling
const result = await toolExecutor.executeTool('create_file', params);
console.log(result.data); // May crash if result.data is undefined
```

## File Operations Best Practices

### Reading Files

#### Small Files (< 256KB)
```javascript
// ✅ Perfect for small files
const result = await toolExecutor.executeTool('read_file', {
  filename: 'src/utils.js',
  include_line_numbers: true
});
```

#### Large Files (> 256KB)
```javascript
// ✅ Use targeted reading for large files
const result = await toolExecutor.executeTool('read_file_lines', {
  filename: 'large-dataset.json',
  start_line: 1,
  end_line: 100
});

// ✅ Or use streaming for full content
const result = await toolExecutor.executeTool('read_file', {
  filename: 'large-file.js' // Will use streaming automatically
});
```

#### Multiple Files
```javascript
// ✅ Efficient batch processing
const result = await toolExecutor.executeTool('read_multiple_files', {
  filenames: [
    'src/components/Header.jsx',
    'src/components/Footer.jsx',
    'src/components/Navigation.jsx'
  ]
});

// ❌ Inefficient individual calls
for (const filename of filenames) {
  await toolExecutor.executeTool('read_file', { filename });
}
```

### Writing and Editing Files

#### Creating New Files
```javascript
// ✅ Good: Create with proper content structure
await toolExecutor.executeTool('create_file', {
  filename: 'src/components/NewComponent.jsx',
  content: `import React from 'react';

/**
 * NewComponent - A reusable component
 */
export default function NewComponent({ title, children }) {
  return (
    <div className="new-component">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

NewComponent.defaultProps = {
  title: 'Default Title'
};`
});

// ❌ Bad: Create with malformed content
await toolExecutor.executeTool('create_file', {
  filename: 'component.jsx',
  content: 'function Component() { return <div>Hello' // Missing closing tags
});
```

#### Precise Edits with apply_diff
```javascript
// ✅ Good: Well-structured diff with exact content
await toolExecutor.executeTool('apply_diff', {
  filename: 'src/app.js',
  diff: `<<<<<<< SEARCH
:start_line:15
-------
const oldFunction = () => {
  console.log('old implementation');
  return false;
};
=======
const newFunction = () => {
  console.log('new implementation');
  return true;
};
>>>>>>> REPLACE`
});

// ❌ Bad: Diff with incorrect line numbers or content
await toolExecutor.executeTool('apply_diff', {
  filename: 'src/app.js',
  diff: `<<<<<<< SEARCH
:start_line:999
-------
some content that doesn't exist
=======
new content
>>>>>>> REPLACE`
});
```

#### Simple Text Replacements
```javascript
// ✅ Good: Simple, targeted replacements
await toolExecutor.executeTool('find_and_replace', {
  filename: 'src/config.js',
  find_text: 'API_URL = "http://localhost:3000"',
  replace_text: 'API_URL = "https://api.production.com"',
  all_occurrences: false
});

// ✅ Good: Variable renaming
await toolExecutor.executeTool('find_and_replace', {
  filename: 'src/utils.js',
  find_text: 'oldVariableName',
  replace_text: 'newVariableName',
  all_occurrences: true
});
```

#### Complex Edits
```javascript
// ✅ Good: Multiple targeted edits in one operation
await toolExecutor.executeTool('edit_file', {
  filename: 'src/component.jsx',
  edits: [
    {
      type: 'replace_lines',
      start_line: 5,
      end_line: 7,
      new_content: `import { useState, useEffect, useCallback } from 'react';`
    },
    {
      type: 'insert_lines',
      line_number: 15,
      new_content: `  // Added state management
  const [isLoading, setIsLoading] = useState(false);`
    },
    {
      type: 'replace_lines',
      start_line: 25,
      end_line: 25,
      new_content: `  const handleSubmit = useCallback(async (data) => {`
    }
  ]
});
```

## Code Analysis Best Practices

### Analyzing Code Structure
```javascript
// ✅ Good: Analyze specific files for structure
const result = await toolExecutor.executeTool('analyze_code', {
  filename: 'src/complex-module.js'
});

if (result.success) {
  const { functions, classes, imports } = result.data.analysis;
  console.log(`Found ${functions.length} functions, ${classes.length} classes`);
}
```

### Searching Code
```javascript
// ✅ Good: Targeted search with patterns
await toolExecutor.executeTool('search_code', {
  query: 'TODO|FIXME|HACK',
  file_pattern: '*.js,*.jsx,*.ts,*.tsx',
  context_lines: 2
});

// ✅ Good: Search for specific patterns
await toolExecutor.executeTool('search_code', {
  query: 'useState\\(',
  file_pattern: '*.jsx',
  max_results: 50
});
```

### Quality Analysis
```javascript
// ✅ Good: Regular quality checks
const qualityResult = await toolExecutor.executeTool('analyze_code_quality', {
  file_path: 'src/legacy-component.jsx'
});

if (qualityResult.success) {
  const { issues, suggestions, metrics } = qualityResult.data;
  
  // Act on quality issues
  if (issues.length > 0) {
    console.log('Quality issues found:', issues);
    console.log('Suggestions:', suggestions);
  }
}
```

## Research Best Practices

### Reading URLs
```javascript
// ✅ Good: Read specific documentation
const result = await toolExecutor.executeTool('read_url', {
  url: 'https://reactjs.org/docs/hooks-state.html'
});

// ✅ Good: Handle network errors gracefully
try {
  const result = await toolExecutor.executeTool('read_url', {
    url: 'https://api.example.com/docs'
  });
} catch (error) {
  if (error.message.includes('network')) {
    console.log('Network issue, trying alternative source...');
  }
}
```

### Comprehensive Research
```javascript
// ✅ Good: Structured research with appropriate scope
const research = await toolExecutor.executeTool('perform_research', {
  query: 'React performance optimization best practices',
  max_results: 5,
  depth: 2,
  relevance_threshold: 0.7
});

// ✅ Good: Process research results
if (research.success) {
  const { summary, references, metadata } = research.data;
  
  console.log(`Research completed: ${metadata.totalUrls} sources analyzed`);
  console.log(`Unique domains: ${metadata.uniqueDomains}`);
  
  // Use the comprehensive summary
  console.log('Research summary:', summary);
}
```

## Performance Optimization

### Memory Management
```javascript
// ✅ Good: Monitor memory usage for large operations
const stats = toolExecutor.getPerformanceStats();
if (stats.memoryUsage > 0.8) {
  console.warn('High memory usage, consider smaller operations');
}

// ✅ Good: Use streaming for large files
await toolExecutor.executeTool('edit_file', {
  filename: 'very-large-file.js',
  edits: [/* edits */]
}); // Automatically uses streaming
```

### Batch Operations
```javascript
// ✅ Good: Batch related operations
const analysisResults = await toolExecutor.executeTool('batch_analyze_files', {
  filenames: [
    'src/component1.jsx',
    'src/component2.jsx',
    'src/component3.jsx'
  ],
  analysis_types: ['ast', 'quality']
});

// ✅ Good: Use tool chains for dependent operations
await toolExecutor.executeToolChain([
  { name: 'read_file', parameters: { filename: 'input.js' } },
  { name: 'analyze_code', parameters: { filename: 'input.js' } },
  { name: 'create_file', parameters: { filename: 'analysis.json', content: '...' } }
], {
  useDependencyGraph: true
});
```

### Caching and Optimization
```javascript
// ✅ Good: Leverage caching for repeated operations
// The system automatically caches results, but you can optimize by:

// 1. Avoiding redundant operations
const fileContent = await toolExecutor.executeTool('read_file', {
  filename: 'config.js'
});

// Don't read the same file again immediately
// Use the cached result instead

// 2. Using appropriate timeouts
await toolExecutor.executeTool('perform_research', {
  query: 'complex research topic'
}, {
  timeout: 60000, // 60 seconds for complex research
  progressCallback: (progress) => {
    console.log('Research progress:', progress.message);
  }
});
```

## Error Handling and Recovery

### Retry Logic
```javascript
// ✅ Good: Let the system handle retries automatically
const result = await toolExecutor.executeTool('read_url', {
  url: 'https://api.example.com/data'
}); // Automatically retries network failures

// ✅ Good: Custom retry handling when needed
await toolExecutor.executeTool('perform_research', {
  query: 'research topic'
}, {
  onRetry: (error, attempt, delay, errorAnalysis) => {
    console.log(`Retry ${attempt}: ${error.message}`);
    console.log(`Next attempt in ${Math.round(delay)}ms`);
    
    if (errorAnalysis.category === 'network') {
      console.log('Network issue detected, will retry with exponential backoff');
    }
  }
});
```

### Fallback Strategies
```javascript
// ✅ Good: Implement fallback strategies
async function robustFileRead(filename) {
  try {
    // Try primary approach
    return await toolExecutor.executeTool('read_file', { filename });
  } catch (error) {
    console.warn('Primary read failed, trying line-based approach');
    
    try {
      // Fallback to line-based reading
      return await toolExecutor.executeTool('read_file_lines', {
        filename,
        start_line: 1,
        end_line: 1000 // Read first 1000 lines
      });
    } catch (fallbackError) {
      console.error('All read attempts failed');
      throw fallbackError;
    }
  }
}
```

### Error Analysis
```javascript
// ✅ Good: Use error analysis for intelligent recovery
try {
  await toolExecutor.executeTool('create_file', {
    filename: 'new-file.js',
    content: fileContent
  });
} catch (error) {
  const result = error.result || {};
  
  if (result.errorAnalysis) {
    const { category, retryable, recoverySuggestions } = result.errorAnalysis;
    
    switch (category) {
      case 'filesystem':
        if (error.message.includes('permission')) {
          console.log('Permission error - user activation required');
          // Guide user to click in editor
        }
        break;
        
      case 'validation':
        console.log('Parameter validation failed');
        console.log('Suggestions:', recoverySuggestions);
        break;
        
      case 'network':
        if (retryable) {
          console.log('Network error - will retry automatically');
        }
        break;
    }
  }
}
```

## Security Best Practices

### Input Validation
```javascript
// ✅ Good: Validate and sanitize inputs
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename must be a non-empty string');
  }
  
  if (filename.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  
  if (filename.length > 255) {
    throw new Error('Filename too long');
  }
  
  return filename.trim();
}

const safeFilename = validateFilename(userInput);
await toolExecutor.executeTool('create_file', {
  filename: safeFilename,
  content: sanitizedContent
});
```

### Content Sanitization
```javascript
// ✅ Good: Sanitize content before writing
function sanitizeContent(content) {
  if (typeof content !== 'string') {
    throw new Error('Content must be a string');
  }
  
  // Remove potentially dangerous patterns
  return content
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .trim();
}

await toolExecutor.executeTool('create_file', {
  filename: 'safe-file.js',
  content: sanitizeContent(userContent)
});
```

### URL Validation
```javascript
// ✅ Good: Validate URLs before reading
function validateUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP/HTTPS URLs are allowed');
    }
    
    // Block local/internal URLs
    const hostname = urlObj.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)) {
      throw new Error('Local URLs are not allowed');
    }
    
    return url;
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

const safeUrl = validateUrl(userUrl);
await toolExecutor.executeTool('read_url', { url: safeUrl });
```

## Testing and Debugging

### Tool Testing
```javascript
// ✅ Good: Test tools with various inputs
async function testFileOperations() {
  const testCases = [
    { filename: 'test1.js', content: 'console.log("test1");' },
    { filename: 'test2.jsx', content: 'export default function Test() { return <div>Test</div>; }' },
    { filename: 'test3.json', content: '{"test": true}' }
  ];
  
  for (const testCase of testCases) {
    try {
      const result = await toolExecutor.executeTool('create_file', testCase);
      console.log(`✅ ${testCase.filename}: ${result.success ? 'Success' : 'Failed'}`);
    } catch (error) {
      console.log(`❌ ${testCase.filename}: ${error.message}`);
    }
  }
}
```

### Performance Monitoring
```javascript
// ✅ Good: Monitor tool performance
async function monitoredExecution(toolName, params) {
  const startTime = Date.now();
  
  try {
    const result = await toolExecutor.executeTool(toolName, params);
    const executionTime = Date.now() - startTime;
    
    console.log(`Tool ${toolName} executed in ${executionTime}ms`);
    
    if (executionTime > 10000) { // > 10 seconds
      console.warn(`Slow execution detected for ${toolName}`);
    }
    
    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`Tool ${toolName} failed after ${executionTime}ms: ${error.message}`);
    throw error;
  }
}
```

## Common Anti-Patterns to Avoid

### ❌ Don't Do These

```javascript
// ❌ Don't ignore errors
await toolExecutor.executeTool('create_file', params); // No error handling

// ❌ Don't use wrong tools for the job
await toolExecutor.executeTool('read_file', { 
  filename: 'huge-file.txt' // Will be truncated
});

// ❌ Don't make unnecessary individual calls
for (const file of files) {
  await toolExecutor.executeTool('read_file', { filename: file });
}

// ❌ Don't use apply_diff with uncertain content
await toolExecutor.executeTool('apply_diff', {
  filename: 'file.js',
  diff: `<<<<<<< SEARCH
some content that might not exist
=======
new content
>>>>>>> REPLACE`
});

// ❌ Don't create files with invalid content
await toolExecutor.executeTool('create_file', {
  filename: 'component.jsx',
  content: 'function Component() { return <div>Hello' // Malformed
});

// ❌ Don't ignore security validation
await toolExecutor.executeTool('read_url', {
  url: userInput // Unvalidated user input
});
```

## Summary Checklist

Before using any tool, ask yourself:

- [ ] **Is this the right tool for my specific task?**
- [ ] **Have I validated all input parameters?**
- [ ] **Am I handling errors appropriately?**
- [ ] **Is my content properly formatted and valid?**
- [ ] **Am I using batch operations where possible?**
- [ ] **Have I considered security implications?**
- [ ] **Am I monitoring performance for large operations?**
- [ ] **Do I have appropriate fallback strategies?**

Following these best practices will help you use the AI Code Editor's tool system effectively, safely, and efficiently while avoiding common pitfalls and optimizing performance.