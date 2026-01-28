/**
 * Audit DynamoDB data for validity and duplicates
 * 
 * Usage: TABLE_NAME=session-tracking node audit-data.js
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME || 'session-tracking';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Scan entire table and get all items
 */
async function scanAllItems() {
  const items = [];
  let lastEvaluatedKey = null;
  
  console.log('Scanning table:', TABLE_NAME);
  console.log('Region:', REGION);
  console.log('');
  
  do {
    const params = {
      TableName: TABLE_NAME,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
    };
    
    const response = await docClient.send(new ScanCommand(params));
    items.push(...response.Items);
    lastEvaluatedKey = response.LastEvaluatedKey;
    
    console.log(`Scanned ${items.length} items so far...`);
  } while (lastEvaluatedKey);
  
  return items;
}

/**
 * Analyze and validate data
 */
function analyzeData(items) {
  const sessions = new Map();
  const events = new Map();
  const issues = [];
  
  // Separate sessions and events
  for (const item of items) {
    if (item.itemType === 'SESSION_METADATA') {
      const sessionId = item.sessionId;
      
      if (sessions.has(sessionId)) {
        issues.push({
          type: 'DUPLICATE_SESSION',
          sessionId,
          message: `Duplicate session found: ${sessionId}`
        });
      }
      
      sessions.set(sessionId, item);
    } else if (item.itemType === 'EVENT') {
      const sessionId = item.sessionId;
      
      if (!events.has(sessionId)) {
        events.set(sessionId, []);
      }
      events.get(sessionId).push(item);
    }
  }
  
  // Validate sessions
  for (const [sessionId, session] of sessions) {
    // Check required fields
    if (!session.PK || !session.SK) {
      issues.push({
        type: 'MISSING_KEYS',
        sessionId,
        message: `Session ${sessionId} missing PK or SK`
      });
    }
    
    if (!session.createdAt) {
      issues.push({
        type: 'MISSING_FIELD',
        sessionId,
        message: `Session ${sessionId} missing createdAt`
      });
    }
    
    // Check if session has events
    const sessionEvents = events.get(sessionId) || [];
    if (sessionEvents.length === 0) {
      // It's OK to have sessions without events, just note it
    }
  }
  
  // Check for orphaned events (events without sessions)
  for (const [sessionId, eventList] of events) {
    if (!sessions.has(sessionId)) {
      issues.push({
        type: 'ORPHANED_EVENTS',
        sessionId,
        message: `Found ${eventList.length} events for non-existent session: ${sessionId}`
      });
    }
  }
  
  return {
    sessions,
    events,
    issues
  };
}

/**
 * Print summary report
 */
function printReport(analysis) {
  const { sessions, events, issues } = analysis;
  
  console.log('\n' + '═'.repeat(60));
  console.log('  DATA AUDIT REPORT');
  console.log('═'.repeat(60));
  
  // Summary
  console.log('\n📊 SUMMARY:');
  console.log(`  Total Sessions: ${sessions.size}`);
  
  let totalEvents = 0;
  for (const eventList of events.values()) {
    totalEvents += eventList.length;
  }
  console.log(`  Total Events: ${totalEvents}`);
  console.log(`  Sessions with Events: ${events.size}`);
  console.log(`  Sessions without Events: ${sessions.size - events.size}`);
  
  // Issues
  console.log('\n🔍 VALIDATION RESULTS:');
  if (issues.length === 0) {
    console.log('  ✅ No issues found - Data is clean!');
  } else {
    console.log(`  ⚠️  Found ${issues.length} issue(s):\n`);
    
    const issuesByType = {};
    for (const issue of issues) {
      if (!issuesByType[issue.type]) {
        issuesByType[issue.type] = [];
      }
      issuesByType[issue.type].push(issue);
    }
    
    for (const [type, typeIssues] of Object.entries(issuesByType)) {
      console.log(`  ${type}: ${typeIssues.length}`);
      typeIssues.forEach(issue => {
        console.log(`    - ${issue.message}`);
      });
    }
  }
  
  // Session details
  console.log('\n📋 SESSION DETAILS:');
  console.log('');
  
  const sessionArray = Array.from(sessions.entries());
  sessionArray.sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt));
  
  for (const [sessionId, session] of sessionArray) {
    const sessionEvents = events.get(sessionId) || [];
    const hasGSI = session.GSI1PK ? '🔗' : '  ';
    
    console.log(`  ${hasGSI} ${sessionId}`);
    console.log(`     Status: ${session.status || 'unknown'}`);
    console.log(`     External ID: ${session.externalId || 'anonymous'}`);
    console.log(`     Events: ${sessionEvents.length}`);
    console.log(`     Steps: ${session.stepsTaken || 0}`);
    console.log(`     Created: ${session.createdAt}`);
    
    if (sessionEvents.length > 0) {
      const eventTypes = sessionEvents.map(e => e.eventType);
      const uniqueTypes = [...new Set(eventTypes)];
      console.log(`     Event Types: ${uniqueTypes.join(', ')}`);
    }
    
    console.log('');
  }
  
  // User summary
  console.log('👥 USERS:');
  const userSessions = new Map();
  
  for (const [sessionId, session] of sessions) {
    if (session.externalId) {
      if (!userSessions.has(session.externalId)) {
        userSessions.set(session.externalId, []);
      }
      userSessions.get(session.externalId).push(sessionId);
    }
  }
  
  if (userSessions.size === 0) {
    console.log('  No users with externalId found (all anonymous sessions)');
  } else {
    for (const [userId, userSessionIds] of userSessions) {
      console.log(`  ${userId}: ${userSessionIds.length} session(s)`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  try {
    const items = await scanAllItems();
    
    console.log(`\n✓ Scan complete: ${items.length} total items\n`);
    
    const analysis = analyzeData(items);
    printReport(analysis);
    
    // Exit code based on issues
    if (analysis.issues.length > 0) {
      console.log('\n⚠️  Data validation found issues (see above)');
      process.exit(1);
    } else {
      console.log('\n✅ Data validation passed - Everything looks good!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Error during audit:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
