/**
 * HTTP response builders
 */

import { logger } from '../shared/logger.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,user-agent,x-forwarded-for,x-request-id,x-session-id,x-external-id',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Build success response
 */
export function successResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      data
    })
  };
}

/**
 * Build error response
 */
export function errorResponse(error, statusCode = 500) {
  const errorBody = {
    success: false,
    error: {
      message: error.message || 'Internal server error',
      type: error.name || 'Error'
    }
  };
  
  // Add field info for validation errors
  if (error.field) {
    errorBody.error.field = error.field;
  }
  
  logger.error('HTTP Error Response', { 
    statusCode, 
    error: error.message,
    type: error.name 
  });
  
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(errorBody)
  };
}

/**
 * Build error response from exception
 */
export function errorResponseFromException(error) {
  // Use statusCode from error if available
  const statusCode = error.statusCode || 500;
  return errorResponse(error, statusCode);
}

/**
 * Health check response
 */
export function healthResponse() {
  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'session-tracking-api'
  });
}
