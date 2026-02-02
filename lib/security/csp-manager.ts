/**
 * Content Security Policy Management for Ray Chrome Extension
 * Handles CSP configuration, enforcement, and violation monitoring
 */

export interface CSPDirective {
  name: string;
  values: string[];
  description: string;
  required: boolean;
}

export interface CSPConfiguration {
  version: '1' | '2' | '3';
  directives: CSPDirective[];
  reportOnly?: boolean;
  reportURI?: string;
}

export interface CSPViolation {
  blockedURI?: string;
  documentURI?: string;
  effectiveDirective?: string;
  originalPolicy?: string;
  referrer?: string;
  sample?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

export interface CSPReport {
  violations: CSPViolation[];
  summary: {
    totalViolations: number;
    byDirective: Record<string, number>;
    bySeverity: Record<string, number>;
    lastViolation: number;
  };
  generatedAt: number;
}

export class CSPManager {
  private static readonly VIOLATION_STORAGE_KEY = 'cspViolations';
  private static readonly MAX_VIOLATIONS = 1000;

  /**
   * Default CSP configuration for Ray Chrome Extension
   */
  private static readonly DEFAULT_CSP_CONFIG: CSPConfiguration = {
    version: '3',
    directives: [
      {
        name: 'default-src',
        values: ["'self'"],
        description: 'Default source for loading content',
        required: true
      },
      {
        name: 'script-src',
        values: ["'self'"],
        description: 'Allowed sources for JavaScript',
        required: true
      },
      {
        name: 'connect-src',
        values: ["'self'", 'https://openrouter.ai'],
        description: 'Allowed sources for network connections',
        required: true
      },
      {
        name: 'style-src',
        values: ["'self'", "'unsafe-inline'"],
        description: 'Allowed sources for CSS stylesheets',
        required: true
      },
      {
        name: 'img-src',
        values: ["'self'", 'data:', 'https:'],
        description: 'Allowed sources for images',
        required: true
      },
      {
        name: 'font-src',
        values: ["'self'", 'data:', 'https:'],
        description: 'Allowed sources for fonts',
        required: true
      },
      {
        name: 'object-src',
        values: ["'none'"],
        description: 'Allowed sources for plugins (disabled for security)',
        required: true
      },
      {
        name: 'media-src',
        values: ["'self'"],
        description: 'Allowed sources for media elements',
        required: true
      },
      {
        name: 'frame-src',
        values: ["'none'"],
        description: 'Allowed sources for frames (disabled for security)',
        required: true
      },
      {
        name: 'child-src',
        values: ["'none'"],
        description: 'Allowed sources for web workers and frames',
        required: true
      },
      {
        name: 'worker-src',
        values: ["'self'"],
        description: 'Allowed sources for web workers',
        required: true
      },
      {
        name: 'manifest-src',
        values: ["'self'"],
        description: 'Allowed sources for manifest files',
        required: true
      },
      {
        name: 'base-uri',
        values: ["'self'"],
        description: 'Restricts base tag URLs',
        required: true
      },
      {
        name: 'form-action',
        values: ["'self'"],
        description: 'Restricts form submission targets',
        required: true
      }
    ],
    reportOnly: false
  };

  /**
   * Generate CSP header string for manifest.json
   * @param config Optional custom CSP configuration
   * @returns CSP header string
   */
  static generateCSPHeader(config?: Partial<CSPConfiguration>): string {
    const finalConfig = { ...this.DEFAULT_CSP_CONFIG, ...config };
    
    const directives = finalConfig.directives
      .filter(directive => directive.values.length > 0)
      .map(directive => `${directive.name} ${directive.values.join(' ')}`)
      .join('; ');

    return directives;
  }

  /**
   * Generate CSP configuration for manifest.json
   * @param config Optional custom CSP configuration
   * @returns CSP configuration object for manifest
   */
  static generateManifestCSP(config?: Partial<CSPConfiguration>): Record<string, string> {
    const cspHeader = this.generateCSPHeader(config);
    
    return {
      'extension_pages': cspHeader
    };
  }

  /**
   * Validate CSP configuration
   * @param config CSP configuration to validate
   * @returns Validation result
   */
  static validateCSPConfig(config: CSPConfiguration): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required directives
    const requiredDirectives = this.DEFAULT_CSP_CONFIG.directives.filter(d => d.required);
    for (const required of requiredDirectives) {
      const found = config.directives.find(d => d.name === required.name);
      if (!found) {
        errors.push(`Missing required directive: ${required.name}`);
      } else if (found.values.length === 0) {
        errors.push(`Required directive ${required.name} has no values`);
      }
    }

    // Check for unsafe values
    for (const directive of config.directives) {
      if (directive.values.includes("'unsafe-inline'") && 
          !['style-src', 'script-src'].includes(directive.name)) {
        warnings.push(`'unsafe-inline' in ${directive.name} may be a security risk`);
      }

      if (directive.values.includes("'unsafe-eval'")) {
        errors.push(`'unsafe-eval' in ${directive.name} is a major security risk`);
      }

      if (directive.values.includes('*') && directive.name !== 'default-src') {
        warnings.push(`Wildcard (*) in ${directive.name} may be too permissive`);
      }
    }

    // Check connect-src for allowed domains
    const connectDirective = config.directives.find(d => d.name === 'connect-src');
    if (connectDirective) {
      const allowedDomains = ['https://openrouter.ai'];
      for (const value of connectDirective.values) {
        if (value.startsWith('http://') && !allowedDomains.includes(value)) {
          warnings.push(`HTTP connection to ${value} is insecure`);
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
   * Set up CSP violation monitoring
   * @param callback Function to call when violations occur
   */
  static setupViolationMonitoring(callback?: (violation: CSPViolation) => void): void {
    // Listen for CSP violation reports
    if (typeof document !== 'undefined') {
      document.addEventListener('securitypolicyviolation', (event) => {
        const violation: CSPViolation = {
          blockedURI: event.blockedURI,
          documentURI: event.documentURI,
          effectiveDirective: event.effectiveDirective,
          originalPolicy: event.originalPolicy,
          referrer: event.referrer,
          sample: event.sample,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          columnNumber: event.columnNumber,
          statusCode: event.statusCode,
          timestamp: Date.now(),
          severity: this.assessViolationSeverity(event)
        };

        // Store violation
        this.storeViolation(violation);

        // Call callback if provided
        if (callback) {
          callback(violation);
        }
      });
    }
  }

  /**
   * Store CSP violation for monitoring
   * @param violation The CSP violation to store
   */
  private static async storeViolation(violation: CSPViolation): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATION_STORAGE_KEY]);
      const violations: CSPViolation[] = result[this.VIOLATION_STORAGE_KEY] || [];

      violations.push(violation);

      // Keep only the most recent violations
      if (violations.length > this.MAX_VIOLATIONS) {
        violations.splice(0, violations.length - this.MAX_VIOLATIONS);
      }

      await chrome.storage.local.set({ [this.VIOLATION_STORAGE_KEY]: violations });
    } catch (error) {
      console.error('Failed to store CSP violation:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get stored CSP violations
   * @param limit Maximum number of violations to retrieve
   * @returns Promise that resolves with CSP violations
   */
  static async getViolations(limit: number = 100): Promise<CSPViolation[]> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATION_STORAGE_KEY]);
      const violations: CSPViolation[] = result[this.VIOLATION_STORAGE_KEY] || [];

      // Return most recent violations
      return violations.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get CSP violations:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Generate CSP violation report
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with CSP report
   */
  static async generateReport(daysToAnalyze: number = 7): Promise<CSPReport> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const allViolations = await this.getViolations();
      const violations = allViolations.filter(v => v.timestamp >= startDate);

      // Generate summary statistics
      const summary = {
        totalViolations: violations.length,
        byDirective: {} as Record<string, number>,
        bySeverity: { low: 0, medium: 0, high: 0 } as Record<string, number>,
        lastViolation: violations.length > 0 ? Math.max(...violations.map(v => v.timestamp)) : 0
      };

      for (const violation of violations) {
        // Count by directive
        const directive = violation.effectiveDirective || 'unknown';
        summary.byDirective[directive] = (summary.byDirective[directive] || 0) + 1;

        // Count by severity
        summary.bySeverity[violation.severity]++;
      }

      return {
        violations,
        summary,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate CSP report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate CSP report');
    }
  }

  /**
   * Assess severity of CSP violation
   * @param event The CSP violation event
   * @returns Severity level
   */
  private static assessViolationSeverity(event: SecurityPolicyViolationEvent): 'low' | 'medium' | 'high' {
    // High severity violations
    if (event.effectiveDirective === 'script-src' && 
        (event.blockedURI?.includes('data:') || event.blockedURI?.includes('javascript:'))) {
      return 'high';
    }

    if (event.effectiveDirective === 'object-src' && event.blockedURI) {
      return 'high';
    }

    if (event.effectiveDirective === 'connect-src' && 
        event.blockedURI?.startsWith('http://')) {
      return 'high';
    }

    // Medium severity violations
    if (['script-src', 'style-src', 'connect-src'].includes(event.effectiveDirective || '')) {
      return 'medium';
    }

    // Low severity violations
    return 'low';
  }

  /**
   * Clear stored CSP violations
   * @returns Promise that resolves when violations are cleared
   */
  static async clearViolations(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.VIOLATION_STORAGE_KEY]);
    } catch (error) {
      console.error('Failed to clear CSP violations:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear CSP violations');
    }
  }

  /**
   * Get recommended CSP configuration based on usage patterns
   * @param violations Recent CSP violations
   * @returns Recommended CSP configuration
   */
  static getRecommendedConfig(violations: CSPViolation[]): Partial<CSPConfiguration> {
    const recommendations: Partial<CSPConfiguration> = {
      directives: [...this.DEFAULT_CSP_CONFIG.directives]
    };

    // Analyze violations to suggest improvements
    const connectViolations = violations.filter(v => v.effectiveDirective === 'connect-src');
    if (connectViolations.length > 0) {
      const blockedURIs = new Set(connectViolations.map(v => v.blockedURI).filter(Boolean) as string[]);
      const connectDirective = recommendations.directives!.find(d => d.name === 'connect-src');
      
      if (connectDirective && blockedURIs.size > 0) {
        // Add commonly blocked domains if they seem legitimate
        const legitimateDomains = Array.from(blockedURIs)
          .filter(uri => uri?.startsWith('https://') && !uri.includes('ads') && !uri.includes('tracking'))
          .map(uri => uri!.split('/')[2]); // Extract domain
        
        if (legitimateDomains.length > 0) {
          connectDirective.values.push(...legitimateDomains);
        }
      }
    }

    return recommendations;
  }

  /**
   * Check if current CSP configuration is secure
   * @param config CSP configuration to check
   * @returns Security assessment
   */
  static assessSecurity(config: CSPConfiguration): {
    score: number;
    level: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    recommendations: string[];
  } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for security issues
    for (const directive of config.directives) {
      // Unsafe inline
      if (directive.values.includes("'unsafe-inline'")) {
        score -= 20;
        issues.push(`'unsafe-inline' in ${directive.name} directive`);
        recommendations.push(`Remove 'unsafe-inline' from ${directive.name} if possible`);
      }

      // Unsafe eval
      if (directive.values.includes("'unsafe-eval'")) {
        score -= 30;
        issues.push(`'unsafe-eval' in ${directive.name} directive`);
        recommendations.push(`Remove 'unsafe-eval' from ${directive.name} immediately`);
      }

      // Wildcards
      if (directive.values.includes('*')) {
        score -= 15;
        issues.push(`Wildcard (*) in ${directive.name} directive`);
        recommendations.push(`Replace wildcard with specific domains in ${directive.name}`);
      }

      // HTTP URLs
      const httpURLs = directive.values.filter(v => v.startsWith('http://'));
      if (httpURLs.length > 0) {
        score -= 10;
        issues.push(`HTTP URLs in ${directive.name} directive`);
        recommendations.push(`Use HTTPS instead of HTTP in ${directive.name}`);
      }
    }

    // Determine security level
    let level: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 90) level = 'excellent';
    else if (score >= 70) level = 'good';
    else if (score >= 50) level = 'fair';
    else level = 'poor';

    return {
      score: Math.max(0, score),
      level,
      issues,
      recommendations
    };
  }
} * Content Security Policy Management for Ray Chrome Extension
 * Handles CSP configuration, enforcement, and violation monitoring
 */

export interface CSPDirective {
  name: string;
  values: string[];
  description: string;
  required: boolean;
}

export interface CSPConfiguration {
  version: '1' | '2' | '3';
  directives: CSPDirective[];
  reportOnly?: boolean;
  reportURI?: string;
}

export interface CSPViolation {
  blockedURI?: string;
  documentURI?: string;
  effectiveDirective?: string;
  originalPolicy?: string;
  referrer?: string;
  sample?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

export interface CSPReport {
  violations: CSPViolation[];
  summary: {
    totalViolations: number;
    byDirective: Record<string, number>;
    bySeverity: Record<string, number>;
    lastViolation: number;
  };
  generatedAt: number;
}

export class CSPManager {
  private static readonly VIOLATION_STORAGE_KEY = 'cspViolations';
  private static readonly MAX_VIOLATIONS = 1000;

  /**
   * Default CSP configuration for Ray Chrome Extension
   */
  private static readonly DEFAULT_CSP_CONFIG: CSPConfiguration = {
    version: '3',
    directives: [
      {
        name: 'default-src',
        values: ["'self'"],
        description: 'Default source for loading content',
        required: true
      },
      {
        name: 'script-src',
        values: ["'self'"],
        description: 'Allowed sources for JavaScript',
        required: true
      },
      {
        name: 'connect-src',
        values: ["'self'", 'https://openrouter.ai'],
        description: 'Allowed sources for network connections',
        required: true
      },
      {
        name: 'style-src',
        values: ["'self'", "'unsafe-inline'"],
        description: 'Allowed sources for CSS stylesheets',
        required: true
      },
      {
        name: 'img-src',
        values: ["'self'", 'data:', 'https:'],
        description: 'Allowed sources for images',
        required: true
      },
      {
        name: 'font-src',
        values: ["'self'", 'data:', 'https:'],
        description: 'Allowed sources for fonts',
        required: true
      },
      {
        name: 'object-src',
        values: ["'none'"],
        description: 'Allowed sources for plugins (disabled for security)',
        required: true
      },
      {
        name: 'media-src',
        values: ["'self'"],
        description: 'Allowed sources for media elements',
        required: true
      },
      {
        name: 'frame-src',
        values: ["'none'"],
        description: 'Allowed sources for frames (disabled for security)',
        required: true
      },
      {
        name: 'child-src',
        values: ["'none'"],
        description: 'Allowed sources for web workers and frames',
        required: true
      },
      {
        name: 'worker-src',
        values: ["'self'"],
        description: 'Allowed sources for web workers',
        required: true
      },
      {
        name: 'manifest-src',
        values: ["'self'"],
        description: 'Allowed sources for manifest files',
        required: true
      },
      {
        name: 'base-uri',
        values: ["'self'"],
        description: 'Restricts base tag URLs',
        required: true
      },
      {
        name: 'form-action',
        values: ["'self'"],
        description: 'Restricts form submission targets',
        required: true
      }
    ],
    reportOnly: false
  };

  /**
   * Generate CSP header string for manifest.json
   * @param config Optional custom CSP configuration
   * @returns CSP header string
   */
  static generateCSPHeader(config?: Partial<CSPConfiguration>): string {
    const finalConfig = { ...this.DEFAULT_CSP_CONFIG, ...config };
    
    const directives = finalConfig.directives
      .filter(directive => directive.values.length > 0)
      .map(directive => `${directive.name} ${directive.values.join(' ')}`)
      .join('; ');

    return directives;
  }

  /**
   * Generate CSP configuration for manifest.json
   * @param config Optional custom CSP configuration
   * @returns CSP configuration object for manifest
   */
  static generateManifestCSP(config?: Partial<CSPConfiguration>): Record<string, string> {
    const cspHeader = this.generateCSPHeader(config);
    
    return {
      'extension_pages': cspHeader
    };
  }

  /**
   * Validate CSP configuration
   * @param config CSP configuration to validate
   * @returns Validation result
   */
  static validateCSPConfig(config: CSPConfiguration): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required directives
    const requiredDirectives = this.DEFAULT_CSP_CONFIG.directives.filter(d => d.required);
    for (const required of requiredDirectives) {
      const found = config.directives.find(d => d.name === required.name);
      if (!found) {
        errors.push(`Missing required directive: ${required.name}`);
      } else if (found.values.length === 0) {
        errors.push(`Required directive ${required.name} has no values`);
      }
    }

    // Check for unsafe values
    for (const directive of config.directives) {
      if (directive.values.includes("'unsafe-inline'") && 
          !['style-src', 'script-src'].includes(directive.name)) {
        warnings.push(`'unsafe-inline' in ${directive.name} may be a security risk`);
      }

      if (directive.values.includes("'unsafe-eval'")) {
        errors.push(`'unsafe-eval' in ${directive.name} is a major security risk`);
      }

      if (directive.values.includes('*') && directive.name !== 'default-src') {
        warnings.push(`Wildcard (*) in ${directive.name} may be too permissive`);
      }
    }

    // Check connect-src for allowed domains
    const connectDirective = config.directives.find(d => d.name === 'connect-src');
    if (connectDirective) {
      const allowedDomains = ['https://openrouter.ai'];
      for (const value of connectDirective.values) {
        if (value.startsWith('http://') && !allowedDomains.includes(value)) {
          warnings.push(`HTTP connection to ${value} is insecure`);
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
   * Set up CSP violation monitoring
   * @param callback Function to call when violations occur
   */
  static setupViolationMonitoring(callback?: (violation: CSPViolation) => void): void {
    // Listen for CSP violation reports
    if (typeof document !== 'undefined') {
      document.addEventListener('securitypolicyviolation', (event) => {
        const violation: CSPViolation = {
          blockedURI: event.blockedURI,
          documentURI: event.documentURI,
          effectiveDirective: event.effectiveDirective,
          originalPolicy: event.originalPolicy,
          referrer: event.referrer,
          sample: event.sample,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
          columnNumber: event.columnNumber,
          statusCode: event.statusCode,
          timestamp: Date.now(),
          severity: this.assessViolationSeverity(event)
        };

        // Store violation
        this.storeViolation(violation);

        // Call callback if provided
        if (callback) {
          callback(violation);
        }
      });
    }
  }

  /**
   * Store CSP violation for monitoring
   * @param violation The CSP violation to store
   */
  private static async storeViolation(violation: CSPViolation): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATION_STORAGE_KEY]);
      const violations: CSPViolation[] = result[this.VIOLATION_STORAGE_KEY] || [];

      violations.push(violation);

      // Keep only the most recent violations
      if (violations.length > this.MAX_VIOLATIONS) {
        violations.splice(0, violations.length - this.MAX_VIOLATIONS);
      }

      await chrome.storage.local.set({ [this.VIOLATION_STORAGE_KEY]: violations });
    } catch (error) {
      console.error('Failed to store CSP violation:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get stored CSP violations
   * @param limit Maximum number of violations to retrieve
   * @returns Promise that resolves with CSP violations
   */
  static async getViolations(limit: number = 100): Promise<CSPViolation[]> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATION_STORAGE_KEY]);
      const violations: CSPViolation[] = result[this.VIOLATION_STORAGE_KEY] || [];

      // Return most recent violations
      return violations.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get CSP violations:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Generate CSP violation report
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with CSP report
   */
  static async generateReport(daysToAnalyze: number = 7): Promise<CSPReport> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const allViolations = await this.getViolations();
      const violations = allViolations.filter(v => v.timestamp >= startDate);

      // Generate summary statistics
      const summary = {
        totalViolations: violations.length,
        byDirective: {} as Record<string, number>,
        bySeverity: { low: 0, medium: 0, high: 0 } as Record<string, number>,
        lastViolation: violations.length > 0 ? Math.max(...violations.map(v => v.timestamp)) : 0
      };

      for (const violation of violations) {
        // Count by directive
        const directive = violation.effectiveDirective || 'unknown';
        summary.byDirective[directive] = (summary.byDirective[directive] || 0) + 1;

        // Count by severity
        summary.bySeverity[violation.severity]++;
      }

      return {
        violations,
        summary,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate CSP report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate CSP report');
    }
  }

  /**
   * Assess severity of CSP violation
   * @param event The CSP violation event
   * @returns Severity level
   */
  private static assessViolationSeverity(event: SecurityPolicyViolationEvent): 'low' | 'medium' | 'high' {
    // High severity violations
    if (event.effectiveDirective === 'script-src' && 
        (event.blockedURI?.includes('data:') || event.blockedURI?.includes('javascript:'))) {
      return 'high';
    }

    if (event.effectiveDirective === 'object-src' && event.blockedURI) {
      return 'high';
    }

    if (event.effectiveDirective === 'connect-src' && 
        event.blockedURI?.startsWith('http://')) {
      return 'high';
    }

    // Medium severity violations
    if (['script-src', 'style-src', 'connect-src'].includes(event.effectiveDirective || '')) {
      return 'medium';
    }

    // Low severity violations
    return 'low';
  }

  /**
   * Clear stored CSP violations
   * @returns Promise that resolves when violations are cleared
   */
  static async clearViolations(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.VIOLATION_STORAGE_KEY]);
    } catch (error) {
      console.error('Failed to clear CSP violations:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear CSP violations');
    }
  }

  /**
   * Get recommended CSP configuration based on usage patterns
   * @param violations Recent CSP violations
   * @returns Recommended CSP configuration
   */
  static getRecommendedConfig(violations: CSPViolation[]): Partial<CSPConfiguration> {
    const recommendations: Partial<CSPConfiguration> = {
      directives: [...this.DEFAULT_CSP_CONFIG.directives]
    };

    // Analyze violations to suggest improvements
    const connectViolations = violations.filter(v => v.effectiveDirective === 'connect-src');
    if (connectViolations.length > 0) {
      const blockedURIs = new Set(connectViolations.map(v => v.blockedURI).filter(Boolean) as string[]);
      const connectDirective = recommendations.directives!.find(d => d.name === 'connect-src');
      
      if (connectDirective && blockedURIs.size > 0) {
        // Add commonly blocked domains if they seem legitimate
        const legitimateDomains = Array.from(blockedURIs)
          .filter(uri => uri?.startsWith('https://') && !uri.includes('ads') && !uri.includes('tracking'))
          .map(uri => uri!.split('/')[2]); // Extract domain
        
        if (legitimateDomains.length > 0) {
          connectDirective.values.push(...legitimateDomains);
        }
      }
    }

    return recommendations;
  }

  /**
   * Check if current CSP configuration is secure
   * @param config CSP configuration to check
   * @returns Security assessment
   */
  static assessSecurity(config: CSPConfiguration): {
    score: number;
    level: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    recommendations: string[];
  } {
    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for security issues
    for (const directive of config.directives) {
      // Unsafe inline
      if (directive.values.includes("'unsafe-inline'")) {
        score -= 20;
        issues.push(`'unsafe-inline' in ${directive.name} directive`);
        recommendations.push(`Remove 'unsafe-inline' from ${directive.name} if possible`);
      }

      // Unsafe eval
      if (directive.values.includes("'unsafe-eval'")) {
        score -= 30;
        issues.push(`'unsafe-eval' in ${directive.name} directive`);
        recommendations.push(`Remove 'unsafe-eval' from ${directive.name} immediately`);
      }

      // Wildcards
      if (directive.values.includes('*')) {
        score -= 15;
        issues.push(`Wildcard (*) in ${directive.name} directive`);
        recommendations.push(`Replace wildcard with specific domains in ${directive.name}`);
      }

      // HTTP URLs
      const httpURLs = directive.values.filter(v => v.startsWith('http://'));
      if (httpURLs.length > 0) {
        score -= 10;
        issues.push(`HTTP URLs in ${directive.name} directive`);
        recommendations.push(`Use HTTPS instead of HTTP in ${directive.name}`);
      }
    }

    // Determine security level
    let level: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 90) level = 'excellent';
    else if (score >= 70) level = 'good';
    else if (score >= 50) level = 'fair';
    else level = 'poor';

    return {
      score: Math.max(0, score),
      level,
      issues,
      recommendations
    };
  }
}
