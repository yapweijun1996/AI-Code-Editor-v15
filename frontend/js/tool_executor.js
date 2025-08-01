/**
 * Main Tool Executor - Updated to use modular architecture
 * This file now serves as the main entry point that imports from the new modular structure
 */

// Import the new modular tool executor
import { toolExecutor, ToolExecutor } from './tools/core/tool_executor.js';
import { toolRegistry } from './tools/core/tool_registry.js';
import { createSuccessResponse, createErrorResponse } from './tools/core/tool_interfaces.js';

// Import other necessary modules for backward compatibility
import { DbManager } from './db.js';
import * as FileSystem from './file_system.js';
import * as Editor from './editor.js';
import * as UI from './ui.js';
import { toolLogger } from './tool_logger.js';

/**
 * Main execution function - maintains backward compatibility
 * @param {Object} toolCall - The tool call object with name and args
 * @param {FileSystemDirectoryHandle} rootDirectoryHandle - The project root directory handle
 * @param {boolean} silent - Whether to suppress UI updates
 * @returns {Promise<Object>} The execution result
 */
export async function execute(toolCall, rootDirectoryHandle, silent = false) {
    try {
        // Initialize the tool executor if not already done
        if (!toolExecutor.isInitialized) {
            await toolExecutor.initialize(rootDirectoryHandle);
        }
        
        // Execute the tool using the new modular system
        const result = await toolExecutor.executeTool(toolCall.name, toolCall.args, {
            silent,
            rootHandle: rootDirectoryHandle
        });
        
        // Return in the expected format for backward compatibility
        return {
            toolResponse: {
                name: toolCall.name,
                response: result.success ? result.data || result : { error: result.message }
            }
        };
        
    } catch (error) {
        console.error(`Tool execution failed for '${toolCall.name}':`, error);
        
        // Log the error
        toolLogger.log(toolCall.name, toolCall.args, 'Error', {
            message: error.message,
            stack: error.stack
        });
        
        // Return error in expected format
        return {
            toolResponse: {
                name: toolCall.name,
                response: { error: `Tool '${toolCall.name}' execution failed: ${error.message}` }
            }
        };
    }
}

/**
 * Get tool definitions for the AI model
 * @returns {Object} Tool definitions object
 */
export function getToolDefinitions() {
    return {
        functionDeclarations: [
            { name: 'create_file', description: "Creates a new file. CRITICAL: Do NOT include the root directory name in the path. Example: To create 'app.js' in the root, the path is 'app.js', NOT 'my-project/app.js'.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'The raw text content of the file. CRITICAL: Do NOT wrap this content in markdown backticks (```).' } }, required: ['filename', 'content'] } },
            { name: 'delete_file', description: "Deletes a file. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'create_folder', description: "Creates a new folder. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { folder_path: { type: 'STRING' } }, required: ['folder_path'] } },
            { name: 'delete_folder', description: "Deletes a folder and all its contents. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { folder_path: { type: 'STRING' } }, required: ['folder_path'] } },
            { name: 'rename_folder', description: "Renames a folder. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { old_folder_path: { type: 'STRING' }, new_folder_path: { type: 'STRING' } }, required: ['old_folder_path', 'new_folder_path'] } },
            { name: 'rename_file', description: "Renames a file. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { old_path: { type: 'STRING' }, new_path: { type: 'STRING' } }, required: ['old_path', 'new_path'] } },
            { name: 'read_file', description: "Reads a file's content. To ensure accuracy when editing, set 'include_line_numbers' to true. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, include_line_numbers: { type: 'BOOLEAN', description: 'Set to true to prepend line numbers to each line of the output.' } }, required: ['filename'] } },
            { name: 'read_multiple_files', description: "Reads and concatenates the content of multiple files. Essential for multi-file context tasks.", parameters: { type: 'OBJECT', properties: { filenames: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['filenames'] } },
            { name: 'read_file_lines', description: 'Reads a specific range of lines from a file. Output will always include line numbers. Use for quick inspection of specific code sections.', parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, start_line: { type: 'NUMBER' }, end_line: { type: 'NUMBER' } }, required: ['filename', 'start_line', 'end_line'] } },
            { name: 'search_in_file', description: 'Searches for a pattern in a file and returns matching lines. Use this for large files.', parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, pattern: { type: 'STRING' }, context: { type: 'NUMBER' } }, required: ['filename', 'pattern'] } },
            { name: 'read_url', description: 'Reads and extracts the main content and all links from a given URL. The result will be a JSON object with "content" and "links" properties.', parameters: { type: 'OBJECT', properties: { url: { type: 'STRING' } }, required: ['url'] } },
            { name: 'get_open_file_content', description: 'Gets the content of the currently open file in the editor.' },
            { name: 'get_selected_text', description: 'Gets the text currently selected by the user in the editor.' },
            { name: 'replace_selected_text', description: 'Replaces the currently selected text in the editor with new text.', parameters: { type: 'OBJECT', properties: { new_text: { type: 'STRING', description: 'The raw text to replace the selection with. CRITICAL: Do NOT wrap this content in markdown backticks (```).' } }, required: ['new_text'] } },
            { name: 'get_project_structure', description: 'Gets the entire file and folder structure of the project. CRITICAL: Always use this tool before attempting to read or create a file to ensure you have the correct file path.' },
            { name: 'duckduckgo_search', description: 'Performs a search using DuckDuckGo and returns the results.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
            { name: 'perform_research', description: '🔬 ENHANCED: Performs intelligent, recursive web research with AI-driven decision making. Automatically searches, analyzes content relevance, follows promising links, and expands searches based on discovered information. Much more comprehensive than simple search.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'The research query or topic to investigate' }, max_results: { type: 'NUMBER', description: 'Maximum URLs to read per search (1-5, default: 3)' }, depth: { type: 'NUMBER', description: 'Maximum recursion depth for following links (1-4, default: 2)' }, relevance_threshold: { type: 'NUMBER', description: 'Minimum relevance score to read URLs (0.3-1.0, default: 0.7). Lower = more URLs read' } }, required: ['query'] } },
            { name: 'search_code', description: 'Searches for a specific string in all files in the project (like grep).', parameters: { type: 'OBJECT', properties: { search_term: { type: 'STRING' } }, required: ['search_term'] } },
            { name: 'build_or_update_codebase_index', description: 'Scans the entire codebase to build a searchable index. Slow, run once per session.' },
            { name: 'query_codebase', description: 'Searches the pre-built codebase index.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
            { name: 'format_code', description: "Formats a file with Prettier. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'analyze_code', description: "Analyzes a JavaScript file's structure. CRITICAL: Do NOT include the root directory name in the path.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'edit_file', description: "The primary tool for all file modifications. CRITICAL: Before using this tool to fix an error, you MUST use 'read_file' to get the full, up-to-date content of the file. CRITICAL: If the content you are using was retrieved with line numbers, you MUST remove the line numbers and the ` | ` separator from every line before using it in the 'new_content' or 'content' parameter. The content must be the raw source code. Provide EITHER 'content' for a full rewrite OR an 'edits' array for targeted changes.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'Complete file content for small files. CRITICAL: Do NOT wrap in markdown backticks.' }, edits: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: { type: 'STRING', enum: ['replace_lines', 'insert_lines'] }, start_line: { type: 'NUMBER', description: 'Start line for replace_lines' }, end_line: { type: 'NUMBER', description: 'End line for replace_lines' }, line_number: { type: 'NUMBER', description: 'Line position for insert_lines (0=start of file)' }, new_content: { type: 'STRING' } } }, description: 'Efficient targeted edits for large files. Use replace_lines to replace line ranges or insert_lines to add content.' } }, required: ['filename'] } },
            { name: 'append_to_file', description: "Fast append content to end of file without reading full content. Ideal for logs, incremental updates.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, content: { type: 'STRING', description: 'Content to append. Will add newline separator automatically.' } }, required: ['filename', 'content'] } },
            { name: 'get_file_info', description: "Get file metadata (size, last modified, type) without reading content. Use before editing large files.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' } }, required: ['filename'] } },
            { name: 'apply_diff', description: "🔧 RECOMMENDED: Apply precise, surgical changes to files using diff blocks. This is the safest and most reliable way to edit files. Use this instead of edit_file when you need to make targeted changes. CRITICAL: The diff parameter must contain properly formatted diff blocks with EXACT format:\n\n<<<<<<< SEARCH\n:start_line:10\n-------\nold code here\n=======\nnew code here\n>>>>>>> REPLACE\n\nMANDATORY REQUIREMENTS:\n1. Must include ':start_line:N' where N is the line number\n2. Must include '-------' separator line after start_line\n3. Must include '=======' separator between old and new content\n4. Each line must be exact, including whitespace and indentation\n5. Use read_file with include_line_numbers=true first to get accurate content", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING', description: 'Path to the file to modify' }, diff: { type: 'STRING', description: 'One or more diff blocks in the EXACT format: <<<<<<< SEARCH\\n:start_line:N\\n-------\\nold content\\n=======\\nnew content\\n>>>>>>> REPLACE. The -------  separator line is MANDATORY.' } }, required: ['filename', 'diff'] } },
            
            // Alternative file editing tools - more reliable than apply_diff in many cases
            { name: 'find_and_replace', description: "🔍 Simple and reliable text replacement. Perfect when you know the exact text to replace. Safer than apply_diff for simple changes.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, find_text: { type: 'STRING', description: 'Exact text to find and replace' }, replace_text: { type: 'STRING', description: 'New text to replace with' }, all_occurrences: { type: 'BOOLEAN', description: 'Replace all occurrences (default: false - only first occurrence)' } }, required: ['filename', 'find_text', 'replace_text'] } },
            { name: 'insert_at_line', description: "📝 Insert content at a specific line number. Very reliable when you know exactly where to add content.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, line_number: { type: 'NUMBER', description: 'Line number where to insert (1-based)' }, content: { type: 'STRING', description: 'Content to insert' }, insert_mode: { type: 'STRING', enum: ['before', 'after', 'replace'], description: 'Insert before, after, or replace the line (default: after)' } }, required: ['filename', 'line_number', 'content'] } },
            { name: 'replace_lines', description: "📄 Replace a range of lines with new content. Ideal for replacing entire sections or functions.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, start_line: { type: 'NUMBER', description: 'First line to replace (1-based)' }, end_line: { type: 'NUMBER', description: 'Last line to replace (1-based)' }, new_content: { type: 'STRING', description: 'New content to replace the line range with' } }, required: ['filename', 'start_line', 'end_line', 'new_content'] } },
            { name: 'smart_replace', description: "🧠 Fuzzy matching replacement. Finds and replaces similar content even if not exactly matching. Use when content might have changed slightly.", parameters: { type: 'OBJECT', properties: { filename: { type: 'STRING' }, old_content: { type: 'STRING', description: 'Content to find (allows some differences)' }, new_content: { type: 'STRING', description: 'New content to replace with' }, similarity_threshold: { type: 'NUMBER', description: 'Minimum similarity required (0.0-1.0, default: 0.8)' } }, required: ['filename', 'old_content', 'new_content'] } },
            
            // Enhanced code comprehension tools
            { name: 'analyze_symbol', description: 'Analyzes a symbol (variable, function, class) across the entire codebase to understand its usage, definition, and relationships.', parameters: { type: 'OBJECT', properties: { symbol_name: { type: 'STRING', description: 'The name of the symbol to analyze' }, file_path: { type: 'STRING', description: 'The file path where the symbol is used or defined' } }, required: ['symbol_name', 'file_path'] } },
            { name: 'explain_code_section', description: 'Provides detailed explanation of a complex code section including complexity analysis, symbols, and control flow.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING' }, start_line: { type: 'NUMBER' }, end_line: { type: 'NUMBER' } }, required: ['file_path', 'start_line', 'end_line'] } },
            { name: 'trace_variable_flow', description: 'Traces the data flow of a variable through the codebase to understand how data moves and transforms.', parameters: { type: 'OBJECT', properties: { variable_name: { type: 'STRING' }, file_path: { type: 'STRING' } }, required: ['variable_name', 'file_path'] } },
            { name: 'validate_syntax', description: 'Validates the syntax of a file and provides detailed errors, warnings, and suggestions.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING' } }, required: ['file_path'] } },
            
            // Senior Engineer AI Tools
            { name: 'build_symbol_table', description: '🧠 SENIOR ENGINEER: Build comprehensive symbol table for advanced code analysis. Creates detailed mapping of all symbols, functions, classes, imports, and exports in a file.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Path to the file to analyze' } }, required: ['file_path'] } },
            { name: 'trace_data_flow', description: '🧠 SENIOR ENGINEER: Advanced data flow analysis that traces how variables flow through the codebase. Identifies definitions, usages, mutations, and cross-file dependencies.', parameters: { type: 'OBJECT', properties: { variable_name: { type: 'STRING', description: 'Name of the variable to trace' }, file_path: { type: 'STRING', description: 'Starting file path' }, line: { type: 'NUMBER', description: 'Starting line number (optional)' } }, required: ['variable_name', 'file_path'] } },
            { name: 'debug_systematically', description: '🧠 SENIOR ENGINEER: Systematic debugging using hypothesis-driven approach. Analyzes errors, generates hypotheses, tests them systematically, and provides root cause analysis.', parameters: { type: 'OBJECT', properties: { error_message: { type: 'STRING', description: 'The error message to debug' }, file_path: { type: 'STRING', description: 'File where error occurred (optional)' }, line: { type: 'NUMBER', description: 'Line number where error occurred (optional)' }, stack_trace: { type: 'STRING', description: 'Full stack trace (optional)' } }, required: ['error_message'] } },
            { name: 'analyze_code_quality', description: '🧠 SENIOR ENGINEER: Comprehensive code quality analysis including complexity, maintainability, code smells, security vulnerabilities, and performance issues.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Path to the file to analyze' } }, required: ['file_path'] } },
            { name: 'solve_engineering_problem', description: '🧠 SENIOR ENGINEER: Holistic engineering problem solving. Analyzes problems comprehensively, generates multiple solutions, evaluates trade-offs, and provides implementation plans.', parameters: { type: 'OBJECT', properties: { problem_description: { type: 'STRING', description: 'Detailed description of the engineering problem' }, file_path: { type: 'STRING', description: 'Related file path (optional)' }, priority: { type: 'STRING', description: 'Problem priority: low, medium, high, critical', enum: ['low', 'medium', 'high', 'critical'] }, constraints: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Any constraints or limitations (optional)' } }, required: ['problem_description'] } },
            { name: 'get_engineering_insights', description: '🧠 SENIOR ENGINEER: Get comprehensive engineering insights and statistics about code quality, debugging patterns, and decision-making effectiveness.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Specific file to analyze (optional - if omitted, provides project-wide insights)' } } } },
            { name: 'optimize_code_architecture', description: '🧠 SENIOR ENGINEER: Analyze and optimize code architecture. Identifies architectural issues, suggests design patterns, and provides optimization recommendations.', parameters: { type: 'OBJECT', properties: { file_path: { type: 'STRING', description: 'Path to the file to optimize' }, optimization_goals: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Optimization goals: maintainability, performance, readability, security (optional)' } }, required: ['file_path'] } },
            
            // Operation management tools
            { name: 'get_active_operations', description: 'Get status of all currently active tool operations.', parameters: { type: 'OBJECT', properties: {} } },
            { name: 'cancel_operation', description: 'Cancel a specific active operation by ID.', parameters: { type: 'OBJECT', properties: { operation_id: { type: 'STRING', description: 'ID of the operation to cancel' }, reason: { type: 'STRING', description: 'Reason for cancellation (optional)' } }, required: ['operation_id'] } },
            { name: 'cancel_all_operations', description: 'Cancel all currently active operations.', parameters: { type: 'OBJECT', properties: { reason: { type: 'STRING', description: 'Reason for cancellation (optional)' } } } },
            
            // Dependency graph management tools
            { name: 'create_dependency_graph', description: 'Create a dependency graph for intelligent tool orchestration and parallel execution.', parameters: { type: 'OBJECT', properties: { tools: { type: 'ARRAY', items: { type: 'OBJECT' }, description: 'Array of tool definitions with dependencies' }, auto_detect_dependencies: { type: 'BOOLEAN', description: 'Automatically detect dependencies between tools (default: true)' } }, required: ['tools'] } },
            { name: 'get_execution_plan', description: 'Get the optimized execution plan from the current dependency graph.', parameters: { type: 'OBJECT', properties: {} } },
            { name: 'get_dependency_graph_status', description: 'Get current status and statistics of the dependency graph.', parameters: { type: 'OBJECT', properties: {} } },
            
            // Batch processing tools
            { name: 'batch_analyze_files', description: 'Analyze multiple files in parallel for efficient bulk operations.', parameters: { type: 'OBJECT', properties: { filenames: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Array of file paths to analyze' }, analysis_types: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Types of analysis: ast, quality, symbols (default: all)' } }, required: ['filenames'] } },
            { name: 'batch_validate_files', description: 'Validate syntax of multiple files in parallel.', parameters: { type: 'OBJECT', properties: { filenames: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Array of file paths to validate' }, validation_types: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Types of validation: syntax, style, security (default: all)' } }, required: ['filenames'] } },
            
            // Backend indexing tools
            { name: 'build_backend_index', description: 'Build comprehensive backend codebase index for advanced searching.', parameters: { type: 'OBJECT', properties: {} } },
            { name: 'query_backend_index', description: 'Query the backend codebase index for symbols and code patterns.', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Search query' }, page: { type: 'NUMBER', description: 'Page number (default: 1)' }, limit: { type: 'NUMBER', description: 'Results per page (default: 20)' } }, required: ['query'] } },
            
            // Utility tools
            { name: 'list_tools', description: 'List all available tools in the system.', parameters: { type: 'OBJECT', properties: {} } },
            { name: 'undo_last_change', description: 'Undo the last file modification.', parameters: { type: 'OBJECT', properties: {} } },
            { name: 'create_diff', description: 'Create a diff between two text contents.', parameters: { type: 'OBJECT', properties: { original_content: { type: 'STRING' }, new_content: { type: 'STRING' } }, required: ['original_content', 'new_content'] } },
            { name: 'set_selected_text', description: 'Set text selection in the editor.', parameters: { type: 'OBJECT', properties: { start_line: { type: 'NUMBER' }, start_column: { type: 'NUMBER' }, end_line: { type: 'NUMBER' }, end_column: { type: 'NUMBER' } }, required: ['start_line', 'start_column', 'end_line', 'end_column'] } }
        ]
    };
}

// Export the tool registry and other utilities for backward compatibility
export { toolRegistry, createSuccessResponse, createErrorResponse };

// Export the new ToolExecutor class for advanced usage
export { ToolExecutor };

// Export the singleton instance
export { toolExecutor };

console.log('✅ Tool Executor updated to use modular architecture');
console.log(`📊 Available tools: ${Object.keys(toolRegistry).length}`);
console.log('🔧 Modular structure: Core, File Operations, Code Analysis, Research, Engineering, System');
