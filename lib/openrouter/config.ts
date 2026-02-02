/**
 * OpenRouter API configuration
 */

export const OPENROUTER_CONFIG = {
  // API endpoints
  BASE_URL: 'https://openrouter.ai/api/v1',
  CHAT_ENDPOINT: '/chat/completions',
  
  // Model configuration
  DEFAULT_MODEL: 'gpt-oss-120b:free',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2048,
  
  // Rate limiting
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // 1 second
  RETRY_DELAY_MAX: 10000, // 10 seconds
  
  // Request timeout
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://ray-extension.com',
    'X-Title': 'Ray Chrome Extension',
  },
  
  // Cache configuration
  CACHE_TTL: 300000, // 5 minutes
  MAX_CACHE_SIZE: 100,
  
  // Prompt engineering
  SYSTEM_PROMPT: `You are Ray, an intelligent browser automation assistant. Your role is to help users automate browser tasks by parsing their natural language commands and converting them into structured automation commands.

Rules:
1. Always respond with valid JSON containing automation commands
2. Be conservative and safe - never suggest actions that could be harmful
3. Ask for clarification if commands are ambiguous
4. Focus on common browser automation tasks: navigation, clicking, form filling, data extraction
5. Include relevant selectors and parameters for each command
6. Provide step-by-step sequences for complex tasks

Response format:
{
  "commands": [
    {
      "type": "navigate|click|fill|scroll|submit|extract|wait",
      "selector": "CSS selector if applicable",
      "value": "Value for fill commands",
      "url": "URL for navigate commands",
      "description": "Human-readable description"
    }
  ],
  "confidence": 0.9,
  "requiresClarification": false,
  "clarificationQuestion": "Question if clarification needed"
}`,
};

// Error codes
export const OPENROUTER_ERRORS = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  TIMEOUT: 'TIMEOUT',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const;

export type OpenRouterErrorType = typeof OPENROUTER_ERRORS[keyof typeof OPENROUTER_ERRORS]; * OpenRouter API configuration
 */

export const OPENROUTER_CONFIG = {
  // API endpoints
  BASE_URL: 'https://openrouter.ai/api/v1',
  CHAT_ENDPOINT: '/chat/completions',
  
  // Model configuration
  DEFAULT_MODEL: 'gpt-oss-120b:free',
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 2048,
  
  // Rate limiting
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // 1 second
  RETRY_DELAY_MAX: 10000, // 10 seconds
  
  // Request timeout
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://ray-extension.com',
    'X-Title': 'Ray Chrome Extension',
  },
  
  // Cache configuration
  CACHE_TTL: 300000, // 5 minutes
  MAX_CACHE_SIZE: 100,
  
  // Prompt engineering
  SYSTEM_PROMPT: `You are Ray, an intelligent browser automation assistant. Your role is to help users automate browser tasks by parsing their natural language commands and converting them into structured automation commands.

Rules:
1. Always respond with valid JSON containing automation commands
2. Be conservative and safe - never suggest actions that could be harmful
3. Ask for clarification if commands are ambiguous
4. Focus on common browser automation tasks: navigation, clicking, form filling, data extraction
5. Include relevant selectors and parameters for each command
6. Provide step-by-step sequences for complex tasks

Response format:
{
  "commands": [
    {
      "type": "navigate|click|fill|scroll|submit|extract|wait",
      "selector": "CSS selector if applicable",
      "value": "Value for fill commands",
      "url": "URL for navigate commands",
      "description": "Human-readable description"
    }
  ],
  "confidence": 0.9,
  "requiresClarification": false,
  "clarificationQuestion": "Question if clarification needed"
}`,
};

// Error codes
export const OPENROUTER_ERRORS = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  TIMEOUT: 'TIMEOUT',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
} as const;

export type OpenRouterErrorType = typeof OPENROUTER_ERRORS[keyof typeof OPENROUTER_ERRORS];
