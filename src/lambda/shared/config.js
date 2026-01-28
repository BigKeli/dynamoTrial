/**
 * Runtime configuration from environment variables
 */

export const config = {
  stage: process.env.STAGE || 'dev',
  tableName: process.env.TABLE_NAME || 'session-tracking',
  gsi1Name: process.env.GSI1_NAME || 'GSI1',
  pkName: process.env.PK_NAME || 'PK',
  skName: process.env.SK_NAME || 'SK',
  logLevel: process.env.LOG_LEVEL || 'INFO',
  region: process.env.AWS_REGION || 'eu-central-1'
};

export function validateConfig() {
  const required = ['tableName'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}
