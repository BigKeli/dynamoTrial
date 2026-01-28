/**
 * Script to query and display session data
 * 
 * Usage: 
 *   TABLE_NAME=session-tracking node query-sessions.js [sessionId]
 *   TABLE_NAME=session-tracking EXTERNAL_ID=user@example.com node query-sessions.js
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME || 'session-tracking';
const REGION = process.env.AWS_REGION || 'eu-central-1';
const GSI1_NAME = process.env.GSI1_NAME || 'GSI1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Get session metadata
 */
async function getSession(sessionId) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `SESSION#${sessionId}`,
      SK: '#METADATA'
    }
  });
  
  const result = await docClient.send(command);
  return result.Item;
}

/**
 * Get all events for a session
 */
async function getSessionEvents(sessionId) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `SESSION#${sessionId}`,
      ':skPrefix': 'EVENT#'
    }
  });
  
  const result = await docClient.send(command);
  return result.Items || [];
}

/**
 * Query sessions by external ID using GSI
 */
async function getSessionsByExternalId(externalId) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': `USER#${externalId}`
    }
  });
  
  const result = await docClient.send(command);
  return result.Items || [];
}

/**
 * Display session timeline
 */
function displaySessionTimeline(session, events) {
  console.log('\n' + '='.repeat(80));
  console.log('SESSION TIMELINE');
  console.log('='.repeat(80));
  
  console.log('\nSession Metadata:');
  console.log(`  Session ID:    ${session.sessionId}`);
  console.log(`  External ID:   ${session.externalId || '(anonymous)'}`);
  console.log(`  Status:        ${session.status}`);
  console.log(`  Steps Taken:   ${session.stepsTaken}`);
  console.log(`  Created:       ${session.createdAt}`);
  console.log(`  Updated:       ${session.updatedAt}`);
  console.log(`  User Agent:    ${session.userAgent || 'N/A'}`);
  console.log(`  IP Address:    ${session.ipAddress || 'N/A'}`);
  
  if (session.metadata && Object.keys(session.metadata).length > 0) {
    console.log(`  Metadata:      ${JSON.stringify(session.metadata)}`);
  }
  
  console.log(`\nEvents (${events.length} total):`);
  events.forEach((event, idx) => {
    console.log(`\n  [${idx + 1}] ${event.eventType}`);
    console.log(`      Event ID:   ${event.eventId}`);
    console.log(`      Timestamp:  ${event.timestamp}`);
    if (event.eventData && Object.keys(event.eventData).length > 0) {
      console.log(`      Data:       ${JSON.stringify(event.eventData)}`);
    }
  });
  
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Display sessions by user
 */
function displayUserSessions(sessions) {
  console.log('\n' + '='.repeat(80));
  console.log('USER SESSIONS');
  console.log('='.repeat(80));
  
  console.log(`\nFound ${sessions.length} session(s):\n`);
  
  sessions.forEach((session, idx) => {
    console.log(`[${idx + 1}] ${session.sessionId}`);
    console.log(`    Status:       ${session.status}`);
    console.log(`    Steps Taken:  ${session.stepsTaken}`);
    console.log(`    Created:      ${session.createdAt}`);
    console.log(`    Updated:      ${session.updatedAt}`);
    console.log('');
  });
  
  console.log('='.repeat(80) + '\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    const sessionId = process.argv[2];
    const externalId = process.env.EXTERNAL_ID;
    
    console.log(`Table: ${TABLE_NAME}`);
    console.log(`Region: ${REGION}\n`);
    
    if (externalId) {
      // Query by external ID
      console.log(`Querying sessions for external ID: ${externalId}`);
      const sessions = await getSessionsByExternalId(externalId);
      
      if (sessions.length === 0) {
        console.log('No sessions found for this external ID');
        return;
      }
      
      displayUserSessions(sessions);
      
    } else if (sessionId) {
      // Get specific session
      console.log(`Fetching session: ${sessionId}`);
      const session = await getSession(sessionId);
      
      if (!session) {
        console.log('Session not found');
        return;
      }
      
      const events = await getSessionEvents(sessionId);
      displaySessionTimeline(session, events);
      
    } else {
      console.log('Usage:');
      console.log('  Query specific session:');
      console.log('    node query-sessions.js <sessionId>');
      console.log('');
      console.log('  Query by external ID:');
      console.log('    EXTERNAL_ID=user@example.com node query-sessions.js');
      console.log('');
      console.log('Environment variables:');
      console.log('  TABLE_NAME  - DynamoDB table name (default: session-tracking)');
      console.log('  AWS_REGION  - AWS region (default: eu-central-1)');
      console.log('  EXTERNAL_ID - User external ID to query');
    }
    
  } catch (error) {
    console.error('Error querying data:', error);
    process.exit(1);
  }
}

main();
