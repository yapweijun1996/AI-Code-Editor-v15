/**
 * Debugging and systematic problem-solving tools
 */

export async function _debugSystematically({ error_message, file_path, line, stack_trace }, rootHandle) {
    if (!error_message) throw new Error("The 'error_message' parameter is required.");
    
    const error = new Error(error_message);
    if (stack_trace) error.stack = stack_trace;
    
    const codeContext = {
        filePath: file_path,
        line: line || 1
    };
    
    // Import debugging intelligence dynamically
    const { debuggingIntelligence } = await import('../../../debugging_intelligence.js');
    
    const debuggingResult = await debuggingIntelligence.debugSystematically(error, codeContext);
    
    return {
        message: `Systematic debugging completed for: ${error_message}`,
        session: {
            id: debuggingResult.session.id,
            status: debuggingResult.session.status,
            rootCause: debuggingResult.rootCause,
            hypothesesTested: debuggingResult.hypotheses.length,
            solution: debuggingResult.solution
        },
        recommendation: debuggingResult.recommendation
    };
}