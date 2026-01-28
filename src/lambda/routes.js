/**
 * Routes - Maps HTTP paths to controllers
 */

import { logger } from './shared/logger.js';
import { errorResponseFromException } from './shared/response.js';
import * as sessionController from './controller/sessionController.js';
import * as eventController from './controller/eventController.js';

/**
 * Route the incoming request to appropriate handler
 */
export async function route(event) {
  const method = event.requestContext.http.method;
  let path = event.requestContext.http.path;
  
  // Strip stage prefix from path (e.g., /dev/sessions -> /sessions)
  const stage = event.requestContext.stage;
  if (stage && path.startsWith(`/${stage}/`)) {
    path = path.substring(stage.length + 1);
  }
  
  logger.info('Routing request', { method, path, stage });
  
  try {
    // === Session Management ===
    
    // Create session
    // Gang already was here full flow
    // ✅ TESTED & WORKING - 2026-01-27 - Successfully creates session with provided sessionId
    if (method === 'POST' && path === '/sessions') {
      return await sessionController.createSession(event);
    }
    
    // Update session
    // Gang already was here full flow
    // ✅ TESTED & WORKING - 2026-01-27 - Successfully updates session status and metadata
    if (method === 'PATCH' && path.match(/^\/sessions\/[^/]+$/) && !path.includes('/analytics')) {
      return await sessionController.updateSession(event);
    }
    
    // Get session metadata
    // ✅ TESTED & WORKING - 2026-01-27 - Returns analytics: event breakdown, funnel, duration
    if (method === 'GET' && path.match(/^\/sessions\/[^/]+\/metadata$/)) {
      return await sessionController.handleGetSessionAnalytics(event);
    }
    
    // Get session events timeline
    // ✅ TESTED & WORKING - 2026-01-27 - Successfully retrieves session with events timeline
    if (method === 'GET' && path.match(/^\/sessions\/[^/]+$/)) {
      return await sessionController.handleGetSession(event);
    }
    
    // Get sessions for user
    // ✅ TESTED & WORKING - 2026-01-27 - Returns user sessions with summary statistics
    if (method === 'GET' && path.match(/^\/users\/[^/]+\/sessions$/)) {
      return await sessionController.handleGetUserSessions(event);
    }
    
    // Delete session
    if (method === 'DELETE' && path.match(/^\/sessions\/[^/]+$/) && !path.includes('/metadata')) {
      return await sessionController.deleteSession(event);
    }
    
    // === Event Tracking ===
    
    // Track single event
    // ✅ TESTED & WORKING - 2026-01-27 - Successfully tracks events and increments stepsTaken
    if (method === 'POST' && path === '/events') {
      return await eventController.trackEvent(event);
    }
    
    // Track batch events
    // ✅ TESTED & WORKING - 2026-01-27 - Batch processes multiple events with validation
    if (method === 'POST' && path === '/events/batch') {
      return await eventController.trackBatchEvents(event);
    }
    
    // Get single event
    if (method === 'GET' && path.match(/^\/events\/[^/]+\/[^/]+\/[^/]+$/)) {
      return await eventController.getEvent(event);
    }
    
    // Update event
    if (method === 'PATCH' && path.match(/^\/events\/[^/]+\/[^/]+\/[^/]+$/)) {
      return await eventController.updateEvent(event);
    }
    
    // Delete event
    if (method === 'DELETE' && path.match(/^\/events\/[^/]+\/[^/]+\/[^/]+$/)) {
      return await eventController.deleteEvent(event);
    }
        
    // Route not found
    logger.warn('Route not found', { method, path });
    return errorResponseFromException({
      message: `Route not found: ${method} ${path}`,
      name: 'NotFoundError',
      statusCode: 404
    });
    
  } catch (error) {
    logger.error('Unhandled error in router', { 
      error: error.message, 
      stack: error.stack 
    });
    return errorResponseFromException(error);
  }
}
