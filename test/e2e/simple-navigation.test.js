/**
 * Simple Navigation E2E Tests
 * Tests for basic navigation automation end-to-end scenarios
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
    
    // Create new tab
    createTab: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.create({ url, active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process navigation command
    processNavigationCommand: async (command) => {
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
      
      return { type: 'navigate', url, originalCommand: command };
    },
    
    // Execute navigation command
    executeNavigation: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processNavigationCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Navigate to URL
      const updatedTab = await mockE2ETestFramework.browser.navigate(parsedCommand.url);
      
      // Wait for navigation to complete
      const finalTab = await mockE2ETestFramework.browser.waitForNavigation(updatedTab.id);
      
      return {
        success: true,
        command: parsedCommand,
        result: {
          originalTab: currentTab,
          updatedTab: finalTab,
          url: finalTab.url
        }
      };
    }
  },
  
  // Test utilities
  utils: {
    // Verify URL matches expected
    verifyURL: (actualURL, expectedURL) => {
      const actual = new URL(actualURL);
      const expected = new URL(expectedURL);
      
      return actual.hostname === expected.hostname && actual.pathname === expected.pathname;
    },
    
    // Wait for page to be ready
    waitForPageReady: async (tabId, timeout = 3000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkReady = () => {
          chrome.tabs.sendMessage(tabId, { type: 'checkReady' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.ready) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Page ready timeout after ${timeout}ms`));
            } else {
              setTimeout(checkReady, 100);
            }
          });
        };
        
        checkReady();
      });
    },
    
    // Simulate user command input
    simulateCommandInput: async (command) => {
      // This would typically interact with the popup UI
      // For E2E testing, we'll simulate the direct command processing
      return await mockE2ETestFramework.commandProcessor.executeNavigation(command);
    }
  }
};

describe('Simple Navigation E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock content script ready response
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.type === 'checkReady') {
        callback({ ready: true, url: 'http://example.com' });
      } else {
        callback({ success: true });
      }
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic Navigation Commands', () => {
    test('should navigate to google.com', async () => {
      const command = 'Go to google.com';
      const expectedURL = 'https://google.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
      expect(result.result.url).toBe(expectedURL);
      expect(mockE2ETestFramework.utils.verifyURL(result.result.url, expectedURL)).toBe(true);
    });
    
    test('should navigate to https://example.com', async () => {
      const command = 'Navigate to https://example.com';
      const expectedURL = 'https://example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
      expect(result.result.url).toBe(expectedURL);
    });
    
    test('should handle case insensitive commands', async () => {
      const command = 'GO TO EXAMPLE.COM';
      const expectedURL = 'https://example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
    });
  });
  
  describe('URL Validation and Normalization', () => {
    test('should add https protocol to URLs without protocol', async () => {
      const command = 'Go to example.com';
      const expectedURL = 'https://example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
    });
    
    test('should preserve existing https protocol', async () => {
      const command = 'Navigate to https://secure.example.com';
      const expectedURL = 'https://secure.example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
    });
    
    test('should handle http protocol URLs', async () => {
      const command = 'Go to http://legacy.example.com';
      const expectedURL = 'http://legacy.example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid command format', async () => {
      const command = 'Invalid command without proper format';
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Invalid navigation command format');
    });
    
    test('should reject empty command', async () => {
      const command = '';
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Invalid command: command must be a non-empty string');
    });
    
    test('should reject null command', async () => {
      const command = null;
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Invalid command: command must be a non-empty string');
    });
    
    test('should handle navigation timeout', async () => {
      const command = 'Go to example.com';
      
      // Mock navigation timeout
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([createMockTab({ id: 1, url: 'http://example.com' })]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        // Always return loading status to simulate timeout
        callback(createMockTab({ id: tabId, status: 'loading' }));
      });
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Navigation timeout after 5000ms');
    });
    
    test('should handle Chrome API errors', async () => {
      const command = 'Go to example.com';
      const error = new Error('Tab update failed');
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([createMockTab({ id: 1 })]);
      });
      
      chrome.runtime.lastError = error;
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(null);
      });
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Tab update failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete full navigation workflow', async () => {
      const command = 'Navigate to https://github.com/ray-extension';
      const expectedURL = 'https://github.com/ray-extension';
      
      // Mock complete workflow
      const initialTab = createMockTab({ id: 1, url: 'http://example.com' });
      const finalTab = createMockTab({ id: 1, url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([initialTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(finalTab);
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
      expect(result.result.originalTab).toEqual(initialTab);
      expect(result.result.updatedTab).toEqual(finalTab);
      expect(result.result.url).toBe(expectedURL);
    });
    
    test('should handle navigation to complex URLs', async () => {
      const command = 'Go to example.com/path/to/resource?query=value#fragment';
      const expectedURL = 'https://example.com/path/to/resource?query=value#fragment';
      
      // Mock successful navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
      expect(mockE2ETestFramework.utils.verifyURL(result.result.url, expectedURL)).toBe(true);
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete navigation within acceptable time', async () => {
      const command = 'Go to example.com';
      const startTime = Date.now();
      
      // Mock fast navigation
      const mockTab = createMockTab({ url: 'https://example.com', status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        setTimeout(() => callback(createMockTab({ id: tabId, ...updateProperties })), 100);
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        setTimeout(() => callback(createMockTab({ id: tabId, status: 'complete' })), 50);
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); * Simple Navigation E2E Tests
 * Tests for basic navigation automation end-to-end scenarios
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
    
    // Create new tab
    createTab: async (url) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.create({ url, active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tab);
          }
        });
      });
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process navigation command
    processNavigationCommand: async (command) => {
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
      
      return { type: 'navigate', url, originalCommand: command };
    },
    
    // Execute navigation command
    executeNavigation: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processNavigationCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Navigate to URL
      const updatedTab = await mockE2ETestFramework.browser.navigate(parsedCommand.url);
      
      // Wait for navigation to complete
      const finalTab = await mockE2ETestFramework.browser.waitForNavigation(updatedTab.id);
      
      return {
        success: true,
        command: parsedCommand,
        result: {
          originalTab: currentTab,
          updatedTab: finalTab,
          url: finalTab.url
        }
      };
    }
  },
  
  // Test utilities
  utils: {
    // Verify URL matches expected
    verifyURL: (actualURL, expectedURL) => {
      const actual = new URL(actualURL);
      const expected = new URL(expectedURL);
      
      return actual.hostname === expected.hostname && actual.pathname === expected.pathname;
    },
    
    // Wait for page to be ready
    waitForPageReady: async (tabId, timeout = 3000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkReady = () => {
          chrome.tabs.sendMessage(tabId, { type: 'checkReady' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.ready) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Page ready timeout after ${timeout}ms`));
            } else {
              setTimeout(checkReady, 100);
            }
          });
        };
        
        checkReady();
      });
    },
    
    // Simulate user command input
    simulateCommandInput: async (command) => {
      // This would typically interact with the popup UI
      // For E2E testing, we'll simulate the direct command processing
      return await mockE2ETestFramework.commandProcessor.executeNavigation(command);
    }
  }
};

describe('Simple Navigation E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock content script ready response
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      if (message.type === 'checkReady') {
        callback({ ready: true, url: 'http://example.com' });
      } else {
        callback({ success: true });
      }
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic Navigation Commands', () => {
    test('should navigate to google.com', async () => {
      const command = 'Go to google.com';
      const expectedURL = 'https://google.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
      expect(result.result.url).toBe(expectedURL);
      expect(mockE2ETestFramework.utils.verifyURL(result.result.url, expectedURL)).toBe(true);
    });
    
    test('should navigate to https://example.com', async () => {
      const command = 'Navigate to https://example.com';
      const expectedURL = 'https://example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
      expect(result.result.url).toBe(expectedURL);
    });
    
    test('should handle case insensitive commands', async () => {
      const command = 'GO TO EXAMPLE.COM';
      const expectedURL = 'https://example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
    });
  });
  
  describe('URL Validation and Normalization', () => {
    test('should add https protocol to URLs without protocol', async () => {
      const command = 'Go to example.com';
      const expectedURL = 'https://example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
    });
    
    test('should preserve existing https protocol', async () => {
      const command = 'Navigate to https://secure.example.com';
      const expectedURL = 'https://secure.example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
    });
    
    test('should handle http protocol URLs', async () => {
      const command = 'Go to http://legacy.example.com';
      const expectedURL = 'http://legacy.example.com';
      
      // Mock successful tab update and navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid command format', async () => {
      const command = 'Invalid command without proper format';
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Invalid navigation command format');
    });
    
    test('should reject empty command', async () => {
      const command = '';
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Invalid command: command must be a non-empty string');
    });
    
    test('should reject null command', async () => {
      const command = null;
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Invalid command: command must be a non-empty string');
    });
    
    test('should handle navigation timeout', async () => {
      const command = 'Go to example.com';
      
      // Mock navigation timeout
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([createMockTab({ id: 1, url: 'http://example.com' })]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        // Always return loading status to simulate timeout
        callback(createMockTab({ id: tabId, status: 'loading' }));
      });
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Navigation timeout after 5000ms');
    });
    
    test('should handle Chrome API errors', async () => {
      const command = 'Go to example.com';
      const error = new Error('Tab update failed');
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([createMockTab({ id: 1 })]);
      });
      
      chrome.runtime.lastError = error;
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(null);
      });
      
      await expect(mockE2ETestFramework.utils.simulateCommandInput(command)).rejects.toThrow('Tab update failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete full navigation workflow', async () => {
      const command = 'Navigate to https://github.com/ray-extension';
      const expectedURL = 'https://github.com/ray-extension';
      
      // Mock complete workflow
      const initialTab = createMockTab({ id: 1, url: 'http://example.com' });
      const finalTab = createMockTab({ id: 1, url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([initialTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(finalTab);
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('navigate');
      expect(result.command.url).toBe(expectedURL);
      expect(result.result.originalTab).toEqual(initialTab);
      expect(result.result.updatedTab).toEqual(finalTab);
      expect(result.result.url).toBe(expectedURL);
    });
    
    test('should handle navigation to complex URLs', async () => {
      const command = 'Go to example.com/path/to/resource?query=value#fragment';
      const expectedURL = 'https://example.com/path/to/resource?query=value#fragment';
      
      // Mock successful navigation
      const mockTab = createMockTab({ url: expectedURL, status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback(createMockTab({ id: tabId, ...updateProperties }));
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        callback(createMockTab({ id: tabId, status: 'complete' }));
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      
      expect(result.success).toBe(true);
      expect(result.command.url).toBe(expectedURL);
      expect(mockE2ETestFramework.utils.verifyURL(result.result.url, expectedURL)).toBe(true);
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete navigation within acceptable time', async () => {
      const command = 'Go to example.com';
      const startTime = Date.now();
      
      // Mock fast navigation
      const mockTab = createMockTab({ url: 'https://example.com', status: 'complete' });
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        callback([mockTab]);
      });
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        setTimeout(() => callback(createMockTab({ id: tabId, ...updateProperties })), 100);
      });
      
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        setTimeout(() => callback(createMockTab({ id: tabId, status: 'complete' })), 50);
      });
      
      const result = await mockE2ETestFramework.utils.simulateCommandInput(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
