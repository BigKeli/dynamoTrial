/**
 * Input validation utilities
 */

import { ValidationError } from './errors.js';

export function validateRequired(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

export function validateEventType(eventType) {
  const allowedTypes = [
    'landing',
    'click',
    'form_submit',
    'form_start',
    'quiz_start',
    'quiz_complete',
    'product_view',
    'add_to_cart',
    'checkout_start',
    'checkout_complete',
    'page_view',
    'video_play',
    'video_complete',
    'download',
    'signup',
    'login',
    'custom'
  ];
  
  validateRequired(eventType, 'eventType');
  
  if (!allowedTypes.includes(eventType)) {
    throw new ValidationError(
      `eventType must be one of: ${allowedTypes.join(', ')}`,
      'eventType'
    );
  }
}

export function validateObject(value, fieldName) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return true;
  }
  throw new ValidationError(`${fieldName} must be a valid object`, fieldName);
}

export function validateSessionId(sessionId) {
  validateRequired(sessionId, 'sessionId');
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new ValidationError('sessionId must be a non-empty string', 'sessionId');
  }
}

export function validateString(value, fieldName) {
  validateRequired(value, fieldName);
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }
}
