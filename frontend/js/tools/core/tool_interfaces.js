/**
 * @fileoverview Standardized tool interface helpers and validation functions
 *
 * This module provides the foundational interfaces and validation functions used throughout
 * the AI Code Editor's tool system. It ensures consistent response formats, parameter validation,
 * and comprehensive security checks for all tool operations.
 *
 * Key Features:
 * - Standardized success/error response formats
 * - Comprehensive parameter validation with security checks
 * - Enhanced error analysis and recovery suggestions
 * - Security validation for file paths, content, and URLs
 * - Rate limiting and resource usage monitoring
 *
 * @author AI Code Editor Team
 * @version 1.0.0
 * @since 2024
 */

import {
    performSecurityValidation,
    sanitizeFilePath,
    sanitizeContent,
    sanitizeUrl,
    validateParameters as secureValidateParameters,
    checkRateLimit,
    recordOperation
} from '../utils/shared_utils.js';

/**
 * Creates a standardized success response for tool operations
 *
 * This function ensures all successful tool operations return responses in a consistent format,
 * making it easier for the UI and other systems to handle results predictably.
 *
 * @param {string} message - Human-readable success message describing what was accomplished
 * @param {any} [data=null] - Optional data payload containing operation results, metrics, or additional information
 * @returns {Object} Standardized success response object
 * @returns {boolean} returns.success - Always true for success responses
 * @returns {string} returns.message - The provided success message
 * @returns {any} [returns.data] - The provided data payload (only included if data is not null)
 *
 * @example
 * // Simple success response
 * const result = createSuccessResponse('File created successfully');
 * // Returns: { success: true, message: 'File created successfully' }
 *
 * @example
 * // Success response with data
 * const result = createSuccessResponse('Analysis completed', {
 *   linesAnalyzed: 150,
 *   issues: [],
 *   executionTime: 1200
 * });
 * // Returns: {
 * //   success: true,
 * //   message: 'Analysis completed',
 * //   data: { linesAnalyzed: 150, issues: [], executionTime: 1200 }
 * // }
 */
export function createSuccessResponse(message, data = null) {
    const response = {
        success: true,
        message: message
    };
    
    if (data !== null) {
        response.data = data;
    }
    
    return response;
}

/**
 * Creates a standardized error response with enhanced error analysis
 *
 * This function creates consistent error responses across all tool operations, including
 * automatic error categorization, severity assessment, and recovery suggestions when possible.
 *
 * @param {string} message - Human-readable error message describing what failed
 * @param {string|Error} [error=null] - Detailed error information (Error object or error string)
 * @param {Object} [options={}] - Additional options for error handling and analysis
 * @param {string} [options.context=''] - Context about what operation was being performed
 * @param {string} [options.toolName=''] - Name of the tool that encountered the error
 * @param {boolean} [options.includeAnalysis=true] - Whether to include automatic error analysis
 * @param {Object} [options.additionalData={}] - Additional data to include in the response
 * @returns {Object} Standardized error response with analysis
 * @returns {boolean} returns.success - Always false for error responses
 * @returns {string} returns.message - The provided error message
 * @returns {string} returns.timestamp - ISO timestamp when the error occurred
 * @returns {string} [returns.error] - Detailed error information if provided
 * @returns {Object} [returns.errorAnalysis] - Automatic error analysis (if includeAnalysis is true)
 * @returns {string} returns.errorAnalysis.category - Error category (network, filesystem, syntax, etc.)
 * @returns {string} returns.errorAnalysis.severity - Error severity (low, medium, high, critical)
 * @returns {boolean} returns.errorAnalysis.retryable - Whether the operation can be retried
 * @returns {string[]} returns.errorAnalysis.recoverySuggestions - Suggested recovery actions
 * @returns {boolean} returns.errorAnalysis.requiresUserAction - Whether user intervention is needed
 *
 * @example
 * // Basic error response
 * const result = createErrorResponse('File not found', 'ENOENT: no such file');
 * // Returns: { success: false, message: 'File not found', error: 'ENOENT: no such file', ... }
 *
 * @example
 * // Error response with context and analysis
 * const result = createErrorResponse('Failed to read file', error, {
 *   context: 'file_read_operation',
 *   toolName: 'read_file',
 *   additionalData: { filename: 'config.json' }
 * });
 */
export function createErrorResponse(message, error = null, options = {}) {
    const {
        context = '',
        toolName = '',
        includeAnalysis = true,
        additionalData = {}
    } = options;
    
    const response = {
        success: false,
        message: message,
        timestamp: new Date().toISOString(),
        ...additionalData
    };
    
    if (error !== null) {
        response.error = typeof error === 'string' ? error : error.message || error.toString();
        
        // Add enhanced error analysis if requested
        if (includeAnalysis) {
            try {
                // Import analyzeError dynamically to avoid circular dependencies
                import('../utils/shared_utils.js').then(({ analyzeError, buildErrorContext }) => {
                    const errorContext = buildErrorContext('error_response', toolName, {}, { context });
                    const analysis = analyzeError(error, errorContext, toolName);
                    
                    response.errorAnalysis = {
                        category: analysis.category,
                        severity: analysis.severity,
                        retryable: analysis.retryable,
                        recoverySuggestions: analysis.recoverySuggestions,
                        requiresUserAction: analysis.requiresUserAction
                    };
                }).catch(analysisError => {
                    console.warn('Failed to analyze error:', analysisError.message);
                });
            } catch (analysisError) {
                console.warn('Error analysis failed:', analysisError.message);
            }
        }
    }
    
    return response;
}

/**
 * Creates an enhanced error response with immediate comprehensive analysis
 *
 * This async function performs immediate error analysis and categorization, providing
 * detailed recovery suggestions and context. Unlike createErrorResponse, this function
 * performs analysis synchronously and returns a Promise.
 *
 * @async
 * @param {string} message - Human-readable error message describing what failed
 * @param {string|Error} error - Detailed error information (Error object or error string)
 * @param {Object} [options={}] - Error handling options and context
 * @param {string} [options.context=''] - Context about what operation was being performed
 * @param {string} [options.toolName=''] - Name of the tool that encountered the error
 * @param {Object} [options.additionalData={}] - Additional data to include in the response
 * @returns {Promise<Object>} Enhanced error response with comprehensive analysis
 * @returns {boolean} returns.success - Always false for error responses
 * @returns {string} returns.message - The provided error message
 * @returns {string} returns.timestamp - ISO timestamp when the error occurred
 * @returns {string} returns.error - Detailed error information
 * @returns {Object} returns.errorAnalysis - Comprehensive error analysis
 * @returns {string} returns.errorAnalysis.category - Error category with detailed classification
 * @returns {string} returns.errorAnalysis.severity - Error severity assessment
 * @returns {boolean} returns.errorAnalysis.retryable - Whether the operation can be retried
 * @returns {number} returns.errorAnalysis.maxRetries - Recommended maximum retry attempts
 * @returns {string} returns.errorAnalysis.backoffStrategy - Recommended retry backoff strategy
 * @returns {string[]} returns.errorAnalysis.recoverySuggestions - Detailed recovery suggestions
 * @returns {boolean} returns.errorAnalysis.requiresUserAction - Whether user intervention is needed
 * @returns {boolean} returns.errorAnalysis.requiresCodeFix - Whether code changes are needed
 * @returns {boolean} returns.errorAnalysis.requiresParameterFix - Whether parameter fixes are needed
 * @returns {Object} returns.context - Contextual information about the error
 *
 * @example
 * // Enhanced error analysis for network failure
 * const result = await createEnhancedErrorResponse('API request failed', networkError, {
 *   context: 'web_request',
 *   toolName: 'read_url',
 *   additionalData: { url: 'https://example.com' }
 * });
 * // Returns detailed analysis with specific recovery suggestions for network issues
 */
export async function createEnhancedErrorResponse(message, error, options = {}) {
    const {
        context = '',
        toolName = '',
        additionalData = {}
    } = options;
    
    const response = {
        success: false,
        message: message,
        timestamp: new Date().toISOString(),
        ...additionalData
    };
    
    if (error !== null) {
        response.error = typeof error === 'string' ? error : error.message || error.toString();
        
        try {
            const { analyzeError, buildErrorContext } = await import('../utils/shared_utils.js');
            const errorContext = buildErrorContext('error_response', toolName, {}, { context });
            const analysis = analyzeError(error, errorContext, toolName);
            
            response.errorAnalysis = {
                category: analysis.category,
                severity: analysis.severity,
                retryable: analysis.retryable,
                maxRetries: analysis.maxRetries,
                backoffStrategy: analysis.backoffStrategy,
                recoverySuggestions: analysis.recoverySuggestions,
                requiresUserAction: analysis.requiresUserAction,
                requiresCodeFix: analysis.requiresCodeFix,
                requiresParameterFix: analysis.requiresParameterFix
            };
            
            // Add contextual information
            response.context = {
                operation: context,
                toolName: toolName,
                timestamp: analysis.timestamp
            };
            
        } catch (analysisError) {
            console.warn('Enhanced error analysis failed:', analysisError.message);
            response.errorAnalysis = {
                category: 'unknown',
                severity: 'medium',
                retryable: false,
                recoverySuggestions: ['Please try the operation again', 'Check the browser console for more details']
            };
        }
    }
    
    return response;
}

/**
 * Enhanced parameter validation with comprehensive security checks
 *
 * Validates that all required parameters are present and performs security scanning
 * to detect potential injection attacks, malicious patterns, and other security threats.
 *
 * @param {Object} params - Parameters object to validate
 * @param {string[]} requiredParams - Array of required parameter names
 * @param {string} toolName - Name of the tool for error messages and logging
 * @throws {Error} If any required parameter is missing or validation fails
 *
 * @example
 * // Validate required parameters for a file operation
 * validateRequiredParams(
 *   { filename: 'test.js', content: 'console.log("hello");' },
 *   ['filename', 'content'],
 *   'create_file'
 * );
 *
 * @example
 * // This will throw an error
 * validateRequiredParams(
 *   { filename: 'test.js' }, // missing 'content'
 *   ['filename', 'content'],
 *   'create_file'
 * );
 * // Throws: Error: The 'content' parameter is required for create_file.
 */
export function validateRequiredParams(params, requiredParams, toolName) {
    // First perform basic required parameter validation
    for (const param of requiredParams) {
        if (params[param] === undefined || params[param] === null) {
            throw new Error(`The '${param}' parameter is required for ${toolName}.`);
        }
    }
    
    // Perform security validation on parameters
    try {
        // Check for potential injection attacks in string parameters
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'string') {
                // Basic injection pattern detection
                const dangerousPatterns = [
                    /<script[^>]*>/gi,
                    /javascript:/gi,
                    /vbscript:/gi,
                    /on\w+\s*=/gi,
                    /\0/g
                ];
                
                for (const pattern of dangerousPatterns) {
                    if (pattern.test(value)) {
                        console.warn(`[Security] Potentially dangerous pattern detected in parameter '${key}' for ${toolName}`);
                        // Don't throw error, just log warning to maintain functionality
                    }
                }
            }
        }
    } catch (error) {
        console.warn(`[Security] Parameter security check failed for ${toolName}:`, error.message);
    }
}

/**
 * Enhanced parameter type validation with security checks and DoS protection
 *
 * Validates parameter types and includes security measures to prevent DoS attacks
 * through oversized parameters. Supports validation of primitives, arrays, and objects.
 *
 * @param {Object} params - Parameters object to validate
 * @param {Object} typeValidations - Object mapping parameter names to expected types
 * @param {string} typeValidations.paramName - Expected type: 'string', 'number', 'boolean', 'array', 'object'
 * @param {string} toolName - Name of the tool for error messages and logging
 * @throws {Error} If any parameter has incorrect type or exceeds security limits
 *
 * @example
 * // Validate parameter types
 * validateParameterTypes(
 *   { filename: 'test.js', lineNumber: 42, options: ['verbose'] },
 *   { filename: 'string', lineNumber: 'number', options: 'array' },
 *   'read_file_lines'
 * );
 *
 * @example
 * // This will throw an error for wrong type
 * validateParameterTypes(
 *   { filename: 123 }, // should be string
 *   { filename: 'string' },
 *   'read_file'
 * );
 * // Throws: Error: The 'filename' parameter must be a string for read_file.
 */
export function validateParameterTypes(params, typeValidations, toolName) {
    for (const [param, expectedType] of Object.entries(typeValidations)) {
        if (params[param] !== undefined) {
            const actualType = typeof params[param];
            if (expectedType === 'array' && !Array.isArray(params[param])) {
                throw new Error(`The '${param}' parameter must be an array for ${toolName}.`);
            } else if (expectedType !== 'array' && actualType !== expectedType) {
                throw new Error(`The '${param}' parameter must be a ${expectedType} for ${toolName}.`);
            }
            
            // Additional security checks based on parameter type
            if (expectedType === 'string' && typeof params[param] === 'string') {
                // Check string length to prevent DoS attacks
                if (params[param].length > 1000000) { // 1MB limit
                    throw new Error(`Parameter '${param}' exceeds maximum length for ${toolName}`);
                }
            }
            
            if (expectedType === 'array' && Array.isArray(params[param])) {
                // Check array size to prevent DoS attacks
                if (params[param].length > 10000) { // 10k items limit
                    throw new Error(`Parameter '${param}' array exceeds maximum size for ${toolName}`);
                }
            }
        }
    }
}

/**
 * Comprehensive security validation for tool operations
 * @param {Object} params - Parameters to validate
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} - Validation results with sanitized parameters
 */
export async function validateToolSecurity(params, options = {}) {
    const {
        toolName = 'unknown',
        operation = 'unknown',
        allowedFileExtensions = null,
        maxContentLength = 1000000,
        requireHttps = false,
        skipRateLimit = false
    } = options;

    try {
        // Rate limiting check
        if (!skipRateLimit) {
            checkRateLimit(operation);
        }

        const validationOptions = {
            operation,
            parameters: params,
            skipRateLimit: true // Already checked above
        };

        // Add file path if present
        if (params.filename) {
            validationOptions.filePath = params.filename;
        }

        // Add content if present
        if (params.content) {
            validationOptions.content = params.content;
        }

        // Add URL if present
        if (params.url) {
            validationOptions.url = params.url;
        }

        // Perform comprehensive security validation
        const securityResult = await performSecurityValidation(validationOptions);

        if (!securityResult.valid) {
            throw new Error(`Security validation failed for ${toolName}: ${securityResult.errors.join(', ')}`);
        }

        // Record the operation for rate limiting
        if (!skipRateLimit) {
            recordOperation(operation);
        }

        return {
            valid: true,
            sanitizedParams: {
                ...params,
                ...securityResult.sanitized
            },
            warnings: securityResult.warnings
        };

    } catch (error) {
        throw new Error(`Security validation failed for ${toolName}: ${error.message}`);
    }
}

/**
 * Secure file path validation wrapper with path traversal protection
 *
 * Validates and sanitizes file paths to prevent directory traversal attacks,
 * null byte injection, and access to restricted system directories.
 *
 * @param {string} filePath - File path to validate and sanitize
 * @param {string} toolName - Tool name for error messages and logging
 * @returns {string} Sanitized file path safe for use
 * @throws {Error} If file path is invalid, dangerous, or contains malicious patterns
 *
 * @example
 * // Valid file path
 * const safePath = validateSecureFilePath('src/components/Button.jsx', 'create_file');
 * // Returns: 'src/components/Button.jsx'
 *
 * @example
 * // This will throw an error
 * const safePath = validateSecureFilePath('../../../etc/passwd', 'read_file');
 * // Throws: Error: Path traversal detected: ".." is not allowed in file paths
 */
export function validateSecureFilePath(filePath, toolName) {
    try {
        return sanitizeFilePath(filePath);
    } catch (error) {
        throw new Error(`Invalid file path for ${toolName}: ${error.message}`);
    }
}

/**
 * Secure content validation wrapper with XSS and injection protection
 *
 * Validates and sanitizes content to prevent XSS attacks, script injection,
 * and other malicious content while preserving legitimate formatting.
 *
 * @param {string} content - Content to validate and sanitize
 * @param {string} toolName - Tool name for error messages and logging
 * @param {Object} [options={}] - Sanitization options
 * @param {boolean} [options.allowHtml=false] - Whether to allow HTML tags
 * @param {boolean} [options.allowScripts=false] - Whether to allow script tags
 * @param {number} [options.maxLength=1000000] - Maximum content length
 * @param {boolean} [options.preserveFormatting=true] - Whether to preserve formatting
 * @returns {string} Sanitized content safe for use
 * @throws {Error} If content is invalid, too large, or contains dangerous patterns
 *
 * @example
 * // Sanitize code content
 * const safeContent = validateSecureContent(
 *   'function hello() { console.log("Hello World"); }',
 *   'create_file'
 * );
 *
 * @example
 * // Sanitize with HTML allowed
 * const safeHtml = validateSecureContent(
 *   '<div>Safe HTML content</div>',
 *   'create_file',
 *   { allowHtml: true }
 * );
 */
export function validateSecureContent(content, toolName, options = {}) {
    try {
        return sanitizeContent(content, options);
    } catch (error) {
        throw new Error(`Invalid content for ${toolName}: ${error.message}`);
    }
}

/**
 * Secure URL validation wrapper with protocol and domain restrictions
 *
 * Validates and sanitizes URLs to prevent access to dangerous protocols,
 * local/internal networks, and malicious domains while ensuring proper URL structure.
 *
 * @param {string} url - URL to validate and sanitize
 * @param {string} toolName - Tool name for error messages and logging
 * @returns {string} Sanitized URL safe for use
 * @throws {Error} If URL is invalid, uses dangerous protocol, or accesses restricted domains
 *
 * @example
 * // Valid HTTPS URL
 * const safeUrl = validateSecureUrl('https://api.github.com/repos/user/repo', 'read_url');
 * // Returns: 'https://api.github.com/repos/user/repo'
 *
 * @example
 * // This will throw an error
 * const safeUrl = validateSecureUrl('javascript:alert("xss")', 'read_url');
 * // Throws: Error: Dangerous protocol detected: javascript:
 *
 * @example
 * // This will also throw an error
 * const safeUrl = validateSecureUrl('http://localhost:3000/admin', 'read_url');
 * // Throws: Error: Access to local/internal URLs is not allowed
 */
export function validateSecureUrl(url, toolName) {
    try {
        return sanitizeUrl(url);
    } catch (error) {
        throw new Error(`Invalid URL for ${toolName}: ${error.message}`);
    }
}

/**
 * Enhanced parameter validation with comprehensive security schema
 *
 * Validates parameters against a detailed schema that includes type checking,
 * length validation, allowed values, and custom validation functions.
 *
 * @param {Object} params - Parameters object to validate
 * @param {Object} schema - Validation schema with security rules
 * @param {Object} schema.paramName - Schema for each parameter
 * @param {boolean} [schema.paramName.required=false] - Whether parameter is required
 * @param {string} [schema.paramName.type] - Expected type ('string', 'number', 'boolean', 'array', 'object')
 * @param {number} [schema.paramName.maxLength] - Maximum length for strings/arrays
 * @param {number} [schema.paramName.minLength] - Minimum length for strings/arrays
 * @param {Array} [schema.paramName.allowedValues] - Array of allowed values
 * @param {Function} [schema.paramName.validator] - Custom validation function
 * @param {string} toolName - Tool name for error messages and logging
 * @returns {Object} Validation results
 * @returns {boolean} returns.valid - Whether validation passed
 * @returns {Object} returns.sanitizedParams - Sanitized parameters
 * @returns {string[]} returns.warnings - Non-critical validation warnings
 * @throws {Error} If validation fails critically
 *
 * @example
 * // Define validation schema
 * const schema = {
 *   filename: { required: true, type: 'string', maxLength: 255 },
 *   lineNumber: { required: true, type: 'number', validator: (n) => n > 0 },
 *   options: { type: 'array', allowedValues: ['verbose', 'quiet'] }
 * };
 *
 * // Validate parameters
 * const result = validateParametersWithSecurity(
 *   { filename: 'test.js', lineNumber: 42, options: ['verbose'] },
 *   schema,
 *   'read_file_lines'
 * );
 */
export function validateParametersWithSecurity(params, schema, toolName) {
    try {
        // Use the secure parameter validation from shared_utils
        secureValidateParameters(params, schema);
        
        return {
            valid: true,
            sanitizedParams: params,
            warnings: []
        };
    } catch (error) {
        throw new Error(`Parameter validation failed for ${toolName}: ${error.message}`);
    }
}