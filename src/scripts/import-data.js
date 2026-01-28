/**
 * Import existing data into DynamoDB
 * 
 * Usage: 
 *   TABLE_NAME=session-tracking node import-data.js path/to/data.json
 * 
 * Expected JSON format:
 * {
 *   "sessions": [
 *     {
 *       "sessionId": "sess_123",
 *       "externalId": "user@example.com",
 *       "userAgent": "...",
 *       "ipAddress": "1.2.3.4",
 *       "status": "active",
 *       "createdAt": "2024-01-01T00:00:00Z",
 *       "metadata": { "source": "organic" }
 *     }
 *   ],
 *   "events": [
 *     {
 *       "sessionId": "sess_123",
 *       "eventType": "landing",
 *       "eventData": { "page": "/" },
 *       "timestamp": "2024-01-01T00:00:00Z"
 *     }
 *   ]
 * }
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { readFile } from 'fs/promises';

const TABLE_NAME = process.env.TABLE_NAME || 'session-tracking';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Transform your data format to DynamoDB items
 */
function transformSessionToItem(session) {
  const item = {
    PK: `SESSION#${session.sessionId}`,
    SK: '#METADATA',
    itemType: 'SESSION_METADATA',
    sessionId: session.sessionId,
    externalId: session.externalId || null,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    status: session.status || 'active',
    stepsTaken: session.stepsTaken || 0,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt || session.createdAt,
    metadata: session.metadata || {}
  };

  // Add GSI keys for user lookup
  if (session.externalId) {
    item.GSI1PK = `USER#${session.externalId}`;
    item.GSI1SK = `SESSION#${session.createdAt}`;
  }

  return item;
}

function transformEventToItem(event) {
  const eventId = event.eventId || uuidv4();
  const timestamp = event.timestamp || new Date().toISOString();

  return {
    PK: `SESSION#${event.sessionId}`,
    SK: `EVENT#${timestamp}#${eventId}`,
    itemType: 'EVENT',
    eventId,
    sessionId: event.sessionId,
    eventType: event.eventType,
    eventData: event.eventData || {},
    userAgent: event.userAgent,
    ipAddress: event.ipAddress,
    timestamp,
    createdAt: event.createdAt || timestamp
  };
}

/**
 * Batch write items to DynamoDB (max 25 per request)
 */
async function batchWrite(items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  console.log(`Writing ${items.length} items in ${chunks.length} batches...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const putRequests = chunk.map(item => ({
      PutRequest: { Item: item }
    }));

    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: putRequests
      }
    });

    try {
      await docClient.send(command);
      console.log(`✓ Batch ${i + 1}/${chunks.length} written (${chunk.length} items)`);
    } catch (error) {
      console.error(`✗ Error writing batch ${i + 1}:`, error.message);
      throw error;
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const dataFile = process.argv[2];
    
    if (!dataFile) {
      console.error('Error: Please provide path to data file');
      console.log('Usage: TABLE_NAME=session-tracking node import-data.js path/to/data.json');
      process.exit(1);
    }

    console.log('Reading data file:', dataFile);
    const rawData = await readFile(dataFile, 'utf-8');
    const data = JSON.parse(rawData);

    console.log('Transforming data to DynamoDB format...');
    const items = [];

    // Transform sessions
    if (data.sessions) {
      console.log(`- Found ${data.sessions.length} sessions`);
      data.sessions.forEach(session => {
        items.push(transformSessionToItem(session));
      });
    }

    // Transform events
    if (data.events) {
      console.log(`- Found ${data.events.length} events`);
      data.events.forEach(event => {
        items.push(transformEventToItem(event));
      });
    }

    console.log(`\nTotal items to import: ${items.length}`);
    console.log(`Target table: ${TABLE_NAME}`);
    console.log(`Region: ${REGION}\n`);

    await batchWrite(items);

    console.log('\n✓ Import completed successfully!');
    console.log(`Imported ${data.sessions?.length || 0} sessions and ${data.events?.length || 0} events`);

  } catch (error) {
    console.error('Error importing data:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
