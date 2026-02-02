/**
 * Test configuration and setup for Ray Chrome Extension
 * This file configures the testing environment and provides global test utilities
 */

// Global test configuration
export const TEST_CONFIG = {
  // API configuration for testing
  API: {
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    TEST_API_KEY: 'test-api-key-for-testing-only',
    TIMEOUT: 5000
  },
  
  // Chrome extension test configuration
  EXTENSION: {
    ID: 'test-extension-id',
    POPUP_WIDTH: 400,
    POPUP_HEIGHT: 600
  },
  
  // Test data configuration
  TEST_DATA: {
    VALID_COMMANDS: [
      'Go to google.com',
      'Search for Chrome extensions',
      'Fill name field with John Doe',
      'Click the submit button'
    ],
    INVALID_COMMANDS: [
      '',
      null,
      undefined,
      123
    ]
  },
  
  // Performance thresholds
  PERFORMANCE: {
    POPUP_LOAD_TIME: 500, // ms
    API_RESPONSE_TIME: 3000, // ms
    COMMAND_EXECUTION_START: 1000, // ms
    MEMORY_USAGE: 50 * 1024 * 1024, // 50MB in bytes
    CONTENT_SCRIPT_LOAD: 200 // ms
  }
};

// Test environment setup
export function setupTestEnvironment() {
  // Set up any global test environment variables
  global.TEST_CONFIG = TEST_CONFIG;
  
  // Mock console methods to avoid noise in tests
  global.console = {
    ...console,
    // Uncomment to suppress logs during tests
    // log: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn()
  };
}

// Clean up function for tests
export function cleanupTestEnvironment() {
  // Clean up any test-specific modifications
  delete global.TEST_CONFIG;
}

