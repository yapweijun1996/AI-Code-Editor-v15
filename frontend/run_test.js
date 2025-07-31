// Simple test runner script for the multi-stage research implementation
import { execute } from './js/tool_executor.js';

async function runTest() {
  console.log('🧪 Running research test...');
  
  try {
    // Create a tool call for the test_research tool
    const toolCall = {
      name: 'test_research',
      args: {
        query: 'What are the main architectural patterns in software engineering?'
      }
    };
    
    console.log('Executing test_research tool...');
    const result = await execute(toolCall, null, false);
    
    console.log('✅ Test completed successfully!');
    console.log('Results:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { error: error.message };
  }
}

// Automatically run the test when the script is loaded
runTest().then(result => {
  console.log('Test execution complete.');
});