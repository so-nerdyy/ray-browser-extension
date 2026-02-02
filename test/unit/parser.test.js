/**
 * Command Parser Unit Tests
 * Tests for natural language command parsing and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { generateTestCommand, setupTest, teardownTest } = require('../utils/test-helpers');

// Mock command parser module (this would be imported from the actual source)
const mockCommandParser = {
  // Parse natural language commands into structured actions
  parseCommand: (command) => {
    if (!command || typeof command !== 'string' || command.trim() === '') {
      throw new Error('Invalid command: Command must be a non-empty string');
    }
    
    const trimmedCommand = command.trim().toLowerCase();
    
    // Navigation commands
    if (trimmedCommand.startsWith('go to') || trimmedCommand.startsWith('navigate to')) {
      const urlMatch = trimmedCommand.match(/(?:go to|navigate to)\s+(.+?)(?:\s|$)/);
      if (urlMatch) {
        let url = urlMatch[1];
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        return {
          type: 'navigate',
          url: url,
          originalCommand: command
        };
      }
    }
    
    // Search commands
    if (trimmedCommand.startsWith('search for') || trimmedCommand.startsWith('find')) {
      const searchMatch = trimmedCommand.match(/(?:search for|find)\s+(.+?)(?:\s|$)/);
      if (searchMatch) {
        return {
          type: 'search',
          query: searchMatch[1],
          originalCommand: command
        };
      }
    }
    
    // Fill form commands
    if (trimmedCommand.includes('fill') && trimmedCommand.includes('with')) {
      const fieldMatch = trimmedCommand.match(/fill\s+(.+?)\s+with\s+(.+?)(?:\s|$)/);
      if (fieldMatch) {
        return {
          type: 'fill',
          field: fieldMatch[1],
          value: fieldMatch[2],
          originalCommand: command
        };
      }
    }
    
    // Click commands
    if (trimmedCommand.startsWith('click') || trimmedCommand.startsWith('press')) {
      const elementMatch = trimmedCommand.match(/(?:click|press)\s+(.+?)(?:\s|$)/);
      if (elementMatch) {
        return {
          type: 'click',
          element: elementMatch[1],
          originalCommand: command
        };
      }
    }
    
    // Multi-step commands
    if (trimmedCommand.includes(',') || trimmedCommand.includes(' then ')) {
      const steps = trimmedCommand.split(/,|\s+then\s+/).map(step => step.trim()).filter(step => step);
      const parsedSteps = steps.map(step => {
        try {
          return mockCommandParser.parseCommand(step);
        } catch (error) {
          return null;
        }
      }).filter(step => step !== null);
      
      if (parsedSteps.length > 1) {
        return {
          type: 'multi-step',
          steps: parsedSteps,
          originalCommand: command
        };
      }
    }
    
    // Default case - treat as unknown command
    return {
      type: 'unknown',
      command: trimmedCommand,
      originalCommand: command
    };
  },
  
  // Validate parsed command
  validateCommand: (parsedCommand) => {
    if (!parsedCommand || typeof parsedCommand !== 'object') {
      return { valid: false, errors: ['Command must be an object'] };
    }
    
    if (!parsedCommand.type) {
      return { valid: false, errors: ['Command must have a type'] };
    }
    
    const validTypes = ['navigate', 'search', 'fill', 'click', 'multi-step', 'unknown'];
    if (!validTypes.includes(parsedCommand.type)) {
      return { valid: false, errors: [`Invalid command type: ${parsedCommand.type}`] };
    }
    
    const errors = [];
    
    switch (parsedCommand.type) {
      case 'navigate':
        if (!parsedCommand.url) {
          errors.push('Navigate command must have a URL');
        } else if (!parsedCommand.url.match(/^https?:\/\/.+/)) {
          errors.push('Navigate command must have a valid URL with protocol');
        }
        break;
        
      case 'search':
        if (!parsedCommand.query) {
          errors.push('Search command must have a query');
        }
        break;
        
      case 'fill':
        if (!parsedCommand.field) {
          errors.push('Fill command must have a field name');
        }
        if (!parsedCommand.value) {
          errors.push('Fill command must have a value');
        }
        break;
        
      case 'click':
        if (!parsedCommand.element) {
          errors.push('Click command must have an element');
        }
        break;
        
      case 'multi-step':
        if (!parsedCommand.steps || !Array.isArray(parsedCommand.steps)) {
          errors.push('Multi-step command must have steps array');
        } else if (parsedCommand.steps.length < 2) {
          errors.push('Multi-step command must have at least 2 steps');
        } else {
          // Validate each step
          parsedCommand.steps.forEach((step, index) => {
            const stepValidation = mockCommandParser.validateCommand(step);
            if (!stepValidation.valid) {
              errors.push(`Step ${index + 1}: ${stepValidation.errors.join(', ')}`);
            }
          });
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
};

describe('Command Parser', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('parseCommand', () => {
    test('should parse navigation commands correctly', () => {
      const command = 'Go to google.com';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('navigate');
      expect(result.url).toBe('https://google.com');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse navigation commands with https protocol', () => {
      const command = 'Navigate to https://example.com';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('navigate');
      expect(result.url).toBe('https://example.com');
    });
    
    test('should parse search commands correctly', () => {
      const command = 'Search for Chrome extensions';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('search');
      expect(result.query).toBe('Chrome extensions');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse fill commands correctly', () => {
      const command = 'Fill name field with John Doe';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('fill');
      expect(result.field).toBe('name field');
      expect(result.value).toBe('John Doe');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse click commands correctly', () => {
      const command = 'Click the submit button';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('click');
      expect(result.element).toBe('the submit button');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse multi-step commands correctly', () => {
      const command = 'Go to google.com, search for Chrome extensions';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('multi-step');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].type).toBe('navigate');
      expect(result.steps[1].type).toBe('search');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse multi-step commands with "then"', () => {
      const command = 'Go to google.com then search for Chrome extensions';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('multi-step');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].type).toBe('navigate');
      expect(result.steps[1].type).toBe('search');
    });
    
    test('should handle unknown commands', () => {
      const command = 'Do something random';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('unknown');
      expect(result.command).toBe('do something random');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should reject empty commands', () => {
      expect(() => mockCommandParser.parseCommand('')).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should reject null commands', () => {
      expect(() => mockCommandParser.parseCommand(null)).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should reject undefined commands', () => {
      expect(() => mockCommandParser.parseCommand(undefined)).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should reject non-string commands', () => {
      expect(() => mockCommandParser.parseCommand(123)).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should handle whitespace-only commands', () => {
      expect(() => mockCommandParser.parseCommand('   ')).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should handle case insensitive commands', () => {
      const command = 'GO TO GOOGLE.COM';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('navigate');
      expect(result.url).toBe('https://google.com');
    });
  });
  
  describe('validateCommand', () => {
    test('should validate correct navigate commands', () => {
      const command = {
        type: 'navigate',
        url: 'https://example.com',
        originalCommand: 'Go to example.com'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject navigate commands without URL', () => {
      const command = {
        type: 'navigate',
        originalCommand: 'Go to'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Navigate command must have a URL');
    });
    
    test('should reject navigate commands with invalid URL', () => {
      const command = {
        type: 'navigate',
        url: 'invalid-url',
        originalCommand: 'Go to invalid-url'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Navigate command must have a valid URL with protocol');
    });
    
    test('should validate correct search commands', () => {
      const command = {
        type: 'search',
        query: 'test query',
        originalCommand: 'Search for test query'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject search commands without query', () => {
      const command = {
        type: 'search',
        originalCommand: 'Search for'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Search command must have a query');
    });
    
    test('should validate correct fill commands', () => {
      const command = {
        type: 'fill',
        field: 'name',
        value: 'John Doe',
        originalCommand: 'Fill name with John Doe'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject fill commands without field', () => {
      const command = {
        type: 'fill',
        value: 'John Doe',
        originalCommand: 'Fill with John Doe'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Fill command must have a field name');
    });
    
    test('should reject fill commands without value', () => {
      const command = {
        type: 'fill',
        field: 'name',
        originalCommand: 'Fill name'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Fill command must have a value');
    });
    
    test('should validate correct click commands', () => {
      const command = {
        type: 'click',
        element: 'submit button',
        originalCommand: 'Click submit button'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject click commands without element', () => {
      const command = {
        type: 'click',
        originalCommand: 'Click'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Click command must have an element');
    });
    
    test('should validate correct multi-step commands', () => {
      const command = {
        type: 'multi-step',
        steps: [
          {
            type: 'navigate',
            url: 'https://google.com',
            originalCommand: 'Go to google.com'
          },
          {
            type: 'search',
            query: 'test',
            originalCommand: 'Search for test'
          }
        ],
        originalCommand: 'Go to google.com, search for test'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject multi-step commands with less than 2 steps', () => {
      const command = {
        type: 'multi-step',
        steps: [
          {
            type: 'navigate',
            url: 'https://google.com',
            originalCommand: 'Go to google.com'
          }
        ],
        originalCommand: 'Go to google.com'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Multi-step command must have at least 2 steps');
    });
    
    test('should reject commands without type', () => {
      const command = {
        url: 'https://google.com',
        originalCommand: 'Go to google.com'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command must have a type');
    });
    
    test('should reject commands with invalid type', () => {
      const command = {
        type: 'invalid-type',
        originalCommand: 'Invalid command'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid command type: invalid-type');
    });
  });
  
  describe('Integration scenarios', () => {
    test('should parse and validate complete workflow', () => {
      const command = 'Go to nytimes.com, find first article title, copy it';
      const parsed = mockCommandParser.parseCommand(command);
      const validated = mockCommandParser.validateCommand(parsed);
      
      expect(parsed.type).toBe('multi-step');
      expect(parsed.steps).toHaveLength(3);
      expect(validated.valid).toBe(true);
    });
    
    test('should handle complex multi-step commands', () => {
      const command = 'Go to google.com then search for Chrome extensions then click first result';
      const parsed = mockCommandParser.parseCommand(command);
      const validated = mockCommandParser.validateCommand(parsed);
      
      expect(parsed.type).toBe('multi-step');
      expect(parsed.steps).toHaveLength(3);
      expect(validated.valid).toBe(true);
    });
  });
}); * Command Parser Unit Tests
 * Tests for natural language command parsing and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { generateTestCommand, setupTest, teardownTest } = require('../utils/test-helpers');

// Mock command parser module (this would be imported from the actual source)
const mockCommandParser = {
  // Parse natural language commands into structured actions
  parseCommand: (command) => {
    if (!command || typeof command !== 'string' || command.trim() === '') {
      throw new Error('Invalid command: Command must be a non-empty string');
    }
    
    const trimmedCommand = command.trim().toLowerCase();
    
    // Navigation commands
    if (trimmedCommand.startsWith('go to') || trimmedCommand.startsWith('navigate to')) {
      const urlMatch = trimmedCommand.match(/(?:go to|navigate to)\s+(.+?)(?:\s|$)/);
      if (urlMatch) {
        let url = urlMatch[1];
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        return {
          type: 'navigate',
          url: url,
          originalCommand: command
        };
      }
    }
    
    // Search commands
    if (trimmedCommand.startsWith('search for') || trimmedCommand.startsWith('find')) {
      const searchMatch = trimmedCommand.match(/(?:search for|find)\s+(.+?)(?:\s|$)/);
      if (searchMatch) {
        return {
          type: 'search',
          query: searchMatch[1],
          originalCommand: command
        };
      }
    }
    
    // Fill form commands
    if (trimmedCommand.includes('fill') && trimmedCommand.includes('with')) {
      const fieldMatch = trimmedCommand.match(/fill\s+(.+?)\s+with\s+(.+?)(?:\s|$)/);
      if (fieldMatch) {
        return {
          type: 'fill',
          field: fieldMatch[1],
          value: fieldMatch[2],
          originalCommand: command
        };
      }
    }
    
    // Click commands
    if (trimmedCommand.startsWith('click') || trimmedCommand.startsWith('press')) {
      const elementMatch = trimmedCommand.match(/(?:click|press)\s+(.+?)(?:\s|$)/);
      if (elementMatch) {
        return {
          type: 'click',
          element: elementMatch[1],
          originalCommand: command
        };
      }
    }
    
    // Multi-step commands
    if (trimmedCommand.includes(',') || trimmedCommand.includes(' then ')) {
      const steps = trimmedCommand.split(/,|\s+then\s+/).map(step => step.trim()).filter(step => step);
      const parsedSteps = steps.map(step => {
        try {
          return mockCommandParser.parseCommand(step);
        } catch (error) {
          return null;
        }
      }).filter(step => step !== null);
      
      if (parsedSteps.length > 1) {
        return {
          type: 'multi-step',
          steps: parsedSteps,
          originalCommand: command
        };
      }
    }
    
    // Default case - treat as unknown command
    return {
      type: 'unknown',
      command: trimmedCommand,
      originalCommand: command
    };
  },
  
  // Validate parsed command
  validateCommand: (parsedCommand) => {
    if (!parsedCommand || typeof parsedCommand !== 'object') {
      return { valid: false, errors: ['Command must be an object'] };
    }
    
    if (!parsedCommand.type) {
      return { valid: false, errors: ['Command must have a type'] };
    }
    
    const validTypes = ['navigate', 'search', 'fill', 'click', 'multi-step', 'unknown'];
    if (!validTypes.includes(parsedCommand.type)) {
      return { valid: false, errors: [`Invalid command type: ${parsedCommand.type}`] };
    }
    
    const errors = [];
    
    switch (parsedCommand.type) {
      case 'navigate':
        if (!parsedCommand.url) {
          errors.push('Navigate command must have a URL');
        } else if (!parsedCommand.url.match(/^https?:\/\/.+/)) {
          errors.push('Navigate command must have a valid URL with protocol');
        }
        break;
        
      case 'search':
        if (!parsedCommand.query) {
          errors.push('Search command must have a query');
        }
        break;
        
      case 'fill':
        if (!parsedCommand.field) {
          errors.push('Fill command must have a field name');
        }
        if (!parsedCommand.value) {
          errors.push('Fill command must have a value');
        }
        break;
        
      case 'click':
        if (!parsedCommand.element) {
          errors.push('Click command must have an element');
        }
        break;
        
      case 'multi-step':
        if (!parsedCommand.steps || !Array.isArray(parsedCommand.steps)) {
          errors.push('Multi-step command must have steps array');
        } else if (parsedCommand.steps.length < 2) {
          errors.push('Multi-step command must have at least 2 steps');
        } else {
          // Validate each step
          parsedCommand.steps.forEach((step, index) => {
            const stepValidation = mockCommandParser.validateCommand(step);
            if (!stepValidation.valid) {
              errors.push(`Step ${index + 1}: ${stepValidation.errors.join(', ')}`);
            }
          });
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
};

describe('Command Parser', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('parseCommand', () => {
    test('should parse navigation commands correctly', () => {
      const command = 'Go to google.com';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('navigate');
      expect(result.url).toBe('https://google.com');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse navigation commands with https protocol', () => {
      const command = 'Navigate to https://example.com';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('navigate');
      expect(result.url).toBe('https://example.com');
    });
    
    test('should parse search commands correctly', () => {
      const command = 'Search for Chrome extensions';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('search');
      expect(result.query).toBe('Chrome extensions');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse fill commands correctly', () => {
      const command = 'Fill name field with John Doe';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('fill');
      expect(result.field).toBe('name field');
      expect(result.value).toBe('John Doe');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse click commands correctly', () => {
      const command = 'Click the submit button';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('click');
      expect(result.element).toBe('the submit button');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse multi-step commands correctly', () => {
      const command = 'Go to google.com, search for Chrome extensions';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('multi-step');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].type).toBe('navigate');
      expect(result.steps[1].type).toBe('search');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should parse multi-step commands with "then"', () => {
      const command = 'Go to google.com then search for Chrome extensions';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('multi-step');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].type).toBe('navigate');
      expect(result.steps[1].type).toBe('search');
    });
    
    test('should handle unknown commands', () => {
      const command = 'Do something random';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('unknown');
      expect(result.command).toBe('do something random');
      expect(result.originalCommand).toBe(command);
    });
    
    test('should reject empty commands', () => {
      expect(() => mockCommandParser.parseCommand('')).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should reject null commands', () => {
      expect(() => mockCommandParser.parseCommand(null)).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should reject undefined commands', () => {
      expect(() => mockCommandParser.parseCommand(undefined)).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should reject non-string commands', () => {
      expect(() => mockCommandParser.parseCommand(123)).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should handle whitespace-only commands', () => {
      expect(() => mockCommandParser.parseCommand('   ')).toThrow('Invalid command: Command must be a non-empty string');
    });
    
    test('should handle case insensitive commands', () => {
      const command = 'GO TO GOOGLE.COM';
      const result = mockCommandParser.parseCommand(command);
      
      expect(result.type).toBe('navigate');
      expect(result.url).toBe('https://google.com');
    });
  });
  
  describe('validateCommand', () => {
    test('should validate correct navigate commands', () => {
      const command = {
        type: 'navigate',
        url: 'https://example.com',
        originalCommand: 'Go to example.com'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject navigate commands without URL', () => {
      const command = {
        type: 'navigate',
        originalCommand: 'Go to'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Navigate command must have a URL');
    });
    
    test('should reject navigate commands with invalid URL', () => {
      const command = {
        type: 'navigate',
        url: 'invalid-url',
        originalCommand: 'Go to invalid-url'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Navigate command must have a valid URL with protocol');
    });
    
    test('should validate correct search commands', () => {
      const command = {
        type: 'search',
        query: 'test query',
        originalCommand: 'Search for test query'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject search commands without query', () => {
      const command = {
        type: 'search',
        originalCommand: 'Search for'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Search command must have a query');
    });
    
    test('should validate correct fill commands', () => {
      const command = {
        type: 'fill',
        field: 'name',
        value: 'John Doe',
        originalCommand: 'Fill name with John Doe'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject fill commands without field', () => {
      const command = {
        type: 'fill',
        value: 'John Doe',
        originalCommand: 'Fill with John Doe'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Fill command must have a field name');
    });
    
    test('should reject fill commands without value', () => {
      const command = {
        type: 'fill',
        field: 'name',
        originalCommand: 'Fill name'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Fill command must have a value');
    });
    
    test('should validate correct click commands', () => {
      const command = {
        type: 'click',
        element: 'submit button',
        originalCommand: 'Click submit button'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject click commands without element', () => {
      const command = {
        type: 'click',
        originalCommand: 'Click'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Click command must have an element');
    });
    
    test('should validate correct multi-step commands', () => {
      const command = {
        type: 'multi-step',
        steps: [
          {
            type: 'navigate',
            url: 'https://google.com',
            originalCommand: 'Go to google.com'
          },
          {
            type: 'search',
            query: 'test',
            originalCommand: 'Search for test'
          }
        ],
        originalCommand: 'Go to google.com, search for test'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should reject multi-step commands with less than 2 steps', () => {
      const command = {
        type: 'multi-step',
        steps: [
          {
            type: 'navigate',
            url: 'https://google.com',
            originalCommand: 'Go to google.com'
          }
        ],
        originalCommand: 'Go to google.com'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Multi-step command must have at least 2 steps');
    });
    
    test('should reject commands without type', () => {
      const command = {
        url: 'https://google.com',
        originalCommand: 'Go to google.com'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command must have a type');
    });
    
    test('should reject commands with invalid type', () => {
      const command = {
        type: 'invalid-type',
        originalCommand: 'Invalid command'
      };
      
      const result = mockCommandParser.validateCommand(command);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid command type: invalid-type');
    });
  });
  
  describe('Integration scenarios', () => {
    test('should parse and validate complete workflow', () => {
      const command = 'Go to nytimes.com, find first article title, copy it';
      const parsed = mockCommandParser.parseCommand(command);
      const validated = mockCommandParser.validateCommand(parsed);
      
      expect(parsed.type).toBe('multi-step');
      expect(parsed.steps).toHaveLength(3);
      expect(validated.valid).toBe(true);
    });
    
    test('should handle complex multi-step commands', () => {
      const command = 'Go to google.com then search for Chrome extensions then click first result';
      const parsed = mockCommandParser.parseCommand(command);
      const validated = mockCommandParser.validateCommand(parsed);
      
      expect(parsed.type).toBe('multi-step');
      expect(parsed.steps).toHaveLength(3);
      expect(validated.valid).toBe(true);
    });
  });
});
