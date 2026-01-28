/**
 * Controller for event tracking endpoints
 */

import { successResponse, errorResponseFromException } from '../shared/response.js';
import { logger } from '../shared/logger.js';
import * as eventService from '../service/eventService.js';

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
 * Handle POST /events
 * 
 * Track an event for an existing session
 * 
 * Body:
 * {
 *   sessionId: string (required),
 *   eventType: string (required),
 *   eventData: object (optional)
 * }
 */
export async function trackEvent(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const context = extractRequestContext(event);
    
    logger.info('Track event request received', { 
      sessionId: body.sessionId,
      eventType: body.eventType 
    });
    
    // Validate required fields
    if (!body.sessionId) {
      return errorResponseFromException({
        message: 'sessionId is required',
        name: 'ValidationError',
        field: 'sessionId',
        statusCode: 400
      });
    }
    
    if (!body.eventType) {
      return errorResponseFromException({
        message: 'eventType is required',
        name: 'ValidationError',
        field: 'eventType',
        statusCode: 400
      });
    }
    
    // Track the event
    const trackedEvent = await eventService.trackEvent({
      sessionId: body.sessionId,
      eventType: body.eventType,
      eventData: body.eventData || {},
      userAgent: context.userAgent,
      ipAddress: context.ipAddress
    });
    
    return successResponse({
      event: {
        eventId: trackedEvent.eventId,
        sessionId: trackedEvent.sessionId,
        eventType: trackedEvent.eventType,
        timestamp: trackedEvent.timestamp
      }
    }, 201);
    
  } catch (error) {
    logger.error('Track event handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle POST /events/batch
 * 
 * Track multiple events in a single request
 * 
 * Body:
 * {
 *   events: [
 *     { sessionId, eventType, eventData },
 *     { sessionId, eventType, eventData }
 *   ]
 * }
 */
export async function trackBatchEvents(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    
    logger.info('Batch track events request received', { 
      count: body.events?.length 
    });
    
    if (!body.events || !Array.isArray(body.events)) {
      return errorResponseFromException({
        message: 'events array is required',
        name: 'ValidationError',
        field: 'events',
        statusCode: 400
      });
    }
    
    const result = await eventService.trackBatchEvents(body.events);
    
    return successResponse(result, 201);
    
  } catch (error) {
    logger.error('Batch track events handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle GET /events/{sessionId}/{eventId}/{timestamp}
 * 
 * Get a single event by ID
 */
export async function getEvent(event) {
  try {
    const { sessionId, eventId, timestamp } = event.pathParameters || {};
    
    if (!sessionId || !eventId || !timestamp) {
      return errorResponseFromException({
        message: 'sessionId, eventId, and timestamp path parameters are required',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    logger.info('Get event request', { sessionId, eventId });
    
    const result = await eventService.getEvent(sessionId, eventId, timestamp);
    
    return successResponse({ event: result });
    
  } catch (error) {
    logger.error('Get event handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle PATCH /events/{sessionId}/{eventId}/{timestamp}
 * 
 * Update an event
 */
export async function updateEvent(event) {
  try {
    const { sessionId, eventId, timestamp } = event.pathParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    
    if (!sessionId || !eventId || !timestamp) {
      return errorResponseFromException({
        message: 'sessionId, eventId, and timestamp path parameters are required',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    logger.info('Update event request', { sessionId, eventId });
    
    const result = await eventService.updateEvent(sessionId, eventId, timestamp, body);
    
    return successResponse({ event: result });
    
  } catch (error) {
    logger.error('Update event handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}

/**
 * Handle DELETE /events/{sessionId}/{eventId}/{timestamp}
 * 
 * Delete an event
 */
export async function deleteEvent(event) {
  try {
    const { sessionId, eventId, timestamp } = event.pathParameters || {};
    
    if (!sessionId || !eventId || !timestamp) {
      return errorResponseFromException({
        message: 'sessionId, eventId, and timestamp path parameters are required',
        name: 'ValidationError',
        statusCode: 400
      });
    }
    
    logger.info('Delete event request', { sessionId, eventId });
    
    const result = await eventService.deleteEvent(sessionId, eventId, timestamp);
    
    return successResponse({
      eventId: result.eventId,
      deleted: result.deleted,
      message: 'Event deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete event handler error', { error: error.message });
    return errorResponseFromException(error);
  }
}
