/**
 * Command validation and security implementation
 */

import { 
  EnhancedParsedCommand,
  CommandParameters,
  CommandContext,
  SecurityValidation,
  CommandParsingError
} from './types';
import { AutomationCommand, RayError } from '../shared/contracts';

export class CommandValidator {
  private securityRules: SecurityRule[] = [];
  private validationRules: ValidationRule[] = [];
  private blockedDomains: Set<string> = new Set();
  private allowedSchemes: Set<string> = new Set(['https', 'http', 'file', 'data']);
  private maxCommandComplexity: number = 10;

  constructor() {
    this.initializeSecurityRules();
    this.initializeValidationRules();
    this.initializeBlockedDomains();
  }

  /**
   * Validate a parsed command
   */
  validateCommand(
    command: EnhancedParsedCommand,
    context: CommandContext = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    // Basic validation
    const basicValidation = this.validateBasicStructure(command);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // Parameter validation
    const paramValidation = this.validateParameters(command.parameters, command.intent);
    errors.push(...paramValidation.errors);
    warnings.push(...paramValidation.warnings);

    // Security validation
    const securityValidation = this.validateSecurity(command, context);
    errors.push(...securityValidation.errors);
    warnings.push(...securityValidation.warnings);
    securityIssues.push(...securityValidation.securityIssues);

    // Context validation
    const contextValidation = this.validateContext(command, context);
    errors.push(...contextValidation.errors);
    warnings.push(...contextValidation.warnings);

    // Complexity validation
    const complexityValidation = this.validateComplexity(command);
    errors.push(...complexityValidation.errors);
    warnings.push(...complexityValidation.warnings);

    const isValid = errors.length === 0 && securityIssues.length === 0;
    const sanitizedCommand = this.sanitizeCommand(command);

    return {
      isValid,
      errors,
      warnings,
      securityIssues,
      sanitizedCommand,
      riskLevel: this.calculateRiskLevel(command, securityIssues),
      requiresConfirmation: this.requiresConfirmation(command, securityIssues),
    };
  }

  /**
   * Validate multiple commands
   */
  validateCommands(
    commands: EnhancedParsedCommand[],
    context: CommandContext = {}
  ): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allSecurityIssues: string[] = [];
    const sanitizedCommands: EnhancedParsedCommand[] = [];

    // Validate individual commands
    for (const command of commands) {
      const result = this.validateCommand(command, context);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSecurityIssues.push(...result.securityIssues);
      
      if (result.sanitizedCommand) {
        sanitizedCommands.push(result.sanitizedCommand);
      }
    }

    // Validate command sequence
    const sequenceValidation = this.validateCommandSequence(commands);
    allErrors.push(...sequenceValidation.errors);
    allWarnings.push(...sequenceValidation.warnings);

    return {
      isValid: allErrors.length === 0 && allSecurityIssues.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      securityIssues: allSecurityIssues,
      sanitizedCommands,
      riskLevel: this.calculateSequenceRiskLevel(commands, allSecurityIssues),
      requiresConfirmation: allSecurityIssues.length > 0 || commands.some(cmd => this.requiresConfirmation(cmd, [])),
    };
  }

  /**
   * Validate automation command
   */
  validateAutomationCommand(
    command: AutomationCommand,
    context: CommandContext = {}
  ): SecurityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const permissions: string[] = [];

    // Basic structure validation
    if (!command.id) {
      errors.push('Command ID is required');
    }

    if (!command.type) {
      errors.push('Command type is required');
    }

    // Type-specific validation
    switch (command.type) {
      case 'navigate':
        if (!command.url) {
          errors.push('URL is required for navigation commands');
        } else {
          const urlValidation = this.validateURL(command.url);
          errors.push(...urlValidation.errors);
          warnings.push(...urlValidation.warnings);
          permissions.push('navigation');
        }
        break;

      case 'click':
        if (!command.selector && !command.value) {
          warnings.push('Click command should have either selector or value');
        }
        permissions.push('dom_access');
        break;

      case 'fill':
        if (!command.selector) {
          errors.push('Selector is required for fill commands');
        }
        if (!command.value) {
          errors.push('Value is required for fill commands');
        }
        permissions.push('dom_access', 'form_interaction');
        break;

      case 'extract':
        permissions.push('dom_access', 'data_extraction');
        break;

      case 'submit':
        permissions.push('dom_access', 'form_interaction');
        break;
    }

    // Security validation
    const securityIssues = this.checkSecurityIssues(command);
    errors.push(...securityIssues);

    return {
      isValid: errors.length === 0,
      errors,
      permissions: [...new Set(permissions)],
      warnings,
    };
  }

  /**
   * Validate basic command structure
   */
  private validateBasicStructure(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!command.intent) {
      errors.push('Command intent is required');
    }

    if (!command.originalText) {
      errors.push('Original text is required');
    }

    if (typeof command.confidence !== 'number' || command.confidence < 0 || command.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }

    if (command.confidence < 0.3) {
      warnings.push('Low confidence command may not execute correctly');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command parameters
   */
  private validateParameters(
    parameters: CommandParameters,
    intent: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // URL validation
    if (parameters.url) {
      const urlValidation = this.validateURL(parameters.url);
      errors.push(...urlValidation.errors);
      warnings.push(...urlValidation.warnings);
    }

    // Selector validation
    if (parameters.selector) {
      const selectorValidation = this.validateSelector(parameters.selector);
      errors.push(...selectorValidation.errors);
      warnings.push(...selectorValidation.warnings);
    }

    // Duration validation
    if (parameters.duration !== undefined) {
      if (typeof parameters.duration !== 'number' || parameters.duration < 0) {
        errors.push('Duration must be a positive number');
      }
      if (parameters.duration > 60000) {
        warnings.push('Duration exceeds 1 minute, consider breaking into smaller steps');
      }
    }

    // Timeout validation
    if (parameters.timeout !== undefined) {
      if (typeof parameters.timeout !== 'number' || parameters.timeout < 0) {
        errors.push('Timeout must be a positive number');
      }
    }

    // Value validation for sensitive data
    if (parameters.value) {
      const sensitiveValidation = this.validateSensitiveData(parameters.value);
      warnings.push(...sensitiveValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate URL
   */
  private validateURL(url: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parsedUrl = new URL(url);
      
      // Check scheme
      if (!this.allowedSchemes.has(parsedUrl.protocol.replace(':', ''))) {
        errors.push(`URL scheme ${parsedUrl.protocol} is not allowed`);
      }

      // Check for blocked domains
      const domain = parsedUrl.hostname;
      if (this.blockedDomains.has(domain)) {
        errors.push(`Domain ${domain} is blocked`);
      }

      // Check for suspicious patterns
      if (url.includes('javascript:') || url.includes('data:')) {
        errors.push('JavaScript and data URLs are not allowed');
      }

      // Security warnings
      if (parsedUrl.protocol === 'http:') {
        warnings.push('HTTP URLs are less secure than HTTPS');
      }

      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        warnings.push('Localhost URLs may not be accessible');
      }

    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate CSS selector
   */
  private validateSelector(selector: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selector || selector.trim() === '') {
      errors.push('Selector cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Check for potentially dangerous selectors
    if (selector.includes('javascript:') || selector.includes('data:')) {
      errors.push('Selector contains potentially dangerous content');
    }

    // Check for overly complex selectors
    if (selector.length > 500) {
      warnings.push('Selector is very long and may be inefficient');
    }

    // Check for XSS patterns
    const xssPatterns = ['<script', 'onerror', 'onload', 'javascript:'];
    for (const pattern of xssPatterns) {
      if (selector.toLowerCase().includes(pattern)) {
        errors.push(`Selector contains potentially dangerous pattern: ${pattern}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate sensitive data
   */
  private validateSensitiveData(value: string): ValidationResult {
    const warnings: string[] = [];

    // Check for patterns that might indicate sensitive data
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credit.*card/i,
      /ssn/i,
      /social.*security/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(value)) {
        warnings.push('Value may contain sensitive information');
        break;
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Validate security aspects
   */
  private validateSecurity(
    command: EnhancedParsedCommand,
    context: CommandContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    // Apply security rules
    for (const rule of this.securityRules) {
      const result = rule.check(command, context);
      if (!result.passed) {
        if (result.severity === 'error') {
          errors.push(result.message);
          securityIssues.push(result.message);
        } else {
          warnings.push(result.message);
        }
      }
    }

    // Check intent-specific security
    const intentSecurity = this.checkIntentSecurity(command);
    errors.push(...intentSecurity.errors);
    warnings.push(...intentSecurity.warnings);
    securityIssues.push(...intentSecurity.securityIssues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityIssues,
    };
  }

  /**
   * Validate context
   */
  private validateContext(
    command: EnhancedParsedCommand,
    context: CommandContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if command makes sense in current context
    if (context.currentUrl && command.intent === 'navigate') {
      try {
        const currentUrl = new URL(context.currentUrl);
        const targetUrl = command.parameters.url;
        
        if (targetUrl) {
          const target = new URL(targetUrl);
          if (currentUrl.href === target.href) {
            warnings.push('Navigating to the same URL');
          }
        }
      } catch {
        // URL parsing failed, already caught in URL validation
      }
    }

    // Check if required elements are available
    if (context.availableElements && command.parameters.selector) {
      const hasElement = context.availableElements.some(
        element => element.selector === command.parameters.selector
      );
      
      if (!hasElement) {
        warnings.push('Specified selector not found in available elements');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command complexity
   */
  private validateComplexity(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let complexityScore = 0;

    // Calculate complexity based on various factors
    if (command.parameters.url) complexityScore += 1;
    if (command.parameters.selector) complexityScore += 2;
    if (command.parameters.value) complexityScore += 1;
    if (command.parameters.options) complexityScore += Object.keys(command.parameters.options).length;
    if (command.complexity === 'complex') complexityScore += 3;
    else if (command.complexity === 'moderate') complexityScore += 2;

    if (complexityScore > this.maxCommandComplexity) {
      errors.push('Command is too complex and may be difficult to execute reliably');
    } else if (complexityScore > this.maxCommandComplexity * 0.7) {
      warnings.push('Command is relatively complex');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command sequence
   */
  private validateCommandSequence(commands: EnhancedParsedCommand[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for potential conflicts
    for (let i = 0; i < commands.length - 1; i++) {
      const current = commands[i];
      const next = commands[i + 1];

      // Check for navigation followed by other commands
      if (current.intent === 'navigate' && next.intent !== 'navigate') {
        warnings.push('Navigation followed by other commands may fail if page changes');
      }

      // Check for redundant commands
      if (current.intent === next.intent && 
          JSON.stringify(current.parameters) === JSON.stringify(next.parameters)) {
        warnings.push('Duplicate consecutive commands detected');
      }
    }

    // Check sequence length
    if (commands.length > 10) {
      warnings.push('Long command sequences may be unreliable');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check intent-specific security
   */
  private checkIntentSecurity(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    switch (command.intent) {
      case 'navigate':
        if (command.parameters.url) {
          const url = command.parameters.url.toLowerCase();
          if (url.includes('admin') || url.includes('dashboard')) {
            securityIssues.push('Navigation to admin areas requires caution');
          }
        }
        break;

      case 'fill':
        if (command.parameters.value) {
          const value = command.parameters.value.toLowerCase();
          if (value.includes('password') || value.includes('secret')) {
            securityIssues.push('Handling sensitive data requires extra security');
          }
        }
        break;

      case 'extract':
        if (command.parameters.extractType === 'data') {
          securityIssues.push('Data extraction may involve sensitive information');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityIssues,
    };
  }

  /**
   * Check security issues
   */
  private checkSecurityIssues(command: AutomationCommand): string[] {
    const issues: string[] = [];

    // Check for various security patterns
    if (command.selector) {
      const selector = command.selector.toLowerCase();
      if (selector.includes('script') || selector.includes('iframe')) {
        issues.push('Selector targets potentially dangerous elements');
      }
    }

    if (command.value) {
      const value = command.value.toLowerCase();
      if (value.includes('<script>') || value.includes('javascript:')) {
        issues.push('Value contains potentially dangerous content');
      }
    }

    return issues;
  }

  /**
   * Sanitize command
   */
  private sanitizeCommand(command: EnhancedParsedCommand): EnhancedParsedCommand {
    const sanitized = { ...command };

    // Sanitize parameters
    if (sanitized.parameters) {
      // Remove potentially dangerous content
      if (sanitized.parameters.selector) {
        sanitized.parameters.selector = this.sanitizeSelector(sanitized.parameters.selector);
      }

      if (sanitized.parameters.value) {
        sanitized.parameters.value = this.sanitizeValue(sanitized.parameters.value);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize CSS selector
   */
  private sanitizeSelector(selector: string): string {
    return selector
      .replace(/javascript:/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Sanitize value
   */
  private sanitizeValue(value: string): string {
    return value
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    command: EnhancedParsedCommand,
    securityIssues: string[]
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Base risk from intent
    const intentRiskMap: Record<string, number> = {
      navigate: 1,
      click: 1,
      fill: 2,
      scroll: 1,
      submit: 2,
      extract: 2,
      wait: 0,
      search: 1,
      login: 3,
      logout: 2,
      upload: 3,
      download: 2,
      screenshot: 2,
      unknown: 1,
    };

    riskScore += intentRiskMap[command.intent] || 1;

    // Risk from security issues
    riskScore += securityIssues.length * 2;

    // Risk from complexity
    if (command.complexity === 'complex') riskScore += 2;
    else if (command.complexity === 'moderate') riskScore += 1;

    // Risk from security level
    if (command.securityLevel === 'high') riskScore += 3;
    else if (command.securityLevel === 'medium') riskScore += 2;

    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate sequence risk level
   */
  private calculateSequenceRiskLevel(
    commands: EnhancedParsedCommand[],
    securityIssues: string[]
  ): 'low' | 'medium' | 'high' {
    const maxRisk = Math.max(
      ...commands.map(cmd => this.calculateRiskLevel(cmd, []))
    );

    // Increase risk based on sequence length and security issues
    let riskScore = maxRisk === 'high' ? 3 : maxRisk === 'medium' ? 2 : 1;
    riskScore += Math.floor(commands.length / 5);
    riskScore += Math.floor(securityIssues.length / 3);

    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Check if confirmation is required
   */
  private requiresConfirmation(
    command: EnhancedParsedCommand,
    securityIssues: string[]
  ): boolean {
    // Require confirmation for high-risk commands
    if (command.securityLevel === 'high') return true;
    
    // Require confirmation if there are security issues
    if (securityIssues.length > 0) return true;
    
    // Require confirmation for certain intents
    const confirmationRequiredIntents = ['login', 'upload', 'download'];
    if (confirmationRequiredIntents.includes(command.intent)) return true;
    
    // Require confirmation for low confidence commands
    if (command.confidence < 0.5) return true;
    
    return false;
  }

  /**
   * Initialize security rules
   */
  private initializeSecurityRules(): void {
    this.securityRules = [
      {
        name: 'block_file_urls',
        description: 'Block file:// URLs for security',
        check: (cmd, ctx) => {
          if (cmd.parameters.url?.startsWith('file://')) {
            return { passed: false, message: 'File URLs are not allowed for security reasons', severity: 'error' as const };
          }
          return { passed: true };
        },
      },
      {
        name: 'block_javascript_urls',
        description: 'Block javascript: URLs',
        check: (cmd, ctx) => {
          if (cmd.parameters.url?.startsWith('javascript:')) {
            return { passed: false, message: 'JavaScript URLs are not allowed', severity: 'error' as const };
          }
          return { passed: true };
        },
      },
      {
        name: 'warn_sensitive_data',
        description: 'Warn about sensitive data handling',
        check: (cmd, ctx) => {
          if (cmd.parameters.value?.match(/password|secret|token/i)) {
            return { passed: true, message: 'Command involves sensitive data - proceed with caution', severity: 'warning' as const };
          }
          return { passed: true };
        },
      },
    ];
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      {
        name: 'require_url_for_navigation',
        description: 'Navigation commands must have a URL',
        check: (cmd, ctx) => {
          if (cmd.intent === 'navigate' && !cmd.parameters.url) {
            return { passed: false, message: 'Navigation commands require a URL', severity: 'error' as const };
          }
          return { passed: true };
        },
      },
      {
        name: 'require_selector_for_click',
        description: 'Click commands should have a selector',
        check: (cmd, ctx) => {
          if (cmd.intent === 'click' && !cmd.parameters.selector && !cmd.parameters.text) {
            return { passed: false, message: 'Click commands should have a selector or text', severity: 'warning' as const };
          }
          return { passed: true };
        },
      },
    ];
  }

  /**
   * Initialize blocked domains
   */
  private initializeBlockedDomains(): void {
    // Add commonly blocked/malicious domains
    const blocked = [
      'malware-site.com',
      'phishing-site.net',
      // Add more as needed
    ];

    blocked.forEach(domain => this.blockedDomains.add(domain));
  }

  /**
   * Add custom security rule
   */
  public addSecurityRule(rule: SecurityRule): void {
    this.securityRules.push(rule);
  }

  /**
   * Remove security rule
   */
  public removeSecurityRule(name: string): boolean {
    const index = this.securityRules.findIndex(rule => rule.name === name);
    if (index > -1) {
      this.securityRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add blocked domain
   */
  public addBlockedDomain(domain: string): void {
    this.blockedDomains.add(domain);
  }

  /**
   * Remove blocked domain
   */
  public removeBlockedDomain(domain: string): boolean {
    return this.blockedDomains.delete(domain);
  }

  /**
   * Get security rules
   */
  public getSecurityRules(): SecurityRule[] {
    return [...this.securityRules];
  }

  /**
   * Get blocked domains
   */
  public getBlockedDomains(): string[] {
    return Array.from(this.blockedDomains);
  }
}

// Supporting interfaces
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityIssues?: string[];
  sanitizedCommand?: EnhancedParsedCommand;
  sanitizedCommands?: EnhancedParsedCommand[];
  riskLevel?: 'low' | 'medium' | 'high';
  requiresConfirmation?: boolean;
}

interface SecurityRule {
  name: string;
  description: string;
  check: (command: EnhancedParsedCommand, context: CommandContext) => {
    passed: boolean;
    message?: string;
    severity: 'error' | 'warning';
  };
}

interface ValidationRule {
  name: string;
  description: string;
  check: (command: EnhancedParsedCommand, context: CommandContext) => {
    passed: boolean;
    message?: string;
    severity: 'error' | 'warning';
  };
} * Command validation and security implementation
 */

import { 
  EnhancedParsedCommand,
  CommandParameters,
  CommandContext,
  SecurityValidation,
  CommandParsingError
} from './types';
import { AutomationCommand, RayError } from '../shared/contracts';

export class CommandValidator {
  private securityRules: SecurityRule[] = [];
  private validationRules: ValidationRule[] = [];
  private blockedDomains: Set<string> = new Set();
  private allowedSchemes: Set<string> = new Set(['https', 'http', 'file', 'data']);
  private maxCommandComplexity: number = 10;

  constructor() {
    this.initializeSecurityRules();
    this.initializeValidationRules();
    this.initializeBlockedDomains();
  }

  /**
   * Validate a parsed command
   */
  validateCommand(
    command: EnhancedParsedCommand,
    context: CommandContext = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    // Basic validation
    const basicValidation = this.validateBasicStructure(command);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // Parameter validation
    const paramValidation = this.validateParameters(command.parameters, command.intent);
    errors.push(...paramValidation.errors);
    warnings.push(...paramValidation.warnings);

    // Security validation
    const securityValidation = this.validateSecurity(command, context);
    errors.push(...securityValidation.errors);
    warnings.push(...securityValidation.warnings);
    securityIssues.push(...securityValidation.securityIssues);

    // Context validation
    const contextValidation = this.validateContext(command, context);
    errors.push(...contextValidation.errors);
    warnings.push(...contextValidation.warnings);

    // Complexity validation
    const complexityValidation = this.validateComplexity(command);
    errors.push(...complexityValidation.errors);
    warnings.push(...complexityValidation.warnings);

    const isValid = errors.length === 0 && securityIssues.length === 0;
    const sanitizedCommand = this.sanitizeCommand(command);

    return {
      isValid,
      errors,
      warnings,
      securityIssues,
      sanitizedCommand,
      riskLevel: this.calculateRiskLevel(command, securityIssues),
      requiresConfirmation: this.requiresConfirmation(command, securityIssues),
    };
  }

  /**
   * Validate multiple commands
   */
  validateCommands(
    commands: EnhancedParsedCommand[],
    context: CommandContext = {}
  ): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allSecurityIssues: string[] = [];
    const sanitizedCommands: EnhancedParsedCommand[] = [];

    // Validate individual commands
    for (const command of commands) {
      const result = this.validateCommand(command, context);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSecurityIssues.push(...result.securityIssues);
      
      if (result.sanitizedCommand) {
        sanitizedCommands.push(result.sanitizedCommand);
      }
    }

    // Validate command sequence
    const sequenceValidation = this.validateCommandSequence(commands);
    allErrors.push(...sequenceValidation.errors);
    allWarnings.push(...sequenceValidation.warnings);

    return {
      isValid: allErrors.length === 0 && allSecurityIssues.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      securityIssues: allSecurityIssues,
      sanitizedCommands,
      riskLevel: this.calculateSequenceRiskLevel(commands, allSecurityIssues),
      requiresConfirmation: allSecurityIssues.length > 0 || commands.some(cmd => this.requiresConfirmation(cmd, [])),
    };
  }

  /**
   * Validate automation command
   */
  validateAutomationCommand(
    command: AutomationCommand,
    context: CommandContext = {}
  ): SecurityValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const permissions: string[] = [];

    // Basic structure validation
    if (!command.id) {
      errors.push('Command ID is required');
    }

    if (!command.type) {
      errors.push('Command type is required');
    }

    // Type-specific validation
    switch (command.type) {
      case 'navigate':
        if (!command.url) {
          errors.push('URL is required for navigation commands');
        } else {
          const urlValidation = this.validateURL(command.url);
          errors.push(...urlValidation.errors);
          warnings.push(...urlValidation.warnings);
          permissions.push('navigation');
        }
        break;

      case 'click':
        if (!command.selector && !command.value) {
          warnings.push('Click command should have either selector or value');
        }
        permissions.push('dom_access');
        break;

      case 'fill':
        if (!command.selector) {
          errors.push('Selector is required for fill commands');
        }
        if (!command.value) {
          errors.push('Value is required for fill commands');
        }
        permissions.push('dom_access', 'form_interaction');
        break;

      case 'extract':
        permissions.push('dom_access', 'data_extraction');
        break;

      case 'submit':
        permissions.push('dom_access', 'form_interaction');
        break;
    }

    // Security validation
    const securityIssues = this.checkSecurityIssues(command);
    errors.push(...securityIssues);

    return {
      isValid: errors.length === 0,
      errors,
      permissions: [...new Set(permissions)],
      warnings,
    };
  }

  /**
   * Validate basic command structure
   */
  private validateBasicStructure(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!command.intent) {
      errors.push('Command intent is required');
    }

    if (!command.originalText) {
      errors.push('Original text is required');
    }

    if (typeof command.confidence !== 'number' || command.confidence < 0 || command.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }

    if (command.confidence < 0.3) {
      warnings.push('Low confidence command may not execute correctly');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command parameters
   */
  private validateParameters(
    parameters: CommandParameters,
    intent: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // URL validation
    if (parameters.url) {
      const urlValidation = this.validateURL(parameters.url);
      errors.push(...urlValidation.errors);
      warnings.push(...urlValidation.warnings);
    }

    // Selector validation
    if (parameters.selector) {
      const selectorValidation = this.validateSelector(parameters.selector);
      errors.push(...selectorValidation.errors);
      warnings.push(...selectorValidation.warnings);
    }

    // Duration validation
    if (parameters.duration !== undefined) {
      if (typeof parameters.duration !== 'number' || parameters.duration < 0) {
        errors.push('Duration must be a positive number');
      }
      if (parameters.duration > 60000) {
        warnings.push('Duration exceeds 1 minute, consider breaking into smaller steps');
      }
    }

    // Timeout validation
    if (parameters.timeout !== undefined) {
      if (typeof parameters.timeout !== 'number' || parameters.timeout < 0) {
        errors.push('Timeout must be a positive number');
      }
    }

    // Value validation for sensitive data
    if (parameters.value) {
      const sensitiveValidation = this.validateSensitiveData(parameters.value);
      warnings.push(...sensitiveValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate URL
   */
  private validateURL(url: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const parsedUrl = new URL(url);
      
      // Check scheme
      if (!this.allowedSchemes.has(parsedUrl.protocol.replace(':', ''))) {
        errors.push(`URL scheme ${parsedUrl.protocol} is not allowed`);
      }

      // Check for blocked domains
      const domain = parsedUrl.hostname;
      if (this.blockedDomains.has(domain)) {
        errors.push(`Domain ${domain} is blocked`);
      }

      // Check for suspicious patterns
      if (url.includes('javascript:') || url.includes('data:')) {
        errors.push('JavaScript and data URLs are not allowed');
      }

      // Security warnings
      if (parsedUrl.protocol === 'http:') {
        warnings.push('HTTP URLs are less secure than HTTPS');
      }

      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        warnings.push('Localhost URLs may not be accessible');
      }

    } catch (error) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate CSS selector
   */
  private validateSelector(selector: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selector || selector.trim() === '') {
      errors.push('Selector cannot be empty');
      return { isValid: false, errors, warnings };
    }

    // Check for potentially dangerous selectors
    if (selector.includes('javascript:') || selector.includes('data:')) {
      errors.push('Selector contains potentially dangerous content');
    }

    // Check for overly complex selectors
    if (selector.length > 500) {
      warnings.push('Selector is very long and may be inefficient');
    }

    // Check for XSS patterns
    const xssPatterns = ['<script', 'onerror', 'onload', 'javascript:'];
    for (const pattern of xssPatterns) {
      if (selector.toLowerCase().includes(pattern)) {
        errors.push(`Selector contains potentially dangerous pattern: ${pattern}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate sensitive data
   */
  private validateSensitiveData(value: string): ValidationResult {
    const warnings: string[] = [];

    // Check for patterns that might indicate sensitive data
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credit.*card/i,
      /ssn/i,
      /social.*security/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(value)) {
        warnings.push('Value may contain sensitive information');
        break;
      }
    }

    return {
      isValid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Validate security aspects
   */
  private validateSecurity(
    command: EnhancedParsedCommand,
    context: CommandContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    // Apply security rules
    for (const rule of this.securityRules) {
      const result = rule.check(command, context);
      if (!result.passed) {
        if (result.severity === 'error') {
          errors.push(result.message);
          securityIssues.push(result.message);
        } else {
          warnings.push(result.message);
        }
      }
    }

    // Check intent-specific security
    const intentSecurity = this.checkIntentSecurity(command);
    errors.push(...intentSecurity.errors);
    warnings.push(...intentSecurity.warnings);
    securityIssues.push(...intentSecurity.securityIssues);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityIssues,
    };
  }

  /**
   * Validate context
   */
  private validateContext(
    command: EnhancedParsedCommand,
    context: CommandContext
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if command makes sense in current context
    if (context.currentUrl && command.intent === 'navigate') {
      try {
        const currentUrl = new URL(context.currentUrl);
        const targetUrl = command.parameters.url;
        
        if (targetUrl) {
          const target = new URL(targetUrl);
          if (currentUrl.href === target.href) {
            warnings.push('Navigating to the same URL');
          }
        }
      } catch {
        // URL parsing failed, already caught in URL validation
      }
    }

    // Check if required elements are available
    if (context.availableElements && command.parameters.selector) {
      const hasElement = context.availableElements.some(
        element => element.selector === command.parameters.selector
      );
      
      if (!hasElement) {
        warnings.push('Specified selector not found in available elements');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command complexity
   */
  private validateComplexity(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    let complexityScore = 0;

    // Calculate complexity based on various factors
    if (command.parameters.url) complexityScore += 1;
    if (command.parameters.selector) complexityScore += 2;
    if (command.parameters.value) complexityScore += 1;
    if (command.parameters.options) complexityScore += Object.keys(command.parameters.options).length;
    if (command.complexity === 'complex') complexityScore += 3;
    else if (command.complexity === 'moderate') complexityScore += 2;

    if (complexityScore > this.maxCommandComplexity) {
      errors.push('Command is too complex and may be difficult to execute reliably');
    } else if (complexityScore > this.maxCommandComplexity * 0.7) {
      warnings.push('Command is relatively complex');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate command sequence
   */
  private validateCommandSequence(commands: EnhancedParsedCommand[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for potential conflicts
    for (let i = 0; i < commands.length - 1; i++) {
      const current = commands[i];
      const next = commands[i + 1];

      // Check for navigation followed by other commands
      if (current.intent === 'navigate' && next.intent !== 'navigate') {
        warnings.push('Navigation followed by other commands may fail if page changes');
      }

      // Check for redundant commands
      if (current.intent === next.intent && 
          JSON.stringify(current.parameters) === JSON.stringify(next.parameters)) {
        warnings.push('Duplicate consecutive commands detected');
      }
    }

    // Check sequence length
    if (commands.length > 10) {
      warnings.push('Long command sequences may be unreliable');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check intent-specific security
   */
  private checkIntentSecurity(command: EnhancedParsedCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    switch (command.intent) {
      case 'navigate':
        if (command.parameters.url) {
          const url = command.parameters.url.toLowerCase();
          if (url.includes('admin') || url.includes('dashboard')) {
            securityIssues.push('Navigation to admin areas requires caution');
          }
        }
        break;

      case 'fill':
        if (command.parameters.value) {
          const value = command.parameters.value.toLowerCase();
          if (value.includes('password') || value.includes('secret')) {
            securityIssues.push('Handling sensitive data requires extra security');
          }
        }
        break;

      case 'extract':
        if (command.parameters.extractType === 'data') {
          securityIssues.push('Data extraction may involve sensitive information');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityIssues,
    };
  }

  /**
   * Check security issues
   */
  private checkSecurityIssues(command: AutomationCommand): string[] {
    const issues: string[] = [];

    // Check for various security patterns
    if (command.selector) {
      const selector = command.selector.toLowerCase();
      if (selector.includes('script') || selector.includes('iframe')) {
        issues.push('Selector targets potentially dangerous elements');
      }
    }

    if (command.value) {
      const value = command.value.toLowerCase();
      if (value.includes('<script>') || value.includes('javascript:')) {
        issues.push('Value contains potentially dangerous content');
      }
    }

    return issues;
  }

  /**
   * Sanitize command
   */
  private sanitizeCommand(command: EnhancedParsedCommand): EnhancedParsedCommand {
    const sanitized = { ...command };

    // Sanitize parameters
    if (sanitized.parameters) {
      // Remove potentially dangerous content
      if (sanitized.parameters.selector) {
        sanitized.parameters.selector = this.sanitizeSelector(sanitized.parameters.selector);
      }

      if (sanitized.parameters.value) {
        sanitized.parameters.value = this.sanitizeValue(sanitized.parameters.value);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize CSS selector
   */
  private sanitizeSelector(selector: string): string {
    return selector
      .replace(/javascript:/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Sanitize value
   */
  private sanitizeValue(value: string): string {
    return value
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    command: EnhancedParsedCommand,
    securityIssues: string[]
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Base risk from intent
    const intentRiskMap: Record<string, number> = {
      navigate: 1,
      click: 1,
      fill: 2,
      scroll: 1,
      submit: 2,
      extract: 2,
      wait: 0,
      search: 1,
      login: 3,
      logout: 2,
      upload: 3,
      download: 2,
      screenshot: 2,
      unknown: 1,
    };

    riskScore += intentRiskMap[command.intent] || 1;

    // Risk from security issues
    riskScore += securityIssues.length * 2;

    // Risk from complexity
    if (command.complexity === 'complex') riskScore += 2;
    else if (command.complexity === 'moderate') riskScore += 1;

    // Risk from security level
    if (command.securityLevel === 'high') riskScore += 3;
    else if (command.securityLevel === 'medium') riskScore += 2;

    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Calculate sequence risk level
   */
  private calculateSequenceRiskLevel(
    commands: EnhancedParsedCommand[],
    securityIssues: string[]
  ): 'low' | 'medium' | 'high' {
    const maxRisk = Math.max(
      ...commands.map(cmd => this.calculateRiskLevel(cmd, []))
    );

    // Increase risk based on sequence length and security issues
    let riskScore = maxRisk === 'high' ? 3 : maxRisk === 'medium' ? 2 : 1;
    riskScore += Math.floor(commands.length / 5);
    riskScore += Math.floor(securityIssues.length / 3);

    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Check if confirmation is required
   */
  private requiresConfirmation(
    command: EnhancedParsedCommand,
    securityIssues: string[]
  ): boolean {
    // Require confirmation for high-risk commands
    if (command.securityLevel === 'high') return true;
    
    // Require confirmation if there are security issues
    if (securityIssues.length > 0) return true;
    
    // Require confirmation for certain intents
    const confirmationRequiredIntents = ['login', 'upload', 'download'];
    if (confirmationRequiredIntents.includes(command.intent)) return true;
    
    // Require confirmation for low confidence commands
    if (command.confidence < 0.5) return true;
    
    return false;
  }

  /**
   * Initialize security rules
   */
  private initializeSecurityRules(): void {
    this.securityRules = [
      {
        name: 'block_file_urls',
        description: 'Block file:// URLs for security',
        check: (cmd, ctx) => {
          if (cmd.parameters.url?.startsWith('file://')) {
            return { passed: false, message: 'File URLs are not allowed for security reasons', severity: 'error' as const };
          }
          return { passed: true };
        },
      },
      {
        name: 'block_javascript_urls',
        description: 'Block javascript: URLs',
        check: (cmd, ctx) => {
          if (cmd.parameters.url?.startsWith('javascript:')) {
            return { passed: false, message: 'JavaScript URLs are not allowed', severity: 'error' as const };
          }
          return { passed: true };
        },
      },
      {
        name: 'warn_sensitive_data',
        description: 'Warn about sensitive data handling',
        check: (cmd, ctx) => {
          if (cmd.parameters.value?.match(/password|secret|token/i)) {
            return { passed: true, message: 'Command involves sensitive data - proceed with caution', severity: 'warning' as const };
          }
          return { passed: true };
        },
      },
    ];
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      {
        name: 'require_url_for_navigation',
        description: 'Navigation commands must have a URL',
        check: (cmd, ctx) => {
          if (cmd.intent === 'navigate' && !cmd.parameters.url) {
            return { passed: false, message: 'Navigation commands require a URL', severity: 'error' as const };
          }
          return { passed: true };
        },
      },
      {
        name: 'require_selector_for_click',
        description: 'Click commands should have a selector',
        check: (cmd, ctx) => {
          if (cmd.intent === 'click' && !cmd.parameters.selector && !cmd.parameters.text) {
            return { passed: false, message: 'Click commands should have a selector or text', severity: 'warning' as const };
          }
          return { passed: true };
        },
      },
    ];
  }

  /**
   * Initialize blocked domains
   */
  private initializeBlockedDomains(): void {
    // Add commonly blocked/malicious domains
    const blocked = [
      'malware-site.com',
      'phishing-site.net',
      // Add more as needed
    ];

    blocked.forEach(domain => this.blockedDomains.add(domain));
  }

  /**
   * Add custom security rule
   */
  public addSecurityRule(rule: SecurityRule): void {
    this.securityRules.push(rule);
  }

  /**
   * Remove security rule
   */
  public removeSecurityRule(name: string): boolean {
    const index = this.securityRules.findIndex(rule => rule.name === name);
    if (index > -1) {
      this.securityRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Add blocked domain
   */
  public addBlockedDomain(domain: string): void {
    this.blockedDomains.add(domain);
  }

  /**
   * Remove blocked domain
   */
  public removeBlockedDomain(domain: string): boolean {
    return this.blockedDomains.delete(domain);
  }

  /**
   * Get security rules
   */
  public getSecurityRules(): SecurityRule[] {
    return [...this.securityRules];
  }

  /**
   * Get blocked domains
   */
  public getBlockedDomains(): string[] {
    return Array.from(this.blockedDomains);
  }
}

// Supporting interfaces
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityIssues?: string[];
  sanitizedCommand?: EnhancedParsedCommand;
  sanitizedCommands?: EnhancedParsedCommand[];
  riskLevel?: 'low' | 'medium' | 'high';
  requiresConfirmation?: boolean;
}

interface SecurityRule {
  name: string;
  description: string;
  check: (command: EnhancedParsedCommand, context: CommandContext) => {
    passed: boolean;
    message?: string;
    severity: 'error' | 'warning';
  };
}

interface ValidationRule {
  name: string;
  description: string;
  check: (command: EnhancedParsedCommand, context: CommandContext) => {
    passed: boolean;
    message?: string;
    severity: 'error' | 'warning';
  };
}
