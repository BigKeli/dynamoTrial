/**
 * DynamoDB client initialization and base operations
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  BatchWriteCommand,
  DeleteCommand,
  UpdateCommand 
} from '@aws-sdk/lib-dynamodb';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { InternalError } from '../shared/errors.js';

const client = new DynamoDBClient({ region: config.region });

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false
  },
  unmarshallOptions: {
    wrapNumbers: false
  }
});

/**
 * Put item into DynamoDB
 */
export async function putItem(item) {
  try {
    logger.debug('DynamoDB PutItem', { item });
    
    const command = new PutCommand({
      TableName: config.tableName,
      Item: item
    });
    
    await docClient.send(command);
    return item;
  } catch (error) {
    logger.error('DynamoDB PutItem failed', { error: error.message });
    throw new InternalError('Failed to save item', error);
  }
}

/**
 * Get item from DynamoDB
 */
export async function getItem(pk, sk) {
  try {
    logger.debug('DynamoDB GetItem', { pk, sk });
    
    const command = new GetCommand({
      TableName: config.tableName,
      Key: {
        [config.pkName]: pk,
        [config.skName]: sk
      }
    });
    
    const result = await docClient.send(command);
    return result.Item || null;
  } catch (error) {
    logger.error('DynamoDB GetItem failed', { error: error.message, pk, sk });
    throw new InternalError('Failed to retrieve item', error);
  }
}

/**
 * Query items from DynamoDB (main table or GSI)
 */
export async function queryItems(keyConditionExpression, expressionAttributeValues, indexName = null, limit = null) {
  try {
    logger.debug('DynamoDB Query', { 
      keyConditionExpression, 
      expressionAttributeValues, 
      indexName,
      limit 
    });
    
    const params = {
      TableName: config.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues
    };
    
    if (indexName) {
      params.IndexName = indexName;
    }
    
    if (limit) {
      params.Limit = limit;
    }
    
    const command = new QueryCommand(params);
    const result = await docClient.send(command);
    
    return result.Items || [];
  } catch (error) {
    logger.error('DynamoDB Query failed', { 
      error: error.message, 
      keyConditionExpression 
    });
    throw new InternalError('Failed to query items', error);
  }
}

/**
 * Batch write items (for seeding/bulk operations)
 */
export async function batchWriteItems(items) {
  try {
    logger.debug('DynamoDB BatchWrite', { itemCount: items.length });
    
    const putRequests = items.map(item => ({
      PutRequest: { Item: item }
    }));
    
    const command = new BatchWriteCommand({
      RequestItems: {
        [config.tableName]: putRequests
      }
    });
    
    await docClient.send(command);
    return items;
  } catch (error) {
    logger.error('DynamoDB BatchWrite failed', { error: error.message });
    throw new InternalError('Failed to batch write items', error);
  }
}

/**
 * Delete item from DynamoDB
 */
export async function deleteItem(pk, sk) {
  try {
    logger.debug('DynamoDB DeleteItem', { pk, sk });
    
    const command = new DeleteCommand({
      TableName: config.tableName,
      Key: {
        [config.pkName]: pk,
        [config.skName]: sk
      }
    });
    
    await docClient.send(command);
    return true;
  } catch (error) {
    logger.error('DynamoDB DeleteItem error', { pk, sk, error: error.message });
    throw new InternalError('Failed to delete item', error);
  }
}

/**
 * Update item in DynamoDB
 */
export async function updateItem(pk, sk, updates) {
  try {
    logger.debug('DynamoDB UpdateItem', { pk, sk, updates });
    
    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });
    
    const command = new UpdateCommand({
      TableName: config.tableName,
      Key: {
        [config.pkName]: pk,
        [config.skName]: sk
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const response = await docClient.send(command);
    return response.Attributes;
  } catch (error) {
    logger.error('DynamoDB UpdateItem error', { pk, sk, error: error.message });
    throw new InternalError('Failed to update item', error);
  }
}
