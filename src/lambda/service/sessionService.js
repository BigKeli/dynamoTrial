/**
 * Session domain service - Business logic for session management
 */

import { v4 as uuidv4 } from 'uuid';
import * as repository from '../repositories/sessionRepository.js';
import { logger } from '../shared/logger.js';
import { NotFoundError, ValidationError } from '../shared/errors.js';
import { validateSessionId, validateString } from '../shared/validator.js';

/**
 * Create a new session
 */
export async function createSession({ sessionId, externalId, userAgent, ipAddress, metadata }) {
  // Generate session ID if not provided
  const actualSessionId = sessionId;
  
  const sessionData = {
    sessionId: actualSessionId,
    externalId: externalId || null,
    userAgent: userAgent || null,
    ipAddress: ipAddress || null,
    status: 'active',
    stepsTaken: 0,
    metadata: metadata || {}
  };
  
  logger.info('Creating new session', { sessionId: actualSessionId });
  
  const result = await repository.createSession(sessionData);
  
  return {
    sessionId: result.sessionId,
    externalId: result.externalId,
    status: result.status,
    createdAt: result.createdAt
  };
}

/**
 * Get or create a session (idempotent)
 */
export async function getOrCreateSession({ sessionId, externalId, userAgent, ipAddress, metadata }) {
  if (!sessionId) {
    return await createSession({ externalId, userAgent, ipAddress, metadata });
  }
  
  validateSessionId(sessionId);
  
  const existing = await repository.getSession(sessionId);
  
  if (existing) {
    logger.debug('Session already exists', { sessionId });
    return {
      sessionId: existing.sessionId,
      externalId: existing.externalId,
      status: existing.status,
      createdAt: existing.createdAt,
      existed: true
    };
  }
  
  // Create new session with provided sessionId
  return await createSession({ sessionId, externalId, userAgent, ipAddress, metadata });
}

/**
 * Get full session with timeline
 */
export async function getSessionTimeline(sessionId) {
  
  logger.info('Fetching session timeline', { sessionId });
  
  const timeline = await repository.getSessionTimeline(sessionId);
  
  if (!timeline.metadata) {
    throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
  }
  
  return {
    session: {
      sessionId: timeline.metadata.sessionId,
      externalId: timeline.metadata.externalId,
      status: timeline.metadata.status,
      stepsTaken: timeline.metadata.stepsTaken,
      userAgent: timeline.metadata.userAgent,
      createdAt: timeline.metadata.createdAt,
      updatedAt: timeline.metadata.updatedAt,
      metadata: timeline.metadata.metadata
    },
    events: timeline.events.map(event => ({
      eventId: event.eventId,
      eventType: event.eventType,
      eventData: event.eventData,
      timestamp: event.timestamp
    })),
    eventCount: timeline.eventCount
  };
}

/**
 * Update session (e.g., link externalId, change status)
 */
export async function updateSession(sessionId, updates) {
  validateSessionId(sessionId);
  
  const allowedUpdates = ['externalId', 'status', 'metadata', 'stepsTaken'];
  const filteredUpdates = {};
  
  for (const key of Object.keys(updates)) {
    if (allowedUpdates.includes(key)) {
      filteredUpdates[key] = updates[key];
    }
  }
  
  if (Object.keys(filteredUpdates).length === 0) {
    throw new ValidationError('No valid update fields provided');
  }
  
  logger.info('Updating session', { sessionId, updates: filteredUpdates });
  
  const result = await repository.updateSession(sessionId, filteredUpdates);
  
  if (!result) {
    throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
  }
  
  return {
    sessionId: result.sessionId,
    externalId: result.externalId,
    status: result.status,
    updatedAt: result.updatedAt
  };
}

/**
 * Delete session and all its events
 */
export async function deleteSession(sessionId) {
  validateSessionId(sessionId);
  
  logger.info('Deleting session', { sessionId });
  
  const itemsDeleted = await repository.deleteSession(sessionId);
  
  return { sessionId, itemsDeleted };
}

/**
 * Increment session steps
 */
export async function incrementSessionSteps(sessionId) {
  validateSessionId(sessionId);
  
  const session = await repository.getSession(sessionId);
  
  if (!session) {
    throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
  }
  
  const newStepCount = (session.stepsTaken || 0) + 1;
  
  return await repository.updateSession(sessionId, { stepsTaken: newStepCount });
}

/**
 * Get sessions by external ID
 */
export async function getSessionsByUser(externalId, limit = 50) {
  validateString(externalId, 'externalId', 1, 200);
  
  logger.info('Fetching sessions by externalId', { externalId, limit });
  
  const sessions = await repository.getSessionsByExternalId(externalId, limit);
  
  return sessions.map(session => ({
    sessionId: session.sessionId,
    status: session.status,
    stepsTaken: session.stepsTaken,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  }));
}

/**
 * Get session analytics and summary
 */
export async function getSessionAnalytics(sessionId) {
  
  logger.info('Computing session analytics', { sessionId });
  
  const timeline = await repository.getSessionTimeline(sessionId);
  
  if (!timeline.metadata) {
    throw new NotFoundError(`Session not found: ${sessionId}`, 'session');
  }
  
  // Compute event breakdown
  const events = timeline.events;
  const eventBreakdown = {};
  
  events.forEach(event => {
    eventBreakdown[event.eventType] = (eventBreakdown[event.eventType] || 0) + 1;
  });
  
  // Calculate duration
  const firstEvent = events[0]?.timestamp;
  const lastEvent = events[events.length - 1]?.timestamp;
  const duration = firstEvent && lastEvent 
    ? Math.round((new Date(lastEvent) - new Date(firstEvent)) / 1000)
    : 0;
  
  // Determine conversion funnel status
  const eventTypes = events.map(e => e.eventType);
  const conversionFunnel = {
    landed: eventTypes.includes('landing'),
    engaged: eventTypes.some(t => ['click', 'page_view', 'quiz_start'].includes(t)),
    startedCheckout: eventTypes.includes('checkout_start'),
    converted: eventTypes.includes('checkout_complete')
  };
  
  return {
    sessionId: timeline.metadata.sessionId,
    externalId: timeline.metadata.externalId,
    status: timeline.metadata.status,
    duration,
    eventCount: events.length,
    stepsTaken: timeline.metadata.stepsTaken,
    eventBreakdown,
    firstEvent,
    lastEvent,
    conversionFunnel,
    createdAt: timeline.metadata.createdAt,
    updatedAt: timeline.metadata.updatedAt
  };
}

/**
 * Get user sessions with filtering options
 */
export async function getUserSessionsFiltered(externalId, options = {}) {
  validateString(externalId, 'externalId', 1, 200);
  
  const limit = options.limit || 50;
  const includeAnalytics = options.includeAnalytics || false;
  
  logger.info('Fetching user sessions with filters', { 
    externalId, 
    limit, 
    includeAnalytics 
  });
  
  const sessions = await repository.getSessionsByExternalId(externalId, limit);
  
  // Map sessions with optional analytics
  const mappedSessions = sessions.map(session => ({
    sessionId: session.sessionId,
    status: session.status,
    stepsTaken: session.stepsTaken,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    metadata: session.metadata
  }));
  
  // Calculate summary statistics
  const summary = {
    totalSessions: mappedSessions.length,
    activeSessions: mappedSessions.filter(s => s.status === 'active').length,
    completedSessions: mappedSessions.filter(s => s.status === 'completed').length,
    totalSteps: mappedSessions.reduce((sum, s) => sum + (s.stepsTaken || 0), 0),
    averageSteps: mappedSessions.length > 0 
      ? Math.round(mappedSessions.reduce((sum, s) => sum + (s.stepsTaken || 0), 0) / mappedSessions.length)
      : 0,
    firstSeen: mappedSessions.length > 0 ? mappedSessions[mappedSessions.length - 1].createdAt : null,
    lastActive: mappedSessions.length > 0 ? mappedSessions[0].updatedAt : null
  };
  
  return {
    externalId,
    sessions: mappedSessions,
    summary
  };
}
