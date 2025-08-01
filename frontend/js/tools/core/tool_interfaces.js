/**
 * Standardized tool interface helpers and validation functions
 * Enhanced with comprehensive security validation
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
 * Creates a standardized success response
 * @param {string} message - Success message
 * @param {any} data - Optional data payload
 * @returns {Object} Standardized success response
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
 * @param {string} message - Error message
 * @param {string|Error} error - Optional detailed error information
 * @param {Object} options - Additional options for error handling
 * @returns {Object} Standardized error response with analysis
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
 * Creates an enhanced error response with immediate analysis
 * @param {string} message - Error message
 * @param {string|Error} error - Detailed error information
 * @param {Object} options - Error handling options
 * @returns {Object} Enhanced error response with analysis
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
 * Enhanced parameter validation with security checks
 * @param {Object} params - Parameters object
 * @param {Array<string>} requiredParams - Array of required parameter names
 * @param {string} toolName - Name of the tool for error messages
 * @throws {Error} If any required parameter is missing
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
 * Enhanced parameter type validation with security checks
 * @param {Object} params - Parameters object
 * @param {Object} typeValidations - Object mapping parameter names to expected types
 * @param {string} toolName - Name of the tool for error messages
 * @throws {Error} If any parameter has incorrect type
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
 * Secure file path validation wrapper
 * @param {string} filePath - File path to validate
 * @param {string} toolName - Tool name for error messages
 * @returns {string} - Sanitized file path
 */
export function validateSecureFilePath(filePath, toolName) {
    try {
        return sanitizeFilePath(filePath);
    } catch (error) {
        throw new Error(`Invalid file path for ${toolName}: ${error.message}`);
    }
}

/**
 * Secure content validation wrapper
 * @param {string} content - Content to validate
 * @param {string} toolName - Tool name for error messages
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized content
 */
export function validateSecureContent(content, toolName, options = {}) {
    try {
        return sanitizeContent(content, options);
    } catch (error) {
        throw new Error(`Invalid content for ${toolName}: ${error.message}`);
    }
}

/**
 * Secure URL validation wrapper
 * @param {string} url - URL to validate
 * @param {string} toolName - Tool name for error messages
 * @returns {string} - Sanitized URL
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
 * @param {Object} params - Parameters to validate
 * @param {Object} schema - Validation schema with security rules
 * @param {string} toolName - Tool name for error messages
 * @returns {Object} - Validation results
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