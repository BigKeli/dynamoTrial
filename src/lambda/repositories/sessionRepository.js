/**
 * Repository layer - Single-table DynamoDB design for session-centric tracking
 * 
 * Access patterns:
 * 1. Get session metadata by sessionId (PK = SESSION#<id>, SK = #METADATA)
 * 2. Get all events for a session (PK = SESSION#<id>, SK begins_with EVENT#)
 * 3. Query sessions by externalId (GSI1: GSI1PK = USER#<externalId>, GSI1SK = SESSION#<timestamp>)
 * 
 * Item types:
 * - Session Metadata: PK=SESSION#<id>, SK=#METADATA
 * - Event: PK=SESSION#<id>, SK=EVENT#<timestamp>#<eventId>
 */

import { v4 as uuidv4 } from 'uuid';
import { putItem, getItem, queryItems, deleteItem, updateItem } from '../shared/dynamodbClient.js';
import { getSessionEvents } from './eventRepository.js';
import { logger } from '../shared/logger.js';
import { config } from '../shared/config.js';


// Get session timeline method

/**
 * Get full session timeline (metadata + all events)
 */
export async function getSessionTimeline(sessionId) {
  const [metadata, events] = await Promise.all([
    getSession(sessionId),
    getSessionEvents(sessionId)
  ]);
  
  return {
    metadata,
    events,
    eventCount: events.length
  };
}

/**
 * Get session metadata by sessionId
 */
export async function getSession(sessionId) {
  const pk = `SESSION#${sessionId}`;
  const sk = '#METADATA';
  
  logger.debug('Fetching session', { sessionId });
  return await getItem(pk, sk);
}

/**
 * Create session metadata item
 * Add event one method creation
 * Checked 
 */
export async function createSession(sessionData) {
  const timestamp = new Date().toISOString();
  
  const item = {
    [config.pkName]: `SESSION#${sessionData.sessionId}`,
    [config.skName]: '#METADATA',
    itemType: 'SESSION_METADATA',
    sessionId: sessionData.sessionId,
    externalId: sessionData.externalId || null,
    userAgent: sessionData.userAgent || null,
    ipAddress: sessionData.ipAddress || null,
    status: sessionData.status || 'active',
    stepsTaken: sessionData.stepsTaken || 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: sessionData.metadata || {}
  };
  
  // Add GSI1 keys if externalId exists
  if (sessionData.externalId) {
    item.GSI1PK = `USER#${sessionData.externalId}`;
    item.GSI1SK = `SESSION#${timestamp}`;
  }
  
  logger.info('Creating session', { sessionId: sessionData.sessionId });
  return await putItem(item);
}

/**
 * Update session metadata
 */
export async function updateSession(sessionId, updates) {
  const existing = await getSession(sessionId);
  
  if (!existing) {
    return null;
  }
  
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  logger.info('Updating session', { sessionId, updates });
  return await putItem(updated);
}


/**
 * Query sessions by externalId (using GSI1)
 */
export async function getSessionsByExternalId(externalId, limit = 50) {
  logger.debug('Querying sessions by externalId', { externalId });
  
  const items = await queryItems(
    'GSI1PK = :gsi1pk',
    {
      ':gsi1pk': `USER#${externalId}`
    },
    config.gsi1Name,
    limit
  );
  
  return items;
}

/**
 * Delete session and all its events
 */
export async function deleteSession(sessionId) {
  logger.info('Deleting session and all events', { sessionId });
  
  // First, get all items for this session
  const items = await queryItems(
    'PK = :pk',
    { ':pk': `SESSION#${sessionId}` }
  );
  
  // Delete each item
  for (const item of items) {
    await deleteItem(item.PK, item.SK);
  }
  
  logger.info('Session deleted', { sessionId, itemsDeleted: items.length });
  return items.length;
}

