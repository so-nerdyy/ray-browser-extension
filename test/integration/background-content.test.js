/**
 * Background ↔ Content Script Integration Tests
 * Tests for communication between background script and content scripts
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockMessage } = require('../utils/test-helpers');

// Mock background script module (this would be imported from actual source)
const mockBackgroundScript = {
  // Message handlers
  messageHandlers: {
    executeCommand: async (message, sender, sendResponse) => {
      try {
        const { command, tabId } = message.data;
        
        if (!command) {
          throw new Error('Command is required');
        }
        
        if (!tabId) {
          throw new Error('Tab ID is required');
        }
        
        // Send command to content script
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'executeAction',
          data: { command }
        });
        
        sendResponse({
          success: true,
          result: response
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    },
    
    injectContentScript: async (message, sender, sendResponse) => {
      try {
        const { tabId } = message.data;
        
        if (!tabId) {
          throw new Error('Tab ID is required');
        }
        
        // Inject content script
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        });
        
        sendResponse({
          success: true,
          injected: results.length > 0
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    },
    
    checkContentScript: async (message, sender, sendResponse) => {
      try {
        const { tabId } = message.data;
        
        if (!tabId) {
          throw new Error('Tab ID is required');
        }
        
        // Check if content script is ready by sending a ping
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'ping'
        });
        
        sendResponse({
          success: true,
          contentScriptReady: response.success
        });
      } catch (error) {
        sendResponse({
          success: true,
          contentScriptReady: false
        });
      }
    }
  },
  
  // Main message handler
  handleMessage: (message, sender, sendResponse) => {
    if (!message || !message.type) {
      sendResponse({ success: false, error: 'Message must have a type' });
      return;
    }
    
    const handler = mockBackgroundScript.messageHandlers[message.type];
    if (!handler) {
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      return;
    }
    
    handler(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  },
  
  // Initialize background script
  initialize: () => {
    chrome.runtime.onMessage.addListener(mockBackgroundScript.handleMessage);
  },
  
  // Cleanup
  cleanup: () => {
    chrome.runtime.onMessage.removeListener(mockBackgroundScript.handleMessage);
  }
};

// Mock content script module (this would be imported from actual source)
const mockContentScript = {
  // Message handlers
  messageHandlers: {
    executeAction: async (message, sender, sendResponse) => {
      try {
        const { command } = message.data;
        
        if (!command) {
          throw new Error('Command is required');
        }
        
        // Execute the action (simplified for testing)
        let result;
        switch (command.type) {
          case 'navigate':
            window.location.href = command.url;
            result = { success: true, url: command.url };
            break;
          case 'click':
            const element = document.querySelector(command.element);
            if (element) {
              element.click();
              result = { success: true, element: command.element };
            } else {
              result = { success: false, error: 'Element not found' };
            }
            break;
          case 'fill':
            const field = document.querySelector(command.field);
            if (field) {
              field.value = command.value;
              result = { success: true, field: command.field, value: command.value };
            } else {
              result = { success: false, error: 'Field not found' };
            }
            break;
          default:
            result = { success: false, error: 'Unknown command type' };
        }
        
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    },
    
    ping: async (message, sender, sendResponse) => {
      sendResponse({ success: true, message: 'pong' });
    }
  },
  
  // Main message handler
  handleMessage: (message, sender, sendResponse) => {
    if (!message || !message.type) {
      sendResponse({ success: false, error: 'Message must have a type' });
      return;
    }
    
    const handler = mockContentScript.messageHandlers[message.type];
    if (!handler) {
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      return;
    }
    
    handler(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  },
  
  // Initialize content script
  initialize: () => {
    chrome.runtime.onMessage.addListener(mockContentScript.handleMessage);
    
    // Notify background script that content script is ready
    chrome.runtime.sendMessage({ type: 'contentScriptReady' });
  },
  
  // Cleanup
  cleanup: () => {
    chrome.runtime.onMessage.removeListener(mockContentScript.handleMessage);
  }
};

describe('Background ↔ Content Script Integration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up basic DOM structure
    document.body.innerHTML = `
      <button id="test-button">Click me</button>
      <input type="text" id="test-input" placeholder="Test input">
      <form id="test-form">
        <input type="text" name="username" id="username">
        <button type="submit">Submit</button>
      </form>
    `;
    
    // Mock window.location
    delete window.location;
    window.location = { href: 'http://example.com' };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Message Communication', () => {
    test('should send command from background to content script', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#test-button' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock content script response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: true, element: '#test-button' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        {
          type: 'executeAction',
          data: { command }
        },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: true, element: '#test-button' }
      });
    });
    
    test('should handle content script response errors', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#non-existent' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock content script error response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: false, error: 'Element not found' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: false, error: 'Element not found' }
      });
    });
    
    test('should handle missing command in executeCommand', async () => {
      const tabId = 123;
      const message = createMockMessage('executeCommand', { tabId });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Command is required'
      });
    });
    
    test('should handle missing tab ID in executeCommand', async () => {
      const command = { type: 'click', element: '#test-button' };
      const message = createMockMessage('executeCommand', { command });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Tab ID is required'
      });
    });
  });
  
  describe('Content Script Injection', () => {
    test('should inject content script successfully', async () => {
      const tabId = 123;
      const message = createMockMessage('injectContentScript', { tabId });
      
      // Mock successful script injection
      chrome.scripting.executeScript.mockImplementation((details) => {
        return Promise.resolve([{ result: 'success' }]);
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.injectContentScript(message, {}, sendResponse);
      
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId },
        files: ['content-script.js']
      });
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        injected: true
      });
    });
    
    test('should handle script injection failures', async () => {
      const tabId = 123;
      const message = createMockMessage('injectContentScript', { tabId });
      
      // Mock failed script injection
      chrome.scripting.executeScript.mockImplementation((details) => {
        return Promise.reject(new Error('Script injection failed'));
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.injectContentScript(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Script injection failed'
      });
    });
    
    test('should handle missing tab ID in injectContentScript', async () => {
      const message = createMockMessage('injectContentScript', {});
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.injectContentScript(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Tab ID is required'
      });
    });
  });
  
  describe('Content Script Status Check', () => {
    test('should detect content script is ready', async () => {
      const tabId = 123;
      const message = createMockMessage('checkContentScript', { tabId });
      
      // Mock content script ping response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: true, message: 'pong' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.checkContentScript(message, {}, sendResponse);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        { type: 'ping' },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        contentScriptReady: true
      });
    });
    
    test('should detect content script is not ready', async () => {
      const tabId = 123;
      const message = createMockMessage('checkContentScript', { tabId });
      
      // Mock content script ping failure
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        chrome.runtime.lastError = new Error('Could not establish connection');
        callback();
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.checkContentScript(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        contentScriptReady: false
      });
    });
  });
  
  describe('Content Script Message Handling', () => {
    test('should handle executeAction message', async () => {
      const command = { type: 'fill', field: '#test-input', value: 'test value' };
      const message = createMockMessage('executeAction', { command });
      
      const sendResponse = jest.fn();
      await mockContentScript.messageHandlers.executeAction(message, {}, sendResponse);
      
      expect(document.querySelector('#test-input').value).toBe('test value');
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        field: '#test-input',
        value: 'test value'
      });
    });
    
    test('should handle ping message', async () => {
      const message = createMockMessage('ping', {});
      
      const sendResponse = jest.fn();
      await mockContentScript.messageHandlers.ping(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        message: 'pong'
      });
    });
    
    test('should handle unknown message type', async () => {
      const message = createMockMessage('unknownType', {});
      
      const sendResponse = jest.fn();
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: unknownType'
      });
    });
  });
  
  describe('End-to-End Communication', () => {
    test('should complete full command execution flow', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#test-button' };
      
      // Initialize content script
      mockContentScript.initialize();
      
      // Mock content script response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        // Simulate content script handling the message
        if (msg.type === 'executeAction') {
          const element = document.querySelector('#test-button');
          element.click();
          callback({ success: true, element: '#test-button' });
        } else if (msg.type === 'ping') {
          callback({ success: true, message: 'pong' });
        }
      });
      
      // Send command from background to content script
      const message = createMockMessage('executeCommand', { command, tabId });
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: true, element: '#test-button' }
      });
    });
    
    test('should handle multi-step command execution', async () => {
      const tabId = 123;
      const commands = [
        { type: 'fill', field: '#test-input', value: 'test user' },
        { type: 'click', element: '#test-button' }
      ];
      
      // Initialize content script
      mockContentScript.initialize();
      
      // Mock content script responses
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        if (msg.type === 'executeAction') {
          const command = msg.data.command;
          let result;
          
          if (command.type === 'fill') {
            const field = document.querySelector(command.field);
            field.value = command.value;
            result = { success: true, field: command.field, value: command.value };
          } else if (command.type === 'click') {
            const element = document.querySelector(command.element);
            element.click();
            result = { success: true, element: command.element };
          }
          
          callback(result);
        }
      });
      
      // Execute each command
      for (const command of commands) {
        const message = createMockMessage('executeCommand', { command, tabId });
        const sendResponse = jest.fn();
        await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
        
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          result: expect.objectContaining({ success: true })
        });
      }
      
      // Verify final state
      expect(document.querySelector('#test-input').value).toBe('test user');
    });
  });
  
  describe('Error Handling and Recovery', () => {
    test('should handle content script communication failures', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#test-button' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock communication failure
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        chrome.runtime.lastError = new Error('Receiving end does not exist');
        callback();
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Receiving end does not exist'
      });
    });
    
    test('should handle content script execution errors', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#non-existent' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock content script error response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: false, error: 'Element not found: #non-existent' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: false, error: 'Element not found: #non-existent' }
      });
    });
  });
  
  describe('Initialization and Cleanup', () => {
    test('should initialize background script', () => {
      mockBackgroundScript.initialize();
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockBackgroundScript.handleMessage);
    });
    
    test('should initialize content script', () => {
      mockContentScript.initialize();
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'contentScriptReady'
      });
    });
    
    test('should cleanup background script', () => {
      mockBackgroundScript.cleanup();
      
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockBackgroundScript.handleMessage);
    });
    
    test('should cleanup content script', () => {
      mockContentScript.cleanup();
      
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
    });
  });
}); * Background ↔ Content Script Integration Tests
 * Tests for communication between background script and content scripts
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockMessage } = require('../utils/test-helpers');

// Mock background script module (this would be imported from actual source)
const mockBackgroundScript = {
  // Message handlers
  messageHandlers: {
    executeCommand: async (message, sender, sendResponse) => {
      try {
        const { command, tabId } = message.data;
        
        if (!command) {
          throw new Error('Command is required');
        }
        
        if (!tabId) {
          throw new Error('Tab ID is required');
        }
        
        // Send command to content script
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'executeAction',
          data: { command }
        });
        
        sendResponse({
          success: true,
          result: response
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    },
    
    injectContentScript: async (message, sender, sendResponse) => {
      try {
        const { tabId } = message.data;
        
        if (!tabId) {
          throw new Error('Tab ID is required');
        }
        
        // Inject content script
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        });
        
        sendResponse({
          success: true,
          injected: results.length > 0
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    },
    
    checkContentScript: async (message, sender, sendResponse) => {
      try {
        const { tabId } = message.data;
        
        if (!tabId) {
          throw new Error('Tab ID is required');
        }
        
        // Check if content script is ready by sending a ping
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'ping'
        });
        
        sendResponse({
          success: true,
          contentScriptReady: response.success
        });
      } catch (error) {
        sendResponse({
          success: true,
          contentScriptReady: false
        });
      }
    }
  },
  
  // Main message handler
  handleMessage: (message, sender, sendResponse) => {
    if (!message || !message.type) {
      sendResponse({ success: false, error: 'Message must have a type' });
      return;
    }
    
    const handler = mockBackgroundScript.messageHandlers[message.type];
    if (!handler) {
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      return;
    }
    
    handler(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  },
  
  // Initialize background script
  initialize: () => {
    chrome.runtime.onMessage.addListener(mockBackgroundScript.handleMessage);
  },
  
  // Cleanup
  cleanup: () => {
    chrome.runtime.onMessage.removeListener(mockBackgroundScript.handleMessage);
  }
};

// Mock content script module (this would be imported from actual source)
const mockContentScript = {
  // Message handlers
  messageHandlers: {
    executeAction: async (message, sender, sendResponse) => {
      try {
        const { command } = message.data;
        
        if (!command) {
          throw new Error('Command is required');
        }
        
        // Execute the action (simplified for testing)
        let result;
        switch (command.type) {
          case 'navigate':
            window.location.href = command.url;
            result = { success: true, url: command.url };
            break;
          case 'click':
            const element = document.querySelector(command.element);
            if (element) {
              element.click();
              result = { success: true, element: command.element };
            } else {
              result = { success: false, error: 'Element not found' };
            }
            break;
          case 'fill':
            const field = document.querySelector(command.field);
            if (field) {
              field.value = command.value;
              result = { success: true, field: command.field, value: command.value };
            } else {
              result = { success: false, error: 'Field not found' };
            }
            break;
          default:
            result = { success: false, error: 'Unknown command type' };
        }
        
        sendResponse(result);
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    },
    
    ping: async (message, sender, sendResponse) => {
      sendResponse({ success: true, message: 'pong' });
    }
  },
  
  // Main message handler
  handleMessage: (message, sender, sendResponse) => {
    if (!message || !message.type) {
      sendResponse({ success: false, error: 'Message must have a type' });
      return;
    }
    
    const handler = mockContentScript.messageHandlers[message.type];
    if (!handler) {
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      return;
    }
    
    handler(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  },
  
  // Initialize content script
  initialize: () => {
    chrome.runtime.onMessage.addListener(mockContentScript.handleMessage);
    
    // Notify background script that content script is ready
    chrome.runtime.sendMessage({ type: 'contentScriptReady' });
  },
  
  // Cleanup
  cleanup: () => {
    chrome.runtime.onMessage.removeListener(mockContentScript.handleMessage);
  }
};

describe('Background ↔ Content Script Integration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Set up basic DOM structure
    document.body.innerHTML = `
      <button id="test-button">Click me</button>
      <input type="text" id="test-input" placeholder="Test input">
      <form id="test-form">
        <input type="text" name="username" id="username">
        <button type="submit">Submit</button>
      </form>
    `;
    
    // Mock window.location
    delete window.location;
    window.location = { href: 'http://example.com' };
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Message Communication', () => {
    test('should send command from background to content script', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#test-button' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock content script response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: true, element: '#test-button' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        {
          type: 'executeAction',
          data: { command }
        },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: true, element: '#test-button' }
      });
    });
    
    test('should handle content script response errors', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#non-existent' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock content script error response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: false, error: 'Element not found' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: false, error: 'Element not found' }
      });
    });
    
    test('should handle missing command in executeCommand', async () => {
      const tabId = 123;
      const message = createMockMessage('executeCommand', { tabId });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Command is required'
      });
    });
    
    test('should handle missing tab ID in executeCommand', async () => {
      const command = { type: 'click', element: '#test-button' };
      const message = createMockMessage('executeCommand', { command });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Tab ID is required'
      });
    });
  });
  
  describe('Content Script Injection', () => {
    test('should inject content script successfully', async () => {
      const tabId = 123;
      const message = createMockMessage('injectContentScript', { tabId });
      
      // Mock successful script injection
      chrome.scripting.executeScript.mockImplementation((details) => {
        return Promise.resolve([{ result: 'success' }]);
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.injectContentScript(message, {}, sendResponse);
      
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId },
        files: ['content-script.js']
      });
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        injected: true
      });
    });
    
    test('should handle script injection failures', async () => {
      const tabId = 123;
      const message = createMockMessage('injectContentScript', { tabId });
      
      // Mock failed script injection
      chrome.scripting.executeScript.mockImplementation((details) => {
        return Promise.reject(new Error('Script injection failed'));
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.injectContentScript(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Script injection failed'
      });
    });
    
    test('should handle missing tab ID in injectContentScript', async () => {
      const message = createMockMessage('injectContentScript', {});
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.injectContentScript(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Tab ID is required'
      });
    });
  });
  
  describe('Content Script Status Check', () => {
    test('should detect content script is ready', async () => {
      const tabId = 123;
      const message = createMockMessage('checkContentScript', { tabId });
      
      // Mock content script ping response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: true, message: 'pong' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.checkContentScript(message, {}, sendResponse);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        { type: 'ping' },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        contentScriptReady: true
      });
    });
    
    test('should detect content script is not ready', async () => {
      const tabId = 123;
      const message = createMockMessage('checkContentScript', { tabId });
      
      // Mock content script ping failure
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        chrome.runtime.lastError = new Error('Could not establish connection');
        callback();
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.checkContentScript(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        contentScriptReady: false
      });
    });
  });
  
  describe('Content Script Message Handling', () => {
    test('should handle executeAction message', async () => {
      const command = { type: 'fill', field: '#test-input', value: 'test value' };
      const message = createMockMessage('executeAction', { command });
      
      const sendResponse = jest.fn();
      await mockContentScript.messageHandlers.executeAction(message, {}, sendResponse);
      
      expect(document.querySelector('#test-input').value).toBe('test value');
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        field: '#test-input',
        value: 'test value'
      });
    });
    
    test('should handle ping message', async () => {
      const message = createMockMessage('ping', {});
      
      const sendResponse = jest.fn();
      await mockContentScript.messageHandlers.ping(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        message: 'pong'
      });
    });
    
    test('should handle unknown message type', async () => {
      const message = createMockMessage('unknownType', {});
      
      const sendResponse = jest.fn();
      await mockContentScript.handleMessage(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: unknownType'
      });
    });
  });
  
  describe('End-to-End Communication', () => {
    test('should complete full command execution flow', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#test-button' };
      
      // Initialize content script
      mockContentScript.initialize();
      
      // Mock content script response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        // Simulate content script handling the message
        if (msg.type === 'executeAction') {
          const element = document.querySelector('#test-button');
          element.click();
          callback({ success: true, element: '#test-button' });
        } else if (msg.type === 'ping') {
          callback({ success: true, message: 'pong' });
        }
      });
      
      // Send command from background to content script
      const message = createMockMessage('executeCommand', { command, tabId });
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: true, element: '#test-button' }
      });
    });
    
    test('should handle multi-step command execution', async () => {
      const tabId = 123;
      const commands = [
        { type: 'fill', field: '#test-input', value: 'test user' },
        { type: 'click', element: '#test-button' }
      ];
      
      // Initialize content script
      mockContentScript.initialize();
      
      // Mock content script responses
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        if (msg.type === 'executeAction') {
          const command = msg.data.command;
          let result;
          
          if (command.type === 'fill') {
            const field = document.querySelector(command.field);
            field.value = command.value;
            result = { success: true, field: command.field, value: command.value };
          } else if (command.type === 'click') {
            const element = document.querySelector(command.element);
            element.click();
            result = { success: true, element: command.element };
          }
          
          callback(result);
        }
      });
      
      // Execute each command
      for (const command of commands) {
        const message = createMockMessage('executeCommand', { command, tabId });
        const sendResponse = jest.fn();
        await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
        
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          result: expect.objectContaining({ success: true })
        });
      }
      
      // Verify final state
      expect(document.querySelector('#test-input').value).toBe('test user');
    });
  });
  
  describe('Error Handling and Recovery', () => {
    test('should handle content script communication failures', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#test-button' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock communication failure
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        chrome.runtime.lastError = new Error('Receiving end does not exist');
        callback();
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Receiving end does not exist'
      });
    });
    
    test('should handle content script execution errors', async () => {
      const tabId = 123;
      const command = { type: 'click', element: '#non-existent' };
      const message = createMockMessage('executeCommand', { command, tabId });
      
      // Mock content script error response
      chrome.tabs.sendMessage.mockImplementation((id, msg, callback) => {
        callback({ success: false, error: 'Element not found: #non-existent' });
      });
      
      const sendResponse = jest.fn();
      await mockBackgroundScript.messageHandlers.executeCommand(message, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: false, error: 'Element not found: #non-existent' }
      });
    });
  });
  
  describe('Initialization and Cleanup', () => {
    test('should initialize background script', () => {
      mockBackgroundScript.initialize();
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockBackgroundScript.handleMessage);
    });
    
    test('should initialize content script', () => {
      mockContentScript.initialize();
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'contentScriptReady'
      });
    });
    
    test('should cleanup background script', () => {
      mockBackgroundScript.cleanup();
      
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockBackgroundScript.handleMessage);
    });
    
    test('should cleanup content script', () => {
      mockContentScript.cleanup();
      
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(mockContentScript.handleMessage);
    });
  });
});
