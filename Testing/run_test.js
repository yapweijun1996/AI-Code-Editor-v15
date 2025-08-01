// Simple test runner script for the multi-stage research implementation
import { execute } from './js/tool_executor.js';

/**
 * Runs a test of the research functionality
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Test results
 */
async function runTest(options = {}) {
  console.log('🧪 Running research test...');
  const query = options.query || 'What are the main architectural patterns in software engineering?';
  
  try {
    // Create a tool call for the test_research tool
    const toolCall = {
      name: 'test_research',
      args: {
        query: query
      }
    };
    
    console.log('Executing test_research tool...');
    const result = await execute(toolCall, null, false);
    
    console.log('✅ Test completed successfully!');
    
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { error: error.message };
  }
}

// Create UI controls for test
function setupUI() {
  const container = document.getElementById('test-controls');
  if (!container) return;
  
  // Add query input
  const queryInput = document.createElement('input');
  queryInput.type = 'text';
  queryInput.placeholder = 'Enter research query...';
  queryInput.value = 'What are the main architectural patterns in software engineering?';
  queryInput.className = 'query-input';
  
  // Add run button
  const runButton = document.createElement('button');
  runButton.textContent = 'Run Research Test';
  runButton.className = 'run-btn';
  runButton.onclick = () => {
    const query = queryInput.value.trim();
    if (query) {
      runTest({ query });
    }
  };
  
  // Add elements to container
  container.appendChild(queryInput);
  container.appendChild(runButton);
  
  // Add a message about the removed cleanup functionality
  const cleanupNote = document.createElement('div');
  cleanupNote.textContent = 'Note: Task management functionality has been removed.';
  cleanupNote.style.marginTop = '10px';
  cleanupNote.style.color = '#666';
  container.appendChild(cleanupNote);
}

// Initialize UI and run test
document.addEventListener('DOMContentLoaded', () => {
  setupUI();
  console.log('Test runner initialized. Use the interface to run tests.');
});

// Export for external use
export { runTest };