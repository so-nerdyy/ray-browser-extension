/**
 * Error Recovery E2E Tests
 * Tests for error handling and recovery mechanisms in end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Navigate to URL
    navigate: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.update({ url }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    },
    
    // Wait for navigation to complete
    waitForNavigation: async (tabId, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkNavigation = () => {
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (tab.status === 'complete') {
              resolve(tab);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Navigation timeout after ${timeout}ms`));
            } else {
              setTimeout(checkNavigation, 100);
            }
          });
        };
        
        checkNavigation();
      });
    },
    
    // Get current tab
    getCurrentTab: async () => {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (tabs.length > 0) {
            resolve(tabs[0]);
          } else {
            reject(new Error('No active tab found'));
          }
        });
      });
    },
    
    // Fill form field
    fillField: async (tabId, selector, value) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'fillField',
          data: { selector, value }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to fill field: ${selector}`));
          }
        });
      });
    },
    
    // Click element
    clickElement: async (tabId, selector) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'clickElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to click element: ${selector}`));
          }
        });
      });
    },
    
    // Wait for element to be visible
    waitForElement: async (tabId, selector, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          chrome.tabs.sendMessage(tabId, {
            type: 'checkElementVisible',
            data: { selector }
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.visible) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Element visibility timeout after ${timeout}ms`));
            } else {
              setTimeout(checkElement, 100);
            }
          });
        };
        
        checkElement();
      });
    },
    
    // Get page content
    getPageContent: async (tabId) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'getPageContent'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
  },
  
  // Error recovery manager
  errorRecovery: {
    // Retry mechanism with exponential backoff
    retryWithBackoff: async (operation, maxRetries = 3, baseDelay = 1000) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation();
          return { success: true, result, attempts: attempt };
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      return { success: false, error: lastError, attempts: maxRetries };
    },
    
    // Fallback mechanism
    executeWithFallback: async (primaryOperation, fallbackOperation) => {
      try {
        const result = await primaryOperation();
        return { success: true, result, usedFallback: false };
      } catch (primaryError) {
        try {
          const fallbackResult = await fallbackOperation();
          return { success: true, result: fallbackResult, usedFallback: true, primaryError };
        } catch (fallbackError) {
          return { 
            success: false, 
            primaryError, 
            fallbackError,
            message: 'Both primary and fallback operations failed'
          };
        }
      }
    },
    
    // Graceful degradation
    executeWithDegradation: async (operations) => {
      const results = [];
      let lastError;
      
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          const result = await operation();
          return {
            success: true,
            result,
            operationIndex: i,
            results: [...results, { success: true, result, operationIndex: i }]
          };
        } catch (error) {
          lastError = error;
          results.push({ success: false, error, operationIndex: i });
        }
      }
      
      return {
        success: false,
        error: lastError,
        results,
        message: 'All operations failed'
      };
    }
  },
  
  // Command processor with error recovery
  commandProcessor: {
    // Process navigation command with retry
    processNavigationWithRetry: async (command, maxRetries = 3) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse navigation command
      const urlMatch = command.match(/(?:go to|navigate to)\s+(.+?)(?:\s|$)/i);
      if (!urlMatch) {
        throw new Error('Invalid navigation command format');
      }
      
      let url = urlMatch[1].trim();
      
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Validate URL format
      try {
        new URL(url);
      } catch (error) {
        throw new Error(`Invalid URL: ${url}`);
      }
      
      const navigationOperation = async () => {
        const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
        await mockE2ETestFramework.browser.navigate(url);
        await mockE2ETestFramework.browser.waitForNavigation(currentTab.id);
        return { url, tabId: currentTab.id };
      };
      
      return await mockE2ETestFramework.errorRecovery.retryWithBackoff(
        navigationOperation,
        maxRetries
      );
    },
    
    // Process fill command with fallback
    processFillWithFallback: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse fill command
      const fillMatch = command.match(/fill\s+(.+?)\s+with\s+(.+?)(?:\s|$)/i);
      if (!fillMatch) {
        throw new Error('Invalid fill command format');
      }
      
      const fieldSelector = fillMatch[1].trim();
      const value = fillMatch[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      
      const primaryOperation = async () => {
        const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
        await mockE2ETestFramework.browser.fillField(currentTab.id, fieldSelector, value);
        return { selector: fieldSelector, value, tabId: currentTab.id };
      };
      
      const fallbackOperation = async () => {
        // Try alternative selector
        const alternativeSelector = `input[name="${fieldSelector}"], #${fieldSelector}, .${fieldSelector}`;
        const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
        await mockE2ETestFramework.browser.fillField(currentTab.id, alternativeSelector, value);
        return { selector: alternativeSelector, value, tabId: currentTab.id, usedAlternative: true };
      };
      
      return await mockE2ETestFramework.errorRecovery.executeWithFallback(
        primaryOperation,
        fallbackOperation
      );
    },
    
    // Process click command with degradation
    processClickWithDegradation: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse click command
      const clickMatch = command.match(/(?:click|press)\s+(.+?)(?:\s|$)/i);
      if (!clickMatch) {
        throw new Error('Invalid click command format');
      }
      
      const elementSelector = clickMatch[1].trim();
      
      const operations = [
        // Primary: Click by selector
        async () => {
          const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
          await mockE2ETestFramework.browser.clickElement(currentTab.id, elementSelector);
          return { method: 'selector', selector: elementSelector, tabId: currentTab.id };
        },
        
        // Fallback 1: Wait for element then click
        async () => {
          const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
          await mockE2ETestFramework.browser.waitForElement(currentTab.id, elementSelector, 3000);
          await mockE2ETestFramework.browser.clickElement(currentTab.id, elementSelector);
          return { method: 'wait-and-click', selector: elementSelector, tabId: currentTab.id };
        },
        
        // Fallback 2: Try JavaScript click
        async () => {
          const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
          await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(currentTab.id, {
              type: 'executeScript',
              data: { code: `document.querySelector('${elementSelector}').click();` }
            }, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (response && response.success) {
                resolve(response);
              } else {
                reject(new Error('JavaScript click failed'));
              }
            });
          });
          return { method: 'javascript-click', selector: elementSelector, tabId: currentTab.id };
        }
      ];
      
      return await mockE2ETestFramework.errorRecovery.executeWithDegradation(operations);
    }
  },
  
  // Test utilities
  utils: {
    // Simulate intermittent failures
    setupIntermittentFailures: (failureRate = 0.3) => {
      let callCount = 0;
      
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callCount++;
        const shouldFail = Math.random() < failureRate;
        
        if (shouldFail) {
          chrome.runtime.lastError = new Error(`Simulated failure #${callCount}`);
          callback(null);
        } else {
          // Normal behavior
          switch (message.type) {
            case 'fillField':
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
              break;
            case 'clickElement':
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
              break;
            case 'checkElementVisible':
              const element = document.querySelector(message.data.selector);
              callback({ visible: !!element && element.offsetParent !== null });
              break;
            case 'getPageContent':
              callback({ text: document.body.innerText, html: document.documentElement.outerHTML });
              break;
            case 'executeScript':
              try {
                eval(message.data.code);
                callback({ success: true });
              } catch (error) {
                callback({ success: false, error: error.message });
              }
              break;
            default:
              callback({ success: false });
          }
        }
      });
    },
    
    // Simulate page content
    setupPageContent: () => {
      document.body.innerHTML = `
        <div class="container">
          <h1>Test Page</h1>
          <form id="test-form">
            <div class="form-group">
              <label for="username">Username:</label>
              <input type="text" id="username" name="username" placeholder="Enter username">
            </div>
            <div class="form-group">
              <label for="email">Email:</label>
              <input type="email" id="email" name="email" placeholder="Enter email">
            </div>
            <div class="form-group">
              <button type="button" id="submit-btn" class="btn-primary">Submit</button>
              <button type="button" id="cancel-btn" class="btn-secondary">Cancel</button>
            </div>
          </form>
          <div id="result-message" style="display: none;">Operation completed!</div>
        </div>
      `;
    },
    
    // Reset error state
    resetErrorState: () => {
      chrome.runtime.lastError = null;
    }
  }
};

describe('Error Recovery E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock page content
    mockE2ETestFramework.utils.setupPageContent();
    
    // Mock tab operations
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([createMockTab({ id: 1, url: 'http://example.com', status: 'complete' })]);
    });
    
    chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
      callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
    });
    
    chrome.tabs.get.mockImplementation((tabId, callback) => {
      callback(createMockTab({ id: tabId, status: 'complete' }));
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Retry Mechanism', () => {
    test('should retry failed navigation with exponential backoff', async () => {
      const command = 'Go to example.com';
      let attemptCount = 0;
      
      // Mock navigation that fails twice then succeeds
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        attemptCount++;
        if (attemptCount <= 2) {
          chrome.runtime.lastError = new Error(`Navigation attempt ${attemptCount} failed`);
          callback(null);
        } else {
          callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
        }
      });
      
      const startTime = Date.now();
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(duration).toBeGreaterThan(2000); // Should have exponential backoff delays
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should fail after maximum retry attempts', async () => {
      const command = 'Go to example.com';
      
      // Mock navigation that always fails
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        chrome.runtime.lastError = new Error('Navigation always fails');
        callback(null);
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error.message).toBe('Navigation always fails');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should succeed on first attempt with no failures', async () => {
      const command = 'Go to example.com';
      
      // Mock successful navigation
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });
  });
  
  describe('Fallback Mechanism', () => {
    test('should use fallback when primary operation fails', async () => {
      const command = 'Fill username field with testuser';
      
      // Mock primary operation failure and fallback success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField' && message.data.selector === 'username field') {
          callback({ success: false }); // Primary selector fails
        } else if (message.type === 'fillField' && message.data.selector.includes('input[name=')) {
          // Fallback selector succeeds
          const field = document.querySelector('#username');
          if (field) {
            field.value = message.data.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, field: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
        } else {
          callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(result.result.usedAlternative).toBe(true);
      expect(result.result.value).toBe('testuser');
    });
    
    test('should use primary operation when it succeeds', async () => {
      const command = 'Fill username field with testuser';
      
      // Mock successful primary operation
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField' && message.data.selector === 'username field') {
          // Primary selector succeeds
          const field = document.querySelector('#username');
          if (field) {
            field.value = message.data.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, field: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
        } else {
          callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(false);
      expect(result.result.value).toBe('testuser');
    });
    
    test('should fail when both primary and fallback operations fail', async () => {
      const command = 'Fill non-existent-field with value';
      
      // Mock both operations failing
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: false }); // All operations fail
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Both primary and fallback operations failed');
    });
  });
  
  describe('Graceful Degradation', () => {
    test('should use first successful operation in degradation chain', async () => {
      const command = 'Click submit-btn';
      
      // Mock first operation failure, second success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'clickElement' && message.data.selector === 'submit-btn') {
          callback({ success: false }); // First operation fails
        } else if (message.type === 'checkElementVisible' && message.data.selector === 'submit-btn') {
          callback({ visible: true }); // Element is visible for wait operation
        } else if (message.type === 'clickElement' && message.data.selector === 'submit-btn' && callCount > 1) {
          // Second operation (wait then click) succeeds
          const element = document.querySelector('#submit-btn');
          if (element) {
            element.click();
            callback({ success: true, element: message.data.selector });
          } else {
            callback({ success: false });
          }
        } else {
          callback({ success: false });
        }
      });
      
      let callCount = 0;
      const originalSendMessage = chrome.tabs.sendMessage;
      chrome.tabs.sendMessage = jest.fn((tabId, message, callback) => {
        callCount++;
        return originalSendMessage(tabId, message, callback);
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(true);
      expect(result.operationIndex).toBe(1); // Second operation succeeded
      expect(result.result.method).toBe('wait-and-click');
    });
    
    test('should fall back through all operations until one succeeds', async () => {
      const command = 'Click submit-btn';
      
      // Mock first two operations failure, third success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'clickElement') {
          callback({ success: false }); // First two operations fail
        } else if (message.type === 'executeScript') {
          // Third operation (JavaScript click) succeeds
          callback({ success: true });
        } else {
          callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(true);
      expect(result.operationIndex).toBe(2); // Third operation succeeded
      expect(result.result.method).toBe('javascript-click');
    });
    
    test('should fail when all operations in degradation chain fail', async () => {
      const command = 'Click non-existent-btn';
      
      // Mock all operations failing
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: false }); // All operations fail
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('All operations failed');
      expect(result.results).toHaveLength(3); // All three operations failed
    });
  });
  
  describe('Intermittent Failure Recovery', () => {
    test('should handle intermittent failures with retry mechanism', async () => {
      const command = 'Fill username field with testuser';
      
      // Setup intermittent failures (30% failure rate)
      mockE2ETestFramework.utils.setupIntermittentFailures(0.3);
      
      const result = await mockE2ETestFramework.errorRecovery.retryWithBackoff(async () => {
        return await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      }, 5);
      
      expect(result.success).toBe(true);
    });
    
    test('should handle intermittent navigation failures', async () => {
      const command = 'Go to example.com';
      let attemptCount = 0;
      
      // Mock intermittent navigation failures
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        attemptCount++;
        if (attemptCount % 2 === 0) { // Fail on even attempts
          chrome.runtime.lastError = new Error(`Intermittent failure ${attemptCount}`);
          callback(null);
        } else {
          callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 5);
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2); // Should succeed on second attempt
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Error Context and Reporting', () => {
    test('should provide detailed error information', async () => {
      const command = 'Fill username field with testuser';
      
      // Mock operation failure with specific error
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: false, error: 'Element not found: username field' });
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(false);
      expect(result.primaryError).toBeDefined();
      expect(result.fallbackError).toBeDefined();
      expect(result.message).toBe('Both primary and fallback operations failed');
    });
    
    test('should track operation attempts in degradation', async () => {
      const command = 'Click submit-btn';
      
      // Mock all operations failing with different errors
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        const errors = [
          'Element not clickable',
          'Element not visible',
          'JavaScript execution failed'
        ];
        const errorIndex = Math.floor(Math.random() * errors.length);
        callback({ success: false, error: errors[errorIndex] });
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => !r.success)).toBe(true);
      expect(result.results.every(r => r.error)).toBe(true);
    });
  });
  
  describe('Performance Under Failure Conditions', () => {
    test('should complete within reasonable time despite failures', async () => {
      const command = 'Go to example.com';
      let attemptCount = 0;
      
      // Mock failures with delays
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        attemptCount++;
        setTimeout(() => {
          if (attemptCount <= 2) {
            chrome.runtime.lastError = new Error(`Navigation attempt ${attemptCount} failed`);
            callback(null);
          } else {
            callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
          }
        }, 100); // Add delay to simulate network latency
      });
      
      const startTime = Date.now();
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds despite failures
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
}); * Error Recovery E2E Tests
 * Tests for error handling and recovery mechanisms in end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Navigate to URL
    navigate: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.update({ url }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    },
    
    // Wait for navigation to complete
    waitForNavigation: async (tabId, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkNavigation = () => {
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (tab.status === 'complete') {
              resolve(tab);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Navigation timeout after ${timeout}ms`));
            } else {
              setTimeout(checkNavigation, 100);
            }
          });
        };
        
        checkNavigation();
      });
    },
    
    // Get current tab
    getCurrentTab: async () => {
      return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (tabs.length > 0) {
            resolve(tabs[0]);
          } else {
            reject(new Error('No active tab found'));
          }
        });
      });
    },
    
    // Fill form field
    fillField: async (tabId, selector, value) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'fillField',
          data: { selector, value }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to fill field: ${selector}`));
          }
        });
      });
    },
    
    // Click element
    clickElement: async (tabId, selector) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'clickElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to click element: ${selector}`));
          }
        });
      });
    },
    
    // Wait for element to be visible
    waitForElement: async (tabId, selector, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
          chrome.tabs.sendMessage(tabId, {
            type: 'checkElementVisible',
            data: { selector }
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.visible) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Element visibility timeout after ${timeout}ms`));
            } else {
              setTimeout(checkElement, 100);
            }
          });
        };
        
        checkElement();
      });
    },
    
    // Get page content
    getPageContent: async (tabId) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'getPageContent'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
  },
  
  // Error recovery manager
  errorRecovery: {
    // Retry mechanism with exponential backoff
    retryWithBackoff: async (operation, maxRetries = 3, baseDelay = 1000) => {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation();
          return { success: true, result, attempts: attempt };
        } catch (error) {
          lastError = error;
          
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      return { success: false, error: lastError, attempts: maxRetries };
    },
    
    // Fallback mechanism
    executeWithFallback: async (primaryOperation, fallbackOperation) => {
      try {
        const result = await primaryOperation();
        return { success: true, result, usedFallback: false };
      } catch (primaryError) {
        try {
          const fallbackResult = await fallbackOperation();
          return { success: true, result: fallbackResult, usedFallback: true, primaryError };
        } catch (fallbackError) {
          return { 
            success: false, 
            primaryError, 
            fallbackError,
            message: 'Both primary and fallback operations failed'
          };
        }
      }
    },
    
    // Graceful degradation
    executeWithDegradation: async (operations) => {
      const results = [];
      let lastError;
      
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          const result = await operation();
          return {
            success: true,
            result,
            operationIndex: i,
            results: [...results, { success: true, result, operationIndex: i }]
          };
        } catch (error) {
          lastError = error;
          results.push({ success: false, error, operationIndex: i });
        }
      }
      
      return {
        success: false,
        error: lastError,
        results,
        message: 'All operations failed'
      };
    }
  },
  
  // Command processor with error recovery
  commandProcessor: {
    // Process navigation command with retry
    processNavigationWithRetry: async (command, maxRetries = 3) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse navigation command
      const urlMatch = command.match(/(?:go to|navigate to)\s+(.+?)(?:\s|$)/i);
      if (!urlMatch) {
        throw new Error('Invalid navigation command format');
      }
      
      let url = urlMatch[1].trim();
      
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Validate URL format
      try {
        new URL(url);
      } catch (error) {
        throw new Error(`Invalid URL: ${url}`);
      }
      
      const navigationOperation = async () => {
        const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
        await mockE2ETestFramework.browser.navigate(url);
        await mockE2ETestFramework.browser.waitForNavigation(currentTab.id);
        return { url, tabId: currentTab.id };
      };
      
      return await mockE2ETestFramework.errorRecovery.retryWithBackoff(
        navigationOperation,
        maxRetries
      );
    },
    
    // Process fill command with fallback
    processFillWithFallback: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse fill command
      const fillMatch = command.match(/fill\s+(.+?)\s+with\s+(.+?)(?:\s|$)/i);
      if (!fillMatch) {
        throw new Error('Invalid fill command format');
      }
      
      const fieldSelector = fillMatch[1].trim();
      const value = fillMatch[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      
      const primaryOperation = async () => {
        const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
        await mockE2ETestFramework.browser.fillField(currentTab.id, fieldSelector, value);
        return { selector: fieldSelector, value, tabId: currentTab.id };
      };
      
      const fallbackOperation = async () => {
        // Try alternative selector
        const alternativeSelector = `input[name="${fieldSelector}"], #${fieldSelector}, .${fieldSelector}`;
        const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
        await mockE2ETestFramework.browser.fillField(currentTab.id, alternativeSelector, value);
        return { selector: alternativeSelector, value, tabId: currentTab.id, usedAlternative: true };
      };
      
      return await mockE2ETestFramework.errorRecovery.executeWithFallback(
        primaryOperation,
        fallbackOperation
      );
    },
    
    // Process click command with degradation
    processClickWithDegradation: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse click command
      const clickMatch = command.match(/(?:click|press)\s+(.+?)(?:\s|$)/i);
      if (!clickMatch) {
        throw new Error('Invalid click command format');
      }
      
      const elementSelector = clickMatch[1].trim();
      
      const operations = [
        // Primary: Click by selector
        async () => {
          const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
          await mockE2ETestFramework.browser.clickElement(currentTab.id, elementSelector);
          return { method: 'selector', selector: elementSelector, tabId: currentTab.id };
        },
        
        // Fallback 1: Wait for element then click
        async () => {
          const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
          await mockE2ETestFramework.browser.waitForElement(currentTab.id, elementSelector, 3000);
          await mockE2ETestFramework.browser.clickElement(currentTab.id, elementSelector);
          return { method: 'wait-and-click', selector: elementSelector, tabId: currentTab.id };
        },
        
        // Fallback 2: Try JavaScript click
        async () => {
          const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
          await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(currentTab.id, {
              type: 'executeScript',
              data: { code: `document.querySelector('${elementSelector}').click();` }
            }, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (response && response.success) {
                resolve(response);
              } else {
                reject(new Error('JavaScript click failed'));
              }
            });
          });
          return { method: 'javascript-click', selector: elementSelector, tabId: currentTab.id };
        }
      ];
      
      return await mockE2ETestFramework.errorRecovery.executeWithDegradation(operations);
    }
  },
  
  // Test utilities
  utils: {
    // Simulate intermittent failures
    setupIntermittentFailures: (failureRate = 0.3) => {
      let callCount = 0;
      
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callCount++;
        const shouldFail = Math.random() < failureRate;
        
        if (shouldFail) {
          chrome.runtime.lastError = new Error(`Simulated failure #${callCount}`);
          callback(null);
        } else {
          // Normal behavior
          switch (message.type) {
            case 'fillField':
              const field = document.querySelector(message.data.selector);
              if (field) {
                field.value = message.data.value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                callback({ success: true, field: message.data.selector, value: message.data.value });
              } else {
                callback({ success: false });
              }
              break;
            case 'clickElement':
              const element = document.querySelector(message.data.selector);
              if (element) {
                element.click();
                callback({ success: true, element: message.data.selector });
              } else {
                callback({ success: false });
              }
              break;
            case 'checkElementVisible':
              const element = document.querySelector(message.data.selector);
              callback({ visible: !!element && element.offsetParent !== null });
              break;
            case 'getPageContent':
              callback({ text: document.body.innerText, html: document.documentElement.outerHTML });
              break;
            case 'executeScript':
              try {
                eval(message.data.code);
                callback({ success: true });
              } catch (error) {
                callback({ success: false, error: error.message });
              }
              break;
            default:
              callback({ success: false });
          }
        }
      });
    },
    
    // Simulate page content
    setupPageContent: () => {
      document.body.innerHTML = `
        <div class="container">
          <h1>Test Page</h1>
          <form id="test-form">
            <div class="form-group">
              <label for="username">Username:</label>
              <input type="text" id="username" name="username" placeholder="Enter username">
            </div>
            <div class="form-group">
              <label for="email">Email:</label>
              <input type="email" id="email" name="email" placeholder="Enter email">
            </div>
            <div class="form-group">
              <button type="button" id="submit-btn" class="btn-primary">Submit</button>
              <button type="button" id="cancel-btn" class="btn-secondary">Cancel</button>
            </div>
          </form>
          <div id="result-message" style="display: none;">Operation completed!</div>
        </div>
      `;
    },
    
    // Reset error state
    resetErrorState: () => {
      chrome.runtime.lastError = null;
    }
  }
};

describe('Error Recovery E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock page content
    mockE2ETestFramework.utils.setupPageContent();
    
    // Mock tab operations
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([createMockTab({ id: 1, url: 'http://example.com', status: 'complete' })]);
    });
    
    chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
      callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
    });
    
    chrome.tabs.get.mockImplementation((tabId, callback) => {
      callback(createMockTab({ id: tabId, status: 'complete' }));
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Retry Mechanism', () => {
    test('should retry failed navigation with exponential backoff', async () => {
      const command = 'Go to example.com';
      let attemptCount = 0;
      
      // Mock navigation that fails twice then succeeds
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        attemptCount++;
        if (attemptCount <= 2) {
          chrome.runtime.lastError = new Error(`Navigation attempt ${attemptCount} failed`);
          callback(null);
        } else {
          callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
        }
      });
      
      const startTime = Date.now();
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(duration).toBeGreaterThan(2000); // Should have exponential backoff delays
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should fail after maximum retry attempts', async () => {
      const command = 'Go to example.com';
      
      // Mock navigation that always fails
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        chrome.runtime.lastError = new Error('Navigation always fails');
        callback(null);
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error.message).toBe('Navigation always fails');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
    
    test('should succeed on first attempt with no failures', async () => {
      const command = 'Go to example.com';
      
      // Mock successful navigation
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });
  });
  
  describe('Fallback Mechanism', () => {
    test('should use fallback when primary operation fails', async () => {
      const command = 'Fill username field with testuser';
      
      // Mock primary operation failure and fallback success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField' && message.data.selector === 'username field') {
          callback({ success: false }); // Primary selector fails
        } else if (message.type === 'fillField' && message.data.selector.includes('input[name=')) {
          // Fallback selector succeeds
          const field = document.querySelector('#username');
          if (field) {
            field.value = message.data.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, field: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
        } else {
          callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
      expect(result.result.usedAlternative).toBe(true);
      expect(result.result.value).toBe('testuser');
    });
    
    test('should use primary operation when it succeeds', async () => {
      const command = 'Fill username field with testuser';
      
      // Mock successful primary operation
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField' && message.data.selector === 'username field') {
          // Primary selector succeeds
          const field = document.querySelector('#username');
          if (field) {
            field.value = message.data.value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            callback({ success: true, field: message.data.selector, value: message.data.value });
          } else {
            callback({ success: false });
          }
        } else {
          callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(false);
      expect(result.result.value).toBe('testuser');
    });
    
    test('should fail when both primary and fallback operations fail', async () => {
      const command = 'Fill non-existent-field with value';
      
      // Mock both operations failing
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: false }); // All operations fail
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Both primary and fallback operations failed');
    });
  });
  
  describe('Graceful Degradation', () => {
    test('should use first successful operation in degradation chain', async () => {
      const command = 'Click submit-btn';
      
      // Mock first operation failure, second success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'clickElement' && message.data.selector === 'submit-btn') {
          callback({ success: false }); // First operation fails
        } else if (message.type === 'checkElementVisible' && message.data.selector === 'submit-btn') {
          callback({ visible: true }); // Element is visible for wait operation
        } else if (message.type === 'clickElement' && message.data.selector === 'submit-btn' && callCount > 1) {
          // Second operation (wait then click) succeeds
          const element = document.querySelector('#submit-btn');
          if (element) {
            element.click();
            callback({ success: true, element: message.data.selector });
          } else {
            callback({ success: false });
          }
        } else {
          callback({ success: false });
        }
      });
      
      let callCount = 0;
      const originalSendMessage = chrome.tabs.sendMessage;
      chrome.tabs.sendMessage = jest.fn((tabId, message, callback) => {
        callCount++;
        return originalSendMessage(tabId, message, callback);
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(true);
      expect(result.operationIndex).toBe(1); // Second operation succeeded
      expect(result.result.method).toBe('wait-and-click');
    });
    
    test('should fall back through all operations until one succeeds', async () => {
      const command = 'Click submit-btn';
      
      // Mock first two operations failure, third success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'clickElement') {
          callback({ success: false }); // First two operations fail
        } else if (message.type === 'executeScript') {
          // Third operation (JavaScript click) succeeds
          callback({ success: true });
        } else {
          callback({ success: false });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(true);
      expect(result.operationIndex).toBe(2); // Third operation succeeded
      expect(result.result.method).toBe('javascript-click');
    });
    
    test('should fail when all operations in degradation chain fail', async () => {
      const command = 'Click non-existent-btn';
      
      // Mock all operations failing
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: false }); // All operations fail
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('All operations failed');
      expect(result.results).toHaveLength(3); // All three operations failed
    });
  });
  
  describe('Intermittent Failure Recovery', () => {
    test('should handle intermittent failures with retry mechanism', async () => {
      const command = 'Fill username field with testuser';
      
      // Setup intermittent failures (30% failure rate)
      mockE2ETestFramework.utils.setupIntermittentFailures(0.3);
      
      const result = await mockE2ETestFramework.errorRecovery.retryWithBackoff(async () => {
        return await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      }, 5);
      
      expect(result.success).toBe(true);
    });
    
    test('should handle intermittent navigation failures', async () => {
      const command = 'Go to example.com';
      let attemptCount = 0;
      
      // Mock intermittent navigation failures
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        attemptCount++;
        if (attemptCount % 2 === 0) { // Fail on even attempts
          chrome.runtime.lastError = new Error(`Intermittent failure ${attemptCount}`);
          callback(null);
        } else {
          callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 5);
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2); // Should succeed on second attempt
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Error Context and Reporting', () => {
    test('should provide detailed error information', async () => {
      const command = 'Fill username field with testuser';
      
      // Mock operation failure with specific error
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: false, error: 'Element not found: username field' });
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processFillWithFallback(command);
      
      expect(result.success).toBe(false);
      expect(result.primaryError).toBeDefined();
      expect(result.fallbackError).toBeDefined();
      expect(result.message).toBe('Both primary and fallback operations failed');
    });
    
    test('should track operation attempts in degradation', async () => {
      const command = 'Click submit-btn';
      
      // Mock all operations failing with different errors
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        const errors = [
          'Element not clickable',
          'Element not visible',
          'JavaScript execution failed'
        ];
        const errorIndex = Math.floor(Math.random() * errors.length);
        callback({ success: false, error: errors[errorIndex] });
      });
      
      const result = await mockE2ETestFramework.commandProcessor.processClickWithDegradation(command);
      
      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => !r.success)).toBe(true);
      expect(result.results.every(r => r.error)).toBe(true);
    });
  });
  
  describe('Performance Under Failure Conditions', () => {
    test('should complete within reasonable time despite failures', async () => {
      const command = 'Go to example.com';
      let attemptCount = 0;
      
      // Mock failures with delays
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        attemptCount++;
        setTimeout(() => {
          if (attemptCount <= 2) {
            chrome.runtime.lastError = new Error(`Navigation attempt ${attemptCount} failed`);
            callback(null);
          } else {
            callback(createMockTab({ id: tabId, ...updateProperties, status: 'complete' }));
          }
        }, 100); // Add delay to simulate network latency
      });
      
      const startTime = Date.now();
      const result = await mockE2ETestFramework.commandProcessor.processNavigationWithRetry(command, 3);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds despite failures
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
});
