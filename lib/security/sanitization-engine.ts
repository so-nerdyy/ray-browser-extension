/**
 * Sanitization Engine for Ray Chrome Extension
 * Advanced data sanitization and cleaning utilities
 */

export interface SanitizationRule {
  name: string;
  description: string;
  priority: number;
  apply: (data: any) => any;
  shouldApply: (data: any) => boolean;
}

export interface SanitizationResult {
  original: any;
  sanitized: any;
  appliedRules: string[];
  warnings: string[];
  metadata: {
    processingTime: number;
    dataTypes: string[];
    size: number;
  };
}

export interface SanitizationConfig {
  enableDeepSanitization: boolean;
  enableStrictMode: boolean;
  maxDepth: number;
  preserveWhitespace: boolean;
  customRules?: SanitizationRule[];
}

export class SanitizationEngine {
  private static readonly DEFAULT_CONFIG: SanitizationConfig = {
    enableDeepSanitization: true,
    enableStrictMode: false,
    maxDepth: 10,
    preserveWhitespace: false
  };

  private static readonly SANITIZATION_RULES: SanitizationRule[] = [
    {
      name: 'Remove Null Bytes',
      description: 'Removes null bytes from strings',
      priority: 100,
      apply: (data: any) => {
        if (typeof data === 'string') {
          return data.replace(/\x00/g, '');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Normalize Unicode',
      description: 'Normalizes Unicode characters',
      priority: 90,
      apply: (data: any) => {
        if (typeof data === 'string') {
          // Normalize Unicode normalization form C
          return data.normalize('NFC');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Remove Control Characters',
      description: 'Removes control characters except whitespace',
      priority: 85,
      apply: (data: any) => {
        if (typeof data === 'string') {
          return data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Sanitize Object Keys',
      description: 'Sanitizes object property keys',
      priority: 80,
      apply: (data: any) => {
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(data)) {
            // Skip dangerous keys
            if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
              // Sanitize key name
              const sanitizedKey = key.replace(/[^\w_$]/g, '');
              sanitized[sanitizedKey] = value;
            }
          }
          return sanitized;
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'object' && data !== null && !Array.isArray(data)
    },
    {
      name: 'Sanitize Array Elements',
      description: 'Sanitizes array elements recursively',
      priority: 75,
      apply: (data: any) => {
        if (Array.isArray(data)) {
          return data.map(item => item);
        }
        return data;
      },
      shouldApply: (data: any) => Array.isArray(data)
    },
    {
      name: 'Remove Duplicate Whitespace',
      description: 'Removes duplicate whitespace characters',
      priority: 70,
      apply: (data: any, config: SanitizationConfig) => {
        if (typeof data === 'string') {
          return data.replace(/\s+/g, config?.preserveWhitespace ? ' ' : '').trim();
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Remove ZWSP Characters',
      description: 'Removes zero-width space characters',
      priority: 65,
      apply: (data: any) => {
        if (typeof data === 'string') {
          return data.replace(/[\u200B-\u200D\uFEFF]/g, '');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Sanitize Numbers',
      description: 'Sanitizes numeric values',
      priority: 60,
      apply: (data: any) => {
        if (typeof data === 'number') {
          // Remove NaN and Infinity
          if (isNaN(data) || !isFinite(data)) {
            return 0;
          }
          // Clamp to safe range
          return Math.max(Number.MIN_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, data));
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'number'
    },
    {
      name: 'Sanitize Booleans',
      description: 'Sanitizes boolean values',
      priority: 55,
      apply: (data: any) => {
        if (typeof data === 'boolean') {
          return Boolean(data);
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'boolean'
    }
  ];

  /**
   * Sanitize data using all applicable rules
   * @param data The data to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitize(data: any, config?: Partial<SanitizationConfig>): SanitizationResult {
    const startTime = performance.now();
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const appliedRules: string[] = [];
    const warnings: string[] = [];
    let sanitized = data;

    // Get all rules including custom ones
    const allRules = [...this.SANITIZATION_RULES, ...(finalConfig.customRules || [])]
      .sort((a, b) => b.priority - a.priority);

    // Apply rules based on data type and configuration
    for (const rule of allRules) {
      if (rule.shouldApply(sanitized)) {
        try {
          const before = sanitized;
          sanitized = rule.apply(sanitized, finalConfig);
          
          if (before !== sanitized) {
            appliedRules.push(rule.name);
          }
        } catch (error) {
          warnings.push(`Rule '${rule.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Apply deep sanitization if enabled
    if (finalConfig.enableDeepSanitization) {
      sanitized = this.deepSanitize(sanitized, finalConfig.maxDepth, 0);
    }

    // Apply strict mode if enabled
    if (finalConfig.enableStrictMode) {
      sanitized = this.strictSanitize(sanitized);
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return {
      original: data,
      sanitized,
      appliedRules,
      warnings,
      metadata: {
        processingTime,
        dataTypes: this.getDataTypes(data),
        size: this.getDataSize(data)
      }
    };
  }

  /**
   * Sanitize string specifically
   * @param str The string to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitizeString(str: string, config?: Partial<SanitizationConfig>): SanitizationResult {
    if (typeof str !== 'string') {
      return {
        original: str,
        sanitized: str,
        appliedRules: [],
        warnings: ['Input is not a string'],
        metadata: {
          processingTime: 0,
          dataTypes: [],
          size: 0
        }
      };
    }

    return this.sanitize(str, config);
  }

  /**
   * Sanitize object specifically
   * @param obj The object to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitizeObject(obj: any, config?: Partial<SanitizationConfig>): SanitizationResult {
    if (typeof obj !== 'object' || obj === null) {
      return {
        original: obj,
        sanitized: obj,
        appliedRules: [],
        warnings: ['Input is not an object'],
        metadata: {
          processingTime: 0,
          dataTypes: [],
          size: 0
        }
      };
    }

    return this.sanitize(obj, config);
  }

  /**
   * Sanitize array specifically
   * @param arr The array to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitizeArray(arr: any[], config?: Partial<SanitizationConfig>): SanitizationResult {
    if (!Array.isArray(arr)) {
      return {
        original: arr,
        sanitized: arr,
        appliedRules: [],
        warnings: ['Input is not an array'],
        metadata: {
          processingTime: 0,
          dataTypes: [],
          size: 0
        }
      };
    }

    return this.sanitize(arr, config);
  }

  /**
   * Apply deep sanitization recursively
   * @param data The data to sanitize
   * @param maxDepth Maximum recursion depth
   * @param currentDepth Current recursion depth
   * @returns Deep sanitized data
   */
  private static deepSanitize(data: any, maxDepth: number, currentDepth: number): any {
    if (currentDepth >= maxDepth) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.deepSanitize(item, maxDepth, currentDepth + 1));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
          sanitized[key] = this.deepSanitize(value, maxDepth, currentDepth + 1);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Apply strict mode sanitization
   * @param data The data to sanitize
   * @returns Strict sanitized data
   */
  private static strictSanitize(data: any): any {
    if (typeof data === 'string') {
      // Remove all non-printable characters except basic whitespace
      return data.replace(/[^\x20-\x7E\s]/g, '');
    }

    if (typeof data === 'number') {
      // Remove any non-standard number representations
      if (!isFinite(data)) {
        return 0;
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.strictSanitize(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Only allow alphanumeric keys in strict mode
        if (/^[a-zA-Z0-9_$]+$/.test(key)) {
          sanitized[key] = this.strictSanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Get data types present in the input
   * @param data The data to analyze
   * @returns Array of type names
   */
  private static getDataTypes(data: any): string[] {
    const types = new Set<string>();
    
    const addType = (value: any) => {
      if (value === null) types.add('null');
      else if (Array.isArray(value)) types.add('array');
      else types.add(typeof value);
    };

    addType(data);

    if (Array.isArray(data)) {
      for (const item of data) {
        addType(item);
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const value of Object.values(data)) {
        addType(value);
      }
    }

    return Array.from(types);
  }

  /**
   * Get approximate data size
   * @param data The data to measure
   * @returns Size in bytes
   */
  private static getDataSize(data: any): number {
    try {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Create custom sanitization rule
   * @param name Rule name
   * @param description Rule description
   * @param priority Rule priority (higher = applied first)
   * @param apply Function to apply the rule
   * @param shouldApply Function to check if rule should apply
   * @returns Custom sanitization rule
   */
  static createCustomRule(
    name: string,
    description: string,
    priority: number,
    apply: (data: any) => any,
    shouldApply: (data: any) => boolean
  ): SanitizationRule {
    return {
      name,
      description,
      priority,
      apply,
      shouldApply
    };
  }

  /**
   * Add custom sanitization rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: SanitizationRule): void {
    this.SANITIZATION_RULES.push(rule);
  }

  /**
   * Remove sanitization rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.SANITIZATION_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.SANITIZATION_RULES.splice(index, 1);
    }
  }

  /**
   * Get all sanitization rules
   * @returns Array of sanitization rules
   */
  static getSanitizationRules(): SanitizationRule[] {
    return [...this.SANITIZATION_RULES];
  }

  /**
   * Sanitize HTML content specifically
   * @param html The HTML to sanitize
   * @param allowedTags Optional list of allowed tags
   * @param allowedAttributes Optional list of allowed attributes
   * @returns Sanitized HTML
   */
  static sanitizeHTML(
    html: string,
    allowedTags: string[] = [],
    allowedAttributes: string[] = []
  ): string {
    if (typeof html !== 'string') {
      return '';
    }

    let sanitized = html;

    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove dangerous attributes
    const dangerousAttributes = [
      'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus',
      'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect'
    ];

    for (const attr of dangerousAttributes) {
      const pattern = new RegExp(`\\b${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(pattern, '');
    }

    // Filter to allowed tags if specified
    if (allowedTags.length > 0) {
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      const matches = sanitized.match(tagPattern) || [];
      
      for (const match of matches) {
        const tagName = match.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
        if (tagName && !allowedTags.includes(tagName.toLowerCase())) {
          sanitized = sanitized.replace(match, '');
        }
      }
    }

    // Filter to allowed attributes if specified
    if (allowedAttributes.length > 0) {
      const attrPattern = /\b([a-zA-Z-]+)\s*=\s*["'][^"']*["']/g;
      const matches = sanitized.match(attrPattern) || [];
      
      for (const match of matches) {
        const attrName = match.match(/\b([a-zA-Z-]+)/)?.[1];
        if (attrName && !allowedAttributes.includes(attrName.toLowerCase())) {
          sanitized = sanitized.replace(match, '');
        }
      }
    }

    return sanitized;
  }

  /**
   * Sanitize JSON data
   * @param json The JSON to sanitize
   * @returns Sanitized JSON object or null
   */
  static sanitizeJSON(json: string): any | null {
    try {
      // Parse JSON first
      const parsed = JSON.parse(json);
      
      // Sanitize the parsed object
      const result = this.sanitize(parsed);
      
      return result.sanitized;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate sanitization report
   * @param results Array of sanitization results
   * @returns Sanitization report
   */
  static generateReport(results: SanitizationResult[]): {
    summary: {
      totalProcessed: number;
      totalProcessingTime: number;
      averageProcessingTime: number;
      mostAppliedRules: Array<{ name: string; count: number }>;
      totalWarnings: number;
    };
    details: SanitizationResult[];
    recommendations: string[];
    generatedAt: number;
  } {
    const totalProcessed = results.length;
    const totalProcessingTime = results.reduce((sum, result) => sum + result.metadata.processingTime, 0);
    const averageProcessingTime = totalProcessingTime / totalProcessed;

    // Count rule applications
    const ruleCounts = new Map<string, number>();
    for (const result of results) {
      for (const ruleName of result.appliedRules) {
        ruleCounts.set(ruleName, (ruleCounts.get(ruleName) || 0) + 1);
      }
    }

    const mostAppliedRules = Array.from(ruleCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalWarnings = results.reduce((sum, result) => sum + result.warnings.length, 0);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (averageProcessingTime > 10) {
      recommendations.push('Consider optimizing sanitization rules for better performance');
    }

    if (totalWarnings > 0) {
      recommendations.push('Review and fix sanitization warnings');
    }

    const topRule = mostAppliedRules[0];
    if (topRule && topRule.count > totalProcessed * 0.8) {
      recommendations.push(`Rule '${topRule.name}' is applied to most inputs - consider optimization`);
    }

    return {
      summary: {
        totalProcessed,
        totalProcessingTime,
        averageProcessingTime,
        mostAppliedRules,
        totalWarnings
      },
      details: results,
      recommendations,
      generatedAt: Date.now()
    };
  }

  /**
   * Batch sanitize multiple items
   * @param items Array of items to sanitize
   * @param config Optional sanitization configuration
   * @returns Array of sanitization results
   */
  static batchSanitize(items: any[], config?: Partial<SanitizationConfig>): SanitizationResult[] {
    return items.map(item => this.sanitize(item, config));
  }

  /**
   * Check if data needs sanitization
   * @param data The data to check
   * @returns True if sanitization is recommended
   */
  static needsSanitization(data: any): boolean {
    // Check for common indicators that sanitization is needed
    if (typeof data === 'string') {
      return /[<>\\x00-\\x1F\\x7F]/.test(data);
    }

    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      return keys.some(key => /[<>\\x00-\\x1F\\x7F]/.test(key));
    }

    if (Array.isArray(data)) {
      return data.some(item => this.needsSanitization(item));
    }

    return false;
  }
} * Sanitization Engine for Ray Chrome Extension
 * Advanced data sanitization and cleaning utilities
 */

export interface SanitizationRule {
  name: string;
  description: string;
  priority: number;
  apply: (data: any) => any;
  shouldApply: (data: any) => boolean;
}

export interface SanitizationResult {
  original: any;
  sanitized: any;
  appliedRules: string[];
  warnings: string[];
  metadata: {
    processingTime: number;
    dataTypes: string[];
    size: number;
  };
}

export interface SanitizationConfig {
  enableDeepSanitization: boolean;
  enableStrictMode: boolean;
  maxDepth: number;
  preserveWhitespace: boolean;
  customRules?: SanitizationRule[];
}

export class SanitizationEngine {
  private static readonly DEFAULT_CONFIG: SanitizationConfig = {
    enableDeepSanitization: true,
    enableStrictMode: false,
    maxDepth: 10,
    preserveWhitespace: false
  };

  private static readonly SANITIZATION_RULES: SanitizationRule[] = [
    {
      name: 'Remove Null Bytes',
      description: 'Removes null bytes from strings',
      priority: 100,
      apply: (data: any) => {
        if (typeof data === 'string') {
          return data.replace(/\x00/g, '');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Normalize Unicode',
      description: 'Normalizes Unicode characters',
      priority: 90,
      apply: (data: any) => {
        if (typeof data === 'string') {
          // Normalize Unicode normalization form C
          return data.normalize('NFC');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Remove Control Characters',
      description: 'Removes control characters except whitespace',
      priority: 85,
      apply: (data: any) => {
        if (typeof data === 'string') {
          return data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Sanitize Object Keys',
      description: 'Sanitizes object property keys',
      priority: 80,
      apply: (data: any) => {
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(data)) {
            // Skip dangerous keys
            if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
              // Sanitize key name
              const sanitizedKey = key.replace(/[^\w_$]/g, '');
              sanitized[sanitizedKey] = value;
            }
          }
          return sanitized;
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'object' && data !== null && !Array.isArray(data)
    },
    {
      name: 'Sanitize Array Elements',
      description: 'Sanitizes array elements recursively',
      priority: 75,
      apply: (data: any) => {
        if (Array.isArray(data)) {
          return data.map(item => item);
        }
        return data;
      },
      shouldApply: (data: any) => Array.isArray(data)
    },
    {
      name: 'Remove Duplicate Whitespace',
      description: 'Removes duplicate whitespace characters',
      priority: 70,
      apply: (data: any, config: SanitizationConfig) => {
        if (typeof data === 'string') {
          return data.replace(/\s+/g, config?.preserveWhitespace ? ' ' : '').trim();
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Remove ZWSP Characters',
      description: 'Removes zero-width space characters',
      priority: 65,
      apply: (data: any) => {
        if (typeof data === 'string') {
          return data.replace(/[\u200B-\u200D\uFEFF]/g, '');
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'string'
    },
    {
      name: 'Sanitize Numbers',
      description: 'Sanitizes numeric values',
      priority: 60,
      apply: (data: any) => {
        if (typeof data === 'number') {
          // Remove NaN and Infinity
          if (isNaN(data) || !isFinite(data)) {
            return 0;
          }
          // Clamp to safe range
          return Math.max(Number.MIN_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, data));
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'number'
    },
    {
      name: 'Sanitize Booleans',
      description: 'Sanitizes boolean values',
      priority: 55,
      apply: (data: any) => {
        if (typeof data === 'boolean') {
          return Boolean(data);
        }
        return data;
      },
      shouldApply: (data: any) => typeof data === 'boolean'
    }
  ];

  /**
   * Sanitize data using all applicable rules
   * @param data The data to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitize(data: any, config?: Partial<SanitizationConfig>): SanitizationResult {
    const startTime = performance.now();
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const appliedRules: string[] = [];
    const warnings: string[] = [];
    let sanitized = data;

    // Get all rules including custom ones
    const allRules = [...this.SANITIZATION_RULES, ...(finalConfig.customRules || [])]
      .sort((a, b) => b.priority - a.priority);

    // Apply rules based on data type and configuration
    for (const rule of allRules) {
      if (rule.shouldApply(sanitized)) {
        try {
          const before = sanitized;
          sanitized = rule.apply(sanitized, finalConfig);
          
          if (before !== sanitized) {
            appliedRules.push(rule.name);
          }
        } catch (error) {
          warnings.push(`Rule '${rule.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Apply deep sanitization if enabled
    if (finalConfig.enableDeepSanitization) {
      sanitized = this.deepSanitize(sanitized, finalConfig.maxDepth, 0);
    }

    // Apply strict mode if enabled
    if (finalConfig.enableStrictMode) {
      sanitized = this.strictSanitize(sanitized);
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    return {
      original: data,
      sanitized,
      appliedRules,
      warnings,
      metadata: {
        processingTime,
        dataTypes: this.getDataTypes(data),
        size: this.getDataSize(data)
      }
    };
  }

  /**
   * Sanitize string specifically
   * @param str The string to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitizeString(str: string, config?: Partial<SanitizationConfig>): SanitizationResult {
    if (typeof str !== 'string') {
      return {
        original: str,
        sanitized: str,
        appliedRules: [],
        warnings: ['Input is not a string'],
        metadata: {
          processingTime: 0,
          dataTypes: [],
          size: 0
        }
      };
    }

    return this.sanitize(str, config);
  }

  /**
   * Sanitize object specifically
   * @param obj The object to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitizeObject(obj: any, config?: Partial<SanitizationConfig>): SanitizationResult {
    if (typeof obj !== 'object' || obj === null) {
      return {
        original: obj,
        sanitized: obj,
        appliedRules: [],
        warnings: ['Input is not an object'],
        metadata: {
          processingTime: 0,
          dataTypes: [],
          size: 0
        }
      };
    }

    return this.sanitize(obj, config);
  }

  /**
   * Sanitize array specifically
   * @param arr The array to sanitize
   * @param config Optional sanitization configuration
   * @returns Sanitization result
   */
  static sanitizeArray(arr: any[], config?: Partial<SanitizationConfig>): SanitizationResult {
    if (!Array.isArray(arr)) {
      return {
        original: arr,
        sanitized: arr,
        appliedRules: [],
        warnings: ['Input is not an array'],
        metadata: {
          processingTime: 0,
          dataTypes: [],
          size: 0
        }
      };
    }

    return this.sanitize(arr, config);
  }

  /**
   * Apply deep sanitization recursively
   * @param data The data to sanitize
   * @param maxDepth Maximum recursion depth
   * @param currentDepth Current recursion depth
   * @returns Deep sanitized data
   */
  private static deepSanitize(data: any, maxDepth: number, currentDepth: number): any {
    if (currentDepth >= maxDepth) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.deepSanitize(item, maxDepth, currentDepth + 1));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (!['__proto__', 'constructor', 'prototype'].includes(key)) {
          sanitized[key] = this.deepSanitize(value, maxDepth, currentDepth + 1);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Apply strict mode sanitization
   * @param data The data to sanitize
   * @returns Strict sanitized data
   */
  private static strictSanitize(data: any): any {
    if (typeof data === 'string') {
      // Remove all non-printable characters except basic whitespace
      return data.replace(/[^\x20-\x7E\s]/g, '');
    }

    if (typeof data === 'number') {
      // Remove any non-standard number representations
      if (!isFinite(data)) {
        return 0;
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.strictSanitize(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Only allow alphanumeric keys in strict mode
        if (/^[a-zA-Z0-9_$]+$/.test(key)) {
          sanitized[key] = this.strictSanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Get data types present in the input
   * @param data The data to analyze
   * @returns Array of type names
   */
  private static getDataTypes(data: any): string[] {
    const types = new Set<string>();
    
    const addType = (value: any) => {
      if (value === null) types.add('null');
      else if (Array.isArray(value)) types.add('array');
      else types.add(typeof value);
    };

    addType(data);

    if (Array.isArray(data)) {
      for (const item of data) {
        addType(item);
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const value of Object.values(data)) {
        addType(value);
      }
    }

    return Array.from(types);
  }

  /**
   * Get approximate data size
   * @param data The data to measure
   * @returns Size in bytes
   */
  private static getDataSize(data: any): number {
    try {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Create custom sanitization rule
   * @param name Rule name
   * @param description Rule description
   * @param priority Rule priority (higher = applied first)
   * @param apply Function to apply the rule
   * @param shouldApply Function to check if rule should apply
   * @returns Custom sanitization rule
   */
  static createCustomRule(
    name: string,
    description: string,
    priority: number,
    apply: (data: any) => any,
    shouldApply: (data: any) => boolean
  ): SanitizationRule {
    return {
      name,
      description,
      priority,
      apply,
      shouldApply
    };
  }

  /**
   * Add custom sanitization rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: SanitizationRule): void {
    this.SANITIZATION_RULES.push(rule);
  }

  /**
   * Remove sanitization rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.SANITIZATION_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.SANITIZATION_RULES.splice(index, 1);
    }
  }

  /**
   * Get all sanitization rules
   * @returns Array of sanitization rules
   */
  static getSanitizationRules(): SanitizationRule[] {
    return [...this.SANITIZATION_RULES];
  }

  /**
   * Sanitize HTML content specifically
   * @param html The HTML to sanitize
   * @param allowedTags Optional list of allowed tags
   * @param allowedAttributes Optional list of allowed attributes
   * @returns Sanitized HTML
   */
  static sanitizeHTML(
    html: string,
    allowedTags: string[] = [],
    allowedAttributes: string[] = []
  ): string {
    if (typeof html !== 'string') {
      return '';
    }

    let sanitized = html;

    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove dangerous attributes
    const dangerousAttributes = [
      'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus',
      'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect'
    ];

    for (const attr of dangerousAttributes) {
      const pattern = new RegExp(`\\b${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(pattern, '');
    }

    // Filter to allowed tags if specified
    if (allowedTags.length > 0) {
      const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      const matches = sanitized.match(tagPattern) || [];
      
      for (const match of matches) {
        const tagName = match.match(/<\/?([a-zA-Z][a-zA-Z0-9]*)/)?.[1];
        if (tagName && !allowedTags.includes(tagName.toLowerCase())) {
          sanitized = sanitized.replace(match, '');
        }
      }
    }

    // Filter to allowed attributes if specified
    if (allowedAttributes.length > 0) {
      const attrPattern = /\b([a-zA-Z-]+)\s*=\s*["'][^"']*["']/g;
      const matches = sanitized.match(attrPattern) || [];
      
      for (const match of matches) {
        const attrName = match.match(/\b([a-zA-Z-]+)/)?.[1];
        if (attrName && !allowedAttributes.includes(attrName.toLowerCase())) {
          sanitized = sanitized.replace(match, '');
        }
      }
    }

    return sanitized;
  }

  /**
   * Sanitize JSON data
   * @param json The JSON to sanitize
   * @returns Sanitized JSON object or null
   */
  static sanitizeJSON(json: string): any | null {
    try {
      // Parse JSON first
      const parsed = JSON.parse(json);
      
      // Sanitize the parsed object
      const result = this.sanitize(parsed);
      
      return result.sanitized;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate sanitization report
   * @param results Array of sanitization results
   * @returns Sanitization report
   */
  static generateReport(results: SanitizationResult[]): {
    summary: {
      totalProcessed: number;
      totalProcessingTime: number;
      averageProcessingTime: number;
      mostAppliedRules: Array<{ name: string; count: number }>;
      totalWarnings: number;
    };
    details: SanitizationResult[];
    recommendations: string[];
    generatedAt: number;
  } {
    const totalProcessed = results.length;
    const totalProcessingTime = results.reduce((sum, result) => sum + result.metadata.processingTime, 0);
    const averageProcessingTime = totalProcessingTime / totalProcessed;

    // Count rule applications
    const ruleCounts = new Map<string, number>();
    for (const result of results) {
      for (const ruleName of result.appliedRules) {
        ruleCounts.set(ruleName, (ruleCounts.get(ruleName) || 0) + 1);
      }
    }

    const mostAppliedRules = Array.from(ruleCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalWarnings = results.reduce((sum, result) => sum + result.warnings.length, 0);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (averageProcessingTime > 10) {
      recommendations.push('Consider optimizing sanitization rules for better performance');
    }

    if (totalWarnings > 0) {
      recommendations.push('Review and fix sanitization warnings');
    }

    const topRule = mostAppliedRules[0];
    if (topRule && topRule.count > totalProcessed * 0.8) {
      recommendations.push(`Rule '${topRule.name}' is applied to most inputs - consider optimization`);
    }

    return {
      summary: {
        totalProcessed,
        totalProcessingTime,
        averageProcessingTime,
        mostAppliedRules,
        totalWarnings
      },
      details: results,
      recommendations,
      generatedAt: Date.now()
    };
  }

  /**
   * Batch sanitize multiple items
   * @param items Array of items to sanitize
   * @param config Optional sanitization configuration
   * @returns Array of sanitization results
   */
  static batchSanitize(items: any[], config?: Partial<SanitizationConfig>): SanitizationResult[] {
    return items.map(item => this.sanitize(item, config));
  }

  /**
   * Check if data needs sanitization
   * @param data The data to check
   * @returns True if sanitization is recommended
   */
  static needsSanitization(data: any): boolean {
    // Check for common indicators that sanitization is needed
    if (typeof data === 'string') {
      return /[<>\\x00-\\x1F\\x7F]/.test(data);
    }

    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      return keys.some(key => /[<>\\x00-\\x1F\\x7F]/.test(key));
    }

    if (Array.isArray(data)) {
      return data.some(item => this.needsSanitization(item));
    }

    return false;
  }
}
