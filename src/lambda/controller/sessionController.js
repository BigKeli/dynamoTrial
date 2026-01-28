/**
 * Controller for session-related endpoints
 */

import { successResponse, errorResponseFromException } from '../shared/response.js';
import { logger } from '../shared/logger.js';
import * as sessionService from '../service/sessionService.js';

/**
 * Extract request context (user agent, IP)
 */
function extractRequestContext(event) {
  const headers = event.headers || {};
  const requestContext = event.requestContext || {};
  
  return {
    userAgent: headers['user-agent'] || null,
    ipAddress: requestContext.http?.sourceIp || headers['x-forwarded-for'] || null
  };
}

/**
 * Handle POST /sessions
 * 
 * Create a new session explicitly
 * 
 * Body:
 * {
 *   sessionId: string (optional, will be generated if not provided),
 *   externalId: string (optional, e.g. user email or customer ID),
 *   metadata: object (optional, session-level metadata)
 * }
 */
export async function createSession(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const context = extractRequestContext(event);
    
    logger.info('Create session request received', { 
      sessionId: body.sessionId,
      externalId: body.externalId 
    });
    
    const session = await sessionService.createSession({
      sessionId: body.sessionId || null,
      externalId: body.externalId || null,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      metadata: body.metadata || {}
    });
    
    return successResponse({
      session: {
        sessionId: session.sessionId,
        externalId: session.externalId,
        status: session.status,
        createdAt: session.createdAt
      }
    }, 201);
    
  } catch (error) {
    logger.error('Create session handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle PATCH /sessions/{sessionId}
 * 
 * Update an existing session
 * 
 * Body:
 * {
 *   externalId: string (optional),
 *   status: string (optional),
 *   metadata: object (optional)
 * }
 */
export async function updateSession(event) {
  try {
    const pathParameters = event.pathParameters || {};
    const sessionId = pathParameters.sessionId;
    const body = event.body ? JSON.parse(event.body) : {};
    
    if (!sessionId) {
      return errorResponseFromException({
        message: 'sessionId is required in path',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    logger.info('Update session request received', { sessionId, updates: body });
    
    const updated = await sessionService.updateSession(sessionId, body);
    
    return successResponse({
      session: {
        sessionId: updated.sessionId,
        externalId: updated.externalId,
        status: updated.status,
        updatedAt: updated.updatedAt
      }
    });
    
  } catch (error) {
    logger.error('Update session handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle GET /sessions/{sessionId}
 * 
 * Returns:
 * {
 *   session: { sessionId, externalId, status, ... },
 *   events: [ { eventId, eventType, eventData, timestamp }, ... ],
 *   eventCount: number
 * }
 */
export async function handleGetSession(event) {
  try {
    // Extract sessionId from path parameters
    const pathParameters = event.pathParameters || {};
    const sessionId = pathParameters.sessionId;
    
    if (!sessionId) {
      return errorResponseFromException({
        message: 'sessionId is required in path',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    logger.info('Get session request received', { sessionId });
    
    // Fetch session timeline
    const timeline = await sessionService.getSessionTimeline(sessionId);
    
    return successResponse(timeline);
    
  } catch (error) {
    logger.error('Get session handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle GET /sessions/{sessionId}/analytics
 * 
 * Returns session analytics including:
 * - Duration
 * - Event breakdown
 * - Conversion funnel status
 */
export async function handleGetSessionAnalytics(event) {
  try {
    const pathParameters = event.pathParameters || {};
    const sessionId = pathParameters.sessionId;
    
    if (!sessionId) {
      return errorResponseFromException({
        message: 'sessionId is required in path',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    logger.info('Get session analytics request received', { sessionId });
    
    const analytics = await sessionService.getSessionAnalytics(sessionId);
    
    return successResponse(analytics);
    
  } catch (error) {
    logger.error('Get session analytics handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle GET /users/{externalId}/sessions
 * 
 * Query parameters:
 * - limit: number (default 50, max 100)
 * - includeAnalytics: boolean (default false)
 * 
 * Returns:
 * {
 *   externalId: string,
 *   sessions: [...],
 *   summary: { totalSessions, activeSessions, ... }
 * }
 */
export async function handleGetUserSessions(event) {
  try {
    const pathParameters = event.pathParameters || {};
    const queryParameters = event.queryStringParameters || {};
    const externalId = pathParameters.externalId;
    
    if (!externalId) {
      return errorResponseFromException({
        message: 'externalId is required in path',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    // Parse query parameters
    const limit = queryParameters.limit 
      ? Math.min(parseInt(queryParameters.limit, 10), 100) 
      : 50;
    const includeAnalytics = queryParameters.includeAnalytics === 'true';
    
    logger.info('Get user sessions request received', { 
      externalId, 
      limit, 
      includeAnalytics 
    });
    
    const result = await sessionService.getUserSessionsFiltered(externalId, {
      limit,
      includeAnalytics
    });
    
    return successResponse(result);
    
  } catch (error) {
    logger.error('Get user sessions handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle DELETE /sessions/{sessionId}
 * 
 * Delete a session and all its events
 */
export async function deleteSession(event) {
  try {
    const sessionId = event.pathParameters?.sessionId;
    
    if (!sessionId) {
      return errorResponseFromException({
        message: 'sessionId path parameter is required',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    logger.info('Delete session request', { sessionId });
    
    const result = await sessionService.deleteSession(sessionId);
    
    return successResponse({
      sessionId: result.sessionId,
      itemsDeleted: result.itemsDeleted,
      message: 'Session and all associated events deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete session handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}
