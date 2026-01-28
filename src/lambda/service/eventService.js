/**
 * Event domain service - Business logic for event tracking
 */

import * as repository from '../repositories/eventRepository.js';
import * as sessionRepository from '../repositories/sessionRepository.js';
import { logger } from '../shared/logger.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { validateSessionId, validateEventType, validateObject } from '../shared/validator.js';
import { incrementSessionSteps } from './sessionService.js';

/**
 * Track an event for a session
 */
export async function trackEvent({ sessionId, eventType, eventData, userAgent, ipAddress }) {
  validateEventType(eventType);
  
  // Verify session exists
  const session = await sessionRepository.getSession(sessionId);
  
  if (!session) {
    throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
  }
  
  // Validate eventData if provided
  if (eventData !== null && eventData !== undefined) {
    validateObject(eventData, 'eventData');
  }
  
  logger.info('Tracking event', { sessionId, eventType });
  
  // Create the event
  const event = await repository.createEvent({
    sessionId,
    eventType,
    eventData: eventData || {},
    userAgent,
    ipAddress
  });
  
  // Increment session steps counter
  try {
    await incrementSessionSteps(sessionId);
  } catch (error) {
    logger.warn('Failed to increment session steps', { 
      sessionId, 
      error: error.message 
    });
    // Don't fail the entire operation if step increment fails
  }
  
  return {
    eventId: event.eventId,
    sessionId: event.sessionId,
    eventType: event.eventType,
    timestamp: event.timestamp
  };
}


/**
 * Batch track multiple events (useful for offline sync)
 * Processes with controlled concurrency to avoid throttling
 */
export async function trackBatchEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new ValidationError('events must be a non-empty array');
  }
  
  if (events.length > 25) {
    throw new ValidationError('Cannot track more than 25 events at once');
  }
  
  logger.info('Batch tracking events', { count: events.length });
  
  const results = [];
  const errors = [];
  const CONCURRENCY_LIMIT = 5; // Process 5 events at a time
  
  // Process events in batches of CONCURRENCY_LIMIT
  for (let i = 0; i < events.length; i += CONCURRENCY_LIMIT) {
    const batch = events.slice(i, i + CONCURRENCY_LIMIT);
    
    const batchPromises = batch.map(async (event, batchIdx) => {
      const globalIdx = i + batchIdx;
      try {
        const result = await trackEvent(event);
        return { index: globalIdx, success: true, ...result };
      } catch (error) {
        logger.error('Failed to track event in batch', { 
          index: globalIdx, 
          error: error.message 
        });
        return { 
          index: globalIdx, 
          success: false, 
          error: error.message 
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Separate successes and errors
    batchResults.forEach(result => {
      if (result.success) {
        results.push(result);
      } else {
        errors.push(result);
      }
    });
  }
  
  return {
    total: events.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors
  };
}

/**
 * Get single event by ID
 */
export async function getEvent(sessionId, eventId, timestamp) {
  validateSessionId(sessionId);
  
  logger.info('Fetching event', { sessionId, eventId });
  
  const event = await repository.getEvent(sessionId, eventId, timestamp);
  
  if (!event) {
    throw new NotFoundError(`Event not found: ${eventId}`, 'event');
  }
  
  return {
    eventId: event.eventId,
    sessionId: event.sessionId,
    eventType: event.eventType,
    eventData: event.eventData,
    timestamp: event.timestamp,
    userAgent: event.userAgent,
    ipAddress: event.ipAddress
  };
}

/**
 * Update an event
 */
export async function updateEvent(sessionId, eventId, timestamp, updates) {
  validateSessionId(sessionId);
  
  // Validate eventType if it's being updated
  if (updates.eventType) {
    validateEventType(updates.eventType);
  }
  
  // Validate eventData if it's being updated
  if (updates.eventData !== undefined) {
    validateObject(updates.eventData, 'eventData');
  }
  
  logger.info('Updating event', { sessionId, eventId });
  
  const updatedEvent = await repository.updateEvent(sessionId, eventId, timestamp, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
  
  return {
    eventId: updatedEvent.eventId,
    sessionId: updatedEvent.sessionId,
    eventType: updatedEvent.eventType,
    eventData: updatedEvent.eventData,
    timestamp: updatedEvent.timestamp
  };
}

/**
 * Delete an event
 */
export async function deleteEvent(sessionId, eventId, timestamp) {
  validateSessionId(sessionId);
  
  logger.info('Deleting event', { sessionId, eventId });
  
  await repository.deleteEvent(sessionId, eventId, timestamp);
  
  // Decrement session step counter
  try {
    const session = await sessionRepository.getSession(sessionId);
    if (session && session.stepsTaken > 0) {
      await sessionRepository.updateSession(sessionId, {
        stepsTaken: session.stepsTaken - 1,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.warn('Failed to decrement session steps', { sessionId, error: error.message });
  }
  
  return { eventId, deleted: true };
}
