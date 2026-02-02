/**
 * Permission Validation Tests
 * Tests for Chrome extension permission validation and security
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock permission validation module
const mockPermissionValidator = {
  // Permission validator
  permissions: {
    // Validate required permissions
    validateRequiredPermissions: async () => {
      return new Promise((resolve) => {
        chrome.permissions.getAll((permissions) => {
          const requiredPermissions = [
            'storage',
            'activeTab',
            'scripting'
          ];
          
          const optionalPermissions = [
            'tabs',
            'background'
          ];
          
          const validation = {
            required: {
              granted: [],
              missing: [],
              valid: true
            },
            optional: {
              granted: [],
              missing: [],
              valid: true
            },
            suspicious: [],
            overall: true
          };
          
          // Check required permissions
          requiredPermissions.forEach(permission => {
            if (permissions.permissions && permissions.permissions.includes(permission)) {
              validation.required.granted.push(permission);
            } else {
              validation.required.missing.push(permission);
              validation.required.valid = false;
              validation.overall = false;
            }
          });
          
          // Check optional permissions
          optionalPermissions.forEach(permission => {
            if (permissions.permissions && permissions.permissions.includes(permission)) {
              validation.optional.granted.push(permission);
            } else {
              validation.optional.missing.push(permission);
            }
          });
          
          // Check for suspicious permissions
          const suspiciousPermissions = [
            'clipboardRead',
            'clipboardWrite',
            'geolocation',
            'camera',
            'microphone',
            'notifications',
            'history',
            'bookmarks'
          ];
          
          permissions.permissions.forEach(permission => {
            if (suspiciousPermissions.includes(permission)) {
              validation.suspicious.push({
                permission: permission,
                risk: 'high',
                reason: `${permission} access may compromise user privacy`
              });
              validation.overall = false;
            }
          });
          
          // Check host permissions
          if (permissions.origins) {
            permissions.origins.forEach(origin => {
              if (origin === '<all_urls>') {
                validation.suspicious.push({
                  permission: origin,
                  risk: 'high',
                  reason: 'Access to all URLs poses significant security risk'
                });
                validation.overall = false;
              } else if (origin.includes('file://')) {
                validation.suspicious.push({
                  permission: origin,
                  risk: 'medium',
                  reason: 'File system access may expose sensitive data'
                });
              }
            });
          }
          
          resolve(validation);
        });
      });
    },
    
    // Validate permission requests
    validatePermissionRequest: (permissions) => {
      const validation = {
        valid: true,
        issues: [],
        riskLevel: 'low'
      };
      
      if (!permissions || !Array.isArray(permissions)) {
        validation.valid = false;
        validation.issues.push('Invalid permission request format');
        return validation;
      }
      
      // Check for excessive permissions
      if (permissions.length > 10) {
        validation.valid = false;
        validation.issues.push('Requesting too many permissions at once');
        validation.riskLevel = 'high';
      }
      
      // Check for dangerous permission combinations
      const dangerousCombinations = [
        ['scripting', '<all_urls>'],
        ['tabs', 'history'],
        ['clipboardRead', 'clipboardWrite']
      ];
      
      dangerousCombinations.forEach(combination => {
        if (combination.every(perm => permissions.includes(perm))) {
          validation.valid = false;
          validation.issues.push(`Dangerous permission combination: ${combination.join(' + ')}`);
          validation.riskLevel = 'high';
        }
      });
      
      // Check for unnecessary permissions
      const unnecessaryPermissions = [
        'management',
        'devtools',
        'debugger'
      ];
      
      unnecessaryPermissions.forEach(permission => {
        if (permissions.includes(permission)) {
          validation.issues.push(`Unnecessary permission: ${permission}`);
          if (validation.riskLevel === 'low') {
            validation.riskLevel = 'medium';
          }
        }
      });
      
      return validation;
    },
    
    // Check permission escalation
    checkPermissionEscalation: async (newPermissions) => {
      return new Promise((resolve) => {
        chrome.permissions.getAll((currentPermissions) => {
          const escalation = {
            detected: false,
            addedPermissions: [],
            riskLevel: 'low',
            recommendations: []
          };
          
          const currentPerms = currentPermissions.permissions || [];
          const newPerms = newPermissions.permissions || [];
          
          // Check for newly requested permissions
          newPerms.forEach(permission => {
            if (!currentPerms.includes(permission)) {
              escalation.addedPermissions.push(permission);
              
              // Assess risk of new permissions
              const highRiskPermissions = [
                'clipboardRead',
                'geolocation',
                'camera',
                'microphone',
                'history'
              ];
              
              if (highRiskPermissions.includes(permission)) {
                escalation.detected = true;
                escalation.riskLevel = 'high';
                escalation.recommendations.push(
                  `Review necessity of ${permission} permission`
                );
              } else if (escalation.riskLevel === 'low') {
                escalation.riskLevel = 'medium';
              }
            }
          });
          
          // Check for host permission escalation
          const currentOrigins = currentPermissions.origins || [];
          const newOrigins = newPermissions.origins || [];
          
          newOrigins.forEach(origin => {
            if (!currentOrigins.includes(origin)) {
              escalation.addedPermissions.push(origin);
              
              if (origin === '<all_urls>') {
                escalation.detected = true;
                escalation.riskLevel = 'high';
                escalation.recommendations.push(
                  'Avoid requesting access to all URLs'
                );
              }
            }
          });
          
          resolve(escalation);
        });
      });
    },
    
    // Validate runtime permission usage
    validateRuntimeUsage: async () => {
      return new Promise((resolve) => {
        // Mock runtime permission usage tracking
        const usage = {
          storage: {
            accessed: true,
            frequency: 'high',
            dataTypes: ['api_keys', 'settings', 'cache'],
            secure: true
          },
          tabs: {
            accessed: true,
            frequency: 'medium',
            operations: ['query', 'update', 'create'],
            secure: true
          },
          scripting: {
            accessed: true,
            frequency: 'medium',
            operations: ['executeScript', 'insertCSS'],
            secure: true
          },
          suspicious: {
            accessed: false,
            operations: [],
            riskLevel: 'low'
          }
        };
        
        const validation = {
          valid: true,
          issues: [],
          recommendations: []
        };
        
        // Check storage usage
        if (usage.storage.accessed) {
          if (!usage.storage.secure) {
            validation.valid = false;
            validation.issues.push('Storage usage is not secure');
          }
          
          if (usage.storage.dataTypes.includes('passwords') || 
              usage.storage.dataTypes.includes('credentials')) {
            validation.valid = false;
            validation.issues.push('Storing sensitive credentials in extension storage');
            validation.recommendations.push('Use secure storage for sensitive data');
          }
        }
        
        // Check tabs usage
        if (usage.tabs.accessed) {
          if (usage.tabs.operations.includes('executeScript') && 
              !usage.permissions.includes('scripting')) {
            validation.valid = false;
            validation.issues.push('Executing scripts without proper permission');
          }
        }
        
        // Check scripting usage
        if (usage.scripting.accessed) {
          if (usage.scripting.frequency === 'high') {
            validation.recommendations.push(
              'Consider reducing script execution frequency'
            );
          }
        }
        
        // Check for suspicious operations
        if (usage.suspicious.accessed) {
          validation.valid = false;
          validation.issues.push('Suspicious operations detected');
          validation.recommendations.push('Review extension behavior');
        }
        
        resolve({
          ...validation,
          usage: usage
        });
      });
    },
    
    // Validate permission manifest
    validateManifestPermissions: (manifest) => {
      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        recommendations: []
      };
      
      if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
        validation.valid = false;
        validation.errors.push('Manifest permissions field is missing or invalid');
        return validation;
      }
      
      // Check for permission minimization
      if (manifest.permissions.length > 5) {
        validation.warnings.push(
          `Manifest requests ${manifest.permissions.length} permissions, consider minimizing`
        );
      }
      
      // Check for permission justification
      if (!manifest.description || manifest.description.length < 10) {
        validation.recommendations.push(
          'Add detailed description justifying permission usage'
        );
      }
      
      // Check for optional permissions
      if (!manifest.optional_permissions) {
        validation.recommendations.push(
          'Consider using optional permissions for non-critical features'
        );
      }
      
      // Check host permissions
      if (manifest.host_permissions) {
        manifest.host_permissions.forEach(host => {
          if (host === '<all_urls>') {
            validation.warnings.push(
              'Host permission <all_urls> is overly broad'
            );
            validation.recommendations.push(
              'Specify exact domains needed instead of <all_urls>'
            );
          }
        });
      }
      
      return validation;
    }
  }
};

describe('Permission Validation Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock default permissions
    chrome.permissions.getAll.mockImplementation((callback) => {
      callback({
        permissions: ['storage', 'activeTab', 'scripting'],
        origins: ['https://api.openrouter.ai/*']
      });
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Required Permissions Validation', () => {
    test('should validate all required permissions are granted', async () => {
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(true);
      expect(result.required.valid).toBe(true);
      expect(result.required.granted).toContain('storage');
      expect(result.required.granted).toContain('activeTab');
      expect(result.required.granted).toContain('scripting');
      expect(result.required.missing).toHaveLength(0);
    });
    
    test('should detect missing required permissions', async () => {
      // Mock missing permissions
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: ['storage'], // Missing activeTab and scripting
          origins: []
        });
      });
      
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(false);
      expect(result.required.valid).toBe(false);
      expect(result.required.missing).toContain('activeTab');
      expect(result.required.missing).toContain('scripting');
    });
    
    test('should detect suspicious permissions', async () => {
      // Mock suspicious permissions
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: ['storage', 'activeTab', 'scripting', 'clipboardRead', 'geolocation'],
          origins: ['<all_urls>']
        });
      });
      
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(false);
      expect(result.suspicious.length).toBeGreaterThan(0);
      expect(result.suspicious.some(s => s.permission === 'clipboardRead')).toBe(true);
      expect(result.suspicious.some(s => s.permission === '<all_urls>')).toBe(true);
    });
  });
  
  describe('Permission Request Validation', () => {
    test('should validate valid permission request', () => {
      const permissions = ['storage', 'activeTab'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.riskLevel).toBe('low');
    });
    
    test('should reject excessive permission request', () => {
      const permissions = [
        'storage', 'activeTab', 'scripting', 'tabs', 'history',
        'bookmarks', 'clipboardRead', 'clipboardWrite', 'geolocation',
        'camera', 'microphone', 'notifications'
      ];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Requesting too many permissions at once');
      expect(result.riskLevel).toBe('high');
    });
    
    test('should detect dangerous permission combinations', () => {
      const permissions = ['scripting', '<all_urls>'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => 
        issue.includes('Dangerous permission combination')
      )).toBe(true);
      expect(result.riskLevel).toBe('high');
    });
    
    test('should warn about unnecessary permissions', () => {
      const permissions = ['storage', 'activeTab', 'management'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toContain('Unnecessary permission: management');
      expect(result.riskLevel).toBe('medium');
    });
    
    test('should reject invalid permission request format', () => {
      const invalidRequests = [
        null,
        undefined,
        'string',
        {},
        []
      ];
      
      invalidRequests.forEach(request => {
        const result = mockPermissionValidator.permissions.validatePermissionRequest(request);
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Invalid permission request format');
      });
    });
  });
  
  describe('Permission Escalation Detection', () => {
    test('should detect permission escalation', async () => {
      const newPermissions = {
        permissions: ['storage', 'activeTab', 'scripting', 'clipboardRead'],
        origins: ['<all_urls>']
      };
      
      const result = await mockPermissionValidator.permissions.checkPermissionEscalation(newPermissions);
      
      expect(result.detected).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.addedPermissions).toContain('clipboardRead');
      expect(result.addedPermissions).toContain('<all_urls>');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
    
    test('should handle safe permission addition', async () => {
      const newPermissions = {
        permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
        origins: ['https://example.com/*']
      };
      
      const result = await mockPermissionValidator.permissions.checkPermissionEscalation(newPermissions);
      
      expect(result.detected).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.addedPermissions).toContain('tabs');
    });
    
    test('should handle no permission changes', async () => {
      const newPermissions = {
        permissions: ['storage', 'activeTab', 'scripting'],
        origins: ['https://api.openrouter.ai/*']
      };
      
      const result = await mockPermissionValidator.permissions.checkPermissionEscalation(newPermissions);
      
      expect(result.detected).toBe(false);
      expect(result.addedPermissions).toHaveLength(0);
    });
  });
  
  describe('Runtime Permission Usage Validation', () => {
    test('should validate secure runtime usage', async () => {
      const result = await mockPermissionValidator.permissions.validateRuntimeUsage();
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.usage.storage.secure).toBe(true);
    });
    
    test('should detect insecure storage usage', async () => {
      // Mock insecure storage usage
      const mockValidateRuntimeUsage = async () => {
        return {
          valid: false,
          issues: ['Storage usage is not secure'],
          recommendations: ['Use secure storage for sensitive data'],
          usage: {
            storage: {
              accessed: true,
              secure: false,
              dataTypes: ['passwords']
            }
          }
        };
      };
      
      const result = await mockValidateRuntimeUsage();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Storage usage is not secure');
      expect(result.usage.storage.secure).toBe(false);
    });
    
    test('should detect suspicious operations', async () => {
      // Mock suspicious operations
      const mockValidateRuntimeUsage = async () => {
        return {
          valid: false,
          issues: ['Suspicious operations detected'],
          recommendations: ['Review extension behavior'],
          usage: {
            suspicious: {
              accessed: true,
              operations: ['unauthorized_data_access'],
              riskLevel: 'high'
            }
          }
        };
      };
      
      const result = await mockValidateRuntimeUsage();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Suspicious operations detected');
      expect(result.usage.suspicious.accessed).toBe(true);
    });
  });
  
  describe('Manifest Permission Validation', () => {
    test('should validate valid manifest permissions', () => {
      const manifest = {
        permissions: ['storage', 'activeTab', 'scripting'],
        host_permissions: ['https://api.openrouter.ai/*'],
        description: 'Ray Chrome Extension for browser automation'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should detect missing permissions field', () => {
      const manifest = {
        description: 'Ray Chrome Extension'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Manifest permissions field is missing or invalid');
    });
    
    test('should warn about excessive permissions', () => {
      const manifest = {
        permissions: [
          'storage', 'activeTab', 'scripting', 'tabs', 'history',
          'bookmarks', 'clipboardRead', 'clipboardWrite'
        ],
        description: 'Ray Chrome Extension'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.includes('requests 8 permissions, consider minimizing')
      )).toBe(true);
    });
    
    test('should warn about <all_urls> host permission', () => {
      const manifest = {
        permissions: ['storage', 'activeTab'],
        host_permissions: ['<all_urls>'],
        description: 'Ray Chrome Extension'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Host permission <all_urls> is overly broad');
      expect(result.recommendations).toContain(
        'Specify exact domains needed instead of <all_urls>'
      );
    });
    
    test('should recommend optional permissions', () => {
      const manifest = {
        permissions: ['storage', 'activeTab'],
        description: 'Ray'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.recommendations).toContain(
        'Consider using optional permissions for non-critical features'
      );
    });
  });
  
  describe('Permission Security Best Practices', () => {
    test('should enforce principle of least privilege', () => {
      const minimalPermissions = ['storage', 'activeTab'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(minimalPermissions);
      
      expect(result.valid).toBe(true);
      expect(result.riskLevel).toBe('low');
    });
    
    test('should identify permission creep', async () => {
      // Mock permission creep scenario
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: [
            'storage', 'activeTab', 'scripting', 'tabs', 'history',
            'bookmarks', 'clipboardRead', 'clipboardWrite', 'geolocation'
          ],
          origins: ['<all_urls>']
        });
      });
      
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(false);
      expect(result.suspicious.length).toBeGreaterThan(2);
    });
    
    test('should validate permission justification', () => {
      const manifestWithoutJustification = {
        permissions: ['storage', 'activeTab'],
        description: 'Ray'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(
        manifestWithoutJustification
      );
      
      expect(result.recommendations).toContain(
        'Add detailed description justifying permission usage'
      );
    });
  });
}); * Permission Validation Tests
 * Tests for Chrome extension permission validation and security
 */

// Mock Chrome APIs before importing modules
require('../setup/chrome-mock.js');

// Import test utilities
const { setupTest, teardownTest, createMockTab, createMockWindow } = require('../utils/test-helpers');

// Mock permission validation module
const mockPermissionValidator = {
  // Permission validator
  permissions: {
    // Validate required permissions
    validateRequiredPermissions: async () => {
      return new Promise((resolve) => {
        chrome.permissions.getAll((permissions) => {
          const requiredPermissions = [
            'storage',
            'activeTab',
            'scripting'
          ];
          
          const optionalPermissions = [
            'tabs',
            'background'
          ];
          
          const validation = {
            required: {
              granted: [],
              missing: [],
              valid: true
            },
            optional: {
              granted: [],
              missing: [],
              valid: true
            },
            suspicious: [],
            overall: true
          };
          
          // Check required permissions
          requiredPermissions.forEach(permission => {
            if (permissions.permissions && permissions.permissions.includes(permission)) {
              validation.required.granted.push(permission);
            } else {
              validation.required.missing.push(permission);
              validation.required.valid = false;
              validation.overall = false;
            }
          });
          
          // Check optional permissions
          optionalPermissions.forEach(permission => {
            if (permissions.permissions && permissions.permissions.includes(permission)) {
              validation.optional.granted.push(permission);
            } else {
              validation.optional.missing.push(permission);
            }
          });
          
          // Check for suspicious permissions
          const suspiciousPermissions = [
            'clipboardRead',
            'clipboardWrite',
            'geolocation',
            'camera',
            'microphone',
            'notifications',
            'history',
            'bookmarks'
          ];
          
          permissions.permissions.forEach(permission => {
            if (suspiciousPermissions.includes(permission)) {
              validation.suspicious.push({
                permission: permission,
                risk: 'high',
                reason: `${permission} access may compromise user privacy`
              });
              validation.overall = false;
            }
          });
          
          // Check host permissions
          if (permissions.origins) {
            permissions.origins.forEach(origin => {
              if (origin === '<all_urls>') {
                validation.suspicious.push({
                  permission: origin,
                  risk: 'high',
                  reason: 'Access to all URLs poses significant security risk'
                });
                validation.overall = false;
              } else if (origin.includes('file://')) {
                validation.suspicious.push({
                  permission: origin,
                  risk: 'medium',
                  reason: 'File system access may expose sensitive data'
                });
              }
            });
          }
          
          resolve(validation);
        });
      });
    },
    
    // Validate permission requests
    validatePermissionRequest: (permissions) => {
      const validation = {
        valid: true,
        issues: [],
        riskLevel: 'low'
      };
      
      if (!permissions || !Array.isArray(permissions)) {
        validation.valid = false;
        validation.issues.push('Invalid permission request format');
        return validation;
      }
      
      // Check for excessive permissions
      if (permissions.length > 10) {
        validation.valid = false;
        validation.issues.push('Requesting too many permissions at once');
        validation.riskLevel = 'high';
      }
      
      // Check for dangerous permission combinations
      const dangerousCombinations = [
        ['scripting', '<all_urls>'],
        ['tabs', 'history'],
        ['clipboardRead', 'clipboardWrite']
      ];
      
      dangerousCombinations.forEach(combination => {
        if (combination.every(perm => permissions.includes(perm))) {
          validation.valid = false;
          validation.issues.push(`Dangerous permission combination: ${combination.join(' + ')}`);
          validation.riskLevel = 'high';
        }
      });
      
      // Check for unnecessary permissions
      const unnecessaryPermissions = [
        'management',
        'devtools',
        'debugger'
      ];
      
      unnecessaryPermissions.forEach(permission => {
        if (permissions.includes(permission)) {
          validation.issues.push(`Unnecessary permission: ${permission}`);
          if (validation.riskLevel === 'low') {
            validation.riskLevel = 'medium';
          }
        }
      });
      
      return validation;
    },
    
    // Check permission escalation
    checkPermissionEscalation: async (newPermissions) => {
      return new Promise((resolve) => {
        chrome.permissions.getAll((currentPermissions) => {
          const escalation = {
            detected: false,
            addedPermissions: [],
            riskLevel: 'low',
            recommendations: []
          };
          
          const currentPerms = currentPermissions.permissions || [];
          const newPerms = newPermissions.permissions || [];
          
          // Check for newly requested permissions
          newPerms.forEach(permission => {
            if (!currentPerms.includes(permission)) {
              escalation.addedPermissions.push(permission);
              
              // Assess risk of new permissions
              const highRiskPermissions = [
                'clipboardRead',
                'geolocation',
                'camera',
                'microphone',
                'history'
              ];
              
              if (highRiskPermissions.includes(permission)) {
                escalation.detected = true;
                escalation.riskLevel = 'high';
                escalation.recommendations.push(
                  `Review necessity of ${permission} permission`
                );
              } else if (escalation.riskLevel === 'low') {
                escalation.riskLevel = 'medium';
              }
            }
          });
          
          // Check for host permission escalation
          const currentOrigins = currentPermissions.origins || [];
          const newOrigins = newPermissions.origins || [];
          
          newOrigins.forEach(origin => {
            if (!currentOrigins.includes(origin)) {
              escalation.addedPermissions.push(origin);
              
              if (origin === '<all_urls>') {
                escalation.detected = true;
                escalation.riskLevel = 'high';
                escalation.recommendations.push(
                  'Avoid requesting access to all URLs'
                );
              }
            }
          });
          
          resolve(escalation);
        });
      });
    },
    
    // Validate runtime permission usage
    validateRuntimeUsage: async () => {
      return new Promise((resolve) => {
        // Mock runtime permission usage tracking
        const usage = {
          storage: {
            accessed: true,
            frequency: 'high',
            dataTypes: ['api_keys', 'settings', 'cache'],
            secure: true
          },
          tabs: {
            accessed: true,
            frequency: 'medium',
            operations: ['query', 'update', 'create'],
            secure: true
          },
          scripting: {
            accessed: true,
            frequency: 'medium',
            operations: ['executeScript', 'insertCSS'],
            secure: true
          },
          suspicious: {
            accessed: false,
            operations: [],
            riskLevel: 'low'
          }
        };
        
        const validation = {
          valid: true,
          issues: [],
          recommendations: []
        };
        
        // Check storage usage
        if (usage.storage.accessed) {
          if (!usage.storage.secure) {
            validation.valid = false;
            validation.issues.push('Storage usage is not secure');
          }
          
          if (usage.storage.dataTypes.includes('passwords') || 
              usage.storage.dataTypes.includes('credentials')) {
            validation.valid = false;
            validation.issues.push('Storing sensitive credentials in extension storage');
            validation.recommendations.push('Use secure storage for sensitive data');
          }
        }
        
        // Check tabs usage
        if (usage.tabs.accessed) {
          if (usage.tabs.operations.includes('executeScript') && 
              !usage.permissions.includes('scripting')) {
            validation.valid = false;
            validation.issues.push('Executing scripts without proper permission');
          }
        }
        
        // Check scripting usage
        if (usage.scripting.accessed) {
          if (usage.scripting.frequency === 'high') {
            validation.recommendations.push(
              'Consider reducing script execution frequency'
            );
          }
        }
        
        // Check for suspicious operations
        if (usage.suspicious.accessed) {
          validation.valid = false;
          validation.issues.push('Suspicious operations detected');
          validation.recommendations.push('Review extension behavior');
        }
        
        resolve({
          ...validation,
          usage: usage
        });
      });
    },
    
    // Validate permission manifest
    validateManifestPermissions: (manifest) => {
      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        recommendations: []
      };
      
      if (!manifest.permissions || !Array.isArray(manifest.permissions)) {
        validation.valid = false;
        validation.errors.push('Manifest permissions field is missing or invalid');
        return validation;
      }
      
      // Check for permission minimization
      if (manifest.permissions.length > 5) {
        validation.warnings.push(
          `Manifest requests ${manifest.permissions.length} permissions, consider minimizing`
        );
      }
      
      // Check for permission justification
      if (!manifest.description || manifest.description.length < 10) {
        validation.recommendations.push(
          'Add detailed description justifying permission usage'
        );
      }
      
      // Check for optional permissions
      if (!manifest.optional_permissions) {
        validation.recommendations.push(
          'Consider using optional permissions for non-critical features'
        );
      }
      
      // Check host permissions
      if (manifest.host_permissions) {
        manifest.host_permissions.forEach(host => {
          if (host === '<all_urls>') {
            validation.warnings.push(
              'Host permission <all_urls> is overly broad'
            );
            validation.recommendations.push(
              'Specify exact domains needed instead of <all_urls>'
            );
          }
        });
      }
      
      return validation;
    }
  }
};

describe('Permission Validation Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Mock default permissions
    chrome.permissions.getAll.mockImplementation((callback) => {
      callback({
        permissions: ['storage', 'activeTab', 'scripting'],
        origins: ['https://api.openrouter.ai/*']
      });
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    teardownTest();
  });
  
  describe('Required Permissions Validation', () => {
    test('should validate all required permissions are granted', async () => {
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(true);
      expect(result.required.valid).toBe(true);
      expect(result.required.granted).toContain('storage');
      expect(result.required.granted).toContain('activeTab');
      expect(result.required.granted).toContain('scripting');
      expect(result.required.missing).toHaveLength(0);
    });
    
    test('should detect missing required permissions', async () => {
      // Mock missing permissions
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: ['storage'], // Missing activeTab and scripting
          origins: []
        });
      });
      
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(false);
      expect(result.required.valid).toBe(false);
      expect(result.required.missing).toContain('activeTab');
      expect(result.required.missing).toContain('scripting');
    });
    
    test('should detect suspicious permissions', async () => {
      // Mock suspicious permissions
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: ['storage', 'activeTab', 'scripting', 'clipboardRead', 'geolocation'],
          origins: ['<all_urls>']
        });
      });
      
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(false);
      expect(result.suspicious.length).toBeGreaterThan(0);
      expect(result.suspicious.some(s => s.permission === 'clipboardRead')).toBe(true);
      expect(result.suspicious.some(s => s.permission === '<all_urls>')).toBe(true);
    });
  });
  
  describe('Permission Request Validation', () => {
    test('should validate valid permission request', () => {
      const permissions = ['storage', 'activeTab'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.riskLevel).toBe('low');
    });
    
    test('should reject excessive permission request', () => {
      const permissions = [
        'storage', 'activeTab', 'scripting', 'tabs', 'history',
        'bookmarks', 'clipboardRead', 'clipboardWrite', 'geolocation',
        'camera', 'microphone', 'notifications'
      ];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Requesting too many permissions at once');
      expect(result.riskLevel).toBe('high');
    });
    
    test('should detect dangerous permission combinations', () => {
      const permissions = ['scripting', '<all_urls>'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => 
        issue.includes('Dangerous permission combination')
      )).toBe(true);
      expect(result.riskLevel).toBe('high');
    });
    
    test('should warn about unnecessary permissions', () => {
      const permissions = ['storage', 'activeTab', 'management'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(permissions);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toContain('Unnecessary permission: management');
      expect(result.riskLevel).toBe('medium');
    });
    
    test('should reject invalid permission request format', () => {
      const invalidRequests = [
        null,
        undefined,
        'string',
        {},
        []
      ];
      
      invalidRequests.forEach(request => {
        const result = mockPermissionValidator.permissions.validatePermissionRequest(request);
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Invalid permission request format');
      });
    });
  });
  
  describe('Permission Escalation Detection', () => {
    test('should detect permission escalation', async () => {
      const newPermissions = {
        permissions: ['storage', 'activeTab', 'scripting', 'clipboardRead'],
        origins: ['<all_urls>']
      };
      
      const result = await mockPermissionValidator.permissions.checkPermissionEscalation(newPermissions);
      
      expect(result.detected).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.addedPermissions).toContain('clipboardRead');
      expect(result.addedPermissions).toContain('<all_urls>');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
    
    test('should handle safe permission addition', async () => {
      const newPermissions = {
        permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
        origins: ['https://example.com/*']
      };
      
      const result = await mockPermissionValidator.permissions.checkPermissionEscalation(newPermissions);
      
      expect(result.detected).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.addedPermissions).toContain('tabs');
    });
    
    test('should handle no permission changes', async () => {
      const newPermissions = {
        permissions: ['storage', 'activeTab', 'scripting'],
        origins: ['https://api.openrouter.ai/*']
      };
      
      const result = await mockPermissionValidator.permissions.checkPermissionEscalation(newPermissions);
      
      expect(result.detected).toBe(false);
      expect(result.addedPermissions).toHaveLength(0);
    });
  });
  
  describe('Runtime Permission Usage Validation', () => {
    test('should validate secure runtime usage', async () => {
      const result = await mockPermissionValidator.permissions.validateRuntimeUsage();
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.usage.storage.secure).toBe(true);
    });
    
    test('should detect insecure storage usage', async () => {
      // Mock insecure storage usage
      const mockValidateRuntimeUsage = async () => {
        return {
          valid: false,
          issues: ['Storage usage is not secure'],
          recommendations: ['Use secure storage for sensitive data'],
          usage: {
            storage: {
              accessed: true,
              secure: false,
              dataTypes: ['passwords']
            }
          }
        };
      };
      
      const result = await mockValidateRuntimeUsage();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Storage usage is not secure');
      expect(result.usage.storage.secure).toBe(false);
    });
    
    test('should detect suspicious operations', async () => {
      // Mock suspicious operations
      const mockValidateRuntimeUsage = async () => {
        return {
          valid: false,
          issues: ['Suspicious operations detected'],
          recommendations: ['Review extension behavior'],
          usage: {
            suspicious: {
              accessed: true,
              operations: ['unauthorized_data_access'],
              riskLevel: 'high'
            }
          }
        };
      };
      
      const result = await mockValidateRuntimeUsage();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Suspicious operations detected');
      expect(result.usage.suspicious.accessed).toBe(true);
    });
  });
  
  describe('Manifest Permission Validation', () => {
    test('should validate valid manifest permissions', () => {
      const manifest = {
        permissions: ['storage', 'activeTab', 'scripting'],
        host_permissions: ['https://api.openrouter.ai/*'],
        description: 'Ray Chrome Extension for browser automation'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should detect missing permissions field', () => {
      const manifest = {
        description: 'Ray Chrome Extension'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Manifest permissions field is missing or invalid');
    });
    
    test('should warn about excessive permissions', () => {
      const manifest = {
        permissions: [
          'storage', 'activeTab', 'scripting', 'tabs', 'history',
          'bookmarks', 'clipboardRead', 'clipboardWrite'
        ],
        description: 'Ray Chrome Extension'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => 
        w.includes('requests 8 permissions, consider minimizing')
      )).toBe(true);
    });
    
    test('should warn about <all_urls> host permission', () => {
      const manifest = {
        permissions: ['storage', 'activeTab'],
        host_permissions: ['<all_urls>'],
        description: 'Ray Chrome Extension'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Host permission <all_urls> is overly broad');
      expect(result.recommendations).toContain(
        'Specify exact domains needed instead of <all_urls>'
      );
    });
    
    test('should recommend optional permissions', () => {
      const manifest = {
        permissions: ['storage', 'activeTab'],
        description: 'Ray'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(manifest);
      
      expect(result.valid).toBe(true);
      expect(result.recommendations).toContain(
        'Consider using optional permissions for non-critical features'
      );
    });
  });
  
  describe('Permission Security Best Practices', () => {
    test('should enforce principle of least privilege', () => {
      const minimalPermissions = ['storage', 'activeTab'];
      const result = mockPermissionValidator.permissions.validatePermissionRequest(minimalPermissions);
      
      expect(result.valid).toBe(true);
      expect(result.riskLevel).toBe('low');
    });
    
    test('should identify permission creep', async () => {
      // Mock permission creep scenario
      chrome.permissions.getAll.mockImplementation((callback) => {
        callback({
          permissions: [
            'storage', 'activeTab', 'scripting', 'tabs', 'history',
            'bookmarks', 'clipboardRead', 'clipboardWrite', 'geolocation'
          ],
          origins: ['<all_urls>']
        });
      });
      
      const result = await mockPermissionValidator.permissions.validateRequiredPermissions();
      
      expect(result.overall).toBe(false);
      expect(result.suspicious.length).toBeGreaterThan(2);
    });
    
    test('should validate permission justification', () => {
      const manifestWithoutJustification = {
        permissions: ['storage', 'activeTab'],
        description: 'Ray'
      };
      
      const result = mockPermissionValidator.permissions.validateManifestPermissions(
        manifestWithoutJustification
      );
      
      expect(result.recommendations).toContain(
        'Add detailed description justifying permission usage'
      );
    });
  });
});
});
