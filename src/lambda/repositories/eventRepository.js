/**
 * Event Repository - Event-specific data access operations
 */

import { v4 as uuidv4 } from 'uuid';
import { putItem, getItem, queryItems, deleteItem, updateItem } from '../shared/dynamodbClient.js';
import { logger } from '../shared/logger.js';

/**
 * Create event item
 */
export async function createEvent({ sessionId, eventType, eventData, userAgent, ipAddress }) {
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();
  
  const event = {
    PK: `SESSION#${sessionId}`,
    SK: `EVENT#${timestamp}#${eventId}`,
    itemType: 'EVENT',
    eventId,
    sessionId,
    eventType,
    eventData: eventData || {},
    userAgent,
    ipAddress,
    timestamp,
    createdAt: timestamp
  };
  
  logger.debug('Creating event', { sessionId, eventId, eventType });
  await putItem(event);
  
  return event;
}

/**
 * Get single event by ID and timestamp
 */
export async function getEvent(sessionId, eventId, timestamp) {
  const pk = `SESSION#${sessionId}`;
  const sk = `EVENT#${timestamp}#${eventId}`;
  
  logger.debug('Fetching event', { sessionId, eventId });
  return await getItem(pk, sk);
}

/**
 * Get all events for a session
 */
export async function getSessionEvents(sessionId) {
  logger.debug('Fetching events for session', { sessionId });
  
  const items = await queryItems(
    'PK = :pk AND begins_with(SK, :skPrefix)',
    {
      ':pk': `SESSION#${sessionId}`,
      ':skPrefix': 'EVENT#'
    }
  );
  
  return items;
}

/**
 * Update event
 */
export async function updateEvent(sessionId, eventId, timestamp, updates) {
  const pk = `SESSION#${sessionId}`;
  const sk = `EVENT#${timestamp}#${eventId}`;
  
  logger.info('Updating event', { sessionId, eventId });
  return await updateItem(pk, sk, updates);
}

/**
 * Delete event
 */
export async function deleteEvent(sessionId, eventId, timestamp) {
  const pk = `SESSION#${sessionId}`;
  const sk = `EVENT#${timestamp}#${eventId}`;
  
  logger.info('Deleting event', { sessionId, eventId });
  await deleteItem(pk, sk);
  return true;
}
