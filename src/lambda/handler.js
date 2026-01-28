/**
 * Main Lambda handler - Entry point for all HTTP API requests
 * 
 * This handler receives events from API Gateway HTTP API and routes them
 * to the appropriate handler based on the HTTP method and path.
 */

import { logger } from './shared/logger.js';
import { validateConfig } from './shared/config.js';
import { route } from './routes.js';
import { errorResponseFromException } from './shared/response.js';

/**
 * Lambda handler function
 * 
 * @param {Object} event - API Gateway HTTP API event
 * @param {Object} context - Lambda context
 * @returns {Object} HTTP response
 */
export async function handler(event, context) {
  // Log incoming request
  logger.info('Request received', {
    requestId: context.requestId,
    method: event.requestContext?.http?.method,
    path: event.requestContext?.http?.path
  });
  
  try {
    // Validate configuration on cold start
    validateConfig();
    
    // Route the request
    const response = await route(event);
    
    logger.info('Request completed', {
      requestId: context.requestId,
      statusCode: response.statusCode
    });
    
    return response;
    
  } catch (error) {
    logger.error('Unhandled error in handler', {
      requestId: context.requestId,
      error: error.message,
      stack: error.stack
    });
    
    return errorResponseFromException(error);
  }
}
