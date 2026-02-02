/**
 * Permission Management for Ray Chrome Extension
 * Handles permission requests, validation, and management
 */

export interface PermissionRequest {
  permissions: chrome.permissions.Permissions;
  origins?: string[];
  reason: string;
  requestedBy: string; // Which agent/component requested it
}

export interface PermissionStatus {
  granted: chrome.permissions.Permissions;
  optional: chrome.permissions.Permissions;
  required: chrome.permissions.Permissions;
  lastChecked: number;
}

export interface PermissionAudit {
  permission: string;
  granted: boolean;
  requestedAt: number;
  grantedAt?: number;
  lastUsed?: number;
  usageCount: number;
  requestedBy: string;
}

export class PermissionManager {
  private static readonly AUDIT_KEY = 'permissionAudit';
  private static readonly REQUIRED_PERMISSIONS: chrome.permissions.Permissions = {
    permissions: ['storage']
  };

  private static readonly OPTIONAL_PERMISSIONS: chrome.permissions.Permissions = {
    permissions: ['activeTab'],
    origins: ['https://openrouter.ai/*']
  };

  private static readonly ADVANCED_PERMISSIONS: chrome.permissions.Permissions = {
    permissions: ['scripting', 'tabs'],
    origins: ['<all_urls>']
  };

  /**
   * Initialize permission system and check current status
   * @returns Promise that resolves with current permission status
   */
  static async initialize(): Promise<PermissionStatus> {
    try {
      const [granted, optional, required] = await Promise.all([
        chrome.permissions.getAll(),
        chrome.permissions.contains(this.OPTIONAL_PERMISSIONS),
        chrome.permissions.contains(this.REQUIRED_PERMISSIONS)
      ]);

      const status: PermissionStatus = {
        granted,
        optional: optional ? this.OPTIONAL_PERMISSIONS : { permissions: [], origins: [] },
        required: required ? this.REQUIRED_PERMISSIONS : { permissions: [], origins: [] },
        lastChecked: Date.now()
      };

      // Initialize audit if needed
      await this.initializeAudit(status);

      return status;
    } catch (error) {
      console.error('Failed to initialize permission manager:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Permission initialization failed');
    }
  }

  /**
   * Request optional permissions with user approval
   * @param request The permission request details
   * @returns Promise that resolves with true if permissions were granted
   */
  static async requestPermissions(request: PermissionRequest): Promise<boolean> {
    try {
      // Validate the request
      if (!this.validatePermissionRequest(request)) {
        throw new Error('Invalid permission request');
      }

      // Check if permissions are already granted
      const alreadyGranted = await chrome.permissions.contains(request.permissions);
      if (alreadyGranted) {
        await this.updateAudit(request, true);
        return true;
      }

      // Request permissions from user
      const granted = await chrome.permissions.request(request.permissions);

      // Log the request in audit
      await this.updateAudit(request, granted);

      if (granted) {
        console.log(`Permissions granted: ${JSON.stringify(request.permissions)} for ${request.reason}`);
      } else {
        console.warn(`Permissions denied: ${JSON.stringify(request.permissions)} for ${request.reason}`);
      }

      return granted;
    } catch (error) {
      console.error('Failed to request permissions:', error instanceof Error ? error.message : 'Unknown error');
      await this.updateAudit(request, false);
      return false;
    }
  }

  /**
   * Request basic permissions needed for core functionality
   * @param requestedBy Which component is requesting the permissions
   * @returns Promise that resolves with true if permissions were granted
   */
  static async requestBasicPermissions(requestedBy: string): Promise<boolean> {
    const request: PermissionRequest = {
      permissions: this.OPTIONAL_PERMISSIONS,
      reason: 'Access current tab content and connect to OpenRouter API',
      requestedBy
    };

    return this.requestPermissions(request);
  }

  /**
   * Request advanced permissions for enhanced features
   * @param requestedBy Which component is requesting the permissions
   * @returns Promise that resolves with true if permissions were granted
   */
  static async requestAdvancedPermissions(requestedBy: string): Promise<boolean> {
    const request: PermissionRequest = {
      permissions: this.ADVANCED_PERMISSIONS,
      reason: 'Enable advanced automation features across all websites',
      requestedBy
    };

    return this.requestPermissions(request);
  }

  /**
   * Check if specific permissions are granted
   * @param permissions The permissions to check
   * @returns Promise that resolves with true if permissions are granted
   */
  static async hasPermissions(permissions: chrome.permissions.Permissions): Promise<boolean> {
    try {
      return await chrome.permissions.contains(permissions);
    } catch (error) {
      console.error('Failed to check permissions:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if the extension has basic permissions
   * @returns Promise that resolves with true if basic permissions are granted
   */
  static async hasBasicPermissions(): Promise<boolean> {
    return this.hasPermissions(this.OPTIONAL_PERMISSIONS);
  }

  /**
   * Check if the extension has advanced permissions
   * @returns Promise that resolves with true if advanced permissions are granted
   */
  static async hasAdvancedPermissions(): Promise<boolean> {
    return this.hasPermissions(this.ADVANCED_PERMISSIONS);
  }

  /**
   * Remove optional permissions
   * @param permissions The permissions to remove
   * @returns Promise that resolves with true if permissions were removed
   */
  static async removePermissions(permissions: chrome.permissions.Permissions): Promise<boolean> {
    try {
      // Don't allow removing required permissions
      const isRequired = await this.isRequiredPermission(permissions);
      if (isRequired) {
        throw new Error('Cannot remove required permissions');
      }

      const removed = await chrome.permissions.remove(permissions);

      if (removed) {
        console.log(`Permissions removed: ${JSON.stringify(permissions)}`);
        await this.updateAuditForRemoval(permissions);
      }

      return removed;
    } catch (error) {
      console.error('Failed to remove permissions:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get current permission status
   * @returns Promise that resolves with current permission status
   */
  static async getCurrentStatus(): Promise<PermissionStatus> {
    try {
      const granted = await chrome.permissions.getAll();
      const optional = await chrome.permissions.contains(this.OPTIONAL_PERMISSIONS);
      const required = await chrome.permissions.contains(this.REQUIRED_PERMISSIONS);

      return {
        granted,
        optional: optional ? this.OPTIONAL_PERMISSIONS : { permissions: [], origins: [] },
        required: required ? this.REQUIRED_PERMISSIONS : { permissions: [], origins: [] },
        lastChecked: Date.now()
      };
    } catch (error) {
      console.error('Failed to get current permission status:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to get permission status');
    }
  }

  /**
   * Get permission audit information
   * @returns Promise that resolves with permission audit data
   */
  static async getPermissionAudit(): Promise<PermissionAudit[]> {
    try {
      const result = await chrome.storage.local.get([this.AUDIT_KEY]);
      return result[this.AUDIT_KEY] || [];
    } catch (error) {
      console.error('Failed to get permission audit:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Record permission usage for auditing
   * @param permission The permission that was used
   * @param context Context of how the permission was used
   */
  static async recordPermissionUsage(permission: string, context: string): Promise<void> {
    try {
      const audit = await this.getPermissionAudit();
      const permissionAudit = audit.find(a => a.permission === permission);

      if (permissionAudit) {
        permissionAudit.lastUsed = Date.now();
        permissionAudit.usageCount++;
      } else {
        audit.push({
          permission,
          granted: true,
          requestedAt: Date.now(),
          grantedAt: Date.now(),
          lastUsed: Date.now(),
          usageCount: 1,
          requestedBy: context
        });
      }

      await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
    } catch (error) {
      console.error('Failed to record permission usage:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate permission request before making it
   * @param request The permission request to validate
   * @returns True if the request is valid
   */
  private static validatePermissionRequest(request: PermissionRequest): boolean {
    if (!request || !request.permissions || !request.reason || !request.requestedBy) {
      return false;
    }

    // Check if requested permissions are known
    const knownPermissions = [
      ...this.REQUIRED_PERMISSIONS.permissions || [],
      ...this.OPTIONAL_PERMISSIONS.permissions || [],
      ...this.ADVANCED_PERMISSIONS.permissions || []
    ];

    const requestedPermissions = request.permissions.permissions || [];
    for (const perm of requestedPermissions) {
      if (!knownPermissions.includes(perm)) {
        console.warn(`Unknown permission requested: ${perm}`);
      }
    }

    // Check if requested origins are reasonable
    const requestedOrigins = request.permissions.origins || [];
    const knownOrigins = [
      ...(this.OPTIONAL_PERMISSIONS.origins || []),
      ...(this.ADVANCED_PERMISSIONS.origins || [])
    ];

    for (const origin of requestedOrigins) {
      if (!knownOrigins.some(known => origin.includes(known.replace('*', '')) || known.includes(origin.replace('*', '')))) {
        console.warn(`Potentially unsafe origin requested: ${origin}`);
      }
    }

    return true;
  }

  /**
   * Initialize permission audit with current permissions
   * @param status Current permission status
   */
  private static async initializeAudit(status: PermissionStatus): Promise<void> {
    try {
      const existingAudit = await this.getPermissionAudit();
      
      if (existingAudit.length === 0) {
        const audit: PermissionAudit[] = [];
        const now = Date.now();

        // Add required permissions
        for (const perm of status.required.permissions || []) {
          audit.push({
            permission: perm,
            granted: true,
            requestedAt: now,
            grantedAt: now,
            usageCount: 0,
            requestedBy: 'system'
          });
        }

        // Add optional permissions
        for (const perm of status.optional.permissions || []) {
          audit.push({
            permission: perm,
            granted: true,
            requestedAt: now,
            grantedAt: now,
            usageCount: 0,
            requestedBy: 'system'
          });
        }

        await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
      }
    } catch (error) {
      console.error('Failed to initialize permission audit:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Update audit information for permission request
   * @param request The permission request
   * @param granted Whether the permission was granted
   */
  private static async updateAudit(request: PermissionRequest, granted: boolean): Promise<void> {
    try {
      const audit = await this.getPermissionAudit();
      const now = Date.now();

      // Add entries for all requested permissions
      for (const perm of request.permissions.permissions || []) {
        const existingEntry = audit.find(a => a.permission === perm);
        
        if (existingEntry) {
          existingEntry.requestedAt = now;
          if (granted) {
            existingEntry.granted = true;
            existingEntry.grantedAt = now;
          }
        } else {
          audit.push({
            permission: perm,
            granted,
            requestedAt: now,
            grantedAt: granted ? now : undefined,
            requestedBy: request.requestedBy,
            usageCount: 0
          });
        }
      }

      // Add entries for all requested origins
      for (const origin of request.permissions.origins || []) {
        const existingEntry = audit.find(a => a.permission === origin);
        
        if (existingEntry) {
          existingEntry.requestedAt = now;
          if (granted) {
            existingEntry.granted = true;
            existingEntry.grantedAt = now;
          }
        } else {
          audit.push({
            permission: origin,
            granted,
            requestedAt: now,
            grantedAt: granted ? now : undefined,
            requestedBy: request.requestedBy,
            usageCount: 0
          });
        }
      }

      await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
    } catch (error) {
      console.error('Failed to update permission audit:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Update audit for permission removal
   * @param permissions The permissions that were removed
   */
  private static async updateAuditForRemoval(permissions: chrome.permissions.Permissions): Promise<void> {
    try {
      const audit = await this.getPermissionAudit();

      // Mark permissions as not granted
      for (const perm of permissions.permissions || []) {
        const entry = audit.find(a => a.permission === perm);
        if (entry) {
          entry.granted = false;
        }
      }

      for (const origin of permissions.origins || []) {
        const entry = audit.find(a => a.permission === origin);
        if (entry) {
          entry.granted = false;
        }
      }

      await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
    } catch (error) {
      console.error('Failed to update audit for permission removal:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check if a permission is required
   * @param permissions The permissions to check
   * @returns True if any of the permissions are required
   */
  private static async isRequiredPermission(permissions: chrome.permissions.Permissions): Promise<boolean> {
    const requiredPerms = this.REQUIRED_PERMISSIONS.permissions || [];
    const requestedPerms = permissions.permissions || [];

    return requestedPerms.some(perm => requiredPerms.includes(perm));
  }
} * Permission Management for Ray Chrome Extension
 * Handles permission requests, validation, and management
 */

export interface PermissionRequest {
  permissions: chrome.permissions.Permissions;
  origins?: string[];
  reason: string;
  requestedBy: string; // Which agent/component requested it
}

export interface PermissionStatus {
  granted: chrome.permissions.Permissions;
  optional: chrome.permissions.Permissions;
  required: chrome.permissions.Permissions;
  lastChecked: number;
}

export interface PermissionAudit {
  permission: string;
  granted: boolean;
  requestedAt: number;
  grantedAt?: number;
  lastUsed?: number;
  usageCount: number;
  requestedBy: string;
}

export class PermissionManager {
  private static readonly AUDIT_KEY = 'permissionAudit';
  private static readonly REQUIRED_PERMISSIONS: chrome.permissions.Permissions = {
    permissions: ['storage']
  };

  private static readonly OPTIONAL_PERMISSIONS: chrome.permissions.Permissions = {
    permissions: ['activeTab'],
    origins: ['https://openrouter.ai/*']
  };

  private static readonly ADVANCED_PERMISSIONS: chrome.permissions.Permissions = {
    permissions: ['scripting', 'tabs'],
    origins: ['<all_urls>']
  };

  /**
   * Initialize permission system and check current status
   * @returns Promise that resolves with current permission status
   */
  static async initialize(): Promise<PermissionStatus> {
    try {
      const [granted, optional, required] = await Promise.all([
        chrome.permissions.getAll(),
        chrome.permissions.contains(this.OPTIONAL_PERMISSIONS),
        chrome.permissions.contains(this.REQUIRED_PERMISSIONS)
      ]);

      const status: PermissionStatus = {
        granted,
        optional: optional ? this.OPTIONAL_PERMISSIONS : { permissions: [], origins: [] },
        required: required ? this.REQUIRED_PERMISSIONS : { permissions: [], origins: [] },
        lastChecked: Date.now()
      };

      // Initialize audit if needed
      await this.initializeAudit(status);

      return status;
    } catch (error) {
      console.error('Failed to initialize permission manager:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Permission initialization failed');
    }
  }

  /**
   * Request optional permissions with user approval
   * @param request The permission request details
   * @returns Promise that resolves with true if permissions were granted
   */
  static async requestPermissions(request: PermissionRequest): Promise<boolean> {
    try {
      // Validate the request
      if (!this.validatePermissionRequest(request)) {
        throw new Error('Invalid permission request');
      }

      // Check if permissions are already granted
      const alreadyGranted = await chrome.permissions.contains(request.permissions);
      if (alreadyGranted) {
        await this.updateAudit(request, true);
        return true;
      }

      // Request permissions from user
      const granted = await chrome.permissions.request(request.permissions);

      // Log the request in audit
      await this.updateAudit(request, granted);

      if (granted) {
        console.log(`Permissions granted: ${JSON.stringify(request.permissions)} for ${request.reason}`);
      } else {
        console.warn(`Permissions denied: ${JSON.stringify(request.permissions)} for ${request.reason}`);
      }

      return granted;
    } catch (error) {
      console.error('Failed to request permissions:', error instanceof Error ? error.message : 'Unknown error');
      await this.updateAudit(request, false);
      return false;
    }
  }

  /**
   * Request basic permissions needed for core functionality
   * @param requestedBy Which component is requesting the permissions
   * @returns Promise that resolves with true if permissions were granted
   */
  static async requestBasicPermissions(requestedBy: string): Promise<boolean> {
    const request: PermissionRequest = {
      permissions: this.OPTIONAL_PERMISSIONS,
      reason: 'Access current tab content and connect to OpenRouter API',
      requestedBy
    };

    return this.requestPermissions(request);
  }

  /**
   * Request advanced permissions for enhanced features
   * @param requestedBy Which component is requesting the permissions
   * @returns Promise that resolves with true if permissions were granted
   */
  static async requestAdvancedPermissions(requestedBy: string): Promise<boolean> {
    const request: PermissionRequest = {
      permissions: this.ADVANCED_PERMISSIONS,
      reason: 'Enable advanced automation features across all websites',
      requestedBy
    };

    return this.requestPermissions(request);
  }

  /**
   * Check if specific permissions are granted
   * @param permissions The permissions to check
   * @returns Promise that resolves with true if permissions are granted
   */
  static async hasPermissions(permissions: chrome.permissions.Permissions): Promise<boolean> {
    try {
      return await chrome.permissions.contains(permissions);
    } catch (error) {
      console.error('Failed to check permissions:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if the extension has basic permissions
   * @returns Promise that resolves with true if basic permissions are granted
   */
  static async hasBasicPermissions(): Promise<boolean> {
    return this.hasPermissions(this.OPTIONAL_PERMISSIONS);
  }

  /**
   * Check if the extension has advanced permissions
   * @returns Promise that resolves with true if advanced permissions are granted
   */
  static async hasAdvancedPermissions(): Promise<boolean> {
    return this.hasPermissions(this.ADVANCED_PERMISSIONS);
  }

  /**
   * Remove optional permissions
   * @param permissions The permissions to remove
   * @returns Promise that resolves with true if permissions were removed
   */
  static async removePermissions(permissions: chrome.permissions.Permissions): Promise<boolean> {
    try {
      // Don't allow removing required permissions
      const isRequired = await this.isRequiredPermission(permissions);
      if (isRequired) {
        throw new Error('Cannot remove required permissions');
      }

      const removed = await chrome.permissions.remove(permissions);

      if (removed) {
        console.log(`Permissions removed: ${JSON.stringify(permissions)}`);
        await this.updateAuditForRemoval(permissions);
      }

      return removed;
    } catch (error) {
      console.error('Failed to remove permissions:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get current permission status
   * @returns Promise that resolves with current permission status
   */
  static async getCurrentStatus(): Promise<PermissionStatus> {
    try {
      const granted = await chrome.permissions.getAll();
      const optional = await chrome.permissions.contains(this.OPTIONAL_PERMISSIONS);
      const required = await chrome.permissions.contains(this.REQUIRED_PERMISSIONS);

      return {
        granted,
        optional: optional ? this.OPTIONAL_PERMISSIONS : { permissions: [], origins: [] },
        required: required ? this.REQUIRED_PERMISSIONS : { permissions: [], origins: [] },
        lastChecked: Date.now()
      };
    } catch (error) {
      console.error('Failed to get current permission status:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to get permission status');
    }
  }

  /**
   * Get permission audit information
   * @returns Promise that resolves with permission audit data
   */
  static async getPermissionAudit(): Promise<PermissionAudit[]> {
    try {
      const result = await chrome.storage.local.get([this.AUDIT_KEY]);
      return result[this.AUDIT_KEY] || [];
    } catch (error) {
      console.error('Failed to get permission audit:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Record permission usage for auditing
   * @param permission The permission that was used
   * @param context Context of how the permission was used
   */
  static async recordPermissionUsage(permission: string, context: string): Promise<void> {
    try {
      const audit = await this.getPermissionAudit();
      const permissionAudit = audit.find(a => a.permission === permission);

      if (permissionAudit) {
        permissionAudit.lastUsed = Date.now();
        permissionAudit.usageCount++;
      } else {
        audit.push({
          permission,
          granted: true,
          requestedAt: Date.now(),
          grantedAt: Date.now(),
          lastUsed: Date.now(),
          usageCount: 1,
          requestedBy: context
        });
      }

      await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
    } catch (error) {
      console.error('Failed to record permission usage:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate permission request before making it
   * @param request The permission request to validate
   * @returns True if the request is valid
   */
  private static validatePermissionRequest(request: PermissionRequest): boolean {
    if (!request || !request.permissions || !request.reason || !request.requestedBy) {
      return false;
    }

    // Check if requested permissions are known
    const knownPermissions = [
      ...this.REQUIRED_PERMISSIONS.permissions || [],
      ...this.OPTIONAL_PERMISSIONS.permissions || [],
      ...this.ADVANCED_PERMISSIONS.permissions || []
    ];

    const requestedPermissions = request.permissions.permissions || [];
    for (const perm of requestedPermissions) {
      if (!knownPermissions.includes(perm)) {
        console.warn(`Unknown permission requested: ${perm}`);
      }
    }

    // Check if requested origins are reasonable
    const requestedOrigins = request.permissions.origins || [];
    const knownOrigins = [
      ...(this.OPTIONAL_PERMISSIONS.origins || []),
      ...(this.ADVANCED_PERMISSIONS.origins || [])
    ];

    for (const origin of requestedOrigins) {
      if (!knownOrigins.some(known => origin.includes(known.replace('*', '')) || known.includes(origin.replace('*', '')))) {
        console.warn(`Potentially unsafe origin requested: ${origin}`);
      }
    }

    return true;
  }

  /**
   * Initialize permission audit with current permissions
   * @param status Current permission status
   */
  private static async initializeAudit(status: PermissionStatus): Promise<void> {
    try {
      const existingAudit = await this.getPermissionAudit();
      
      if (existingAudit.length === 0) {
        const audit: PermissionAudit[] = [];
        const now = Date.now();

        // Add required permissions
        for (const perm of status.required.permissions || []) {
          audit.push({
            permission: perm,
            granted: true,
            requestedAt: now,
            grantedAt: now,
            usageCount: 0,
            requestedBy: 'system'
          });
        }

        // Add optional permissions
        for (const perm of status.optional.permissions || []) {
          audit.push({
            permission: perm,
            granted: true,
            requestedAt: now,
            grantedAt: now,
            usageCount: 0,
            requestedBy: 'system'
          });
        }

        await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
      }
    } catch (error) {
      console.error('Failed to initialize permission audit:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Update audit information for permission request
   * @param request The permission request
   * @param granted Whether the permission was granted
   */
  private static async updateAudit(request: PermissionRequest, granted: boolean): Promise<void> {
    try {
      const audit = await this.getPermissionAudit();
      const now = Date.now();

      // Add entries for all requested permissions
      for (const perm of request.permissions.permissions || []) {
        const existingEntry = audit.find(a => a.permission === perm);
        
        if (existingEntry) {
          existingEntry.requestedAt = now;
          if (granted) {
            existingEntry.granted = true;
            existingEntry.grantedAt = now;
          }
        } else {
          audit.push({
            permission: perm,
            granted,
            requestedAt: now,
            grantedAt: granted ? now : undefined,
            requestedBy: request.requestedBy,
            usageCount: 0
          });
        }
      }

      // Add entries for all requested origins
      for (const origin of request.permissions.origins || []) {
        const existingEntry = audit.find(a => a.permission === origin);
        
        if (existingEntry) {
          existingEntry.requestedAt = now;
          if (granted) {
            existingEntry.granted = true;
            existingEntry.grantedAt = now;
          }
        } else {
          audit.push({
            permission: origin,
            granted,
            requestedAt: now,
            grantedAt: granted ? now : undefined,
            requestedBy: request.requestedBy,
            usageCount: 0
          });
        }
      }

      await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
    } catch (error) {
      console.error('Failed to update permission audit:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Update audit for permission removal
   * @param permissions The permissions that were removed
   */
  private static async updateAuditForRemoval(permissions: chrome.permissions.Permissions): Promise<void> {
    try {
      const audit = await this.getPermissionAudit();

      // Mark permissions as not granted
      for (const perm of permissions.permissions || []) {
        const entry = audit.find(a => a.permission === perm);
        if (entry) {
          entry.granted = false;
        }
      }

      for (const origin of permissions.origins || []) {
        const entry = audit.find(a => a.permission === origin);
        if (entry) {
          entry.granted = false;
        }
      }

      await chrome.storage.local.set({ [this.AUDIT_KEY]: audit });
    } catch (error) {
      console.error('Failed to update audit for permission removal:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Check if a permission is required
   * @param permissions The permissions to check
   * @returns True if any of the permissions are required
   */
  private static async isRequiredPermission(permissions: chrome.permissions.Permissions): Promise<boolean> {
    const requiredPerms = this.REQUIRED_PERMISSIONS.permissions || [];
    const requestedPerms = permissions.permissions || [];

    return requestedPerms.some(perm => requiredPerms.includes(perm));
  }
}
