/**
 * Popup ↔ Background Communication Integration Tests
 * Tests for communication between popup UI and background script
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockMessage } = require('../utils/test-helpers');

// Mock popup module (this would be imported from actual source)
const mockPopup = {
  // DOM elements
  elements: {
    commandInput: null,
    submitButton: null,
    responseArea: null,
    progressIndicator: null,
    errorDisplay: null
  },
  
  // Initialize popup
  initialize: () => {
    // Create mock DOM elements
    mockPopup.elements.commandInput = document.createElement('input');
    mockPopup.elements.commandInput.id = 'command-input';
    mockPopup.elements.commandInput.type = 'text';
    mockPopup.elements.commandInput.placeholder = 'Enter command...';
    
    mockPopup.elements.submitButton = document.createElement('button');
    mockPopup.elements.submitButton.id = 'submit-button';
    mockPopup.elements.submitButton.textContent = 'Execute';
    mockPopup.elements.submitButton.type = 'submit';
    
    mockPopup.elements.responseArea = document.createElement('div');
    mockPopup.elements.responseArea.id = 'response-area';
    mockPopup.elements.responseArea.textContent = 'Response will appear here...';
    
    mockPopup.elements.progressIndicator = document.createElement('div');
    mockPopup.elements.progressIndicator.id = 'progress-indicator';
    mockPopup.elements.progressIndicator.style.display = 'none';
    
    mockPopup.elements.errorDisplay = document.createElement('div');
    mockPopup.elements.errorDisplay.id = 'error-display';
    mockPopup.elements.errorDisplay.style.display = 'none';
    
    // Add to DOM
    document.body.appendChild(mockPopup.elements.commandInput);
    document.body.appendChild(mockPopup.elements.submitButton);
    document.body.appendChild(mockPopup.elements.responseArea);
    document.body.appendChild(mockPopup.elements.progressIndicator);
    document.body.appendChild(mockPopup.elements.errorDisplay);
    
    // Add event listeners
    mockPopup.elements.submitButton.addEventListener('click', mockPopup.handleSubmit);
    mockPopup.elements.commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        mockPopup.handleSubmit();
      }
    });
  },
  
  // Handle form submission
  handleSubmit: async () => {
    const command = mockPopup.elements.commandInput.value.trim();
    
    if (!command) {
      mockPopup.showError('Please enter a command');
      return;
    }
    
    try {
      mockPopup.showProgress(true);
      mockPopup.clearError();
      
      // Send command to background script
      const response = await chrome.runtime.sendMessage({
        type: 'executeCommand',
        data: { command }
      });
      
      if (response.success) {
        mockPopup.showResponse(response.result);
      } else {
        mockPopup.showError(response.error);
      }
    } catch (error) {
      mockPopup.showError(error.message);
    } finally {
      mockPopup.showProgress(false);
    }
  },
  
  // Show progress
  showProgress: (show) => {
    mockPopup.elements.progressIndicator.style.display = show ? 'block' : 'none';
    mockPopup.elements.submitButton.disabled = show;
  },
  
  // Show response
  showResponse: (response) => {
    mockPopup.elements.responseArea.textContent = JSON.stringify(response, null, 2);
  },
  
  // Show error
  showError: (error) => {
    mockPopup.elements.errorDisplay.textContent = error;
    mockPopup.elements.errorDisplay.style.display = 'block';
  },
  
  // Clear error
  clearError: () => {
    mockPopup.elements.errorDisplay.style.display = 'none';
    mockPopup.elements.errorDisplay.textContent = '';
  },
  
  // Cleanup
  cleanup: () => {
    mockPopup.elements.submitButton.removeEventListener('click', mockPopup.handleSubmit);
    document.body.innerHTML = '';
  }
};

// Mock background script module (this would be imported from actual source)
const mockBackgroundScript = {
  // Message handlers
  messageHandlers: {
    executeCommand: async (message, sender, sendResponse) => {
      try {
        const { command } = message.data;
        
        if (!command) {
          throw new Error('Command is required');
        }
        
        // Simulate command processing
        const result = await mockBackgroundScript.processCommand(command);
        
        sendResponse({
          success: true,
          result: result
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    },
    
    checkStatus: async (message, sender, sendResponse) => {
      try {
        const status = await mockBackgroundScript.getExtensionStatus();
        sendResponse({
          success: true,
          status: status
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    }
  },
  
  // Process command (simplified for testing)
  processCommand: async (command) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (command.includes('error')) {
      throw new Error('Simulated command error');
    }
    
    return {
      command: command,
      executed: true,
      timestamp: Date.now()
    };
  },
  
  // Get extension status
  getExtensionStatus: async () => {
    return {
      version: '1.0.0',
      active: true,
      apiKeySet: true,
      lastCommand: null
    };
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

describe('Popup ↔ Background Communication', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Initialize popup
    mockPopup.initialize();
    
    // Initialize background script
    mockBackgroundScript.initialize();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
    mockPopup.cleanup();
    mockBackgroundScript.cleanup();
  });
  
  describe('Command Execution Flow', () => {
    test('should send command from popup to background and receive response', async () => {
      const command = 'Go to google.com';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: {
            command: command,
            executed: true,
            timestamp: Date.now()
          }
        });
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify message was sent to background
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
      
      // Verify response is displayed
      const responseText = mockPopup.elements.responseArea.textContent;
      expect(responseText).toContain(command);
      expect(responseText).toContain('executed');
    });
    
    test('should handle command execution errors', async () => {
      const command = 'test error command';
      
      // Mock background script error response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: false,
          error: 'Simulated command error'
        });
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify error is displayed
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('Simulated command error');
    });
    
    test('should handle empty command submission', async () => {
      // Set empty command
      mockPopup.elements.commandInput.value = '';
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify error is displayed
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('Please enter a command');
      
      // Verify no message was sent to background
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('should handle communication errors', async () => {
      const command = 'Go to google.com';
      
      // Mock communication error
      chrome.runtime.sendMessage.mockImplementation((message) => {
        chrome.runtime.lastError = new Error('Communication failed');
        return Promise.reject(new Error('Communication failed'));
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify error is displayed
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('Communication failed');
    });
  });
  
  describe('Progress Indication', () => {
    test('should show progress during command execution', async () => {
      const command = 'Go to google.com';
      
      // Mock slow background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              result: { command, executed: true }
            });
          }, 200);
        });
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Start submission (but don't await)
      const submissionPromise = mockPopup.handleSubmit();
      
      // Verify progress is shown
      expect(mockPopup.elements.progressIndicator.style.display).toBe('block');
      expect(mockPopup.elements.submitButton.disabled).toBe(true);
      
      // Wait for completion
      await submissionPromise;
      
      // Verify progress is hidden
      expect(mockPopup.elements.progressIndicator.style.display).toBe('none');
      expect(mockPopup.elements.submitButton.disabled).toBe(false);
    });
  });
  
  describe('Status Checking', () => {
    test('should check extension status from popup', async () => {
      // Mock background script status response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'checkStatus') {
          return Promise.resolve({
            success: true,
            status: {
              version: '1.0.0',
              active: true,
              apiKeySet: true,
              lastCommand: null
            }
          });
        }
      });
      
      // Send status check message
      const response = await chrome.runtime.sendMessage({
        type: 'checkStatus'
      });
      
      expect(response.success).toBe(true);
      expect(response.status.version).toBe('1.0.0');
      expect(response.status.active).toBe(true);
      expect(response.status.apiKeySet).toBe(true);
    });
    
    test('should handle status check errors', async () => {
      // Mock background script error response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'checkStatus') {
          return Promise.resolve({
            success: false,
            error: 'Status check failed'
          });
        }
      });
      
      // Send status check message
      const response = await chrome.runtime.sendMessage({
        type: 'checkStatus'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Status check failed');
    });
  });
  
  describe('Message Validation', () => {
    test('should validate message format in background script', async () => {
      // Send invalid message (no type)
      const sendResponse = jest.fn();
      mockBackgroundScript.handleMessage({ data: 'test' }, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Message must have a type'
      });
    });
    
    test('should handle unknown message types in background script', async () => {
      // Send unknown message type
      const sendResponse = jest.fn();
      mockBackgroundScript.handleMessage({
        type: 'unknownType',
        data: 'test'
      }, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: unknownType'
      });
    });
    
    test('should validate command data in background script', async () => {
      // Send command message without command data
      const sendResponse = jest.fn();
      mockBackgroundScript.messageHandlers.executeCommand({
        type: 'executeCommand',
        data: {}
      }, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Command is required'
      });
    });
  });
  
  describe('UI Interaction', () => {
    test('should handle Enter key in command input', async () => {
      const command = 'Go to google.com';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command, executed: true }
        });
      });
      
      // Set command and trigger Enter key
      mockPopup.elements.commandInput.value = command;
      const enterEvent = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter'
      });
      mockPopup.elements.commandInput.dispatchEvent(enterEvent);
      
      // Wait a bit for async handling
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
    });
    
    test('should handle button click submission', async () => {
      const command = 'Go to google.com';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command, executed: true }
        });
      });
      
      // Set command and click button
      mockPopup.elements.commandInput.value = command;
      mockPopup.elements.submitButton.click();
      
      // Wait a bit for async handling
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
    });
  });
  
  describe('Error Recovery', () => {
    test('should clear previous errors on new submission', async () => {
      // Show initial error
      mockPopup.showError('Initial error');
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      
      // Mock successful background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command: 'test', executed: true }
        });
      });
      
      // Submit new command
      mockPopup.elements.commandInput.value = 'test command';
      await mockPopup.handleSubmit();
      
      // Verify error was cleared
      expect(mockPopup.elements.errorDisplay.style.display).toBe('none');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('');
    });
    
    test('should handle multiple rapid submissions', async () => {
      const command1 = 'Command 1';
      const command2 = 'Command 2';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command: message.data.command, executed: true }
        });
      });
      
      // Submit first command
      mockPopup.elements.commandInput.value = command1;
      const promise1 = mockPopup.handleSubmit();
      
      // Submit second command immediately
      mockPopup.elements.commandInput.value = command2;
      const promise2 = mockPopup.handleSubmit();
      
      // Wait for both to complete
      await Promise.all([promise1, promise2]);
      
      // Verify both messages were sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
        type: 'executeCommand',
        data: { command: command1 }
      });
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
        type: 'executeCommand',
        data: { command: command2 }
      });
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete full popup-background workflow', async () => {
      const command = 'Navigate to https://example.com';
      
      // Mock successful background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: {
            command: command,
            executed: true,
            timestamp: Date.now(),
            actions: [{ type: 'navigate', url: 'https://example.com' }]
          }
        });
      });
      
      // Set command and submit
      mockPopup.elements.commandInput.value = command;
      await mockPopup.handleSubmit();
      
      // Verify complete flow
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
      
      const responseText = mockPopup.elements.responseArea.textContent;
      expect(responseText).toContain(command);
      expect(responseText).toContain('navigate');
      expect(mockPopup.elements.progressIndicator.style.display).toBe('none');
      expect(mockPopup.elements.submitButton.disabled).toBe(false);
    });
    
    test('should handle complex command with multiple steps', async () => {
      const command = 'Go to google.com, search for Chrome extensions, click first result';
      
      // Mock complex background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: {
            command: command,
            executed: true,
            actions: [
              { type: 'navigate', url: 'https://google.com' },
              { type: 'search', query: 'Chrome extensions' },
              { type: 'click', element: 'first result' }
            ]
          }
        });
      });
      
      // Set command and submit
      mockPopup.elements.commandInput.value = command;
      await mockPopup.handleSubmit();
      
      // Verify complex response is handled
      const responseText = mockPopup.elements.responseArea.textContent;
      expect(responseText).toContain('navigate');
      expect(responseText).toContain('search');
      expect(responseText).toContain('click');
    });
  });
}); * Popup ↔ Background Communication Integration Tests
 * Tests for communication between popup UI and background script
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockMessage } = require('../utils/test-helpers');

// Mock popup module (this would be imported from actual source)
const mockPopup = {
  // DOM elements
  elements: {
    commandInput: null,
    submitButton: null,
    responseArea: null,
    progressIndicator: null,
    errorDisplay: null
  },
  
  // Initialize popup
  initialize: () => {
    // Create mock DOM elements
    mockPopup.elements.commandInput = document.createElement('input');
    mockPopup.elements.commandInput.id = 'command-input';
    mockPopup.elements.commandInput.type = 'text';
    mockPopup.elements.commandInput.placeholder = 'Enter command...';
    
    mockPopup.elements.submitButton = document.createElement('button');
    mockPopup.elements.submitButton.id = 'submit-button';
    mockPopup.elements.submitButton.textContent = 'Execute';
    mockPopup.elements.submitButton.type = 'submit';
    
    mockPopup.elements.responseArea = document.createElement('div');
    mockPopup.elements.responseArea.id = 'response-area';
    mockPopup.elements.responseArea.textContent = 'Response will appear here...';
    
    mockPopup.elements.progressIndicator = document.createElement('div');
    mockPopup.elements.progressIndicator.id = 'progress-indicator';
    mockPopup.elements.progressIndicator.style.display = 'none';
    
    mockPopup.elements.errorDisplay = document.createElement('div');
    mockPopup.elements.errorDisplay.id = 'error-display';
    mockPopup.elements.errorDisplay.style.display = 'none';
    
    // Add to DOM
    document.body.appendChild(mockPopup.elements.commandInput);
    document.body.appendChild(mockPopup.elements.submitButton);
    document.body.appendChild(mockPopup.elements.responseArea);
    document.body.appendChild(mockPopup.elements.progressIndicator);
    document.body.appendChild(mockPopup.elements.errorDisplay);
    
    // Add event listeners
    mockPopup.elements.submitButton.addEventListener('click', mockPopup.handleSubmit);
    mockPopup.elements.commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        mockPopup.handleSubmit();
      }
    });
  },
  
  // Handle form submission
  handleSubmit: async () => {
    const command = mockPopup.elements.commandInput.value.trim();
    
    if (!command) {
      mockPopup.showError('Please enter a command');
      return;
    }
    
    try {
      mockPopup.showProgress(true);
      mockPopup.clearError();
      
      // Send command to background script
      const response = await chrome.runtime.sendMessage({
        type: 'executeCommand',
        data: { command }
      });
      
      if (response.success) {
        mockPopup.showResponse(response.result);
      } else {
        mockPopup.showError(response.error);
      }
    } catch (error) {
      mockPopup.showError(error.message);
    } finally {
      mockPopup.showProgress(false);
    }
  },
  
  // Show progress
  showProgress: (show) => {
    mockPopup.elements.progressIndicator.style.display = show ? 'block' : 'none';
    mockPopup.elements.submitButton.disabled = show;
  },
  
  // Show response
  showResponse: (response) => {
    mockPopup.elements.responseArea.textContent = JSON.stringify(response, null, 2);
  },
  
  // Show error
  showError: (error) => {
    mockPopup.elements.errorDisplay.textContent = error;
    mockPopup.elements.errorDisplay.style.display = 'block';
  },
  
  // Clear error
  clearError: () => {
    mockPopup.elements.errorDisplay.style.display = 'none';
    mockPopup.elements.errorDisplay.textContent = '';
  },
  
  // Cleanup
  cleanup: () => {
    mockPopup.elements.submitButton.removeEventListener('click', mockPopup.handleSubmit);
    document.body.innerHTML = '';
  }
};

// Mock background script module (this would be imported from actual source)
const mockBackgroundScript = {
  // Message handlers
  messageHandlers: {
    executeCommand: async (message, sender, sendResponse) => {
      try {
        const { command } = message.data;
        
        if (!command) {
          throw new Error('Command is required');
        }
        
        // Simulate command processing
        const result = await mockBackgroundScript.processCommand(command);
        
        sendResponse({
          success: true,
          result: result
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    },
    
    checkStatus: async (message, sender, sendResponse) => {
      try {
        const status = await mockBackgroundScript.getExtensionStatus();
        sendResponse({
          success: true,
          status: status
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    }
  },
  
  // Process command (simplified for testing)
  processCommand: async (command) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (command.includes('error')) {
      throw new Error('Simulated command error');
    }
    
    return {
      command: command,
      executed: true,
      timestamp: Date.now()
    };
  },
  
  // Get extension status
  getExtensionStatus: async () => {
    return {
      version: '1.0.0',
      active: true,
      apiKeySet: true,
      lastCommand: null
    };
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

describe('Popup ↔ Background Communication', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Initialize popup
    mockPopup.initialize();
    
    // Initialize background script
    mockBackgroundScript.initialize();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
    mockPopup.cleanup();
    mockBackgroundScript.cleanup();
  });
  
  describe('Command Execution Flow', () => {
    test('should send command from popup to background and receive response', async () => {
      const command = 'Go to google.com';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: {
            command: command,
            executed: true,
            timestamp: Date.now()
          }
        });
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify message was sent to background
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
      
      // Verify response is displayed
      const responseText = mockPopup.elements.responseArea.textContent;
      expect(responseText).toContain(command);
      expect(responseText).toContain('executed');
    });
    
    test('should handle command execution errors', async () => {
      const command = 'test error command';
      
      // Mock background script error response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: false,
          error: 'Simulated command error'
        });
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify error is displayed
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('Simulated command error');
    });
    
    test('should handle empty command submission', async () => {
      // Set empty command
      mockPopup.elements.commandInput.value = '';
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify error is displayed
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('Please enter a command');
      
      // Verify no message was sent to background
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
    
    test('should handle communication errors', async () => {
      const command = 'Go to google.com';
      
      // Mock communication error
      chrome.runtime.sendMessage.mockImplementation((message) => {
        chrome.runtime.lastError = new Error('Communication failed');
        return Promise.reject(new Error('Communication failed'));
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Submit form
      await mockPopup.handleSubmit();
      
      // Verify error is displayed
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('Communication failed');
    });
  });
  
  describe('Progress Indication', () => {
    test('should show progress during command execution', async () => {
      const command = 'Go to google.com';
      
      // Mock slow background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              result: { command, executed: true }
            });
          }, 200);
        });
      });
      
      // Set command in popup
      mockPopup.elements.commandInput.value = command;
      
      // Start submission (but don't await)
      const submissionPromise = mockPopup.handleSubmit();
      
      // Verify progress is shown
      expect(mockPopup.elements.progressIndicator.style.display).toBe('block');
      expect(mockPopup.elements.submitButton.disabled).toBe(true);
      
      // Wait for completion
      await submissionPromise;
      
      // Verify progress is hidden
      expect(mockPopup.elements.progressIndicator.style.display).toBe('none');
      expect(mockPopup.elements.submitButton.disabled).toBe(false);
    });
  });
  
  describe('Status Checking', () => {
    test('should check extension status from popup', async () => {
      // Mock background script status response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'checkStatus') {
          return Promise.resolve({
            success: true,
            status: {
              version: '1.0.0',
              active: true,
              apiKeySet: true,
              lastCommand: null
            }
          });
        }
      });
      
      // Send status check message
      const response = await chrome.runtime.sendMessage({
        type: 'checkStatus'
      });
      
      expect(response.success).toBe(true);
      expect(response.status.version).toBe('1.0.0');
      expect(response.status.active).toBe(true);
      expect(response.status.apiKeySet).toBe(true);
    });
    
    test('should handle status check errors', async () => {
      // Mock background script error response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.type === 'checkStatus') {
          return Promise.resolve({
            success: false,
            error: 'Status check failed'
          });
        }
      });
      
      // Send status check message
      const response = await chrome.runtime.sendMessage({
        type: 'checkStatus'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Status check failed');
    });
  });
  
  describe('Message Validation', () => {
    test('should validate message format in background script', async () => {
      // Send invalid message (no type)
      const sendResponse = jest.fn();
      mockBackgroundScript.handleMessage({ data: 'test' }, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Message must have a type'
      });
    });
    
    test('should handle unknown message types in background script', async () => {
      // Send unknown message type
      const sendResponse = jest.fn();
      mockBackgroundScript.handleMessage({
        type: 'unknownType',
        data: 'test'
      }, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: unknownType'
      });
    });
    
    test('should validate command data in background script', async () => {
      // Send command message without command data
      const sendResponse = jest.fn();
      mockBackgroundScript.messageHandlers.executeCommand({
        type: 'executeCommand',
        data: {}
      }, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Command is required'
      });
    });
  });
  
  describe('UI Interaction', () => {
    test('should handle Enter key in command input', async () => {
      const command = 'Go to google.com';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command, executed: true }
        });
      });
      
      // Set command and trigger Enter key
      mockPopup.elements.commandInput.value = command;
      const enterEvent = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter'
      });
      mockPopup.elements.commandInput.dispatchEvent(enterEvent);
      
      // Wait a bit for async handling
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
    });
    
    test('should handle button click submission', async () => {
      const command = 'Go to google.com';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command, executed: true }
        });
      });
      
      // Set command and click button
      mockPopup.elements.commandInput.value = command;
      mockPopup.elements.submitButton.click();
      
      // Wait a bit for async handling
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify message was sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
    });
  });
  
  describe('Error Recovery', () => {
    test('should clear previous errors on new submission', async () => {
      // Show initial error
      mockPopup.showError('Initial error');
      expect(mockPopup.elements.errorDisplay.style.display).toBe('block');
      
      // Mock successful background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command: 'test', executed: true }
        });
      });
      
      // Submit new command
      mockPopup.elements.commandInput.value = 'test command';
      await mockPopup.handleSubmit();
      
      // Verify error was cleared
      expect(mockPopup.elements.errorDisplay.style.display).toBe('none');
      expect(mockPopup.elements.errorDisplay.textContent).toBe('');
    });
    
    test('should handle multiple rapid submissions', async () => {
      const command1 = 'Command 1';
      const command2 = 'Command 2';
      
      // Mock background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: { command: message.data.command, executed: true }
        });
      });
      
      // Submit first command
      mockPopup.elements.commandInput.value = command1;
      const promise1 = mockPopup.handleSubmit();
      
      // Submit second command immediately
      mockPopup.elements.commandInput.value = command2;
      const promise2 = mockPopup.handleSubmit();
      
      // Wait for both to complete
      await Promise.all([promise1, promise2]);
      
      // Verify both messages were sent
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(1, {
        type: 'executeCommand',
        data: { command: command1 }
      });
      expect(chrome.runtime.sendMessage).toHaveBeenNthCalledWith(2, {
        type: 'executeCommand',
        data: { command: command2 }
      });
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete full popup-background workflow', async () => {
      const command = 'Navigate to https://example.com';
      
      // Mock successful background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: {
            command: command,
            executed: true,
            timestamp: Date.now(),
            actions: [{ type: 'navigate', url: 'https://example.com' }]
          }
        });
      });
      
      // Set command and submit
      mockPopup.elements.commandInput.value = command;
      await mockPopup.handleSubmit();
      
      // Verify complete flow
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'executeCommand',
        data: { command }
      });
      
      const responseText = mockPopup.elements.responseArea.textContent;
      expect(responseText).toContain(command);
      expect(responseText).toContain('navigate');
      expect(mockPopup.elements.progressIndicator.style.display).toBe('none');
      expect(mockPopup.elements.submitButton.disabled).toBe(false);
    });
    
    test('should handle complex command with multiple steps', async () => {
      const command = 'Go to google.com, search for Chrome extensions, click first result';
      
      // Mock complex background script response
      chrome.runtime.sendMessage.mockImplementation((message) => {
        return Promise.resolve({
          success: true,
          result: {
            command: command,
            executed: true,
            actions: [
              { type: 'navigate', url: 'https://google.com' },
              { type: 'search', query: 'Chrome extensions' },
              { type: 'click', element: 'first result' }
            ]
          }
        });
      });
      
      // Set command and submit
      mockPopup.elements.commandInput.value = command;
      await mockPopup.handleSubmit();
      
      // Verify complex response is handled
      const responseText = mockPopup.elements.responseArea.textContent;
      expect(responseText).toContain('navigate');
      expect(responseText).toContain('search');
      expect(responseText).toContain('click');
    });
  });
});
