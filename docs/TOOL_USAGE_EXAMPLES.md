# Tool Usage Examples

## Overview

This document provides practical, real-world examples of using the AI Code Editor's tool system. Each example includes complete code snippets, expected outputs, and common variations to help you understand how to effectively use each tool category.

## Table of Contents

1. [File Operations Examples](#file-operations-examples)
2. [Code Analysis Examples](#code-analysis-examples)
3. [Research Tools Examples](#research-tools-examples)
4. [Engineering Tools Examples](#engineering-tools-examples)
5. [System Management Examples](#system-management-examples)
6. [Advanced Workflows](#advanced-workflows)

## File Operations Examples

### Reading Files

#### Example 1: Reading a Small Component File

```javascript
// Read a React component with line numbers
const result = await toolExecutor.executeTool('read_file', {
  filename: 'src/components/Button.jsx',
  include_line_numbers: true
});

if (result.success) {
  console.log('File content:');
  console.log(result.data.content);
  console.log(`File size: ${result.data.file_size} bytes`);
}

/* Expected Output:
File content:
1 | import React from 'react';
2 | import PropTypes from 'prop-types';
3 | 
4 | /**
5 |  * Reusable Button component
6 |  */
7 | export default function Button({ children, onClick, variant = 'primary' }) {
8 |   return (
9 |     <button 
10 |       className={`btn btn-${variant}`}
11 |       onClick={onClick}
12 |     >
13 |       {children}
14 |     </button>
15 |   );
16 | }
17 | 
18 | Button.propTypes = {
19 |   children: PropTypes.node.isRequired,
20 |   onClick: PropTypes.func,
21 |   variant: PropTypes.oneOf(['primary', 'secondary', 'danger'])
22 | };

File size: 456 bytes
*/
```

#### Example 2: Reading Specific Lines from a Large File

```javascript
// Read specific lines from a large log file
const result = await toolExecutor.executeTool('read_file_lines', {
  filename: 'logs/application.log',
  start_line: 1000,
  end_line: 1020
});

if (result.success) {
  console.log('Log entries:');
  console.log(result.data.content);
  console.log(`Lines ${result.data.details.start_line}-${result.data.details.end_line} of ${result.data.details.original_lines_count}`);
}

/* Expected Output:
Log entries:
1000 | 2024-01-15 10:30:15 INFO  [UserService] User login successful: user123
1001 | 2024-01-15 10:30:16 DEBUG [DatabasePool] Connection acquired from pool
1002 | 2024-01-15 10:30:16 INFO  [OrderService] New order created: order456
1003 | 2024-01-15 10:30:17 WARN  [PaymentService] Payment retry attempt 2/3
1004 | 2024-01-15 10:30:18 INFO  [PaymentService] Payment successful
...

Lines 1000-1020 of 15847
*/
```

#### Example 3: Reading Multiple Related Files

```javascript
// Read all components in a feature directory
const result = await toolExecutor.executeTool('read_multiple_files', {
  filenames: [
    'src/features/auth/LoginForm.jsx',
    'src/features/auth/SignupForm.jsx',
    'src/features/auth/AuthProvider.jsx',
    'src/features/auth/authUtils.js'
  ]
});

if (result.success) {
  console.log('Batch read completed:');
  console.log(`Successfully read: ${result.data.batch_stats.successful} files`);
  console.log(`Failed: ${result.data.batch_stats.failed} files`);
  console.log(`Total size processed: ${result.data.batch_stats.total_processed_size} bytes`);
  
  // The combined_content contains all files with clear separators
  console.log('Combined content preview:');
  console.log(result.data.combined_content.substring(0, 500) + '...');
}
```

### Creating and Writing Files

#### Example 4: Creating a New React Component

```javascript
// Create a new reusable component
const componentCode = `import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './Modal.css';

/**
 * Modal component with backdrop and close functionality
 */
export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node
};`;

const result = await toolExecutor.executeTool('create_file', {
  filename: 'src/components/Modal.jsx',
  content: componentCode
});

if (result.success) {
  console.log('✅ Modal component created successfully');
  if (result.data.checkpointId) {
    console.log(`Undo checkpoint: ${result.data.checkpointId}`);
  }
}
```

#### Example 5: Precise Code Editing with apply_diff

```javascript
// Update a function to use modern React hooks
const result = await toolExecutor.executeTool('apply_diff', {
  filename: 'src/components/Counter.jsx',
  diff: `<<<<<<< SEARCH
:start_line:8
-------
class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  increment = () => {
    this.setState({ count: this.state.count + 1 });
  };

  render() {
    return (
      <div>
        <p>Count: {this.state.count}</p>
        <button onClick={this.increment}>Increment</button>
      </div>
    );
  }
}
=======
function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}
>>>>>>> REPLACE`
});

if (result.success) {
  console.log('✅ Successfully converted class component to function component');
  console.log(`Applied ${result.data.details.blocksApplied} diff blocks`);
}
```

#### Example 6: Simple Text Replacements

```javascript
// Update API endpoint across configuration
const result = await toolExecutor.executeTool('find_and_replace', {
  filename: 'src/config/api.js',
  find_text: 'https://api-dev.example.com',
  replace_text: 'https://api-prod.example.com',
  all_occurrences: true
});

if (result.success) {
  console.log(`✅ Updated ${result.data.details.replacements} API endpoints`);
}
```

#### Example 7: Complex Multi-Edit Operations

```javascript
// Add error handling and loading states to a component
const result = await toolExecutor.executeTool('edit_file', {
  filename: 'src/components/UserProfile.jsx',
  edits: [
    {
      type: 'replace_lines',
      start_line: 5,
      end_line: 5,
      new_content: `import { useState, useEffect } from 'react';`
    },
    {
      type: 'insert_lines',
      line_number: 10,
      new_content: `  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);`
    },
    {
      type: 'replace_lines',
      start_line: 15,
      end_line: 20,
      new_content: `  const fetchUserData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(\`/api/users/\${userId}\`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      
      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };`
    }
  ]
});

if (result.success) {
  console.log('✅ Added error handling and loading states');
  console.log(`Modified ${result.data.details.editsApplied} sections`);
}
```

## Code Analysis Examples

#### Example 8: Analyzing Code Structure

```javascript
// Analyze a complex module for structure and dependencies
const result = await toolExecutor.executeTool('analyze_code', {
  filename: 'src/services/DataProcessor.js'
});

if (result.success) {
  const { functions, classes, imports } = result.data.analysis;
  
  console.log('📊 Code Analysis Results:');
  console.log(`Functions found: ${functions.length}`);
  functions.forEach(fn => console.log(`  - ${fn.name} (${fn.type})`));
  
  console.log(`Classes found: ${classes.length}`);
  classes.forEach(cls => console.log(`  - ${cls.name}`));
  
  console.log(`Imports: ${imports.length}`);
  imports.forEach(imp => console.log(`  - ${imp.source}`));
}

/* Expected Output:
📊 Code Analysis Results:
Functions found: 8
  - processData (function)
  - validateInput (function)
  - transformData (function)
  - handleError (function)
  - DataProcessor (class)
  - getInstance (function)
  - cleanup (function)
  - exportResults (function)

Classes found: 1
  - DataProcessor

Imports: 5
  - lodash
  - ./validators
  - ./transformers
  - ../utils/logger
  - ../config/constants
*/
```

#### Example 9: Searching Code Patterns

```javascript
// Find all TODO comments across the project
const result = await toolExecutor.executeTool('search_code', {
  query: 'TODO|FIXME|HACK',
  file_pattern: '*.js,*.jsx,*.ts,*.tsx',
  context_lines: 2
});

if (result.success) {
  console.log(`🔍 Found ${result.data.results.length} code comments to review:`);
  
  result.data.results.forEach((match, index) => {
    console.log(`\n${index + 1}. ${match.file}:${match.line}`);
    console.log(match.context);
  });
}

/* Expected Output:
🔍 Found 12 code comments to review:

1. src/components/Dashboard.jsx:45
43 |   const handleDataRefresh = () => {
44 |     // TODO: Implement proper error handling for data refresh
45 |     fetchDashboardData();
46 |   };

2. src/utils/api.js:128
126 |   } catch (error) {
127 |     // FIXME: This error handling is too generic
128 |     console.error('API Error:', error);
129 |     throw error;
...
*/
```

#### Example 10: Code Quality Analysis

```javascript
// Analyze code quality for a legacy component
const result = await toolExecutor.executeTool('analyze_code_quality', {
  file_path: 'src/legacy/OldComponent.jsx'
});

if (result.success) {
  const { issues, suggestions, metrics } = result.data;
  
  console.log('📈 Code Quality Report:');
  console.log(`Overall Score: ${metrics.overallScore}/100`);
  console.log(`Complexity: ${metrics.complexity}`);
  console.log(`Maintainability: ${metrics.maintainability}`);
  
  if (issues.length > 0) {
    console.log('\n⚠️ Issues Found:');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.type}: ${issue.description}`);
      console.log(`   Line ${issue.line}: ${issue.context}`);
    });
  }
  
  if (suggestions.length > 0) {
    console.log('\n💡 Suggestions:');
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
  }
}
```

#### Example 11: Batch Analysis

```javascript
// Analyze multiple files for quality issues
const result = await toolExecutor.executeTool('batch_analyze_files', {
  filenames: [
    'src/components/Header.jsx',
    'src/components/Footer.jsx',
    'src/components/Navigation.jsx',
    'src/components/Sidebar.jsx'
  ],
  analysis_types: ['ast', 'quality', 'symbols']
});

if (result.success) {
  console.log('📊 Batch Analysis Summary:');
  console.log(`Files analyzed: ${result.data.summary.totalFiles}`);
  console.log(`Successful: ${result.data.summary.successful}`);
  console.log(`Average quality score: ${result.data.summary.averageQuality.toFixed(1)}`);
  
  result.data.results.forEach(fileResult => {
    if (fileResult.success) {
      console.log(`\n📄 ${fileResult.filename}:`);
      console.log(`  Quality Score: ${fileResult.qualityScore}/100`);
      console.log(`  Issues: ${fileResult.issues.length}`);
      console.log(`  Processing: ${fileResult.processingMethod}`);
    }
  });
}
```

## Research Tools Examples

#### Example 12: Reading Documentation

```javascript
// Read React documentation for hooks
const result = await toolExecutor.executeTool('read_url', {
  url: 'https://reactjs.org/docs/hooks-intro.html'
});

if (result.success) {
  console.log('📖 Documentation Content:');
  console.log(`Title: ${result.data.title}`);
  console.log(`Content length: ${result.data.content.length} characters`);
  console.log(`Links found: ${result.data.links.length}`);
  
  // Show first 500 characters
  console.log('\nContent preview:');
  console.log(result.data.content.substring(0, 500) + '...');
}
```

#### Example 13: Comprehensive Research

```javascript
// Research React performance optimization techniques
const result = await toolExecutor.executeTool('perform_research', {
  query: 'React performance optimization best practices 2024',
  max_results: 5,
  depth: 2,
  relevance_threshold: 0.7
});

if (result.success) {
  console.log('🔬 Research Results:');
  console.log(result.data.summary);
  
  console.log('\n📚 Sources Analyzed:');
  result.data.references.forEach((url, index) => {
    console.log(`${index + 1}. ${url}`);
  });
  
  console.log('\n📊 Research Metadata:');
  console.log(`Total URLs visited: ${result.data.metadata.totalUrls}`);
  console.log(`Successful retrievals: ${result.data.metadata.successfulRetrievals}`);
  console.log(`Unique domains: ${result.data.metadata.uniqueDomains}`);
  console.log(`Knowledge gaps identified: ${result.data.metadata.knowledgeGaps.length}`);
}

/* Expected Output:
🔬 Research Results:
Research for "React performance optimization best practices 2024" completed successfully using multi-stage approach.

📊 Research Statistics:
- Total URLs visited: 12
- Successful content retrievals: 10
- Failed retrievals: 2
- Stage 1 (Broad exploration): 7 sources
- Stage 3 (Focused reading): 3 sources
- Unique domains explored: 8
- Search queries performed: 15
- Knowledge gaps identified: 3

The multi-stage research approach first gathered broad information, then identified knowledge gaps, and finally performed focused research to fill those gaps.

Key findings include:
1. React.memo() for component memoization
2. useMemo() and useCallback() for expensive calculations
3. Code splitting with React.lazy() and Suspense
4. Virtual scrolling for large lists
5. Bundle analysis and optimization techniques
...
*/
```

#### Example 14: Quick Web Search

```javascript
// Search for specific technical information
const result = await toolExecutor.executeTool('duckduckgo_search', {
  query: 'JavaScript async await error handling patterns'
});

if (result.success) {
  console.log(`🔍 Found ${result.data.results.length} search results:`);
  
  result.data.results.slice(0, 5).forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.title}`);
    console.log(`   ${item.link}`);
    console.log(`   ${item.snippet}`);
  });
}
```

## Engineering Tools Examples

#### Example 15: Systematic Debugging

```javascript
// Debug a complex issue systematically
const result = await toolExecutor.executeTool('debug_systematically', {
  problem_description: 'Users report that the shopping cart total is sometimes incorrect after applying discount codes',
  context: {
    component: 'ShoppingCart.jsx',
    related_files: ['discountUtils.js', 'priceCalculator.js'],
    user_reports: 'Discount appears to apply twice on some items'
  }
});

if (result.success) {
  console.log('🔧 Systematic Debugging Results:');
  console.log('\n📋 Hypothesis:');
  console.log(result.data.hypothesis);
  
  console.log('\n🧪 Test Plan:');
  result.data.testPlan.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
  
  console.log('\n🔍 Investigation Steps:');
  result.data.investigationSteps.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
}
```

#### Example 16: Engineering Problem Solving

```javascript
// Solve a complex architectural problem
const result = await toolExecutor.executeTool('solve_engineering_problem', {
  problem: 'Need to implement real-time collaboration features in a React application with conflict resolution',
  constraints: [
    'Must work with existing Redux state management',
    'Should handle 50+ concurrent users',
    'Need offline support with sync when reconnected'
  ],
  requirements: [
    'Real-time updates across all connected clients',
    'Conflict resolution for simultaneous edits',
    'Optimistic updates for better UX'
  ]
});

if (result.success) {
  console.log('🏗️ Engineering Solution:');
  console.log('\n📐 Recommended Architecture:');
  console.log(result.data.architecture);
  
  console.log('\n🛠️ Implementation Plan:');
  result.data.implementationPlan.forEach((phase, index) => {
    console.log(`Phase ${index + 1}: ${phase.title}`);
    console.log(`  Duration: ${phase.duration}`);
    console.log(`  Tasks: ${phase.tasks.join(', ')}`);
  });
  
  console.log('\n⚠️ Considerations:');
  result.data.considerations.forEach(consideration => {
    console.log(`- ${consideration}`);
  });
}
```

#### Example 17: Building Symbol Tables

```javascript
// Build comprehensive symbol table for a module
const result = await toolExecutor.executeTool('build_symbol_table', {
  file_path: 'src/services/UserService.js'
});

if (result.success) {
  console.log('🗂️ Symbol Table:');
  
  const { functions, classes, variables, exports } = result.data.symbols;
  
  console.log(`\n📋 Functions (${functions.length}):`);
  functions.forEach(fn => {
    console.log(`  ${fn.name}(${fn.parameters.join(', ')}) - Line ${fn.line}`);
  });
  
  console.log(`\n🏗️ Classes (${classes.length}):`);
  classes.forEach(cls => {
    console.log(`  ${cls.name} - Line ${cls.line}`);
    cls.methods.forEach(method => {
      console.log(`    ${method.name}() - Line ${method.line}`);
    });
  });
  
  console.log(`\n📤 Exports (${exports.length}):`);
  exports.forEach(exp => {
    console.log(`  ${exp.name} (${exp.type})`);
  });
}
```

## System Management Examples

#### Example 18: Operation Management

```javascript
// Monitor and manage active operations
const activeOps = await toolExecutor.executeTool('get_active_operations');

console.log('🔄 Active Operations:');
console.log(`Total: ${activeOps.data.summary.total}`);
console.log(`Running: ${activeOps.data.summary.running}`);
console.log(`Longest running: ${activeOps.data.summary.longestRunning}ms`);

if (activeOps.data.operations.length > 0) {
  console.log('\nOperations:');
  activeOps.data.operations.forEach(op => {
    console.log(`- ${op.id}: ${op.status} (${op.duration}ms)`);
  });
  
  // Cancel a specific long-running operation
  const longRunning = activeOps.data.operations.find(op => op.duration > 30000);
  if (longRunning) {
    const cancelResult = await toolExecutor.executeTool('cancel_operation', {
      operation_id: longRunning.id,
      reason: 'Operation taking too long'
    });
    
    if (cancelResult.success) {
      console.log(`✅ Cancelled operation ${longRunning.id}`);
    }
  }
}
```

#### Example 19: Dependency Graph Management

```javascript
// Create and execute a dependency graph for a complex workflow
const tools = [
  {
    name: 'read_file',
    parameters: { filename: 'src/data/input.json' },
    metadata: { priority: 1, estimatedDuration: 2000 }
  },
  {
    name: 'analyze_code',
    parameters: { filename: 'src/processors/DataProcessor.js' },
    dependencies: [], // No dependencies
    metadata: { priority: 2, estimatedDuration: 5000 }
  },
  {
    name: 'create_file',
    parameters: { 
      filename: 'src/output/processed-data.json',
      content: '// Will be generated based on analysis'
    },
    dependencies: [0, 1], // Depends on both read_file and analyze_code
    metadata: { priority: 3, estimatedDuration: 3000 }
  }
];

// Create the dependency graph
const graphResult = await toolExecutor.executeTool('create_dependency_graph', {
  tools: tools,
  auto_detect_dependencies: true
});

if (graphResult.success) {
  console.log('📊 Dependency Graph Created:');
  console.log(`Nodes: ${graphResult.data.nodeIds.length}`);
  console.log(`Phases: ${graphResult.data.executionPlan.phases}`);
  console.log(`Estimated time: ${graphResult.data.executionPlan.totalEstimatedTime}ms`);
  
  // Get the execution plan
  const planResult = await toolExecutor.executeTool('get_execution_plan');
  
  if (planResult.success) {
    console.log('\n📋 Execution Plan:');
    planResult.data.plan.phases.forEach((phase, index) => {
      console.log(`Phase ${index + 1}: ${phase.toolCount} tools`);
      console.log(`  Can run in parallel: ${phase.canRunInParallel}`);
      phase.tools.forEach(tool => {
        console.log(`  - ${tool.toolName} (${tool.estimatedDuration}ms)`);
      });
    });
  }
  
  // Execute the tool chain using the dependency graph
  const executionResult = await toolExecutor.executeToolChain(tools, {
    useDependencyGraph: true,
    continueOnError: false
  });
  
  if (executionResult.success) {
    console.log('\n✅ Tool chain executed successfully:');
    console.log(`Completed: ${executionResult.data.summary.succeeded}/${executionResult.data.summary.total}`);
    console.log(`Total time: ${executionResult.data.summary.executionTime}ms`);
  }
}
```

#### Example 20: Performance Monitoring

```javascript
// Monitor tool performance and optimize
const performanceStats = toolExecutor.getPerformanceStats();

console.log('📊 Performance Statistics:');
console.log(`Total operations: ${performanceStats.totalOperations}`);
console.log(`Average execution time: ${performanceStats.averageExecutionTime}ms`);
console.log(`Error rate: ${(performanceStats.errorRate * 100).toFixed(2)}%`);
console.log(`Memory usage: ${(performanceStats.memoryUsage * 100).toFixed(1)}%`);

// Check if performance optimization is needed
if (performanceStats.errorRate > 0.1) {
  console.log('⚠️ High error rate detected - consider adjusting retry settings');
}

if (performanceStats.memoryUsage > 0.8) {
  console.log('⚠️ High memory usage - consider using streaming operations');
}

if (performanceStats.averageExecutionTime > 10000) {
  console.log('⚠️ Slow average execution time - consider optimizing operations');
}

// Update timeout settings if needed
const timeoutResult = await toolExecutor.executeTool('update_timeout_settings', {
  tool_type: 'file_operations',
  timeout_ms: 45000 // Increase timeout for file operations
});

if (timeoutResult.success) {
  console.log(`✅ Updated timeout: ${timeoutResult.data.old_timeout}ms → ${timeoutResult.data.new_timeout}ms`);
}
```

## Advanced Workflows

#### Example 21: Complete Feature Development Workflow

```javascript
// Complete workflow: Research → Plan → Implement → Test
async function developFeatureWorkflow(featureName, requirements) {
  console.log(`🚀 Starting development workflow for: ${featureName}`);
  
  // Step 1: Research best practices
  console.log('\n1️⃣ Researching best practices...');
  const research = await toolExecutor.executeTool('perform_research', {
    query: `${featureName} React implementation best practices`,
    max_results: 3,
    depth: 2
  });
  
  if (research.success) {
    console.log('✅ Research completed');
    console.log(`Sources analyzed: ${research.data.metadata.totalUrls}`);
  }
  
  // Step 2: Analyze existing codebase
  console.log('\n2️⃣ Analyzing existing codebase...');
  const codebaseAnalysis = await toolExecutor.executeTool('batch_analyze_files', {
    filenames: [
      'src/components/index.js',
      'src/hooks/index.js',
      'src/utils/index.js'
    ],
    analysis_types: ['ast', 'quality']
  });
  
  // Step 3: Create component structure
  console.log('\n3️⃣ Creating component structure...');
  const componentCode = generateComponentCode(featureName, requirements, research.data);
  
  const createResult = await toolExecutor.executeTool('create_file', {
    filename: `src/components/${featureName}.jsx`,
    content: componentCode
  });
  
  // Step 4: Create tests
  console.log('\n4️⃣ Creating tests...');
  const testCode = generateTestCode(featureName, requirements);
  
  const testResult = await toolExecutor.executeTool('create_file', {
    filename: `src/components/__tests__/${featureName}.test.jsx`,
    content: testCode
  });
  
  // Step 5: Update index file
  console.log('\n5️⃣ Updating exports...');
  const updateResult = await toolExecutor.executeTool('find_and_replace', {
    filename: 'src/components/index.js',
    find_text: '// Export components here',
    replace_text: `// Export components here\nexport { default as ${featureName} } from './${featureName}';`,
    all_occurrences: false
  });
  
  // Step 6: Validate implementation
  console.log('\n6️⃣ Validating implementation...');
  const validation = await toolExecutor.executeTool('analyze_code_quality', {
    file_path: `src/components/${featureName}.jsx`
  });
  
  console.log('\n✅ Feature development workflow completed!');
  console.log('Summary:');
  console.log(`- Component created: ${createResult.success ? '✅' : '❌'}`);
  console.log(`- Tests created: ${testResult.success ? '✅' : '❌'}`);
  console.log(`- Exports updated: ${updateResult.success ? '✅' : '❌'}`);
  console.log(`- Quality score: ${validation.success ? validation.data.metrics.overallScore : 'N/A'}/100`);
  
  return {
    success: createResult.success && testResult.success && updateResult.success,
    qualityScore: validation.success ? validation.data.metrics.overallScore : null
  };
}

// Helper functions (simplified for example)
function generateComponentCode(name, requirements, research) {
  return `import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * ${name} component
 * Generated based on research: ${research.summary.substring(0, 100)}...
 */
export default function ${name}({ ...props }) {
  // Implementation based on requirements and research
  return (
    <div className="${name.toLowerCase()}">
      <h2>${name}</h2>
      {/* Component implementation */}
    </div>
  );
}

${name}.propTypes = {
  // Define prop types based on requirements
};`;
}

function generateTestCode(name, requirements) {
  return `import React from 'react';
import { render, screen } from '@testing-library/react';
import ${name} from '../${name}';

describe('${name}', () => {
  test('renders without crashing', () => {
    render(<${name} />);
    expect(screen.getByText('${name}')).toBeInTheDocument();
  });
  
  // Add more tests based on requirements
});`;
}

// Usage
const result = await developFeatureWorkflow('UserProfile', {
  displayName: true,
  avatar: true,
  editMode: true
});

if (result.success) {
  console.log(`✅ Feature developed successfully with quality score: ${result.qualityScore}/100`);
}
```

#### Example 22: Batch File Processing Pipeline

```javascript
// Process multiple files through a transformation pipeline
async function batchProcessingPipeline(filePattern, transformations) {
  console.log('🔄 Starting batch processing pipeline...');
  
  // Step 1: Find all matching files
  const searchResult = await toolExecutor.executeTool('search_code', {
    query: '.*', // Match all content
    file_pattern: filePattern,
    context_lines: 0
  });
  
  if (!searchResult.success) {
    throw new Error('Failed to find files');
  }
  
  const filenames = [...new Set(searchResult.data.results.map(r => r.file))];
  console.log(`📁 Found ${filenames.length} files to process`);
  
  // Step 2: Create dependency graph for parallel processing
  const tools = filenames.map((filename, index) => ({
    name: 'apply_transformations',
    parameters: { filename, transformations },
    metadata: { 
      priority: 1,
      estimatedDuration: 3000,
      canRunInParallel: true
    }
  }));
  
  // Step 3: Execute transformations in parallel
  const executionResult = await toolExecutor.executeToolChain(tools, {
    maxConcurrency: 5,
    continueOnError: true,
    progressCallback: (completed, total) => {
      console.log(`Progress: ${completed}/${total} files processed`);
    }
  });
  
  console.log('\n✅ Batch processing completed:');
  console.log(`Successful: ${executionResult.data.summary.succeeded}`);
  console.log(`Failed: ${executionResult.data.summary.failed}`);
  console.log(`Total time: ${executionResult.data.summary.executionTime}ms`);
  
  return executionResult;
}

// Custom transformation function
async function applyTransformations(filename, transformations) {
  let result = { success: true, transformationsApplied: 0 };
  
  for (const transformation of transformations) {
    try {
      switch (transformation.type) {
        case 'replace_text':
          const replaceResult = await toolExecutor.executeTool('find_and_replace', {
            filename,
            find_text: transformation.find,
            replace_text: transformation.replace,
            all_occurrences: transformation.global || false
          });
          if (replaceResult.success) result.transformationsApplied++;
          break;
          
        case 'add_imports':
          const importResult = await toolExecutor.executeTool('edit_file', {
            filename,
            edits: [{
              type: 'insert_lines',
              line_number: 1,
              new_content: transformation.imports.join('\n')
            }]
          });
          if (importResult.success) result.transformationsApplied++;
          break;
          
        case 'format_code':
          // Custom formatting logic would go here
          result.transformationsApplied++;
          break;
      }
    } catch (error) {
      console.error(`Transformation failed for ${filename}:`, error.message);
      result.success = false;
    }
  }
  
  return result;
}
```

#### Example 23: Error Recovery and Retry Patterns

```javascript
// Implement robust error handling with automatic retry
async function robustToolExecution(toolName, parameters, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
    fallbackTool = null,
    onRetry = null
  } = options;
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries}: ${toolName}`);
      
      const result = await toolExecutor.executeTool(toolName, parameters);
      
      if (result.success) {
        if (attempt > 1) {
          console.log(`✅ Succeeded on attempt ${attempt}`);
        }
        return result;
      } else {
        throw new Error(result.error || 'Tool execution failed');
      }
      
    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (onRetry) {
        await onRetry(attempt, error);
      }
      
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed, try fallback if available
  if (fallbackTool) {
    console.log(`🔄 Trying fallback tool: ${fallbackTool.name}`);
    try {
      const fallbackResult = await toolExecutor.executeTool(
        fallbackTool.name, 
        fallbackTool.parameters || parameters
      );
      
      if (fallbackResult.success) {
        console.log('✅ Fallback succeeded');
        return { ...fallbackResult, usedFallback: true };
      }
    } catch (fallbackError) {
      console.log(`❌ Fallback also failed: ${fallbackError.message}`);
    }
  }
  
  // Everything failed
  throw new Error(`All attempts failed. Last error: ${lastError.message}`);
}

// Usage with custom retry logic
const result = await robustToolExecution('read_file', {
  filename: 'potentially-locked-file.txt'
}, {
  maxRetries: 5,
  retryDelay: 2000,
  backoffMultiplier: 1.5,
  fallbackTool: {
    name: 'read_file_lines',
    parameters: { filename: 'potentially-locked-file.txt', start_line: 1, end_line: 100 }
  },
  onRetry: async (attempt, error) => {
    if (error.message.includes('locked')) {
      console.log('File appears to be locked, waiting for release...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
});
```

## Best Practices Summary

### 1. Always Check Results
```javascript
if (result.success) {
  // Handle success
  console.log('Operation completed successfully');
} else {
  // Handle failure
  console.error('Operation failed:', result.error);
}
```

### 2. Use Appropriate Tools for the Task
- **Small edits**: Use [`apply_diff`](frontend/js/tools/file_operations/file_writers.js) or [`find_and_replace`](frontend/js/tools/file_operations/file_writers.js)
- **Large changes**: Use [`edit_file`](frontend/js/tools/file_operations/file_writers.js) with multiple edits
- **New files**: Use [`create_file`](frontend/js/tools/file_operations/file_writers.js)
- **Analysis**: Use [`analyze_code`](frontend/js/tools/code_analysis/analyzers.js) or [`batch_analyze_files`](frontend/js/tools/code_analysis/analyzers.js)

### 3. Leverage Batch Operations
```javascript
// Instead of multiple individual calls
const results = await toolExecutor.executeTool('batch_analyze_files', {
  filenames: ['file1.js', 'file2.js', 'file3.js'],
  analysis_types: ['ast', 'quality']
});
```

### 4. Use Tool Chains for Complex Workflows
```javascript
const tools = [
  { name: 'read_file', parameters: { filename: 'input.txt' } },
  { name: 'analyze_code', parameters: { filename: 'processor.js' } },
  { name: 'create_file', parameters: { filename: 'output.txt', content: 'processed' } }
];

const result = await toolExecutor.executeToolChain(tools);
```

### 5. Monitor Performance
```javascript
const stats = toolExecutor.getPerformanceStats();
if (stats.averageExecutionTime > 10000) {
  console.log('Consider optimizing slow operations');
}
```

### 6. Handle Errors Gracefully
```javascript
try {
  const result = await toolExecutor.executeTool('risky_operation', params);
  if (!result.success) {
    // Handle tool-level failure
    console.error('Tool failed:', result.error);
  }
} catch (error) {
  // Handle system-level failure
  console.error('System error:', error.message);
}
```

This comprehensive guide provides practical examples for all major tool categories and common workflows. Use these patterns as starting points for your own implementations, adapting them to your specific use cases and requirements.