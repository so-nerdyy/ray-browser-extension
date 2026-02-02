/**
 * Security Configuration for Ray Chrome Extension
 * Provides centralized security configuration management
 */

export interface SecurityConfig {
  version: string;
  lastUpdated: number;
  apiKeys: {
    enableEncryption: boolean;
    enableRotation: boolean;
    rotationInterval: number; // in days
    maxRetries: number;
  };
  permissions: {
    enableValidation: boolean;
    enableAudit: boolean;
    enableLeastPrivilege: boolean;
    maxPermissions: number;
    restrictedPermissions: string[];
  };
  csp: {
    enabled: boolean;
    policy: string;
    reportOnly: boolean;
    enableReporting: boolean;
  };
  inputValidation: {
    enabled: boolean;
    strictMode: boolean;
    enableSanitization: boolean;
    maxLength: number;
    allowedPatterns: string[];
    blockedPatterns: string[];
  };
  monitoring: {
    enabled: boolean;
    enableRealTime: boolean;
    enableThreatDetection: boolean;
    enableBehaviorAnalysis: boolean;
    retentionDays: number;
    alertThresholds: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  auditing: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    enableRemoteLogging: boolean;
    remoteEndpoint?: string;
    retentionDays: number;
    maxLogEntries: number;
  };
  agentCoordination: {
    enabled: boolean;
    enablePolicyEnforcement: boolean;
    enableEventSharing: boolean;
    enableCrossAgentAuth: boolean;
    maxAgents: number;
    policyRefreshInterval: number; // in minutes
  };
  compliance: {
    enabled: boolean;
    frameworks: string[];
    schedule: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      time: string;
    };
    notifications: {
      enabled: boolean;
      channels: ('email' | 'slack' | 'webhook')[];
      recipients: string[];
    };
  };
}

export class SecurityConfigManager {
  private static readonly DEFAULT_CONFIG: SecurityConfig = {
    version: '1.0.0',
    lastUpdated: Date.now(),
    apiKeys: {
      enableEncryption: true,
      enableRotation: false,
      rotationInterval: 30,
      maxRetries: 3
    },
    permissions: {
      enableValidation: true,
      enableAudit: true,
      enableLeastPrivilege: true,
      maxPermissions: 10,
      restrictedPermissions: ['<all_urls>', 'nativeMessaging', 'devtools']
    },
    csp: {
      enabled: true,
      policy: "script-src 'self'; connect-src https://openrouter.ai; default-src 'self';",
      reportOnly: false,
      enableReporting: true
    },
    inputValidation: {
      enabled: true,
      strictMode: true,
      enableSanitization: true,
      maxLength: 1000,
      allowedPatterns: [],
      blockedPatterns: [
        'javascript:',
        'data:',
        'vbscript:',
        '<script',
        'on\\w+\\s*=',
        'eval\\s*\\('
      ]
    },
    monitoring: {
      enabled: true,
      enableRealTime: true,
      enableThreatDetection: true,
      enableBehaviorAnalysis: true,
      retentionDays: 30,
      alertThresholds: {
        critical: 1,
        high: 5,
        medium: 10,
        low: 20
      }
    },
    auditing: {
      enabled: true,
      logLevel: 'info',
      enableRemoteLogging: false,
      retentionDays: 90,
      maxLogEntries: 10000
    },
    agentCoordination: {
      enabled: true,
      enablePolicyEnforcement: true,
      enableEventSharing: true,
      enableCrossAgentAuth: true,
      maxAgents: 10,
      policyRefreshInterval: 60
    },
    compliance: {
      enabled: true,
      frameworks: ['chrome_extension_security'],
      schedule: {
        enabled: false,
        frequency: 'monthly',
        time: '00:00'
      },
      notifications: {
        enabled: false,
        channels: [],
        recipients: []
      }
    }
  };

  private static readonly CONFIG_KEY = 'securityConfig';

  /**
   * Initialize security configuration
   * @param config Optional configuration overrides
   */
  static async initialize(config?: Partial<SecurityConfig>): Promise<void> {
    try {
      // Load existing configuration or create default
      const existingConfig = await this.loadConfig();
      const finalConfig = this.mergeConfigs(this.DEFAULT_CONFIG, existingConfig, config);
      
      // Validate configuration
      const validation = this.validateConfig(finalConfig);
      if (!validation.isValid) {
        console.warn('Security configuration validation failed:', validation.errors);
      }

      // Save configuration
      await this.saveConfig(finalConfig);

      console.log('Security configuration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration initialization failed');
    }
  }

  /**
   * Get security configuration
   * @returns Current security configuration
   */
  static async getConfig(): Promise<SecurityConfig> {
    try {
      return await this.loadConfig();
    } catch (error) {
      console.error('Failed to get security configuration:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update security configuration
   * @param updates Configuration updates
   */
  static async updateConfig(updates: Partial<SecurityConfig>): Promise<void> {
    try {
      const currentConfig = await this.loadConfig();
      const updatedConfig = this.mergeConfigs(currentConfig, updates);
      
      // Validate updated configuration
      const validation = this.validateConfig(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Save updated configuration
      await this.saveConfig(updatedConfig);

      console.log('Security configuration updated successfully');
    } catch (error) {
      console.error('Failed to update security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration update failed');
    }
  }

  /**
   * Reset security configuration to defaults
   */
  static async resetConfig(): Promise<void> {
    try {
      await this.saveConfig(this.DEFAULT_CONFIG);
      console.log('Security configuration reset to defaults');
    } catch (error) {
      console.error('Failed to reset security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration reset failed');
    }
  }

  /**
   * Export security configuration
   * @param format Export format ('json' | 'yaml')
   * @returns Exported configuration
   */
  static async exportConfig(format: 'json' | 'yaml' = 'json'): Promise<string> {
    try {
      const config = await this.loadConfig();
      
      if (format === 'json') {
        return JSON.stringify(config, null, 2);
      } else if (format === 'yaml') {
        // Simple YAML conversion (would use a proper YAML library in production)
        return this.convertToYAML(config);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration export failed');
    }
  }

  /**
   * Import security configuration
   * @param configData Configuration data to import
   * @param format Format of the configuration data ('json' | 'yaml')
   */
  static async importConfig(configData: string, format: 'json' | 'yaml' = 'json'): Promise<void> {
    try {
      let config: Partial<SecurityConfig>;
      
      if (format === 'json') {
        config = JSON.parse(configData);
      } else if (format === 'yaml') {
        // Simple YAML parsing (would use a proper YAML library in production)
        config = this.parseFromYAML(configData);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }

      // Validate imported configuration
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Merge with existing configuration
      const existingConfig = await this.loadConfig();
      const mergedConfig = this.mergeConfigs(existingConfig, config);
      
      // Save merged configuration
      await this.saveConfig(mergedConfig);

      console.log('Security configuration imported successfully');
    } catch (error) {
      console.error('Failed to import security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration import failed');
    }
  }

  /**
   * Get configuration section
   * @param section Configuration section name
   * @returns Configuration section
   */
  static async getConfigSection<K extends keyof SecurityConfig>(section: K): Promise<SecurityConfig[K]> {
    try {
      const config = await this.loadConfig();
      return config[section];
    } catch (error) {
      console.error(`Failed to get configuration section ${section}:`, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to get configuration section ${section}`);
    }
  }

  /**
   * Update configuration section
   * @param section Configuration section name
   * @param updates Section updates
   */
  static async updateConfigSection<K extends keyof SecurityConfig>(
    section: K,
    updates: Partial<SecurityConfig[K]>
  ): Promise<void> {
    try {
      const currentConfig = await this.loadConfig();
      const updatedSection = { ...currentConfig[section], ...updates };
      const updatedConfig = { ...currentConfig, [section]: updatedSection };
      
      // Validate updated configuration
      const validation = this.validateConfig(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Save updated configuration
      await this.saveConfig(updatedConfig);

      console.log(`Configuration section ${section} updated successfully`);
    } catch (error) {
      console.error(`Failed to update configuration section ${section}:`, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to update configuration section ${section}`);
    }
  }

  /**
   * Validate security configuration
   * @param config Configuration to validate
   * @returns Validation result
   */
  static validateConfig(config: Partial<SecurityConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate API keys configuration
    if (config.apiKeys) {
      if (config.apiKeys.rotationInterval && config.apiKeys.rotationInterval < 1) {
        errors.push('API key rotation interval must be at least 1 day');
      }
      
      if (config.apiKeys.maxRetries && config.apiKeys.maxRetries < 0) {
        errors.push('API key max retries must be non-negative');
      }
    }

    // Validate permissions configuration
    if (config.permissions) {
      if (config.permissions.maxPermissions && config.permissions.maxPermissions < 1) {
        errors.push('Max permissions must be at least 1');
      }
      
      if (config.permissions.restrictedPermissions && config.permissions.restrictedPermissions.length === 0) {
        warnings.push('No restricted permissions defined');
      }
    }

    // Validate CSP configuration
    if (config.csp) {
      if (config.csp.policy && config.csp.policy.length === 0) {
        errors.push('CSP policy cannot be empty');
      }
    }

    // Validate input validation configuration
    if (config.inputValidation) {
      if (config.inputValidation.maxLength && config.inputValidation.maxLength < 1) {
        errors.push('Input validation max length must be at least 1');
      }
      
      if (config.inputValidation.blockedPatterns && config.inputValidation.blockedPatterns.length === 0) {
        warnings.push('No blocked patterns defined for input validation');
      }
    }

    // Validate monitoring configuration
    if (config.monitoring) {
      if (config.monitoring.retentionDays && config.monitoring.retentionDays < 1) {
        errors.push('Monitoring retention days must be at least 1');
      }
      
      if (config.monitoring.alertThresholds) {
        const { critical, high, medium, low } = config.monitoring.alertThresholds;
        if (critical < 0 || high < 0 || medium < 0 || low < 0) {
          errors.push('All alert thresholds must be non-negative');
        }
        
        if (critical > high || high > medium || medium > low) {
          warnings.push('Alert thresholds should be in descending order (critical > high > medium > low)');
        }
      }
    }

    // Validate auditing configuration
    if (config.auditing) {
      if (config.auditing.retentionDays && config.auditing.retentionDays < 1) {
        errors.push('Auditing retention days must be at least 1');
      }
      
      if (config.auditing.maxLogEntries && config.auditing.maxLogEntries < 1) {
        errors.push('Max log entries must be at least 1');
      }
      
      if (config.auditing.enableRemoteLogging && !config.auditing.remoteEndpoint) {
        errors.push('Remote logging endpoint must be specified when remote logging is enabled');
      }
    }

    // Validate agent coordination configuration
    if (config.agentCoordination) {
      if (config.agentCoordination.maxAgents && config.agentCoordination.maxAgents < 1) {
        errors.push('Max agents must be at least 1');
      }
      
      if (config.agentCoordination.policyRefreshInterval && config.agentCoordination.policyRefreshInterval < 1) {
        errors.push('Policy refresh interval must be at least 1 minute');
      }
    }

    // Validate compliance configuration
    if (config.compliance) {
      if (config.compliance.frameworks && config.compliance.frameworks.length === 0) {
        warnings.push('No compliance frameworks specified');
      }
      
      if (config.compliance.schedule) {
        if (config.compliance.schedule.dayOfWeek && (config.compliance.schedule.dayOfWeek < 0 || config.compliance.schedule.dayOfWeek > 6)) {
          errors.push('Day of week must be between 0 (Sunday) and 6 (Saturday)');
        }
        
        if (config.compliance.schedule.dayOfMonth && (config.compliance.schedule.dayOfMonth < 1 || config.compliance.schedule.dayOfMonth > 31)) {
          errors.push('Day of month must be between 1 and 31');
        }
        
        if (config.compliance.schedule.time && !/^\d{2}:\d{2}$/.test(config.compliance.schedule.time)) {
          errors.push('Time must be in HH:MM format');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load configuration from storage
   * @returns Configuration
   */
  private static async loadConfig(): Promise<SecurityConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to load security configuration:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Save configuration to storage
   * @param config Configuration to save
   */
  private static async saveConfig(config: SecurityConfig): Promise<void> {
    try {
      const configToSave = {
        ...config,
        lastUpdated: Date.now()
      };
      
      await chrome.storage.local.set({ [this.CONFIG_KEY]: configToSave });
    } catch (error) {
      console.error('Failed to save security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Merge configuration objects
   * @param configs Configuration objects to merge
   * @returns Merged configuration
   */
  private static mergeConfigs(...configs: Partial<SecurityConfig>[]): SecurityConfig {
    const result: SecurityConfig = { ...this.DEFAULT_CONFIG };
    
    for (const config of configs) {
      if (config) {
        // Deep merge each section
        if (config.apiKeys) {
          result.apiKeys = { ...result.apiKeys, ...config.apiKeys };
        }
        
        if (config.permissions) {
          result.permissions = { ...result.permissions, ...config.permissions };
        }
        
        if (config.csp) {
          result.csp = { ...result.csp, ...config.csp };
        }
        
        if (config.inputValidation) {
          result.inputValidation = { ...result.inputValidation, ...config.inputValidation };
        }
        
        if (config.monitoring) {
          result.monitoring = { ...result.monitoring, ...config.monitoring };
        }
        
        if (config.auditing) {
          result.auditing = { ...result.auditing, ...config.auditing };
        }
        
        if (config.agentCoordination) {
          result.agentCoordination = { ...result.agentCoordination, ...config.agentCoordination };
        }
        
        if (config.compliance) {
          result.compliance = { ...result.compliance, ...config.compliance };
        }
        
        // Merge top-level properties
        if (config.version !== undefined) {
          result.version = config.version;
        }
        
        if (config.lastUpdated !== undefined) {
          result.lastUpdated = config.lastUpdated;
        }
      }
    }
    
    return result;
  }

  /**
   * Convert configuration to YAML (simplified)
   * @param config Configuration to convert
   * @returns YAML string
   */
  private static convertToYAML(config: SecurityConfig): string {
    // This is a simplified YAML conversion
    // In production, use a proper YAML library
    const yamlLines: string[] = [];
    
    yamlLines.push(`version: ${config.version}`);
    yamlLines.push(`lastUpdated: ${config.lastUpdated}`);
    
    yamlLines.push('apiKeys:');
    yamlLines.push(`  enableEncryption: ${config.apiKeys.enableEncryption}`);
    yamlLines.push(`  enableRotation: ${config.apiKeys.enableRotation}`);
    yamlLines.push(`  rotationInterval: ${config.apiKeys.rotationInterval}`);
    yamlLines.push(`  maxRetries: ${config.apiKeys.maxRetries}`);
    
    // Add other sections...
    
    return yamlLines.join('\n');
  }

  /**
   * Parse configuration from YAML (simplified)
   * @param yaml YAML string to parse
   * @returns Configuration object
   */
  private static parseFromYAML(yaml: string): Partial<SecurityConfig> {
    // This is a simplified YAML parser
    // In production, use a proper YAML library
    const config: Partial<SecurityConfig> = {};
    const lines = yaml.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('version:')) {
        config.version = trimmed.substring(9).trim();
      } else if (trimmed.startsWith('lastUpdated:')) {
        config.lastUpdated = parseInt(trimmed.substring(12).trim());
      }
      // Parse other properties...
    }
    
    return config;
  }

  /**
   * Get configuration summary
   * @returns Configuration summary
   */
  static async getConfigSummary(): Promise<{
    version: string;
    lastUpdated: number;
    enabledFeatures: string[];
    securityLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    try {
      const config = await this.loadConfig();
      const enabledFeatures: string[] = [];
      const recommendations: string[] = [];
      
      // Check enabled features
      if (config.apiKeys.enableEncryption) {
        enabledFeatures.push('API Key Encryption');
      }
      
      if (config.permissions.enableValidation) {
        enabledFeatures.push('Permission Validation');
      }
      
      if (config.csp.enabled) {
        enabledFeatures.push('Content Security Policy');
      }
      
      if (config.inputValidation.enabled) {
        enabledFeatures.push('Input Validation');
      }
      
      if (config.monitoring.enabled) {
        enabledFeatures.push('Security Monitoring');
      }
      
      if (config.auditing.enabled) {
        enabledFeatures.push('Security Auditing');
      }
      
      if (config.agentCoordination.enabled) {
        enabledFeatures.push('Agent Coordination');
      }
      
      if (config.compliance.enabled) {
        enabledFeatures.push('Compliance Reporting');
      }
      
      // Calculate security level
      let securityScore = 0;
      
      if (config.apiKeys.enableEncryption) securityScore += 15;
      if (config.permissions.enableValidation) securityScore += 15;
      if (config.csp.enabled) securityScore += 15;
      if (config.inputValidation.enabled) securityScore += 10;
      if (config.monitoring.enabled) securityScore += 10;
      if (config.auditing.enabled) securityScore += 10;
      if (config.agentCoordination.enabled) securityScore += 15;
      if (config.compliance.enabled) securityScore += 10;
      
      let securityLevel: 'low' | 'medium' | 'high';
      if (securityScore >= 80) {
        securityLevel = 'high';
      } else if (securityScore >= 50) {
        securityLevel = 'medium';
      } else {
        securityLevel = 'low';
      }
      
      // Generate recommendations
      if (!config.apiKeys.enableEncryption) {
        recommendations.push('Enable API key encryption for better security');
      }
      
      if (!config.csp.enabled) {
        recommendations.push('Enable Content Security Policy to prevent XSS attacks');
      }
      
      if (!config.monitoring.enableThreatDetection) {
        recommendations.push('Enable threat detection for proactive security');
      }
      
      if (!config.auditing.enabled) {
        recommendations.push('Enable security auditing for compliance and forensics');
      }
      
      return {
        version: config.version,
        lastUpdated: config.lastUpdated,
        enabledFeatures,
        securityLevel,
        recommendations
      };
    } catch (error) {
      console.error('Failed to get configuration summary:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to get configuration summary');
    }
  }
} * Security Configuration for Ray Chrome Extension
 * Provides centralized security configuration management
 */

export interface SecurityConfig {
  version: string;
  lastUpdated: number;
  apiKeys: {
    enableEncryption: boolean;
    enableRotation: boolean;
    rotationInterval: number; // in days
    maxRetries: number;
  };
  permissions: {
    enableValidation: boolean;
    enableAudit: boolean;
    enableLeastPrivilege: boolean;
    maxPermissions: number;
    restrictedPermissions: string[];
  };
  csp: {
    enabled: boolean;
    policy: string;
    reportOnly: boolean;
    enableReporting: boolean;
  };
  inputValidation: {
    enabled: boolean;
    strictMode: boolean;
    enableSanitization: boolean;
    maxLength: number;
    allowedPatterns: string[];
    blockedPatterns: string[];
  };
  monitoring: {
    enabled: boolean;
    enableRealTime: boolean;
    enableThreatDetection: boolean;
    enableBehaviorAnalysis: boolean;
    retentionDays: number;
    alertThresholds: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  auditing: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    enableRemoteLogging: boolean;
    remoteEndpoint?: string;
    retentionDays: number;
    maxLogEntries: number;
  };
  agentCoordination: {
    enabled: boolean;
    enablePolicyEnforcement: boolean;
    enableEventSharing: boolean;
    enableCrossAgentAuth: boolean;
    maxAgents: number;
    policyRefreshInterval: number; // in minutes
  };
  compliance: {
    enabled: boolean;
    frameworks: string[];
    schedule: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      time: string;
    };
    notifications: {
      enabled: boolean;
      channels: ('email' | 'slack' | 'webhook')[];
      recipients: string[];
    };
  };
}

export class SecurityConfigManager {
  private static readonly DEFAULT_CONFIG: SecurityConfig = {
    version: '1.0.0',
    lastUpdated: Date.now(),
    apiKeys: {
      enableEncryption: true,
      enableRotation: false,
      rotationInterval: 30,
      maxRetries: 3
    },
    permissions: {
      enableValidation: true,
      enableAudit: true,
      enableLeastPrivilege: true,
      maxPermissions: 10,
      restrictedPermissions: ['<all_urls>', 'nativeMessaging', 'devtools']
    },
    csp: {
      enabled: true,
      policy: "script-src 'self'; connect-src https://openrouter.ai; default-src 'self';",
      reportOnly: false,
      enableReporting: true
    },
    inputValidation: {
      enabled: true,
      strictMode: true,
      enableSanitization: true,
      maxLength: 1000,
      allowedPatterns: [],
      blockedPatterns: [
        'javascript:',
        'data:',
        'vbscript:',
        '<script',
        'on\\w+\\s*=',
        'eval\\s*\\('
      ]
    },
    monitoring: {
      enabled: true,
      enableRealTime: true,
      enableThreatDetection: true,
      enableBehaviorAnalysis: true,
      retentionDays: 30,
      alertThresholds: {
        critical: 1,
        high: 5,
        medium: 10,
        low: 20
      }
    },
    auditing: {
      enabled: true,
      logLevel: 'info',
      enableRemoteLogging: false,
      retentionDays: 90,
      maxLogEntries: 10000
    },
    agentCoordination: {
      enabled: true,
      enablePolicyEnforcement: true,
      enableEventSharing: true,
      enableCrossAgentAuth: true,
      maxAgents: 10,
      policyRefreshInterval: 60
    },
    compliance: {
      enabled: true,
      frameworks: ['chrome_extension_security'],
      schedule: {
        enabled: false,
        frequency: 'monthly',
        time: '00:00'
      },
      notifications: {
        enabled: false,
        channels: [],
        recipients: []
      }
    }
  };

  private static readonly CONFIG_KEY = 'securityConfig';

  /**
   * Initialize security configuration
   * @param config Optional configuration overrides
   */
  static async initialize(config?: Partial<SecurityConfig>): Promise<void> {
    try {
      // Load existing configuration or create default
      const existingConfig = await this.loadConfig();
      const finalConfig = this.mergeConfigs(this.DEFAULT_CONFIG, existingConfig, config);
      
      // Validate configuration
      const validation = this.validateConfig(finalConfig);
      if (!validation.isValid) {
        console.warn('Security configuration validation failed:', validation.errors);
      }

      // Save configuration
      await this.saveConfig(finalConfig);

      console.log('Security configuration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration initialization failed');
    }
  }

  /**
   * Get security configuration
   * @returns Current security configuration
   */
  static async getConfig(): Promise<SecurityConfig> {
    try {
      return await this.loadConfig();
    } catch (error) {
      console.error('Failed to get security configuration:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update security configuration
   * @param updates Configuration updates
   */
  static async updateConfig(updates: Partial<SecurityConfig>): Promise<void> {
    try {
      const currentConfig = await this.loadConfig();
      const updatedConfig = this.mergeConfigs(currentConfig, updates);
      
      // Validate updated configuration
      const validation = this.validateConfig(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Save updated configuration
      await this.saveConfig(updatedConfig);

      console.log('Security configuration updated successfully');
    } catch (error) {
      console.error('Failed to update security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration update failed');
    }
  }

  /**
   * Reset security configuration to defaults
   */
  static async resetConfig(): Promise<void> {
    try {
      await this.saveConfig(this.DEFAULT_CONFIG);
      console.log('Security configuration reset to defaults');
    } catch (error) {
      console.error('Failed to reset security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration reset failed');
    }
  }

  /**
   * Export security configuration
   * @param format Export format ('json' | 'yaml')
   * @returns Exported configuration
   */
  static async exportConfig(format: 'json' | 'yaml' = 'json'): Promise<string> {
    try {
      const config = await this.loadConfig();
      
      if (format === 'json') {
        return JSON.stringify(config, null, 2);
      } else if (format === 'yaml') {
        // Simple YAML conversion (would use a proper YAML library in production)
        return this.convertToYAML(config);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration export failed');
    }
  }

  /**
   * Import security configuration
   * @param configData Configuration data to import
   * @param format Format of the configuration data ('json' | 'yaml')
   */
  static async importConfig(configData: string, format: 'json' | 'yaml' = 'json'): Promise<void> {
    try {
      let config: Partial<SecurityConfig>;
      
      if (format === 'json') {
        config = JSON.parse(configData);
      } else if (format === 'yaml') {
        // Simple YAML parsing (would use a proper YAML library in production)
        config = this.parseFromYAML(configData);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }

      // Validate imported configuration
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Merge with existing configuration
      const existingConfig = await this.loadConfig();
      const mergedConfig = this.mergeConfigs(existingConfig, config);
      
      // Save merged configuration
      await this.saveConfig(mergedConfig);

      console.log('Security configuration imported successfully');
    } catch (error) {
      console.error('Failed to import security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security configuration import failed');
    }
  }

  /**
   * Get configuration section
   * @param section Configuration section name
   * @returns Configuration section
   */
  static async getConfigSection<K extends keyof SecurityConfig>(section: K): Promise<SecurityConfig[K]> {
    try {
      const config = await this.loadConfig();
      return config[section];
    } catch (error) {
      console.error(`Failed to get configuration section ${section}:`, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to get configuration section ${section}`);
    }
  }

  /**
   * Update configuration section
   * @param section Configuration section name
   * @param updates Section updates
   */
  static async updateConfigSection<K extends keyof SecurityConfig>(
    section: K,
    updates: Partial<SecurityConfig[K]>
  ): Promise<void> {
    try {
      const currentConfig = await this.loadConfig();
      const updatedSection = { ...currentConfig[section], ...updates };
      const updatedConfig = { ...currentConfig, [section]: updatedSection };
      
      // Validate updated configuration
      const validation = this.validateConfig(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Save updated configuration
      await this.saveConfig(updatedConfig);

      console.log(`Configuration section ${section} updated successfully`);
    } catch (error) {
      console.error(`Failed to update configuration section ${section}:`, error instanceof Error ? error.message : 'Unknown error');
      throw new Error(`Failed to update configuration section ${section}`);
    }
  }

  /**
   * Validate security configuration
   * @param config Configuration to validate
   * @returns Validation result
   */
  static validateConfig(config: Partial<SecurityConfig>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate API keys configuration
    if (config.apiKeys) {
      if (config.apiKeys.rotationInterval && config.apiKeys.rotationInterval < 1) {
        errors.push('API key rotation interval must be at least 1 day');
      }
      
      if (config.apiKeys.maxRetries && config.apiKeys.maxRetries < 0) {
        errors.push('API key max retries must be non-negative');
      }
    }

    // Validate permissions configuration
    if (config.permissions) {
      if (config.permissions.maxPermissions && config.permissions.maxPermissions < 1) {
        errors.push('Max permissions must be at least 1');
      }
      
      if (config.permissions.restrictedPermissions && config.permissions.restrictedPermissions.length === 0) {
        warnings.push('No restricted permissions defined');
      }
    }

    // Validate CSP configuration
    if (config.csp) {
      if (config.csp.policy && config.csp.policy.length === 0) {
        errors.push('CSP policy cannot be empty');
      }
    }

    // Validate input validation configuration
    if (config.inputValidation) {
      if (config.inputValidation.maxLength && config.inputValidation.maxLength < 1) {
        errors.push('Input validation max length must be at least 1');
      }
      
      if (config.inputValidation.blockedPatterns && config.inputValidation.blockedPatterns.length === 0) {
        warnings.push('No blocked patterns defined for input validation');
      }
    }

    // Validate monitoring configuration
    if (config.monitoring) {
      if (config.monitoring.retentionDays && config.monitoring.retentionDays < 1) {
        errors.push('Monitoring retention days must be at least 1');
      }
      
      if (config.monitoring.alertThresholds) {
        const { critical, high, medium, low } = config.monitoring.alertThresholds;
        if (critical < 0 || high < 0 || medium < 0 || low < 0) {
          errors.push('All alert thresholds must be non-negative');
        }
        
        if (critical > high || high > medium || medium > low) {
          warnings.push('Alert thresholds should be in descending order (critical > high > medium > low)');
        }
      }
    }

    // Validate auditing configuration
    if (config.auditing) {
      if (config.auditing.retentionDays && config.auditing.retentionDays < 1) {
        errors.push('Auditing retention days must be at least 1');
      }
      
      if (config.auditing.maxLogEntries && config.auditing.maxLogEntries < 1) {
        errors.push('Max log entries must be at least 1');
      }
      
      if (config.auditing.enableRemoteLogging && !config.auditing.remoteEndpoint) {
        errors.push('Remote logging endpoint must be specified when remote logging is enabled');
      }
    }

    // Validate agent coordination configuration
    if (config.agentCoordination) {
      if (config.agentCoordination.maxAgents && config.agentCoordination.maxAgents < 1) {
        errors.push('Max agents must be at least 1');
      }
      
      if (config.agentCoordination.policyRefreshInterval && config.agentCoordination.policyRefreshInterval < 1) {
        errors.push('Policy refresh interval must be at least 1 minute');
      }
    }

    // Validate compliance configuration
    if (config.compliance) {
      if (config.compliance.frameworks && config.compliance.frameworks.length === 0) {
        warnings.push('No compliance frameworks specified');
      }
      
      if (config.compliance.schedule) {
        if (config.compliance.schedule.dayOfWeek && (config.compliance.schedule.dayOfWeek < 0 || config.compliance.schedule.dayOfWeek > 6)) {
          errors.push('Day of week must be between 0 (Sunday) and 6 (Saturday)');
        }
        
        if (config.compliance.schedule.dayOfMonth && (config.compliance.schedule.dayOfMonth < 1 || config.compliance.schedule.dayOfMonth > 31)) {
          errors.push('Day of month must be between 1 and 31');
        }
        
        if (config.compliance.schedule.time && !/^\d{2}:\d{2}$/.test(config.compliance.schedule.time)) {
          errors.push('Time must be in HH:MM format');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load configuration from storage
   * @returns Configuration
   */
  private static async loadConfig(): Promise<SecurityConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to load security configuration:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Save configuration to storage
   * @param config Configuration to save
   */
  private static async saveConfig(config: SecurityConfig): Promise<void> {
    try {
      const configToSave = {
        ...config,
        lastUpdated: Date.now()
      };
      
      await chrome.storage.local.set({ [this.CONFIG_KEY]: configToSave });
    } catch (error) {
      console.error('Failed to save security configuration:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Merge configuration objects
   * @param configs Configuration objects to merge
   * @returns Merged configuration
   */
  private static mergeConfigs(...configs: Partial<SecurityConfig>[]): SecurityConfig {
    const result: SecurityConfig = { ...this.DEFAULT_CONFIG };
    
    for (const config of configs) {
      if (config) {
        // Deep merge each section
        if (config.apiKeys) {
          result.apiKeys = { ...result.apiKeys, ...config.apiKeys };
        }
        
        if (config.permissions) {
          result.permissions = { ...result.permissions, ...config.permissions };
        }
        
        if (config.csp) {
          result.csp = { ...result.csp, ...config.csp };
        }
        
        if (config.inputValidation) {
          result.inputValidation = { ...result.inputValidation, ...config.inputValidation };
        }
        
        if (config.monitoring) {
          result.monitoring = { ...result.monitoring, ...config.monitoring };
        }
        
        if (config.auditing) {
          result.auditing = { ...result.auditing, ...config.auditing };
        }
        
        if (config.agentCoordination) {
          result.agentCoordination = { ...result.agentCoordination, ...config.agentCoordination };
        }
        
        if (config.compliance) {
          result.compliance = { ...result.compliance, ...config.compliance };
        }
        
        // Merge top-level properties
        if (config.version !== undefined) {
          result.version = config.version;
        }
        
        if (config.lastUpdated !== undefined) {
          result.lastUpdated = config.lastUpdated;
        }
      }
    }
    
    return result;
  }

  /**
   * Convert configuration to YAML (simplified)
   * @param config Configuration to convert
   * @returns YAML string
   */
  private static convertToYAML(config: SecurityConfig): string {
    // This is a simplified YAML conversion
    // In production, use a proper YAML library
    const yamlLines: string[] = [];
    
    yamlLines.push(`version: ${config.version}`);
    yamlLines.push(`lastUpdated: ${config.lastUpdated}`);
    
    yamlLines.push('apiKeys:');
    yamlLines.push(`  enableEncryption: ${config.apiKeys.enableEncryption}`);
    yamlLines.push(`  enableRotation: ${config.apiKeys.enableRotation}`);
    yamlLines.push(`  rotationInterval: ${config.apiKeys.rotationInterval}`);
    yamlLines.push(`  maxRetries: ${config.apiKeys.maxRetries}`);
    
    // Add other sections...
    
    return yamlLines.join('\n');
  }

  /**
   * Parse configuration from YAML (simplified)
   * @param yaml YAML string to parse
   * @returns Configuration object
   */
  private static parseFromYAML(yaml: string): Partial<SecurityConfig> {
    // This is a simplified YAML parser
    // In production, use a proper YAML library
    const config: Partial<SecurityConfig> = {};
    const lines = yaml.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('version:')) {
        config.version = trimmed.substring(9).trim();
      } else if (trimmed.startsWith('lastUpdated:')) {
        config.lastUpdated = parseInt(trimmed.substring(12).trim());
      }
      // Parse other properties...
    }
    
    return config;
  }

  /**
   * Get configuration summary
   * @returns Configuration summary
   */
  static async getConfigSummary(): Promise<{
    version: string;
    lastUpdated: number;
    enabledFeatures: string[];
    securityLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    try {
      const config = await this.loadConfig();
      const enabledFeatures: string[] = [];
      const recommendations: string[] = [];
      
      // Check enabled features
      if (config.apiKeys.enableEncryption) {
        enabledFeatures.push('API Key Encryption');
      }
      
      if (config.permissions.enableValidation) {
        enabledFeatures.push('Permission Validation');
      }
      
      if (config.csp.enabled) {
        enabledFeatures.push('Content Security Policy');
      }
      
      if (config.inputValidation.enabled) {
        enabledFeatures.push('Input Validation');
      }
      
      if (config.monitoring.enabled) {
        enabledFeatures.push('Security Monitoring');
      }
      
      if (config.auditing.enabled) {
        enabledFeatures.push('Security Auditing');
      }
      
      if (config.agentCoordination.enabled) {
        enabledFeatures.push('Agent Coordination');
      }
      
      if (config.compliance.enabled) {
        enabledFeatures.push('Compliance Reporting');
      }
      
      // Calculate security level
      let securityScore = 0;
      
      if (config.apiKeys.enableEncryption) securityScore += 15;
      if (config.permissions.enableValidation) securityScore += 15;
      if (config.csp.enabled) securityScore += 15;
      if (config.inputValidation.enabled) securityScore += 10;
      if (config.monitoring.enabled) securityScore += 10;
      if (config.auditing.enabled) securityScore += 10;
      if (config.agentCoordination.enabled) securityScore += 15;
      if (config.compliance.enabled) securityScore += 10;
      
      let securityLevel: 'low' | 'medium' | 'high';
      if (securityScore >= 80) {
        securityLevel = 'high';
      } else if (securityScore >= 50) {
        securityLevel = 'medium';
      } else {
        securityLevel = 'low';
      }
      
      // Generate recommendations
      if (!config.apiKeys.enableEncryption) {
        recommendations.push('Enable API key encryption for better security');
      }
      
      if (!config.csp.enabled) {
        recommendations.push('Enable Content Security Policy to prevent XSS attacks');
      }
      
      if (!config.monitoring.enableThreatDetection) {
        recommendations.push('Enable threat detection for proactive security');
      }
      
      if (!config.auditing.enabled) {
        recommendations.push('Enable security auditing for compliance and forensics');
      }
      
      return {
        version: config.version,
        lastUpdated: config.lastUpdated,
        enabledFeatures,
        securityLevel,
        recommendations
      };
    } catch (error) {
      console.error('Failed to get configuration summary:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to get configuration summary');
    }
  }
}
