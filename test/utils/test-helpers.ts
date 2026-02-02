/**
 * Test Utilities and Helpers for Ray Chrome Extension
 * This file provides reusable test utilities and helper functions
 */

import { TEST_CONFIG } from '../setup/test-config';

// Mock DOM helpers
export const createMockDOM = () => {
  // Create mock elements commonly used in tests
  const mockButton = document.createElement('button');
  mockButton.id = 'submit-button';
  mockButton.type = 'submit';
  
  const mockInput = document.createElement('input');
  mockInput.id = 'command-input';
  mockInput.type = 'text';
  
  const mockTextArea = document.createElement('textarea');
  mockTextArea.id = 'response-area';
  
  const mockProgress = document.createElement('div');
  mockProgress.id = 'progress-indicator';
  
  return {
    mockButton,
    mockInput,
    mockTextArea,
    mockProgress
  };
};

// Mock event helpers
export const createMockEvent = (type: string, properties: any = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  return event;
};

// Mock fetch for API testing
export const createMockFetch = (response: any, options: any = {}) => {
  const defaultOptions = {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' }
  };
  
  const mockResponse = new Response(JSON.stringify(response), {
    ...defaultOptions,
    ...options
  });
  
  return jest.fn().mockResolvedValue(mockResponse);
};

// Test data generators
export const generateTestCommand = (type: 'valid' | 'invalid' = 'valid') => {
  if (type === 'valid') {
    const commands = TEST_CONFIG.TEST_DATA.VALID_COMMANDS;
    return commands[Math.floor(Math.random() * commands.length)];
  } else {
    const commands = TEST_CONFIG.TEST_DATA.INVALID_COMMANDS;
    return commands[Math.floor(Math.random() * commands.length)];
  }
};

// Chrome storage helpers
export const mockChromeStorage = {
  get: (data: any = {}) => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = keys ? { [keys]: data[keys] } : data;
      if (callback) callback(result);
      return Promise.resolve(result);
    });
  },
  
  set: () => {
    chrome.storage.local.set.mockImplementation((items, callback) => {
      if (callback) callback();
      return Promise.resolve();
    });
  }
};

// Performance measurement helpers
export const measurePerformance = (fn: () => void | Promise<void>) => {
  const start = performance.now();
  const result = fn();
  
  if (result instanceof Promise) {
    return result.then(() => performance.now() - start);
  } else {
    return performance.now() - start;
  }
};

// Assertion helpers
export const expectPerformanceThreshold = (
  actualTime: number,
  threshold: number,
  operation: string
) => {
  expect(actualTime).toBeLessThanOrEqual(
    threshold,
    `${operation} took ${actualTime}ms, which exceeds the threshold of ${threshold}ms`
  );
};

// Mock tab helpers
export const createMockTab = (overrides: any = {}) => {
  return {
    id: Math.floor(Math.random() * 1000),
    url: 'http://example.com',
    active: true,
    windowId: 1,
    title: 'Test Page',
    ...overrides
  };
};

// Mock window helpers
export const createMockWindow = (overrides: any = {}) => {
  return {
    id: Math.floor(Math.random() * 1000),
    tabs: [createMockTab()],
    focused: true,
    ...overrides
  };
};

// Message passing helpers
export const createMockMessage = (type: string, data: any = {}) => {
  return {
    type,
    data,
    timestamp: Date.now(),
    id: Math.random().toString(36).substr(2, 9)
  };
};

// Async test helpers
export const waitFor = (condition: () => boolean, timeout: number = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 50);
      }
    };
    
    check();
  });
};

// Error testing helpers
export const expectError = async (fn: () => Promise<any>, expectedError?: string) => {
  try {
    await fn();
    fail('Expected function to throw an error');
  } catch (error) {
    if (expectedError) {
      expect(error.message).toContain(expectedError);
    }
    return error;
  }
};

// Cleanup helpers
export const cleanupMocks = () => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  
  // Reset chrome mocks
  Object.keys(chrome).forEach(api => {
    if (typeof chrome[api] === 'object' && chrome[api] !== null) {
      Object.keys(chrome[api]).forEach(method => {
        if (jest.isMockFunction(chrome[api][method])) {
          chrome[api][method].mockReset();
        }
      });
    }
  });
};

// Test environment setup and teardown
export const setupTest = () => {
  const dom = createMockDOM();
  document.body.appendChild(dom.mockInput);
  document.body.appendChild(dom.mockButton);
  document.body.appendChild(dom.mockTextArea);
  document.body.appendChild(dom.mockProgress);
  
  return dom;
};

export const teardownTest = () => {
  cleanupMocks();
};

// Export default helper object
export default {
  createMockDOM,
  createMockEvent,
  createMockFetch,
  generateTestCommand,
  mockChromeStorage,
  measurePerformance,
  expectPerformanceThreshold,
  createMockTab,
  createMockWindow,
  createMockMessage,
  waitFor,
  expectError,
  cleanupMocks,
  setupTest,
  teardownTest
}; * Test Utilities and Helpers for Ray Chrome Extension
 * This file provides reusable test utilities and helper functions
 */

import { TEST_CONFIG } from '../setup/test-config';

// Mock DOM helpers
export const createMockDOM = () => {
  // Create mock elements commonly used in tests
  const mockButton = document.createElement('button');
  mockButton.id = 'submit-button';
  mockButton.type = 'submit';
  
  const mockInput = document.createElement('input');
  mockInput.id = 'command-input';
  mockInput.type = 'text';
  
  const mockTextArea = document.createElement('textarea');
  mockTextArea.id = 'response-area';
  
  const mockProgress = document.createElement('div');
  mockProgress.id = 'progress-indicator';
  
  return {
    mockButton,
    mockInput,
    mockTextArea,
    mockProgress
  };
};

// Mock event helpers
export const createMockEvent = (type: string, properties: any = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, properties);
  return event;
};

// Mock fetch for API testing
export const createMockFetch = (response: any, options: any = {}) => {
  const defaultOptions = {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' }
  };
  
  const mockResponse = new Response(JSON.stringify(response), {
    ...defaultOptions,
    ...options
  });
  
  return jest.fn().mockResolvedValue(mockResponse);
};

// Test data generators
export const generateTestCommand = (type: 'valid' | 'invalid' = 'valid') => {
  if (type === 'valid') {
    const commands = TEST_CONFIG.TEST_DATA.VALID_COMMANDS;
    return commands[Math.floor(Math.random() * commands.length)];
  } else {
    const commands = TEST_CONFIG.TEST_DATA.INVALID_COMMANDS;
    return commands[Math.floor(Math.random() * commands.length)];
  }
};

// Chrome storage helpers
export const mockChromeStorage = {
  get: (data: any = {}) => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      const result = keys ? { [keys]: data[keys] } : data;
      if (callback) callback(result);
      return Promise.resolve(result);
    });
  },
  
  set: () => {
    chrome.storage.local.set.mockImplementation((items, callback) => {
      if (callback) callback();
      return Promise.resolve();
    });
  }
};

// Performance measurement helpers
export const measurePerformance = (fn: () => void | Promise<void>) => {
  const start = performance.now();
  const result = fn();
  
  if (result instanceof Promise) {
    return result.then(() => performance.now() - start);
  } else {
    return performance.now() - start;
  }
};

// Assertion helpers
export const expectPerformanceThreshold = (
  actualTime: number,
  threshold: number,
  operation: string
) => {
  expect(actualTime).toBeLessThanOrEqual(
    threshold,
    `${operation} took ${actualTime}ms, which exceeds the threshold of ${threshold}ms`
  );
};

// Mock tab helpers
export const createMockTab = (overrides: any = {}) => {
  return {
    id: Math.floor(Math.random() * 1000),
    url: 'http://example.com',
    active: true,
    windowId: 1,
    title: 'Test Page',
    ...overrides
  };
};

// Mock window helpers
export const createMockWindow = (overrides: any = {}) => {
  return {
    id: Math.floor(Math.random() * 1000),
    tabs: [createMockTab()],
    focused: true,
    ...overrides
  };
};

// Message passing helpers
export const createMockMessage = (type: string, data: any = {}) => {
  return {
    type,
    data,
    timestamp: Date.now(),
    id: Math.random().toString(36).substr(2, 9)
  };
};

// Async test helpers
export const waitFor = (condition: () => boolean, timeout: number = 5000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Condition not met within ${timeout}ms`));
      } else {
        setTimeout(check, 50);
      }
    };
    
    check();
  });
};

// Error testing helpers
export const expectError = async (fn: () => Promise<any>, expectedError?: string) => {
  try {
    await fn();
    fail('Expected function to throw an error');
  } catch (error) {
    if (expectedError) {
      expect(error.message).toContain(expectedError);
    }
    return error;
  }
};

// Cleanup helpers
export const cleanupMocks = () => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  
  // Reset chrome mocks
  Object.keys(chrome).forEach(api => {
    if (typeof chrome[api] === 'object' && chrome[api] !== null) {
      Object.keys(chrome[api]).forEach(method => {
        if (jest.isMockFunction(chrome[api][method])) {
          chrome[api][method].mockReset();
        }
      });
    }
  });
};

// Test environment setup and teardown
export const setupTest = () => {
  const dom = createMockDOM();
  document.body.appendChild(dom.mockInput);
  document.body.appendChild(dom.mockButton);
  document.body.appendChild(dom.mockTextArea);
  document.body.appendChild(dom.mockProgress);
  
  return dom;
};

export const teardownTest = () => {
  cleanupMocks();
};

// Export default helper object
export default {
  createMockDOM,
  createMockEvent,
  createMockFetch,
  generateTestCommand,
  mockChromeStorage,
  measurePerformance,
  expectPerformanceThreshold,
  createMockTab,
  createMockWindow,
  createMockMessage,
  waitFor,
  expectError,
  cleanupMocks,
  setupTest,
  teardownTest
};
