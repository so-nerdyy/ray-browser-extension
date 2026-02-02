/**
 * Chrome Extension Permissions Integration Tests
 * Tests for permission handling and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockMessage } = require('../utils/test-helpers');

// Mock permission manager module (this would be imported from actual source)
const mockPermissionManager = {
  // Required permissions for the extension
  requiredPermissions: {
    permissions: ['activeTab', 'storage', 'scripting', 'tabs'],
    origins: ['https://openrouter.ai/*']
  },
  
  // Optional permissions
  optionalPermissions: {
    permissions: ['background', 'notifications'],
    origins: ['<all_urls>']
  },
  
  // Check if permissions are granted
  hasPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.contains(permissions, (hasPermissions) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(hasPermissions);
        }
      });
    });
  },
  
  // Request permissions
  requestPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.request(permissions, (granted) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(granted);
        }
      });
    });
  },
  
  // Get all current permissions
  getAllPermissions: async () => {
    return new Promise((resolve, reject) => {
      chrome.permissions.getAll((permissions) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(permissions);
        }
      });
    });
  },
  
  // Remove permissions
  removePermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.remove(permissions, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  },
  
  // Validate required permissions
  validateRequiredPermissions: async () => {
    const hasRequired = await mockPermissionManager.hasPermissions(mockPermissionManager.requiredPermissions);
    
    const missing = {
      permissions: [],
      origins: []
    };
    
    if (!hasRequired.permissions) {
      missing.permissions = mockPermissionManager.requiredPermissions.permissions.filter(
        perm => !hasRequired.permissions.includes(perm)
      );
    }
    
    if (!hasRequired.origins) {
      missing.origins = mockPermissionManager.requiredPermissions.origins.filter(
        origin => !hasRequired.origins.includes(origin)
      );
    }
    
    return {
      valid: missing.permissions.length === 0 && missing.origins.length === 0,
      missing: missing
    };
  },
  
  // Request optional permissions with user interaction
  requestOptionalPermissions: async (optionalPermissions = null) => {
    const permissionsToRequest = optionalPermissions || mockPermissionManager.optionalPermissions;
    
    try {
      const granted = await mockPermissionManager.requestPermissions(permissionsToRequest);
      return {
        success: true,
        granted: granted,
        requested: permissionsToRequest
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requested: permissionsToRequest
      };
    }
  },
  
  // Check if specific API is available
  isAPIAvailable: (apiName) => {
    switch (apiName) {
      case 'scripting':
        return chrome.scripting !== undefined;
      case 'tabs':
        return chrome.tabs !== undefined;
      case 'storage':
        return chrome.storage !== undefined;
      case 'permissions':
        return chrome.permissions !== undefined;
      case 'runtime':
        return chrome.runtime !== undefined;
      case 'action':
        return chrome.action !== undefined;
      default:
        return false;
    }
  },
  
  // Get permission status summary
  getPermissionStatus: async () => {
    const allPermissions = await mockPermissionManager.getAllPermissions();
    const requiredValidation = await mockPermissionManager.validateRequiredPermissions();
    
    return {
      all: allPermissions,
      required: {
        permissions: mockPermissionManager.requiredPermissions.permissions,
        origins: mockPermissionManager.requiredPermissions.origins,
        valid: requiredValidation.valid,
        missing: requiredValidation.missing
      },
      optional: {
        permissions: mockPermissionManager.optionalPermissions.permissions,
        origins: mockPermissionManager.optionalPermissions.origins
      },
      apis: {
        scripting: mockPermissionManager.isAPIAvailable('scripting'),
        tabs: mockPermissionManager.isAPIAvailable('tabs'),
        storage: mockPermissionManager.isAPIAvailable('storage'),
        permissions: mockPermissionManager.isAPIAvailable('permissions'),
        runtime: mockPermissionManager.isAPIAvailable('runtime'),
        action: mockPermissionManager.isAPIAvailable('action')
      }
    };
  }
};

describe('Permission Handling', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Permission Checking', () => {
    test('should check if permissions are granted', async () => {
      const permissions = { permissions: ['activeTab', 'storage'] };
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.hasPermissions(permissions);
      
      expect(result).toBe(true);
      expect(chrome.permissions.contains).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should check if permissions are not granted', async () => {
      const permissions = { permissions: ['activeTab', 'storage'] };
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback(false);
      });
      
      const result = await mockPermissionManager.hasPermissions(permissions);
      
      expect(result).toBe(false);
      expect(chrome.permissions.contains).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission check errors', async () => {
      const permissions = { permissions: ['activeTab'] };
      const error = new Error('Permission check failed');
      
      chrome.runtime.lastError = error;
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.hasPermissions(permissions)).rejects.toThrow('Permission check failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Permission Requesting', () => {
    test('should request permissions successfully', async () => {
      const permissions = { permissions: ['notifications'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.requestPermissions(permissions);
      
      expect(result).toBe(true);
      expect(chrome.permissions.request).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission request denial', async () => {
      const permissions = { permissions: ['notifications'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(false);
      });
      
      const result = await mockPermissionManager.requestPermissions(permissions);
      
      expect(result).toBe(false);
      expect(chrome.permissions.request).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission request errors', async () => {
      const permissions = { permissions: ['notifications'] };
      const error = new Error('Permission request failed');
      
      chrome.runtime.lastError = error;
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.requestPermissions(permissions)).rejects.toThrow('Permission request failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Required Permission Validation', () => {
    test('should validate all required permissions are granted', async () => {
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        // All required permissions are granted
        callback(true);
      });
      
      const result = await mockPermissionManager.validateRequiredPermissions();
      
      expect(result.valid).toBe(true);
      expect(result.missing.permissions).toHaveLength(0);
      expect(result.missing.origins).toHaveLength(0);
    });
    
    test('should identify missing required permissions', async () => {
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        // Only some permissions are granted
        if (perms.permissions && perms.permissions.includes('activeTab')) {
          callback(true);
        } else if (perms.origins && perms.origins.includes('https://openrouter.ai/*')) {
          callback(false);
        } else {
          callback(false);
        }
      });
      
      const result = await mockPermissionManager.validateRequiredPermissions();
      
      expect(result.valid).toBe(false);
      expect(result.missing.permissions.length).toBeGreaterThan(0);
      expect(result.missing.origins.length).toBeGreaterThan(0);
    });
  });
  
  describe('Optional Permission Handling', () => {
    test('should request optional permissions successfully', async () => {
      const optionalPermissions = { permissions: ['background'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.requestOptionalPermissions(optionalPermissions);
      
      expect(result.success).toBe(true);
      expect(result.granted).toBe(true);
      expect(result.requested).toEqual(optionalPermissions);
    });
    
    test('should handle optional permission request denial', async () => {
      const optionalPermissions = { permissions: ['background'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(false);
      });
      
      const result = await mockPermissionManager.requestOptionalPermissions(optionalPermissions);
      
      expect(result.success).toBe(false);
      expect(result.granted).toBe(false);
      expect(result.requested).toEqual(optionalPermissions);
    });
    
    test('should request default optional permissions', async () => {
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.requestOptionalPermissions();
      
      expect(result.success).toBe(true);
      expect(result.granted).toBe(true);
      expect(result.requested).toEqual(mockPermissionManager.optionalPermissions);
    });
  });
  
  describe('Permission Removal', () => {
    test('should remove permissions successfully', async () => {
      const permissions = { permissions: ['notifications'] };
      
      chrome.permissions.remove.mockImplementation((perms, callback) => {
        callback();
      });
      
      const result = await mockPermissionManager.removePermissions(permissions);
      
      expect(result).toBe(true);
      expect(chrome.permissions.remove).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission removal errors', async () => {
      const permissions = { permissions: ['notifications'] };
      const error = new Error('Permission removal failed');
      
      chrome.runtime.lastError = error;
      chrome.permissions.remove.mockImplementation((perms, callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.removePermissions(permissions)).rejects.toThrow('Permission removal failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('API Availability Checking', () => {
    test('should check API availability for scripting', () => {
      // Mock available API
      global.chrome = { ...chrome, scripting: {} };
      
      expect(mockPermissionManager.isAPIAvailable('scripting')).toBe(true);
      
      // Mock unavailable API
      delete chrome.scripting;
      expect(mockPermissionManager.isAPIAvailable('scripting')).toBe(false);
    });
    
    test('should check API availability for tabs', () => {
      expect(mockPermissionManager.isAPIAvailable('tabs')).toBe(true);
    });
    
    test('should check API availability for storage', () => {
      expect(mockPermissionManager.isAPIAvailable('storage')).toBe(true);
    });
    
    test('should check API availability for unknown API', () => {
      expect(mockPermissionManager.isAPIAvailable('unknown')).toBe(false);
    });
  });
  
  describe('Permission Status Summary', () => {
    test('should get comprehensive permission status', async () => {
      const mockAllPermissions = {
        permissions: ['activeTab', 'storage', 'scripting', 'tabs', 'notifications'],
        origins: ['https://openrouter.ai/*', '<all_urls>']
      };
      
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback(mockAllPermissions);
      });
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        // All required permissions are granted
        callback(true);
      });
      
      const status = await mockPermissionManager.getPermissionStatus();
      
      expect(status.all).toEqual(mockAllPermissions);
      expect(status.required.permissions).toEqual(mockPermissionManager.requiredPermissions.permissions);
      expect(status.required.origins).toEqual(mockPermissionManager.requiredPermissions.origins);
      expect(status.required.valid).toBe(true);
      expect(status.optional.permissions).toEqual(mockPermissionManager.optionalPermissions.permissions);
      expect(status.optional.origins).toEqual(mockPermissionManager.optionalPermissions.origins);
      
      // Check API availability
      expect(status.apis.scripting).toBe(true);
      expect(status.apis.tabs).toBe(true);
      expect(status.apis.storage).toBe(true);
      expect(status.apis.permissions).toBe(true);
      expect(status.apis.runtime).toBe(true);
      expect(status.apis.action).toBe(true);
    });
    
    test('should handle permission status errors', async () => {
      const error = new Error('Failed to get permissions');
      
      chrome.runtime.lastError = error;
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.getPermissionStatus()).rejects.toThrow('Failed to get permissions');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Permission Event Handling', () => {
    test('should handle permission added events', () => {
      const listener = jest.fn();
      
      chrome.permissions.onAdded.addListener(listener);
      
      // Simulate permission added event
      const addedPermissions = { permissions: ['notifications'] };
      chrome.permissions.onAdded.mock.calls[0][0](addedPermissions);
      
      expect(listener).toHaveBeenCalledWith(addedPermissions);
      
      chrome.permissions.onAdded.removeListener(listener);
    });
    
    test('should handle permission removed events', () => {
      const listener = jest.fn();
      
      chrome.permissions.onRemoved.addListener(listener);
      
      // Simulate permission removed event
      const removedPermissions = { permissions: ['notifications'] };
      chrome.permissions.onRemoved.mock.calls[0][0](removedPermissions);
      
      expect(listener).toHaveBeenCalledWith(removedPermissions);
      
      chrome.permissions.onRemoved.removeListener(listener);
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete permission request workflow', async () => {
      // Mock initial state - missing permissions
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions && perms.permissions.includes('scripting')) {
          callback(false); // scripting permission missing
        } else {
          callback(true);
        }
      });
      
      // Mock permission request success
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      // Check initial state
      const validation = await mockPermissionManager.validateRequiredPermissions();
      expect(validation.valid).toBe(false);
      expect(validation.missing.permissions).toContain('scripting');
      
      // Request missing permission
      const requestResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['scripting']
      });
      
      expect(requestResult.success).toBe(true);
      expect(requestResult.granted).toBe(true);
      
      // Verify permission is now granted
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback(true); // Now all permissions are granted
      });
      
      const finalValidation = await mockPermissionManager.validateRequiredPermissions();
      expect(finalValidation.valid).toBe(true);
    });
    
    test('should handle permission request denial and fallback', async () => {
      // Mock initial state - missing optional permissions
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions && perms.permissions.includes('notifications')) {
          callback(false); // notifications permission missing
        } else {
          callback(true);
        }
      });
      
      // Mock permission request denial
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(false); // User denied permission
      });
      
      // Check initial state
      const validation = await mockPermissionManager.validateRequiredPermissions();
      expect(validation.valid).toBe(true); // Required permissions are fine
      
      // Request optional permission
      const requestResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['notifications']
      });
      
      expect(requestResult.success).toBe(false);
      expect(requestResult.granted).toBe(false);
      
      // Verify permission is still not granted
      const hasNotifications = await mockPermissionManager.hasPermissions({
        permissions: ['notifications']
      });
      expect(hasNotifications).toBe(false);
    });
    
    test('should handle complex permission scenarios', async () => {
      // Mock complex permission state
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: ['activeTab', 'storage'], // Missing scripting, tabs
          origins: ['https://openrouter.ai/*'] // Has required origins
        });
      });
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions) {
          const hasAllPerms = perms.permissions.every(perm => 
            ['activeTab', 'storage'].includes(perm)
          );
          callback(hasAllPerms);
        } else {
          callback(true);
        }
      });
      
      // Mock partial permission request success
      chrome.permissions.request.mockImplementation((perms, callback) => {
        if (perms.permissions && perms.permissions.includes('scripting')) {
          callback(true); // Grant scripting
        } else if (perms.permissions && perms.permissions.includes('tabs')) {
          callback(false); // Deny tabs
        } else {
          callback(true);
        }
      });
      
      const status = await mockPermissionManager.getPermissionStatus();
      
      expect(status.required.valid).toBe(false);
      expect(status.required.missing.permissions).toContain('scripting');
      expect(status.required.missing.permissions).toContain('tabs');
      
      // Request scripting permission
      const scriptingResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['scripting']
      });
      expect(scriptingResult.success).toBe(true);
      
      // Request tabs permission (denied)
      const tabsResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['tabs']
      });
      expect(tabsResult.success).toBe(false);
      
      // Final status - scripting granted, tabs still missing
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions) {
          const hasAllPerms = perms.permissions.every(perm => 
            ['activeTab', 'storage', 'scripting'].includes(perm)
          );
          callback(hasAllPerms);
        } else {
          callback(true);
        }
      });
      
      const finalStatus = await mockPermissionManager.getPermissionStatus();
      expect(finalStatus.apis.scripting).toBe(true);
      expect(finalStatus.required.missing.permissions).not.toContain('scripting');
      expect(finalStatus.required.missing.permissions).toContain('tabs');
    });
  });
}); * Chrome Extension Permissions Integration Tests
 * Tests for permission handling and validation
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockMessage } = require('../utils/test-helpers');

// Mock permission manager module (this would be imported from actual source)
const mockPermissionManager = {
  // Required permissions for the extension
  requiredPermissions: {
    permissions: ['activeTab', 'storage', 'scripting', 'tabs'],
    origins: ['https://openrouter.ai/*']
  },
  
  // Optional permissions
  optionalPermissions: {
    permissions: ['background', 'notifications'],
    origins: ['<all_urls>']
  },
  
  // Check if permissions are granted
  hasPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.contains(permissions, (hasPermissions) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(hasPermissions);
        }
      });
    });
  },
  
  // Request permissions
  requestPermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.request(permissions, (granted) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(granted);
        }
      });
    });
  },
  
  // Get all current permissions
  getAllPermissions: async () => {
    return new Promise((resolve, reject) => {
      chrome.permissions.getAll((permissions) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(permissions);
        }
      });
    });
  },
  
  // Remove permissions
  removePermissions: async (permissions) => {
    return new Promise((resolve, reject) => {
      chrome.permissions.remove(permissions, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  },
  
  // Validate required permissions
  validateRequiredPermissions: async () => {
    const hasRequired = await mockPermissionManager.hasPermissions(mockPermissionManager.requiredPermissions);
    
    const missing = {
      permissions: [],
      origins: []
    };
    
    if (!hasRequired.permissions) {
      missing.permissions = mockPermissionManager.requiredPermissions.permissions.filter(
        perm => !hasRequired.permissions.includes(perm)
      );
    }
    
    if (!hasRequired.origins) {
      missing.origins = mockPermissionManager.requiredPermissions.origins.filter(
        origin => !hasRequired.origins.includes(origin)
      );
    }
    
    return {
      valid: missing.permissions.length === 0 && missing.origins.length === 0,
      missing: missing
    };
  },
  
  // Request optional permissions with user interaction
  requestOptionalPermissions: async (optionalPermissions = null) => {
    const permissionsToRequest = optionalPermissions || mockPermissionManager.optionalPermissions;
    
    try {
      const granted = await mockPermissionManager.requestPermissions(permissionsToRequest);
      return {
        success: true,
        granted: granted,
        requested: permissionsToRequest
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requested: permissionsToRequest
      };
    }
  },
  
  // Check if specific API is available
  isAPIAvailable: (apiName) => {
    switch (apiName) {
      case 'scripting':
        return chrome.scripting !== undefined;
      case 'tabs':
        return chrome.tabs !== undefined;
      case 'storage':
        return chrome.storage !== undefined;
      case 'permissions':
        return chrome.permissions !== undefined;
      case 'runtime':
        return chrome.runtime !== undefined;
      case 'action':
        return chrome.action !== undefined;
      default:
        return false;
    }
  },
  
  // Get permission status summary
  getPermissionStatus: async () => {
    const allPermissions = await mockPermissionManager.getAllPermissions();
    const requiredValidation = await mockPermissionManager.validateRequiredPermissions();
    
    return {
      all: allPermissions,
      required: {
        permissions: mockPermissionManager.requiredPermissions.permissions,
        origins: mockPermissionManager.requiredPermissions.origins,
        valid: requiredValidation.valid,
        missing: requiredValidation.missing
      },
      optional: {
        permissions: mockPermissionManager.optionalPermissions.permissions,
        origins: mockPermissionManager.optionalPermissions.origins
      },
      apis: {
        scripting: mockPermissionManager.isAPIAvailable('scripting'),
        tabs: mockPermissionManager.isAPIAvailable('tabs'),
        storage: mockPermissionManager.isAPIAvailable('storage'),
        permissions: mockPermissionManager.isAPIAvailable('permissions'),
        runtime: mockPermissionManager.isAPIAvailable('runtime'),
        action: mockPermissionManager.isAPIAvailable('action')
      }
    };
  }
};

describe('Permission Handling', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Permission Checking', () => {
    test('should check if permissions are granted', async () => {
      const permissions = { permissions: ['activeTab', 'storage'] };
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.hasPermissions(permissions);
      
      expect(result).toBe(true);
      expect(chrome.permissions.contains).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should check if permissions are not granted', async () => {
      const permissions = { permissions: ['activeTab', 'storage'] };
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback(false);
      });
      
      const result = await mockPermissionManager.hasPermissions(permissions);
      
      expect(result).toBe(false);
      expect(chrome.permissions.contains).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission check errors', async () => {
      const permissions = { permissions: ['activeTab'] };
      const error = new Error('Permission check failed');
      
      chrome.runtime.lastError = error;
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.hasPermissions(permissions)).rejects.toThrow('Permission check failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Permission Requesting', () => {
    test('should request permissions successfully', async () => {
      const permissions = { permissions: ['notifications'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.requestPermissions(permissions);
      
      expect(result).toBe(true);
      expect(chrome.permissions.request).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission request denial', async () => {
      const permissions = { permissions: ['notifications'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(false);
      });
      
      const result = await mockPermissionManager.requestPermissions(permissions);
      
      expect(result).toBe(false);
      expect(chrome.permissions.request).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission request errors', async () => {
      const permissions = { permissions: ['notifications'] };
      const error = new Error('Permission request failed');
      
      chrome.runtime.lastError = error;
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.requestPermissions(permissions)).rejects.toThrow('Permission request failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Required Permission Validation', () => {
    test('should validate all required permissions are granted', async () => {
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        // All required permissions are granted
        callback(true);
      });
      
      const result = await mockPermissionManager.validateRequiredPermissions();
      
      expect(result.valid).toBe(true);
      expect(result.missing.permissions).toHaveLength(0);
      expect(result.missing.origins).toHaveLength(0);
    });
    
    test('should identify missing required permissions', async () => {
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        // Only some permissions are granted
        if (perms.permissions && perms.permissions.includes('activeTab')) {
          callback(true);
        } else if (perms.origins && perms.origins.includes('https://openrouter.ai/*')) {
          callback(false);
        } else {
          callback(false);
        }
      });
      
      const result = await mockPermissionManager.validateRequiredPermissions();
      
      expect(result.valid).toBe(false);
      expect(result.missing.permissions.length).toBeGreaterThan(0);
      expect(result.missing.origins.length).toBeGreaterThan(0);
    });
  });
  
  describe('Optional Permission Handling', () => {
    test('should request optional permissions successfully', async () => {
      const optionalPermissions = { permissions: ['background'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.requestOptionalPermissions(optionalPermissions);
      
      expect(result.success).toBe(true);
      expect(result.granted).toBe(true);
      expect(result.requested).toEqual(optionalPermissions);
    });
    
    test('should handle optional permission request denial', async () => {
      const optionalPermissions = { permissions: ['background'] };
      
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(false);
      });
      
      const result = await mockPermissionManager.requestOptionalPermissions(optionalPermissions);
      
      expect(result.success).toBe(false);
      expect(result.granted).toBe(false);
      expect(result.requested).toEqual(optionalPermissions);
    });
    
    test('should request default optional permissions', async () => {
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      const result = await mockPermissionManager.requestOptionalPermissions();
      
      expect(result.success).toBe(true);
      expect(result.granted).toBe(true);
      expect(result.requested).toEqual(mockPermissionManager.optionalPermissions);
    });
  });
  
  describe('Permission Removal', () => {
    test('should remove permissions successfully', async () => {
      const permissions = { permissions: ['notifications'] };
      
      chrome.permissions.remove.mockImplementation((perms, callback) => {
        callback();
      });
      
      const result = await mockPermissionManager.removePermissions(permissions);
      
      expect(result).toBe(true);
      expect(chrome.permissions.remove).toHaveBeenCalledWith(permissions, expect.any(Function));
    });
    
    test('should handle permission removal errors', async () => {
      const permissions = { permissions: ['notifications'] };
      const error = new Error('Permission removal failed');
      
      chrome.runtime.lastError = error;
      chrome.permissions.remove.mockImplementation((perms, callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.removePermissions(permissions)).rejects.toThrow('Permission removal failed');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('API Availability Checking', () => {
    test('should check API availability for scripting', () => {
      // Mock available API
      global.chrome = { ...chrome, scripting: {} };
      
      expect(mockPermissionManager.isAPIAvailable('scripting')).toBe(true);
      
      // Mock unavailable API
      delete chrome.scripting;
      expect(mockPermissionManager.isAPIAvailable('scripting')).toBe(false);
    });
    
    test('should check API availability for tabs', () => {
      expect(mockPermissionManager.isAPIAvailable('tabs')).toBe(true);
    });
    
    test('should check API availability for storage', () => {
      expect(mockPermissionManager.isAPIAvailable('storage')).toBe(true);
    });
    
    test('should check API availability for unknown API', () => {
      expect(mockPermissionManager.isAPIAvailable('unknown')).toBe(false);
    });
  });
  
  describe('Permission Status Summary', () => {
    test('should get comprehensive permission status', async () => {
      const mockAllPermissions = {
        permissions: ['activeTab', 'storage', 'scripting', 'tabs', 'notifications'],
        origins: ['https://openrouter.ai/*', '<all_urls>']
      };
      
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback(mockAllPermissions);
      });
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        // All required permissions are granted
        callback(true);
      });
      
      const status = await mockPermissionManager.getPermissionStatus();
      
      expect(status.all).toEqual(mockAllPermissions);
      expect(status.required.permissions).toEqual(mockPermissionManager.requiredPermissions.permissions);
      expect(status.required.origins).toEqual(mockPermissionManager.requiredPermissions.origins);
      expect(status.required.valid).toBe(true);
      expect(status.optional.permissions).toEqual(mockPermissionManager.optionalPermissions.permissions);
      expect(status.optional.origins).toEqual(mockPermissionManager.optionalPermissions.origins);
      
      // Check API availability
      expect(status.apis.scripting).toBe(true);
      expect(status.apis.tabs).toBe(true);
      expect(status.apis.storage).toBe(true);
      expect(status.apis.permissions).toBe(true);
      expect(status.apis.runtime).toBe(true);
      expect(status.apis.action).toBe(true);
    });
    
    test('should handle permission status errors', async () => {
      const error = new Error('Failed to get permissions');
      
      chrome.runtime.lastError = error;
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback();
      });
      
      await expect(mockPermissionManager.getPermissionStatus()).rejects.toThrow('Failed to get permissions');
      
      // Reset lastError
      chrome.runtime.lastError = null;
    });
  });
  
  describe('Permission Event Handling', () => {
    test('should handle permission added events', () => {
      const listener = jest.fn();
      
      chrome.permissions.onAdded.addListener(listener);
      
      // Simulate permission added event
      const addedPermissions = { permissions: ['notifications'] };
      chrome.permissions.onAdded.mock.calls[0][0](addedPermissions);
      
      expect(listener).toHaveBeenCalledWith(addedPermissions);
      
      chrome.permissions.onAdded.removeListener(listener);
    });
    
    test('should handle permission removed events', () => {
      const listener = jest.fn();
      
      chrome.permissions.onRemoved.addListener(listener);
      
      // Simulate permission removed event
      const removedPermissions = { permissions: ['notifications'] };
      chrome.permissions.onRemoved.mock.calls[0][0](removedPermissions);
      
      expect(listener).toHaveBeenCalledWith(removedPermissions);
      
      chrome.permissions.onRemoved.removeListener(listener);
    });
  });
  
  describe('Integration Scenarios', () => {
    test('should complete permission request workflow', async () => {
      // Mock initial state - missing permissions
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions && perms.permissions.includes('scripting')) {
          callback(false); // scripting permission missing
        } else {
          callback(true);
        }
      });
      
      // Mock permission request success
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(true);
      });
      
      // Check initial state
      const validation = await mockPermissionManager.validateRequiredPermissions();
      expect(validation.valid).toBe(false);
      expect(validation.missing.permissions).toContain('scripting');
      
      // Request missing permission
      const requestResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['scripting']
      });
      
      expect(requestResult.success).toBe(true);
      expect(requestResult.granted).toBe(true);
      
      // Verify permission is now granted
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        callback(true); // Now all permissions are granted
      });
      
      const finalValidation = await mockPermissionManager.validateRequiredPermissions();
      expect(finalValidation.valid).toBe(true);
    });
    
    test('should handle permission request denial and fallback', async () => {
      // Mock initial state - missing optional permissions
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions && perms.permissions.includes('notifications')) {
          callback(false); // notifications permission missing
        } else {
          callback(true);
        }
      });
      
      // Mock permission request denial
      chrome.permissions.request.mockImplementation((perms, callback) => {
        callback(false); // User denied permission
      });
      
      // Check initial state
      const validation = await mockPermissionManager.validateRequiredPermissions();
      expect(validation.valid).toBe(true); // Required permissions are fine
      
      // Request optional permission
      const requestResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['notifications']
      });
      
      expect(requestResult.success).toBe(false);
      expect(requestResult.granted).toBe(false);
      
      // Verify permission is still not granted
      const hasNotifications = await mockPermissionManager.hasPermissions({
        permissions: ['notifications']
      });
      expect(hasNotifications).toBe(false);
    });
    
    test('should handle complex permission scenarios', async () => {
      // Mock complex permission state
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: ['activeTab', 'storage'], // Missing scripting, tabs
          origins: ['https://openrouter.ai/*'] // Has required origins
        });
      });
      
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions) {
          const hasAllPerms = perms.permissions.every(perm => 
            ['activeTab', 'storage'].includes(perm)
          );
          callback(hasAllPerms);
        } else {
          callback(true);
        }
      });
      
      // Mock partial permission request success
      chrome.permissions.request.mockImplementation((perms, callback) => {
        if (perms.permissions && perms.permissions.includes('scripting')) {
          callback(true); // Grant scripting
        } else if (perms.permissions && perms.permissions.includes('tabs')) {
          callback(false); // Deny tabs
        } else {
          callback(true);
        }
      });
      
      const status = await mockPermissionManager.getPermissionStatus();
      
      expect(status.required.valid).toBe(false);
      expect(status.required.missing.permissions).toContain('scripting');
      expect(status.required.missing.permissions).toContain('tabs');
      
      // Request scripting permission
      const scriptingResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['scripting']
      });
      expect(scriptingResult.success).toBe(true);
      
      // Request tabs permission (denied)
      const tabsResult = await mockPermissionManager.requestOptionalPermissions({
        permissions: ['tabs']
      });
      expect(tabsResult.success).toBe(false);
      
      // Final status - scripting granted, tabs still missing
      chrome.permissions.contains.mockImplementation((perms, callback) => {
        if (perms.permissions) {
          const hasAllPerms = perms.permissions.every(perm => 
            ['activeTab', 'storage', 'scripting'].includes(perm)
          );
          callback(hasAllPerms);
        } else {
          callback(true);
        }
      });
      
      const finalStatus = await mockPermissionManager.getPermissionStatus();
      expect(finalStatus.apis.scripting).toBe(true);
      expect(finalStatus.required.missing.permissions).not.toContain('scripting');
      expect(finalStatus.required.missing.permissions).toContain('tabs');
    });
  });
});
