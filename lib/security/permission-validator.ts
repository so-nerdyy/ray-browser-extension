/**
 * Permission Validation for Ray Chrome Extension
 * Handles permission compliance checks and validation
 */

import { PermissionManager, PermissionAudit } from './permission-manager';

export interface ValidationRule {
  name: string;
  description: string;
  validate: (permissions: chrome.permissions.Permissions) => Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

export interface PermissionComplianceReport {
  overallCompliance: boolean;
  validationResults: ValidationResult[];
  auditSummary: {
    totalPermissions: number;
    grantedPermissions: number;
    unusedPermissions: number;
    overprivilegedPermissions: number;
  };
  recommendations: string[];
  lastChecked: number;
}

export class PermissionValidator {
  private static readonly validationRules: ValidationRule[] = [
    {
      name: 'Principle of Least Privilege',
      description: 'Check if extension follows principle of least privilege',
      validate: this.validateLeastPrivilege.bind(this)
    },
    {
      name: 'Required Permissions Check',
      description: 'Ensure all required permissions are granted',
      validate: this.validateRequiredPermissions.bind(this)
    },
    {
      name: 'Permission Usage Analysis',
      description: 'Analyze if granted permissions are being used',
      validate: this.validatePermissionUsage.bind(this)
    },
    {
      name: 'Security Risk Assessment',
      description: 'Assess security risks of current permissions',
      validate: this.validateSecurityRisks.bind(this)
    },
    {
      name: 'Chrome Web Store Compliance',
      description: 'Check Chrome Web Store compliance',
      validate: this.validateStoreCompliance.bind(this)
    }
  ];

  /**
   * Validate all permissions against compliance rules
   * @returns Promise that resolves with compliance report
   */
  static async validatePermissions(): Promise<PermissionComplianceReport> {
    try {
      const currentStatus = await PermissionManager.getCurrentStatus();
      const audit = await PermissionManager.getPermissionAudit();
      
      const validationResults: ValidationResult[] = [];
      
      // Run all validation rules
      for (const rule of this.validationRules) {
        const result = await rule.validate(currentStatus.granted);
        validationResults.push(result);
      }

      // Generate audit summary
      const auditSummary = this.generateAuditSummary(audit);
      
      // Generate overall recommendations
      const recommendations = this.generateRecommendations(validationResults, auditSummary);

      // Calculate overall compliance
      const overallCompliance = validationResults.every(result => result.isValid) && 
                                auditSummary.overprivilegedPermissions === 0;

      return {
        overallCompliance,
        validationResults,
        auditSummary,
        recommendations,
        lastChecked: Date.now()
      };
    } catch (error) {
      console.error('Permission validation failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to validate permissions');
    }
  }

  /**
   * Validate principle of least privilege
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateLeastPrivilege(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];

      // Check for broad permissions
      if (grantedOrigins.includes('<all_urls>')) {
        result.warnings.push('Extension has access to all URLs (<all_urls>)');
        result.recommendations.push('Consider using specific origins instead of <all_urls>');
      }

      // Check for potentially dangerous permissions
      const dangerousPermissions = ['nativeMessaging', 'debugger', 'pageCapture'];
      for (const perm of dangerousPermissions) {
        if (grantedPermissions.includes(perm)) {
          result.warnings.push(`Extension has potentially dangerous permission: ${perm}`);
          result.recommendations.push(`Review if ${perm} permission is absolutely necessary`);
        }
      }

      // Check for excessive origins
      if (grantedOrigins.length > 10) {
        result.warnings.push(`Extension has many origin permissions: ${grantedOrigins.length}`);
        result.recommendations.push('Consider reducing the number of origin permissions');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate least privilege principle');
      return result;
    }
  }

  /**
   * Validate required permissions are granted
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateRequiredPermissions(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const requiredPermissions = ['storage']; // Minimum required permissions

      for (const required of requiredPermissions) {
        if (!grantedPermissions.includes(required)) {
          result.isValid = false;
          result.errors.push(`Required permission missing: ${required}`);
          result.recommendations.push(`Request ${required} permission`);
        }
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate required permissions');
      return result;
    }
  }

  /**
   * Validate permission usage patterns
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validatePermissionUsage(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const audit = await PermissionManager.getPermissionAudit();
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      // Check for unused permissions
      for (const perm of grantedPermissions) {
        const auditEntry = audit.find(a => a.permission === perm);
        if (!auditEntry || !auditEntry.lastUsed || auditEntry.lastUsed < thirtyDaysAgo) {
          result.warnings.push(`Permission appears unused: ${perm}`);
          result.recommendations.push(`Consider removing ${perm} permission if not needed`);
        }
      }

      // Check for unused origins
      for (const origin of grantedOrigins) {
        const auditEntry = audit.find(a => a.permission === origin);
        if (!auditEntry || !auditEntry.lastUsed || auditEntry.lastUsed < thirtyDaysAgo) {
          result.warnings.push(`Origin appears unused: ${origin}`);
          result.recommendations.push(`Consider removing ${origin} if not needed`);
        }
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate permission usage');
      return result;
    }
  }

  /**
   * Validate security risks
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateSecurityRisks(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];

      // High-risk permissions
      const highRiskPermissions = [
        { perm: 'nativeMessaging', risk: 'Can communicate with native applications' },
        { perm: 'debugger', risk: 'Can access Chrome debugger API' },
        { perm: 'pageCapture', risk: 'Can capture page content' },
        { perm: 'privacy', risk: 'Can access privacy-related settings' }
      ];

      for (const { perm, risk } of highRiskPermissions) {
        if (grantedPermissions.includes(perm)) {
          result.warnings.push(`High-risk permission: ${perm} - ${risk}`);
          result.recommendations.push(`Ensure ${perm} is absolutely necessary and well-documented`);
        }
      }

      // Check for http origins (should be https)
      const httpOrigins = grantedOrigins.filter(origin => origin.includes('http://'));
      if (httpOrigins.length > 0) {
        result.warnings.push('Extension has access to HTTP origins (insecure)');
        result.recommendations.push('Use HTTPS origins instead of HTTP where possible');
      }

      // Check for wildcard origins
      const wildcardOrigins = grantedOrigins.filter(origin => origin.includes('*://*/*'));
      if (wildcardOrigins.length > 0) {
        result.warnings.push('Extension has wildcard origin access');
        result.recommendations.push('Use more specific origins instead of wildcards');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate security risks');
      return result;
    }
  }

  /**
   * Validate Chrome Web Store compliance
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateStoreCompliance(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];

      // Check for forbidden permissions
      const forbiddenPermissions = ['eval', 'unsafeEval']; // These are not actual Chrome permissions but represent concepts
      for (const forbidden of forbiddenPermissions) {
        if (grantedPermissions.includes(forbidden)) {
          result.isValid = false;
          result.errors.push(`Forbidden permission: ${forbidden}`);
        }
      }

      // Check for excessive permissions that might trigger store review
      if (grantedPermissions.length > 15) {
        result.warnings.push(`Many permissions requested: ${grantedPermissions.length}`);
        result.recommendations.push('Consider reducing permissions to avoid extended store review');
      }

      // Check for origins that might trigger review
      const sensitiveOrigins = grantedOrigins.filter(origin => 
        origin.includes('chrome://') || 
        origin.includes('chrome-extension://') ||
        origin.includes('file://')
      );

      if (sensitiveOrigins.length > 0) {
        result.warnings.push('Extension has access to sensitive origins');
        result.recommendations.push('Ensure sensitive origin access is well-justified');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate store compliance');
      return result;
    }
  }

  /**
   * Generate audit summary from permission audit data
   * @param audit Permission audit data
   * @returns Audit summary
   */
  private static generateAuditSummary(audit: PermissionAudit[]) {
    const totalPermissions = audit.length;
    const grantedPermissions = audit.filter(a => a.granted).length;
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const unusedPermissions = audit.filter(a => 
      a.granted && (!a.lastUsed || a.lastUsed < thirtyDaysAgo)
    ).length;

    // Count potentially overprivileged permissions
    const overprivilegedPermissions = audit.filter(a => {
      if (!a.granted) return false;
      
      // Consider permissions with broad access as overprivileged
      return a.permission.includes('<all_urls>') ||
             a.permission.includes('*://*/*') ||
             a.permission === 'nativeMessaging' ||
             a.permission === 'debugger';
    }).length;

    return {
      totalPermissions,
      grantedPermissions,
      unusedPermissions,
      overprivilegedPermissions
    };
  }

  /**
   * Generate recommendations based on validation results
   * @param validationResults Validation results
   * @param auditSummary Audit summary
   * @returns Recommendations list
   */
  private static generateRecommendations(
    validationResults: ValidationResult[], 
    auditSummary: { unusedPermissions: number; overprivilegedPermissions: number }
  ): string[] {
    const recommendations: string[] = [];

    // Collect all recommendations from validation results
    for (const result of validationResults) {
      recommendations.push(...result.recommendations);
    }

    // Add specific recommendations based on audit summary
    if (auditSummary.unusedPermissions > 0) {
      recommendations.push(`${auditSummary.unusedPermissions} permissions appear unused - consider removing them`);
    }

    if (auditSummary.overprivilegedPermissions > 0) {
      recommendations.push(`${auditSummary.overprivilegedPermissions} permissions may be overprivileged - review necessity`);
    }

    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push('Permission configuration looks good - continue monitoring usage');
    }

    recommendations.push('Regularly review permission usage and necessity');
    recommendations.push('Document why each permission is needed for transparency');

    return recommendations;
  }

  /**
   * Check if a specific permission is safe to request
   * @param permission The permission to check
   * @returns True if the permission is considered safe
   */
  static isPermissionSafe(permission: string): boolean {
    const safePermissions = [
      'storage',
      'activeTab',
      'contextMenus',
      'tabs',
      'scripting'
    ];

    const moderateRiskPermissions = [
      'webNavigation',
      'webRequest',
      'cookies',
      'background'
    ];

    const highRiskPermissions = [
      'nativeMessaging',
      'debugger',
      'pageCapture',
      'privacy',
      'processes'
    ];

    if (safePermissions.includes(permission)) {
      return true;
    }

    if (moderateRiskPermissions.includes(permission)) {
      return false; // Not automatically safe, requires justification
    }

    if (highRiskPermissions.includes(permission)) {
      return false; // High risk, requires strong justification
    }

    // Unknown permissions - assume unsafe
    return false;
  }

  /**
   * Check if an origin is safe to request
   * @param origin The origin to check
   * @returns True if the origin is considered safe
   */
  static isOriginSafe(origin: string): boolean {
    // HTTPS origins are generally safe
    if (origin.startsWith('https://')) {
      return true;
    }

    // Specific allowed origins
    const allowedOrigins = [
      'https://openrouter.ai/*'
    ];

    if (allowedOrigins.includes(origin)) {
      return true;
    }

    // HTTP origins are not safe
    if (origin.startsWith('http://')) {
      return false;
    }

    // Chrome extension origins are generally safe
    if (origin.startsWith('chrome-extension://')) {
      return true;
    }

    // Wildcard origins are not safe
    if (origin.includes('*://*/*') || origin === '<all_urls>') {
      return false;
    }

    // Unknown origins - assume unsafe
    return false;
  }
} * Permission Validation for Ray Chrome Extension
 * Handles permission compliance checks and validation
 */

import { PermissionManager, PermissionAudit } from './permission-manager';

export interface ValidationRule {
  name: string;
  description: string;
  validate: (permissions: chrome.permissions.Permissions) => Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

export interface PermissionComplianceReport {
  overallCompliance: boolean;
  validationResults: ValidationResult[];
  auditSummary: {
    totalPermissions: number;
    grantedPermissions: number;
    unusedPermissions: number;
    overprivilegedPermissions: number;
  };
  recommendations: string[];
  lastChecked: number;
}

export class PermissionValidator {
  private static readonly validationRules: ValidationRule[] = [
    {
      name: 'Principle of Least Privilege',
      description: 'Check if extension follows principle of least privilege',
      validate: this.validateLeastPrivilege.bind(this)
    },
    {
      name: 'Required Permissions Check',
      description: 'Ensure all required permissions are granted',
      validate: this.validateRequiredPermissions.bind(this)
    },
    {
      name: 'Permission Usage Analysis',
      description: 'Analyze if granted permissions are being used',
      validate: this.validatePermissionUsage.bind(this)
    },
    {
      name: 'Security Risk Assessment',
      description: 'Assess security risks of current permissions',
      validate: this.validateSecurityRisks.bind(this)
    },
    {
      name: 'Chrome Web Store Compliance',
      description: 'Check Chrome Web Store compliance',
      validate: this.validateStoreCompliance.bind(this)
    }
  ];

  /**
   * Validate all permissions against compliance rules
   * @returns Promise that resolves with compliance report
   */
  static async validatePermissions(): Promise<PermissionComplianceReport> {
    try {
      const currentStatus = await PermissionManager.getCurrentStatus();
      const audit = await PermissionManager.getPermissionAudit();
      
      const validationResults: ValidationResult[] = [];
      
      // Run all validation rules
      for (const rule of this.validationRules) {
        const result = await rule.validate(currentStatus.granted);
        validationResults.push(result);
      }

      // Generate audit summary
      const auditSummary = this.generateAuditSummary(audit);
      
      // Generate overall recommendations
      const recommendations = this.generateRecommendations(validationResults, auditSummary);

      // Calculate overall compliance
      const overallCompliance = validationResults.every(result => result.isValid) && 
                                auditSummary.overprivilegedPermissions === 0;

      return {
        overallCompliance,
        validationResults,
        auditSummary,
        recommendations,
        lastChecked: Date.now()
      };
    } catch (error) {
      console.error('Permission validation failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to validate permissions');
    }
  }

  /**
   * Validate principle of least privilege
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateLeastPrivilege(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];

      // Check for broad permissions
      if (grantedOrigins.includes('<all_urls>')) {
        result.warnings.push('Extension has access to all URLs (<all_urls>)');
        result.recommendations.push('Consider using specific origins instead of <all_urls>');
      }

      // Check for potentially dangerous permissions
      const dangerousPermissions = ['nativeMessaging', 'debugger', 'pageCapture'];
      for (const perm of dangerousPermissions) {
        if (grantedPermissions.includes(perm)) {
          result.warnings.push(`Extension has potentially dangerous permission: ${perm}`);
          result.recommendations.push(`Review if ${perm} permission is absolutely necessary`);
        }
      }

      // Check for excessive origins
      if (grantedOrigins.length > 10) {
        result.warnings.push(`Extension has many origin permissions: ${grantedOrigins.length}`);
        result.recommendations.push('Consider reducing the number of origin permissions');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate least privilege principle');
      return result;
    }
  }

  /**
   * Validate required permissions are granted
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateRequiredPermissions(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const requiredPermissions = ['storage']; // Minimum required permissions

      for (const required of requiredPermissions) {
        if (!grantedPermissions.includes(required)) {
          result.isValid = false;
          result.errors.push(`Required permission missing: ${required}`);
          result.recommendations.push(`Request ${required} permission`);
        }
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate required permissions');
      return result;
    }
  }

  /**
   * Validate permission usage patterns
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validatePermissionUsage(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const audit = await PermissionManager.getPermissionAudit();
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      // Check for unused permissions
      for (const perm of grantedPermissions) {
        const auditEntry = audit.find(a => a.permission === perm);
        if (!auditEntry || !auditEntry.lastUsed || auditEntry.lastUsed < thirtyDaysAgo) {
          result.warnings.push(`Permission appears unused: ${perm}`);
          result.recommendations.push(`Consider removing ${perm} permission if not needed`);
        }
      }

      // Check for unused origins
      for (const origin of grantedOrigins) {
        const auditEntry = audit.find(a => a.permission === origin);
        if (!auditEntry || !auditEntry.lastUsed || auditEntry.lastUsed < thirtyDaysAgo) {
          result.warnings.push(`Origin appears unused: ${origin}`);
          result.recommendations.push(`Consider removing ${origin} if not needed`);
        }
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate permission usage');
      return result;
    }
  }

  /**
   * Validate security risks
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateSecurityRisks(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];

      // High-risk permissions
      const highRiskPermissions = [
        { perm: 'nativeMessaging', risk: 'Can communicate with native applications' },
        { perm: 'debugger', risk: 'Can access Chrome debugger API' },
        { perm: 'pageCapture', risk: 'Can capture page content' },
        { perm: 'privacy', risk: 'Can access privacy-related settings' }
      ];

      for (const { perm, risk } of highRiskPermissions) {
        if (grantedPermissions.includes(perm)) {
          result.warnings.push(`High-risk permission: ${perm} - ${risk}`);
          result.recommendations.push(`Ensure ${perm} is absolutely necessary and well-documented`);
        }
      }

      // Check for http origins (should be https)
      const httpOrigins = grantedOrigins.filter(origin => origin.includes('http://'));
      if (httpOrigins.length > 0) {
        result.warnings.push('Extension has access to HTTP origins (insecure)');
        result.recommendations.push('Use HTTPS origins instead of HTTP where possible');
      }

      // Check for wildcard origins
      const wildcardOrigins = grantedOrigins.filter(origin => origin.includes('*://*/*'));
      if (wildcardOrigins.length > 0) {
        result.warnings.push('Extension has wildcard origin access');
        result.recommendations.push('Use more specific origins instead of wildcards');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate security risks');
      return result;
    }
  }

  /**
   * Validate Chrome Web Store compliance
   * @param permissions Current permissions
   * @returns Validation result
   */
  private static async validateStoreCompliance(permissions: chrome.permissions.Permissions): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    try {
      const grantedPermissions = permissions.permissions || [];
      const grantedOrigins = permissions.origins || [];

      // Check for forbidden permissions
      const forbiddenPermissions = ['eval', 'unsafeEval']; // These are not actual Chrome permissions but represent concepts
      for (const forbidden of forbiddenPermissions) {
        if (grantedPermissions.includes(forbidden)) {
          result.isValid = false;
          result.errors.push(`Forbidden permission: ${forbidden}`);
        }
      }

      // Check for excessive permissions that might trigger store review
      if (grantedPermissions.length > 15) {
        result.warnings.push(`Many permissions requested: ${grantedPermissions.length}`);
        result.recommendations.push('Consider reducing permissions to avoid extended store review');
      }

      // Check for origins that might trigger review
      const sensitiveOrigins = grantedOrigins.filter(origin => 
        origin.includes('chrome://') || 
        origin.includes('chrome-extension://') ||
        origin.includes('file://')
      );

      if (sensitiveOrigins.length > 0) {
        result.warnings.push('Extension has access to sensitive origins');
        result.recommendations.push('Ensure sensitive origin access is well-justified');
      }

      return result;
    } catch (error) {
      result.isValid = false;
      result.errors.push('Failed to validate store compliance');
      return result;
    }
  }

  /**
   * Generate audit summary from permission audit data
   * @param audit Permission audit data
   * @returns Audit summary
   */
  private static generateAuditSummary(audit: PermissionAudit[]) {
    const totalPermissions = audit.length;
    const grantedPermissions = audit.filter(a => a.granted).length;
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const unusedPermissions = audit.filter(a => 
      a.granted && (!a.lastUsed || a.lastUsed < thirtyDaysAgo)
    ).length;

    // Count potentially overprivileged permissions
    const overprivilegedPermissions = audit.filter(a => {
      if (!a.granted) return false;
      
      // Consider permissions with broad access as overprivileged
      return a.permission.includes('<all_urls>') ||
             a.permission.includes('*://*/*') ||
             a.permission === 'nativeMessaging' ||
             a.permission === 'debugger';
    }).length;

    return {
      totalPermissions,
      grantedPermissions,
      unusedPermissions,
      overprivilegedPermissions
    };
  }

  /**
   * Generate recommendations based on validation results
   * @param validationResults Validation results
   * @param auditSummary Audit summary
   * @returns Recommendations list
   */
  private static generateRecommendations(
    validationResults: ValidationResult[], 
    auditSummary: { unusedPermissions: number; overprivilegedPermissions: number }
  ): string[] {
    const recommendations: string[] = [];

    // Collect all recommendations from validation results
    for (const result of validationResults) {
      recommendations.push(...result.recommendations);
    }

    // Add specific recommendations based on audit summary
    if (auditSummary.unusedPermissions > 0) {
      recommendations.push(`${auditSummary.unusedPermissions} permissions appear unused - consider removing them`);
    }

    if (auditSummary.overprivilegedPermissions > 0) {
      recommendations.push(`${auditSummary.overprivilegedPermissions} permissions may be overprivileged - review necessity`);
    }

    // Add general recommendations
    if (recommendations.length === 0) {
      recommendations.push('Permission configuration looks good - continue monitoring usage');
    }

    recommendations.push('Regularly review permission usage and necessity');
    recommendations.push('Document why each permission is needed for transparency');

    return recommendations;
  }

  /**
   * Check if a specific permission is safe to request
   * @param permission The permission to check
   * @returns True if the permission is considered safe
   */
  static isPermissionSafe(permission: string): boolean {
    const safePermissions = [
      'storage',
      'activeTab',
      'contextMenus',
      'tabs',
      'scripting'
    ];

    const moderateRiskPermissions = [
      'webNavigation',
      'webRequest',
      'cookies',
      'background'
    ];

    const highRiskPermissions = [
      'nativeMessaging',
      'debugger',
      'pageCapture',
      'privacy',
      'processes'
    ];

    if (safePermissions.includes(permission)) {
      return true;
    }

    if (moderateRiskPermissions.includes(permission)) {
      return false; // Not automatically safe, requires justification
    }

    if (highRiskPermissions.includes(permission)) {
      return false; // High risk, requires strong justification
    }

    // Unknown permissions - assume unsafe
    return false;
  }

  /**
   * Check if an origin is safe to request
   * @param origin The origin to check
   * @returns True if the origin is considered safe
   */
  static isOriginSafe(origin: string): boolean {
    // HTTPS origins are generally safe
    if (origin.startsWith('https://')) {
      return true;
    }

    // Specific allowed origins
    const allowedOrigins = [
      'https://openrouter.ai/*'
    ];

    if (allowedOrigins.includes(origin)) {
      return true;
    }

    // HTTP origins are not safe
    if (origin.startsWith('http://')) {
      return false;
    }

    // Chrome extension origins are generally safe
    if (origin.startsWith('chrome-extension://')) {
      return true;
    }

    // Wildcard origins are not safe
    if (origin.includes('*://*/*') || origin === '<all_urls>') {
      return false;
    }

    // Unknown origins - assume unsafe
    return false;
  }
}
