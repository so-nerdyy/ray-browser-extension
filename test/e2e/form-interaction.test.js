/**
 * Form Interaction E2E Tests
 * Tests for form filling and submission automation end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Find element in page
    findElement: async (tabId, selector) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'findElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response.element);
          } else {
            reject(new Error(`Element not found: ${selector}`));
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
    
    // Submit form
    submitForm: async (tabId, formSelector = 'form') => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'submitForm',
          data: { formSelector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to submit form: ${formSelector}`));
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
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process fill form command
    processFillCommand: async (command) => {
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
      
      return {
        type: 'fill',
        field: fieldSelector,
        value: value,
        originalCommand: command
      };
    },
    
    // Process click command
    processClickCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse click command
      const clickMatch = command.match(/(?:click|press)\s+(.+?)(?:\s|$)/i);
      if (!clickMatch) {
        throw new Error('Invalid click command format');
      }
      
      const elementSelector = clickMatch[1].trim();
      
      return {
        type: 'click',
        element: elementSelector,
        originalCommand: command
      };
    },
    
    // Process submit command
    processSubmitCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse submit command
      const submitMatch = command.match(/(?:submit|press)\s+(.+?)(?:\s|$)/i);
      if (!submitMatch) {
        throw new Error('Invalid submit command format');
      }
      
      const elementSelector = submitMatch[1].trim();
      
      return {
        type: 'submit',
        element: elementSelector,
        originalCommand: command
      };
    },
    
    // Execute fill command
    executeFill: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processFillCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Fill the field
      const fillResult = await mockE2ETestFramework.browser.fillField(
        currentTab.id,
        parsedCommand.field,
        parsedCommand.value
      );
      
      return {
        success: true,
        command: parsedCommand,
        result: fillResult
      };
    },
    
    // Execute click command
    executeClick: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processClickCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Click the element
      const clickResult = await mockE2ETestFramework.browser.clickElement(
        currentTab.id,
        parsedCommand.element
      );
      
      return {
        success: true,
        command: parsedCommand,
        result: clickResult
      };
    },
    
    // Execute submit command
    executeSubmit: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processSubmitCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Submit the form
      const submitResult = await mockE2ETestFramework.browser.submitForm(
        currentTab.id,
        parsedCommand.element
      );
      
      return {
        success: true,
        command: parsedCommand,
        result: submitResult
      };
    }
  },
  
  // Test utilities
  utils: {
    // Simulate form HTML structure
    setupFormPage: () => {
      document.body.innerHTML = `
        <form id="test-form" method="post" action="/submit">
          <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" placeholder="Enter your name">
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" placeholder="Enter your email">
          </div>
          <div class="form-group">
            <label for="message">Message:</label>
            <textarea id="message" name="message" placeholder="Enter your message"></textarea>
          </div>
          <div class="form-group">
            <button type="submit" id="submit-btn">Submit</button>
            <button type="button" id="cancel-btn">Cancel</button>
          </div>
        </form>
        <div id="result" style="display: none;">Form submitted successfully!</div>
      `;
    },
    
    // Verify field value
    verifyFieldValue: async (tabId, selector, expectedValue) => {
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'getFieldValue',
          data: { selector }
        }, resolve);
      });
      
      return response && response.value === expectedValue;
    },
    
    // Wait for form submission
    waitForFormSubmission: async (tabId, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkSubmission = () => {
          chrome.tabs.sendMessage(tabId, {
            type: 'checkFormSubmitted'
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.submitted) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Form submission timeout after ${timeout}ms`));
            } else {
              setTimeout(checkSubmission, 100);
            }
          });
        };
        
        checkSubmission();
      });
    }
  }
};

describe('Form Interaction E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock form page
    mockE2ETestFramework.utils.setupFormPage();
    
    // Mock content script responses
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      switch (message.type) {
        case 'findElement':
          const element = document.querySelector(message.data.selector);
          callback(element ? { success: true, element } : { success: false });
          break;
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
        case 'submitForm':
          const form = document.querySelector(message.data.formSelector);
          if (form) {
            form.submit();
            callback({ success: true, form: message.data.formSelector });
          } else {
            callback({ success: false });
          }
          break;
        case 'checkElementVisible':
          const element = document.querySelector(message.data.selector);
          callback({ visible: !!element && element.offsetParent !== null });
          break;
        case 'getFieldValue':
          const field = document.querySelector(message.data.selector);
          callback({ value: field ? field.value : null });
          break;
        case 'checkFormSubmitted':
          const result = document.getElementById('result');
          callback({ submitted: result && result.style.display !== 'none' });
          break;
        default:
          callback({ success: false });
      }
    });
    
    // Mock tab queries
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([createMockTab({ id: 1, url: 'http://localhost:3000/form' })]);
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic Form Filling', () => {
    test('should fill text input field', async () => {
      const command = 'Fill name field with John Doe';
      const expectedValue = 'John Doe';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('name field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#name',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
    
    test('should fill email field', async () => {
      const command = 'Fill email field with john.doe@example.com';
      const expectedValue = 'john.doe@example.com';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('email field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#email',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
    
    test('should fill textarea field', async () => {
      const command = 'Fill message field with "Hello, World!"';
      const expectedValue = 'Hello, World!';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('message field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#message',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
    
    test('should handle quoted values', async () => {
      const command = 'Fill name field with "John Doe"';
      const expectedValue = 'John Doe';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('name field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#name',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
  });
  
  describe('Form Clicking', () => {
    test('should click submit button', async () => {
      const command = 'Click submit button';
      const expectedElement = '#submit-btn';
      
      const result = await mockE2ETestFramework.commandProcessor.executeClick(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('click');
      expect(result.command.element).toBe(expectedElement);
    });
    
    test('should click cancel button', async () => {
      const command = 'Press cancel button';
      const expectedElement = '#cancel-btn';
      
      const result = await mockE2ETestFramework.commandProcessor.executeClick(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('click');
      expect(result.command.element).toBe(expectedElement);
    });
    
    test('should handle non-existent elements', async () => {
      const command = 'Click non-existent-button';
      
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'clickElement') {
          callback({ success: false }); // Element not found
        }
      });
      
      await expect(mockE2ETestFramework.commandProcessor.executeClick(command)).rejects.toThrow('Failed to click element: non-existent-button');
    });
  });
  
  describe('Form Submission', () => {
    test('should submit form by clicking submit button', async () => {
      const command = 'Submit form';
      const expectedForm = '#test-form';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSubmit(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('submit');
      expect(result.command.element).toBe(expectedForm);
    });
    
    test('should wait for form submission completion', async () => {
      const command = 'Submit form';
      
      // Mock form submission success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'submitForm') {
          // Show result message
          const result = document.getElementById('result');
          result.style.display = 'block';
          callback({ success: true, form: message.data.formSelector });
        } else if (message.type === 'checkFormSubmitted') {
          const result = document.getElementById('result');
          callback({ submitted: result.style.display !== 'none' });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeSubmit(command);
      
      // Wait for submission
      const submissionResult = await mockE2ETestFramework.utils.waitForFormSubmission(result.result.tabId);
      
      expect(submissionResult.submitted).toBe(true);
    });
  });
  
  describe('Complex Form Workflows', () => {
    test('should complete fill and submit workflow', async () => {
      const fillCommand = 'Fill name field with Jane Smith';
      const submitCommand = 'Submit form';
      
      // Execute fill command
      const fillResult = await mockE2ETestFramework.commandProcessor.executeFill(fillCommand);
      expect(fillResult.success).toBe(true);
      
      // Verify field was filled
      const nameValue = await mockE2ETestFramework.utils.verifyFieldValue(
        fillResult.result.tabId,
        '#name',
        'Jane Smith'
      );
      expect(nameValue).toBe(true);
      
      // Execute submit command
      const submitResult = await mockE2ETestFramework.commandProcessor.executeSubmit(submitCommand);
      expect(submitResult.success).toBe(true);
      
      // Wait for submission
      const submissionResult = await mockE2ETestFramework.utils.waitForFormSubmission(submitResult.result.tabId);
      expect(submissionResult.submitted).toBe(true);
    });
    
    test('should handle multi-field form filling', async () => {
      const commands = [
        'Fill name field with John Doe',
        'Fill email field with john.doe@example.com',
        'Fill message field with Test message'
      ];
      
      // Execute fill commands
      for (const command of commands) {
        const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
        expect(result.success).toBe(true);
      }
      
      // Verify all fields were filled
      const nameValue = await mockE2ETestFramework.utils.verifyFieldValue(1, '#name', 'John Doe');
      const emailValue = await mockE2ETestFramework.utils.verifyFieldValue(1, '#email', 'john.doe@example.com');
      const messageValue = await mockE2ETestFramework.utils.verifyFieldValue(1, '#message', 'Test message');
      
      expect(nameValue).toBe(true);
      expect(emailValue).toBe(true);
      expect(messageValue).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid fill command format', async () => {
      const command = 'Invalid fill command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeFill(command)).rejects.toThrow('Invalid fill command format');
    });
    
    test('should reject invalid click command format', async () => {
      const command = 'Invalid click command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeClick(command)).rejects.toThrow('Invalid click command format');
    });
    
    test('should reject invalid submit command format', async () => {
      const command = 'Invalid submit command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSubmit(command)).rejects.toThrow('Invalid submit command format');
    });
    
    test('should handle element not found errors', async () => {
      const command = 'Fill non-existent-field with value';
      
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField') {
          callback({ success: false }); // Field not found
        }
      });
      
      await expect(mockE2ETestFramework.commandProcessor.executeFill(command)).rejects.toThrow('Failed to fill field: non-existent-field');
    });
    
    test('should handle Chrome API errors', async () => {
      const command = 'Fill name field with John Doe';
      const error = new Error('Tab communication failed');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField') {
          callback(null);
        }
      });
      
      await expect(mockE2ETestFramework.commandProcessor.executeFill(command)).rejects.toThrow('Tab communication failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete form filling within acceptable time', async () => {
      const command = 'Fill name field with Test User';
      const startTime = Date.now();
      
      // Mock fast field filling
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField') {
          setTimeout(() => callback({ success: true, field: message.data.selector, value: message.data.value }), 50);
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); * Form Interaction E2E Tests
 * Tests for form filling and submission automation end-to-end scenarios
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock E2E test framework (this would be imported from actual source)
const mockE2ETestFramework = {
  // Browser automation controller
  browser: {
    // Find element in page
    findElement: async (tabId, selector) => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'findElement',
          data: { selector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response.element);
          } else {
            reject(new Error(`Element not found: ${selector}`));
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
    
    // Submit form
    submitForm: async (tabId, formSelector = 'form') => {
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'submitForm',
          data: { formSelector }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(`Failed to submit form: ${formSelector}`));
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
    }
  },
  
  // Command processor
  commandProcessor: {
    // Process fill form command
    processFillCommand: async (command) => {
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
      
      return {
        type: 'fill',
        field: fieldSelector,
        value: value,
        originalCommand: command
      };
    },
    
    // Process click command
    processClickCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse click command
      const clickMatch = command.match(/(?:click|press)\s+(.+?)(?:\s|$)/i);
      if (!clickMatch) {
        throw new Error('Invalid click command format');
      }
      
      const elementSelector = clickMatch[1].trim();
      
      return {
        type: 'click',
        element: elementSelector,
        originalCommand: command
      };
    },
    
    // Process submit command
    processSubmitCommand: async (command) => {
      if (!command || typeof command !== 'string') {
        throw new Error('Invalid command: command must be a non-empty string');
      }
      
      // Parse submit command
      const submitMatch = command.match(/(?:submit|press)\s+(.+?)(?:\s|$)/i);
      if (!submitMatch) {
        throw new Error('Invalid submit command format');
      }
      
      const elementSelector = submitMatch[1].trim();
      
      return {
        type: 'submit',
        element: elementSelector,
        originalCommand: command
      };
    },
    
    // Execute fill command
    executeFill: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processFillCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Fill the field
      const fillResult = await mockE2ETestFramework.browser.fillField(
        currentTab.id,
        parsedCommand.field,
        parsedCommand.value
      );
      
      return {
        success: true,
        command: parsedCommand,
        result: fillResult
      };
    },
    
    // Execute click command
    executeClick: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processClickCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Click the element
      const clickResult = await mockE2ETestFramework.browser.clickElement(
        currentTab.id,
        parsedCommand.element
      );
      
      return {
        success: true,
        command: parsedCommand,
        result: clickResult
      };
    },
    
    // Execute submit command
    executeSubmit: async (command) => {
      const parsedCommand = mockE2ETestFramework.commandProcessor.processSubmitCommand(command);
      
      // Get current tab
      const currentTab = await mockE2ETestFramework.browser.getCurrentTab();
      
      // Submit the form
      const submitResult = await mockE2ETestFramework.browser.submitForm(
        currentTab.id,
        parsedCommand.element
      );
      
      return {
        success: true,
        command: parsedCommand,
        result: submitResult
      };
    }
  },
  
  // Test utilities
  utils: {
    // Simulate form HTML structure
    setupFormPage: () => {
      document.body.innerHTML = `
        <form id="test-form" method="post" action="/submit">
          <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" placeholder="Enter your name">
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" placeholder="Enter your email">
          </div>
          <div class="form-group">
            <label for="message">Message:</label>
            <textarea id="message" name="message" placeholder="Enter your message"></textarea>
          </div>
          <div class="form-group">
            <button type="submit" id="submit-btn">Submit</button>
            <button type="button" id="cancel-btn">Cancel</button>
          </div>
        </form>
        <div id="result" style="display: none;">Form submitted successfully!</div>
      `;
    },
    
    // Verify field value
    verifyFieldValue: async (tabId, selector, expectedValue) => {
      const response = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'getFieldValue',
          data: { selector }
        }, resolve);
      });
      
      return response && response.value === expectedValue;
    },
    
    // Wait for form submission
    waitForFormSubmission: async (tabId, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkSubmission = () => {
          chrome.tabs.sendMessage(tabId, {
            type: 'checkFormSubmitted'
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response && response.submitted) {
              resolve(response);
            } else if (Date.now() - startTime > timeout) {
              reject(new Error(`Form submission timeout after ${timeout}ms`));
            } else {
              setTimeout(checkSubmission, 100);
            }
          });
        };
        
        checkSubmission();
      });
    }
  }
};

describe('Form Interaction E2E Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock form page
    mockE2ETestFramework.utils.setupFormPage();
    
    // Mock content script responses
    chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
      switch (message.type) {
        case 'findElement':
          const element = document.querySelector(message.data.selector);
          callback(element ? { success: true, element } : { success: false });
          break;
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
        case 'submitForm':
          const form = document.querySelector(message.data.formSelector);
          if (form) {
            form.submit();
            callback({ success: true, form: message.data.formSelector });
          } else {
            callback({ success: false });
          }
          break;
        case 'checkElementVisible':
          const element = document.querySelector(message.data.selector);
          callback({ visible: !!element && element.offsetParent !== null });
          break;
        case 'getFieldValue':
          const field = document.querySelector(message.data.selector);
          callback({ value: field ? field.value : null });
          break;
        case 'checkFormSubmitted':
          const result = document.getElementById('result');
          callback({ submitted: result && result.style.display !== 'none' });
          break;
        default:
          callback({ success: false });
      }
    });
    
    // Mock tab queries
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([createMockTab({ id: 1, url: 'http://localhost:3000/form' })]);
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Basic Form Filling', () => {
    test('should fill text input field', async () => {
      const command = 'Fill name field with John Doe';
      const expectedValue = 'John Doe';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('name field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#name',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
    
    test('should fill email field', async () => {
      const command = 'Fill email field with john.doe@example.com';
      const expectedValue = 'john.doe@example.com';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('email field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#email',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
    
    test('should fill textarea field', async () => {
      const command = 'Fill message field with "Hello, World!"';
      const expectedValue = 'Hello, World!';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('message field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#message',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
    
    test('should handle quoted values', async () => {
      const command = 'Fill name field with "John Doe"';
      const expectedValue = 'John Doe';
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('fill');
      expect(result.command.field).toBe('name field');
      expect(result.command.value).toBe(expectedValue);
      
      const fieldValue = await mockE2ETestFramework.utils.verifyFieldValue(
        result.result.tabId,
        '#name',
        expectedValue
      );
      expect(fieldValue).toBe(true);
    });
  });
  
  describe('Form Clicking', () => {
    test('should click submit button', async () => {
      const command = 'Click submit button';
      const expectedElement = '#submit-btn';
      
      const result = await mockE2ETestFramework.commandProcessor.executeClick(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('click');
      expect(result.command.element).toBe(expectedElement);
    });
    
    test('should click cancel button', async () => {
      const command = 'Press cancel button';
      const expectedElement = '#cancel-btn';
      
      const result = await mockE2ETestFramework.commandProcessor.executeClick(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('click');
      expect(result.command.element).toBe(expectedElement);
    });
    
    test('should handle non-existent elements', async () => {
      const command = 'Click non-existent-button';
      
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'clickElement') {
          callback({ success: false }); // Element not found
        }
      });
      
      await expect(mockE2ETestFramework.commandProcessor.executeClick(command)).rejects.toThrow('Failed to click element: non-existent-button');
    });
  });
  
  describe('Form Submission', () => {
    test('should submit form by clicking submit button', async () => {
      const command = 'Submit form';
      const expectedForm = '#test-form';
      
      const result = await mockE2ETestFramework.commandProcessor.executeSubmit(command);
      
      expect(result.success).toBe(true);
      expect(result.command.type).toBe('submit');
      expect(result.command.element).toBe(expectedForm);
    });
    
    test('should wait for form submission completion', async () => {
      const command = 'Submit form';
      
      // Mock form submission success
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'submitForm') {
          // Show result message
          const result = document.getElementById('result');
          result.style.display = 'block';
          callback({ success: true, form: message.data.formSelector });
        } else if (message.type === 'checkFormSubmitted') {
          const result = document.getElementById('result');
          callback({ submitted: result.style.display !== 'none' });
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeSubmit(command);
      
      // Wait for submission
      const submissionResult = await mockE2ETestFramework.utils.waitForFormSubmission(result.result.tabId);
      
      expect(submissionResult.submitted).toBe(true);
    });
  });
  
  describe('Complex Form Workflows', () => {
    test('should complete fill and submit workflow', async () => {
      const fillCommand = 'Fill name field with Jane Smith';
      const submitCommand = 'Submit form';
      
      // Execute fill command
      const fillResult = await mockE2ETestFramework.commandProcessor.executeFill(fillCommand);
      expect(fillResult.success).toBe(true);
      
      // Verify field was filled
      const nameValue = await mockE2ETestFramework.utils.verifyFieldValue(
        fillResult.result.tabId,
        '#name',
        'Jane Smith'
      );
      expect(nameValue).toBe(true);
      
      // Execute submit command
      const submitResult = await mockE2ETestFramework.commandProcessor.executeSubmit(submitCommand);
      expect(submitResult.success).toBe(true);
      
      // Wait for submission
      const submissionResult = await mockE2ETestFramework.utils.waitForFormSubmission(submitResult.result.tabId);
      expect(submissionResult.submitted).toBe(true);
    });
    
    test('should handle multi-field form filling', async () => {
      const commands = [
        'Fill name field with John Doe',
        'Fill email field with john.doe@example.com',
        'Fill message field with Test message'
      ];
      
      // Execute fill commands
      for (const command of commands) {
        const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
        expect(result.success).toBe(true);
      }
      
      // Verify all fields were filled
      const nameValue = await mockE2ETestFramework.utils.verifyFieldValue(1, '#name', 'John Doe');
      const emailValue = await mockE2ETestFramework.utils.verifyFieldValue(1, '#email', 'john.doe@example.com');
      const messageValue = await mockE2ETestFramework.utils.verifyFieldValue(1, '#message', 'Test message');
      
      expect(nameValue).toBe(true);
      expect(emailValue).toBe(true);
      expect(messageValue).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('should reject invalid fill command format', async () => {
      const command = 'Invalid fill command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeFill(command)).rejects.toThrow('Invalid fill command format');
    });
    
    test('should reject invalid click command format', async () => {
      const command = 'Invalid click command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeClick(command)).rejects.toThrow('Invalid click command format');
    });
    
    test('should reject invalid submit command format', async () => {
      const command = 'Invalid submit command';
      
      await expect(mockE2ETestFramework.commandProcessor.executeSubmit(command)).rejects.toThrow('Invalid submit command format');
    });
    
    test('should handle element not found errors', async () => {
      const command = 'Fill non-existent-field with value';
      
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField') {
          callback({ success: false }); // Field not found
        }
      });
      
      await expect(mockE2ETestFramework.commandProcessor.executeFill(command)).rejects.toThrow('Failed to fill field: non-existent-field');
    });
    
    test('should handle Chrome API errors', async () => {
      const command = 'Fill name field with John Doe';
      const error = new Error('Tab communication failed');
      
      chrome.runtime.lastError = error;
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField') {
          callback(null);
        }
      });
      
      await expect(mockE2ETestFramework.commandProcessor.executeFill(command)).rejects.toThrow('Tab communication failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Performance and Timing', () => {
    test('should complete form filling within acceptable time', async () => {
      const command = 'Fill name field with Test User';
      const startTime = Date.now();
      
      // Mock fast field filling
      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        if (message.type === 'fillField') {
          setTimeout(() => callback({ success: true, field: message.data.selector, value: message.data.value }), 50);
        }
      });
      
      const result = await mockE2ETestFramework.commandProcessor.executeFill(command);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
