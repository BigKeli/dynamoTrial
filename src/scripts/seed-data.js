/**
 * Script to seed DynamoDB table with sample data
 * 
 * Usage: TABLE_NAME=session-tracking node seed-data.js
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const TABLE_NAME = process.env.TABLE_NAME || 'session-tracking';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Generate sample sessions and events
 */
function generateSampleData() {
  const items = [];
  const now = new Date();
  
  // Sample users
  const users = [
    { externalId: 'user_john@example.com', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    { externalId: 'user_jane@example.com', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    { externalId: null, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' }
  ];
  
  // Generate sessions
  users.forEach((user, userIdx) => {
    for (let sessionIdx = 0; sessionIdx < 2; sessionIdx++) {
      const sessionId = `sess_${uuidv4()}`;
      const sessionCreatedAt = new Date(now.getTime() - (userIdx * 86400000) - (sessionIdx * 3600000)).toISOString();
      
      // Session metadata item
      const sessionItem = {
        PK: `SESSION#${sessionId}`,
        SK: '#METADATA',
        itemType: 'SESSION_METADATA',
        sessionId,
        externalId: user.externalId,
        userAgent: user.userAgent,
        ipAddress: `192.168.1.${100 + userIdx}`,
        status: sessionIdx === 0 ? 'active' : 'completed',
        stepsTaken: 3,
        createdAt: sessionCreatedAt,
        updatedAt: sessionCreatedAt,
        metadata: {
          source: 'organic',
          campaign: sessionIdx === 0 ? 'spring_sale' : 'email_campaign'
        }
      };
      
      // Add GSI keys if user has externalId
      if (user.externalId) {
        sessionItem.GSI1PK = `USER#${user.externalId}`;
        sessionItem.GSI1SK = `SESSION#${sessionCreatedAt}`;
      }
      
      items.push(sessionItem);
      
      // Generate events for this session
      const eventTypes = ['landing', 'click', 'quiz_start', 'quiz_complete', 'checkout_start'];
      
      eventTypes.forEach((eventType, eventIdx) => {
        const eventTimestamp = new Date(
          new Date(sessionCreatedAt).getTime() + (eventIdx * 60000)
        ).toISOString();
        const eventId = uuidv4();
        
        const eventItem = {
          PK: `SESSION#${sessionId}`,
          SK: `EVENT#${eventTimestamp}#${eventId}`,
          itemType: 'EVENT',
          eventId,
          sessionId,
          eventType,
          eventData: {
            page: eventType === 'landing' ? '/' : `/${eventType.replace('_', '-')}`,
            value: eventType.includes('checkout') ? 99.99 : undefined
          },
          userAgent: user.userAgent,
          ipAddress: `192.168.1.${100 + userIdx}`,
          timestamp: eventTimestamp,
          createdAt: eventTimestamp
        };
        
        items.push(eventItem);
      });
    }
  });
  
  return items;
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
    
    await docClient.send(command);
    console.log(`Batch ${i + 1}/${chunks.length} written successfully`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('Generating sample data...');
    const items = generateSampleData();
    
    console.log(`Generated ${items.length} items`);
    console.log(`Target table: ${TABLE_NAME}`);
    console.log(`Region: ${REGION}`);
    
    await batchWrite(items);
    
    console.log('✓ Seeding completed successfully!');
    console.log('\nSample data includes:');
    console.log('- 3 users (2 identified, 1 anonymous)');
    console.log('- 6 sessions total');
    console.log('- Multiple events per session (landing, clicks, quiz, checkout)');
    
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

main();
