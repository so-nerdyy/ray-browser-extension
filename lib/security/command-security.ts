/**
 * Command Security for Ray Chrome Extension
 * Handles command validation and security for AI interactions
 */

export interface CommandRule {
  name: string;
  description: string;
  pattern: RegExp;
  riskLevel: 'low' | 'medium' | 'high';
  action: 'allow' | 'block' | 'sanitize';
}

export interface CommandValidationResult {
  isValid: boolean;
  command: string;
  violations: Array<{
    rule: string;
    severity: 'low' | 'medium' | 'high';
    match: string;
    description: string;
  }>;
  sanitized?: string;
  riskScore: number;
  warnings: string[];
}

export interface CommandSecurityConfig {
  enableStrictValidation: boolean;
  enableCommandLogging: boolean;
  enableRateLimit: boolean;
  maxCommandsPerMinute: number;
  allowedCommands?: string[];
  blockedCommands?: string[];
  customRules?: CommandRule[];
}

export interface CommandAudit {
  timestamp: number;
  command: string;
  isValid: boolean;
  riskScore: number;
  violations: string[];
  source: string;
}

export class CommandSecurity {
  private static readonly DEFAULT_CONFIG: CommandSecurityConfig = {
    enableStrictValidation: true,
    enableCommandLogging: true,
    enableRateLimit: true,
    maxCommandsPerMinute: 30
  };

  private static readonly SECURITY_RULES: CommandRule[] = [
    {
      name: 'Script Injection',
      description: 'Detects script injection attempts',
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'JavaScript Protocol',
      description: 'Detects javascript: protocol usage',
      pattern: /javascript:/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'Command Injection',
      description: 'Detects command injection attempts',
      pattern: /[;&|`$(){}[\]]/g,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'Path Traversal',
      description: 'Detects path traversal attempts',
      pattern: /\.\.[\\/]/g,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'File Access',
      description: 'Detects file access attempts',
      pattern: /(file:\/\/|\/[a-zA-Z]:\\|\\\\)/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'System Commands',
      description: 'Detects system command attempts',
      pattern: /\b(rm|del|format|shutdown|reboot|sudo|admin|root)\b/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'Network Requests',
      description: 'Detects unauthorized network requests',
      pattern: /\b(fetch|axios|xmlhttprequest|websocket)\b/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'DOM Manipulation',
      description: 'Detects DOM manipulation attempts',
      pattern: /\b(document\.|window\.|eval\(|innerHTML|outerHTML)\b/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'Cookie Access',
      description: 'Detects cookie access attempts',
      pattern: /\b(document\.cookie|localStorage|sessionStorage)\b/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'Extension APIs',
      description: 'Detects unauthorized extension API usage',
      pattern: /\b(chrome\.|browser\.|extension\.)/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    }
  ];

  private static readonly COMMAND_LOG_KEY = 'commandSecurityLog';
  private static readonly RATE_LIMIT_KEY = 'commandRateLimit';

  /**
   * Validate command for security
   * @param command The command to validate
   * @param config Optional security configuration
   * @returns Command validation result
   */
  static validateCommand(command: string, config?: Partial<CommandSecurityConfig>): CommandValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const violations: CommandValidationResult['violations'] = [];
    const warnings: string[] = [];
    let riskScore = 0;
    let sanitized = command;

    // Check rate limiting
    if (finalConfig.enableRateLimit && !this.checkRateLimit(command, finalConfig)) {
      violations.push({
        rule: 'Rate Limit',
        severity: 'medium',
        match: command,
        description: 'Command rate limit exceeded'
      });
      riskScore += 20;
    }

    // Check against blocked commands
    if (finalConfig.blockedCommands) {
      for (const blocked of finalConfig.blockedCommands) {
        if (command.toLowerCase().includes(blocked.toLowerCase())) {
          violations.push({
            rule: 'Blocked Command',
            severity: 'high',
            match: command,
            description: `Command contains blocked term: ${blocked}`
          });
          riskScore += 30;
        }
      }
    }

    // Check against allowed commands (if specified)
    if (finalConfig.allowedCommands && finalConfig.allowedCommands.length > 0) {
      let isAllowed = false;
      for (const allowed of finalConfig.allowedCommands) {
        if (command.toLowerCase().includes(allowed.toLowerCase())) {
          isAllowed = true;
          break;
        }
      }
      
      if (!isAllowed) {
        violations.push({
          rule: 'Allowed Command',
          severity: 'medium',
          match: command,
          description: 'Command not in allowed list'
        });
        riskScore += 15;
      }
    }

    // Apply security rules
    const allRules = [...this.SECURITY_RULES, ...(finalConfig.customRules || [])];
    
    for (const rule of allRules) {
      const matches = command.match(rule.pattern);
      if (matches) {
        violations.push({
          rule: rule.name,
          severity: rule.riskLevel,
          match: matches[0],
          description: rule.description
        });

        // Calculate risk score based on severity
        switch (rule.riskLevel) {
          case 'high':
            riskScore += 25;
            break;
          case 'medium':
            riskScore += 15;
            break;
          case 'low':
            riskScore += 5;
            break;
        }

        // Apply action based on rule
        switch (rule.action) {
          case 'block':
            return {
              isValid: false,
              command,
              violations,
              riskScore,
              warnings: ['Command blocked due to security violations']
            };
          case 'sanitize':
            sanitized = this.sanitizeCommand(command, rule);
            warnings.push(`Command sanitized due to ${rule.name}`);
            break;
        }
      }
    }

    // Additional validation in strict mode
    if (finalConfig.enableStrictValidation) {
      const strictViolations = this.strictValidation(command);
      violations.push(...strictViolations);
      riskScore += strictViolations.length * 10;
    }

    // Log command if enabled
    if (finalConfig.enableCommandLogging) {
      this.logCommand(command, violations.length === 0, riskScore);
    }

    return {
      isValid: violations.length === 0,
      command,
      violations,
      sanitized,
      riskScore,
      warnings
    };
  }

  /**
   * Validate multiple commands
   * @param commands Array of commands to validate
   * @param config Optional security configuration
   * @returns Array of validation results
   */
  static validateCommands(commands: string[], config?: Partial<CommandSecurityConfig>): CommandValidationResult[] {
    return commands.map(command => this.validateCommand(command, config));
  }

  /**
   * Check if command is safe to execute
   * @param command The command to check
   * @param config Optional security configuration
   * @returns True if command is safe
   */
  static isCommandSafe(command: string, config?: Partial<CommandSecurityConfig>): boolean {
    const result = this.validateCommand(command, config);
    return result.isValid && result.riskScore < 50;
  }

  /**
   * Get command risk assessment
   * @param command The command to assess
   * @returns Risk assessment
   */
  static assessCommandRisk(command: string): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    factors: string[];
  } {
    const result = this.validateCommand(command);
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (result.riskScore >= 75) {
      riskLevel = 'critical';
    } else if (result.riskScore >= 50) {
      riskLevel = 'high';
    } else if (result.riskScore >= 25) {
      riskLevel = 'medium';
    }

    const factors = result.violations.map(v => v.description);
    
    return {
      riskLevel,
      riskScore: result.riskScore,
      factors
    };
  }

  /**
   * Get command audit history
   * @param limit Maximum number of entries to retrieve
   * @returns Promise that resolves with command audit history
   */
  static async getCommandAudit(limit: number = 100): Promise<CommandAudit[]> {
    try {
      const result = await chrome.storage.local.get([this.COMMAND_LOG_KEY]);
      const audit: CommandAudit[] = result[this.COMMAND_LOG_KEY] || [];
      
      // Return most recent entries
      return audit.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get command audit:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Clear command audit history
   * @returns Promise that resolves when history is cleared
   */
  static async clearCommandAudit(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.COMMAND_LOG_KEY]);
    } catch (error) {
      console.error('Failed to clear command audit:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear command audit');
    }
  }

  /**
   * Generate command security report
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with security report
   */
  static async generateSecurityReport(daysToAnalyze: number = 7): Promise<{
    summary: {
      totalCommands: number;
      validCommands: number;
      blockedCommands: number;
      highRiskCommands: number;
      averageRiskScore: number;
    };
    topViolations: Array<{
      rule: string;
      count: number;
      severity: string;
    }>;
    timeline: Array<{
      date: number;
      count: number;
      averageRiskScore: number;
    }>;
    recommendations: string[];
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const audit = await this.getCommandAudit(1000);
      const relevantAudit = audit.filter(entry => entry.timestamp >= startDate);

      // Generate summary
      const summary = {
        totalCommands: relevantAudit.length,
        validCommands: relevantAudit.filter(entry => entry.isValid).length,
        blockedCommands: relevantAudit.filter(entry => !entry.isValid).length,
        highRiskCommands: relevantAudit.filter(entry => entry.riskScore >= 50).length,
        averageRiskScore: relevantAudit.length > 0 
          ? relevantAudit.reduce((sum, entry) => sum + entry.riskScore, 0) / relevantAudit.length 
          : 0
      };

      // Generate top violations
      const violationCounts = new Map<string, { count: number; severity: string }>();
      for (const entry of relevantAudit) {
        for (const violation of entry.violations) {
          const existing = violationCounts.get(violation) || { count: 0, severity: entry.riskScore >= 50 ? 'high' : 'medium' };
          violationCounts.set(violation, {
            count: existing.count + 1,
            severity: existing.severity
          });
        }
      }

      const topViolations = Array.from(violationCounts.entries())
        .map(([rule, data]) => ({ rule, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { count: number; totalRiskScore: number }>();
      for (const entry of relevantAudit) {
        const day = Math.floor(entry.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { count: 0, totalRiskScore: 0 };
        timelineMap.set(day, {
          count: existing.count + 1,
          totalRiskScore: existing.totalRiskScore + entry.riskScore
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          averageRiskScore: data.count > 0 ? data.totalRiskScore / data.count : 0
        }))
        .sort((a, b) => a.date - b.date);

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (summary.blockedCommands > summary.totalCommands * 0.1) {
        recommendations.push('High rate of blocked commands detected - review command patterns');
      }

      if (summary.highRiskCommands > 0) {
        recommendations.push(`${summary.highRiskCommands} high-risk commands detected - implement stricter validation`);
      }

      if (summary.averageRiskScore > 30) {
        recommendations.push('Average command risk score is elevated - enhance security measures');
      }

      return {
        summary,
        topViolations,
        timeline,
        recommendations,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate security report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate security report');
    }
  }

  /**
   * Check rate limiting for commands
   * @param command The command to check
   * @param config Security configuration
   * @returns True if within rate limit
   */
  private static checkRateLimit(command: string, config: CommandSecurityConfig): boolean {
    try {
      const result = await chrome.storage.local.get([this.RATE_LIMIT_KEY]);
      const rateLimitData = result[this.RATE_LIMIT_KEY] || { commands: [], timestamps: [] };
      
      const now = Date.now();
      const oneMinuteAgo = now - 60000; // 60 seconds ago
      
      // Clean old entries
      const recentTimestamps = rateLimitData.timestamps.filter((timestamp: number) => timestamp > oneMinuteAgo);
      const recentCommands = rateLimitData.commands.filter((_: string, index: number) => recentTimestamps[index] > oneMinuteAgo);
      
      if (recentCommands.length >= config.maxCommandsPerMinute) {
        return false;
      }

      // Add current command
      recentCommands.push(command);
      recentTimestamps.push(now);
      
      // Update storage
      await chrome.storage.local.set({
        [this.RATE_LIMIT_KEY]: {
          commands: recentCommands,
          timestamps: recentTimestamps
        }
      });
      
      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error instanceof Error ? error.message : 'Unknown error');
      return true; // Allow on error
    }
  }

  /**
   * Apply strict validation to command
   * @param command The command to validate
   * @returns Array of strict violations
   */
  private static strictValidation(command: string): CommandValidationResult['violations'] {
    const violations: CommandValidationResult['violations'] = [];

    // Check for extremely long commands
    if (command.length > 1000) {
      violations.push({
        rule: 'Command Length',
        severity: 'medium',
        match: command,
        description: 'Command is unusually long'
      });
    }

    // Check for excessive special characters
    const specialCharCount = (command.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (specialCharCount > command.length * 0.5) {
      violations.push({
        rule: 'Special Characters',
        severity: 'medium',
        match: command,
        description: 'Command contains excessive special characters'
      });
    }

    // Check for repeated patterns
    const repeatedPatterns = command.match(/(.{10,})/gi);
    if (repeatedPatterns) {
      violations.push({
        rule: 'Repeated Patterns',
        severity: 'low',
        match: repeatedPatterns[0],
        description: 'Command contains suspicious repeated patterns'
      });
    }

    return violations;
  }

  /**
   * Sanitize command based on rule
   * @param command The command to sanitize
   * @param rule The security rule that triggered
   * @returns Sanitized command
   */
  private static sanitizeCommand(command: string, rule: CommandRule): string {
    let sanitized = command;

    switch (rule.name) {
      case 'Script Injection':
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        break;
      case 'JavaScript Protocol':
        sanitized = sanitized.replace(/javascript:/gi, '');
        break;
      case 'Path Traversal':
        sanitized = sanitized.replace(/\.\.[\\/]/g, '');
        break;
      case 'DOM Manipulation':
        sanitized = sanitized.replace(/\b(document\.|window\.|eval\()/gi, '[BLOCKED]');
        break;
      case 'Cookie Access':
        sanitized = sanitized.replace(/\b(document\.cookie|localStorage|sessionStorage)\b/gi, '[BLOCKED]');
        break;
      default:
        // Generic sanitization
        sanitized = sanitized.replace(rule.pattern, '[SANITIZED]');
    }

    return sanitized;
  }

  /**
   * Log command for audit purposes
   * @param command The command to log
   * @param isValid Whether the command is valid
   * @param riskScore The calculated risk score
   */
  private static async logCommand(command: string, isValid: boolean, riskScore: number): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.COMMAND_LOG_KEY]);
      const audit: CommandAudit[] = result[this.COMMAND_LOG_KEY] || [];

      audit.push({
        timestamp: Date.now(),
        command: command.substring(0, 500), // Limit command size for storage
        isValid,
        riskScore,
        violations: [], // Will be populated by validation
        source: 'user'
      });

      // Keep only recent entries
      if (audit.length > 1000) {
        audit.splice(0, audit.length - 1000);
      }

      await chrome.storage.local.set({ [this.COMMAND_LOG_KEY]: audit });
    } catch (error) {
      console.error('Failed to log command:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Create custom command security rule
   * @param name Rule name
   * @param description Rule description
   * @param pattern Regular expression to match
   * @param riskLevel Risk level
   * @param action Action to take
   * @returns Custom security rule
   */
  static createCustomRule(
    name: string,
    description: string,
    pattern: RegExp,
    riskLevel: 'low' | 'medium' | 'high',
    action: 'allow' | 'block' | 'sanitize'
  ): CommandRule {
    return {
      name,
      description,
      pattern,
      riskLevel,
      action
    };
  }

  /**
   * Add custom security rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: CommandRule): void {
    this.SECURITY_RULES.push(rule);
  }

  /**
   * Remove security rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.SECURITY_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.SECURITY_RULES.splice(index, 1);
    }
  }

  /**
   * Get all security rules
   * @returns Array of security rules
   */
  static getSecurityRules(): CommandRule[] {
    return [...this.SECURITY_RULES];
  }

  /**
   * Reset rate limiting data
   * @returns Promise that resolves when rate limit is reset
   */
  static async resetRateLimit(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.RATE_LIMIT_KEY]);
    } catch (error) {
      console.error('Failed to reset rate limit:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to reset rate limit');
    }
  }
} * Command Security for Ray Chrome Extension
 * Handles command validation and security for AI interactions
 */

export interface CommandRule {
  name: string;
  description: string;
  pattern: RegExp;
  riskLevel: 'low' | 'medium' | 'high';
  action: 'allow' | 'block' | 'sanitize';
}

export interface CommandValidationResult {
  isValid: boolean;
  command: string;
  violations: Array<{
    rule: string;
    severity: 'low' | 'medium' | 'high';
    match: string;
    description: string;
  }>;
  sanitized?: string;
  riskScore: number;
  warnings: string[];
}

export interface CommandSecurityConfig {
  enableStrictValidation: boolean;
  enableCommandLogging: boolean;
  enableRateLimit: boolean;
  maxCommandsPerMinute: number;
  allowedCommands?: string[];
  blockedCommands?: string[];
  customRules?: CommandRule[];
}

export interface CommandAudit {
  timestamp: number;
  command: string;
  isValid: boolean;
  riskScore: number;
  violations: string[];
  source: string;
}

export class CommandSecurity {
  private static readonly DEFAULT_CONFIG: CommandSecurityConfig = {
    enableStrictValidation: true,
    enableCommandLogging: true,
    enableRateLimit: true,
    maxCommandsPerMinute: 30
  };

  private static readonly SECURITY_RULES: CommandRule[] = [
    {
      name: 'Script Injection',
      description: 'Detects script injection attempts',
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'JavaScript Protocol',
      description: 'Detects javascript: protocol usage',
      pattern: /javascript:/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'Command Injection',
      description: 'Detects command injection attempts',
      pattern: /[;&|`$(){}[\]]/g,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'Path Traversal',
      description: 'Detects path traversal attempts',
      pattern: /\.\.[\\/]/g,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'File Access',
      description: 'Detects file access attempts',
      pattern: /(file:\/\/|\/[a-zA-Z]:\\|\\\\)/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'System Commands',
      description: 'Detects system command attempts',
      pattern: /\b(rm|del|format|shutdown|reboot|sudo|admin|root)\b/gi,
      riskLevel: 'high',
      action: 'block'
    },
    {
      name: 'Network Requests',
      description: 'Detects unauthorized network requests',
      pattern: /\b(fetch|axios|xmlhttprequest|websocket)\b/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'DOM Manipulation',
      description: 'Detects DOM manipulation attempts',
      pattern: /\b(document\.|window\.|eval\(|innerHTML|outerHTML)\b/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'Cookie Access',
      description: 'Detects cookie access attempts',
      pattern: /\b(document\.cookie|localStorage|sessionStorage)\b/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    },
    {
      name: 'Extension APIs',
      description: 'Detects unauthorized extension API usage',
      pattern: /\b(chrome\.|browser\.|extension\.)/gi,
      riskLevel: 'medium',
      action: 'sanitize'
    }
  ];

  private static readonly COMMAND_LOG_KEY = 'commandSecurityLog';
  private static readonly RATE_LIMIT_KEY = 'commandRateLimit';

  /**
   * Validate command for security
   * @param command The command to validate
   * @param config Optional security configuration
   * @returns Command validation result
   */
  static validateCommand(command: string, config?: Partial<CommandSecurityConfig>): CommandValidationResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const violations: CommandValidationResult['violations'] = [];
    const warnings: string[] = [];
    let riskScore = 0;
    let sanitized = command;

    // Check rate limiting
    if (finalConfig.enableRateLimit && !this.checkRateLimit(command, finalConfig)) {
      violations.push({
        rule: 'Rate Limit',
        severity: 'medium',
        match: command,
        description: 'Command rate limit exceeded'
      });
      riskScore += 20;
    }

    // Check against blocked commands
    if (finalConfig.blockedCommands) {
      for (const blocked of finalConfig.blockedCommands) {
        if (command.toLowerCase().includes(blocked.toLowerCase())) {
          violations.push({
            rule: 'Blocked Command',
            severity: 'high',
            match: command,
            description: `Command contains blocked term: ${blocked}`
          });
          riskScore += 30;
        }
      }
    }

    // Check against allowed commands (if specified)
    if (finalConfig.allowedCommands && finalConfig.allowedCommands.length > 0) {
      let isAllowed = false;
      for (const allowed of finalConfig.allowedCommands) {
        if (command.toLowerCase().includes(allowed.toLowerCase())) {
          isAllowed = true;
          break;
        }
      }
      
      if (!isAllowed) {
        violations.push({
          rule: 'Allowed Command',
          severity: 'medium',
          match: command,
          description: 'Command not in allowed list'
        });
        riskScore += 15;
      }
    }

    // Apply security rules
    const allRules = [...this.SECURITY_RULES, ...(finalConfig.customRules || [])];
    
    for (const rule of allRules) {
      const matches = command.match(rule.pattern);
      if (matches) {
        violations.push({
          rule: rule.name,
          severity: rule.riskLevel,
          match: matches[0],
          description: rule.description
        });

        // Calculate risk score based on severity
        switch (rule.riskLevel) {
          case 'high':
            riskScore += 25;
            break;
          case 'medium':
            riskScore += 15;
            break;
          case 'low':
            riskScore += 5;
            break;
        }

        // Apply action based on rule
        switch (rule.action) {
          case 'block':
            return {
              isValid: false,
              command,
              violations,
              riskScore,
              warnings: ['Command blocked due to security violations']
            };
          case 'sanitize':
            sanitized = this.sanitizeCommand(command, rule);
            warnings.push(`Command sanitized due to ${rule.name}`);
            break;
        }
      }
    }

    // Additional validation in strict mode
    if (finalConfig.enableStrictValidation) {
      const strictViolations = this.strictValidation(command);
      violations.push(...strictViolations);
      riskScore += strictViolations.length * 10;
    }

    // Log command if enabled
    if (finalConfig.enableCommandLogging) {
      this.logCommand(command, violations.length === 0, riskScore);
    }

    return {
      isValid: violations.length === 0,
      command,
      violations,
      sanitized,
      riskScore,
      warnings
    };
  }

  /**
   * Validate multiple commands
   * @param commands Array of commands to validate
   * @param config Optional security configuration
   * @returns Array of validation results
   */
  static validateCommands(commands: string[], config?: Partial<CommandSecurityConfig>): CommandValidationResult[] {
    return commands.map(command => this.validateCommand(command, config));
  }

  /**
   * Check if command is safe to execute
   * @param command The command to check
   * @param config Optional security configuration
   * @returns True if command is safe
   */
  static isCommandSafe(command: string, config?: Partial<CommandSecurityConfig>): boolean {
    const result = this.validateCommand(command, config);
    return result.isValid && result.riskScore < 50;
  }

  /**
   * Get command risk assessment
   * @param command The command to assess
   * @returns Risk assessment
   */
  static assessCommandRisk(command: string): {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    factors: string[];
  } {
    const result = this.validateCommand(command);
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (result.riskScore >= 75) {
      riskLevel = 'critical';
    } else if (result.riskScore >= 50) {
      riskLevel = 'high';
    } else if (result.riskScore >= 25) {
      riskLevel = 'medium';
    }

    const factors = result.violations.map(v => v.description);
    
    return {
      riskLevel,
      riskScore: result.riskScore,
      factors
    };
  }

  /**
   * Get command audit history
   * @param limit Maximum number of entries to retrieve
   * @returns Promise that resolves with command audit history
   */
  static async getCommandAudit(limit: number = 100): Promise<CommandAudit[]> {
    try {
      const result = await chrome.storage.local.get([this.COMMAND_LOG_KEY]);
      const audit: CommandAudit[] = result[this.COMMAND_LOG_KEY] || [];
      
      // Return most recent entries
      return audit.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get command audit:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Clear command audit history
   * @returns Promise that resolves when history is cleared
   */
  static async clearCommandAudit(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.COMMAND_LOG_KEY]);
    } catch (error) {
      console.error('Failed to clear command audit:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear command audit');
    }
  }

  /**
   * Generate command security report
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with security report
   */
  static async generateSecurityReport(daysToAnalyze: number = 7): Promise<{
    summary: {
      totalCommands: number;
      validCommands: number;
      blockedCommands: number;
      highRiskCommands: number;
      averageRiskScore: number;
    };
    topViolations: Array<{
      rule: string;
      count: number;
      severity: string;
    }>;
    timeline: Array<{
      date: number;
      count: number;
      averageRiskScore: number;
    }>;
    recommendations: string[];
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const audit = await this.getCommandAudit(1000);
      const relevantAudit = audit.filter(entry => entry.timestamp >= startDate);

      // Generate summary
      const summary = {
        totalCommands: relevantAudit.length,
        validCommands: relevantAudit.filter(entry => entry.isValid).length,
        blockedCommands: relevantAudit.filter(entry => !entry.isValid).length,
        highRiskCommands: relevantAudit.filter(entry => entry.riskScore >= 50).length,
        averageRiskScore: relevantAudit.length > 0 
          ? relevantAudit.reduce((sum, entry) => sum + entry.riskScore, 0) / relevantAudit.length 
          : 0
      };

      // Generate top violations
      const violationCounts = new Map<string, { count: number; severity: string }>();
      for (const entry of relevantAudit) {
        for (const violation of entry.violations) {
          const existing = violationCounts.get(violation) || { count: 0, severity: entry.riskScore >= 50 ? 'high' : 'medium' };
          violationCounts.set(violation, {
            count: existing.count + 1,
            severity: existing.severity
          });
        }
      }

      const topViolations = Array.from(violationCounts.entries())
        .map(([rule, data]) => ({ rule, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { count: number; totalRiskScore: number }>();
      for (const entry of relevantAudit) {
        const day = Math.floor(entry.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { count: 0, totalRiskScore: 0 };
        timelineMap.set(day, {
          count: existing.count + 1,
          totalRiskScore: existing.totalRiskScore + entry.riskScore
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          averageRiskScore: data.count > 0 ? data.totalRiskScore / data.count : 0
        }))
        .sort((a, b) => a.date - b.date);

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (summary.blockedCommands > summary.totalCommands * 0.1) {
        recommendations.push('High rate of blocked commands detected - review command patterns');
      }

      if (summary.highRiskCommands > 0) {
        recommendations.push(`${summary.highRiskCommands} high-risk commands detected - implement stricter validation`);
      }

      if (summary.averageRiskScore > 30) {
        recommendations.push('Average command risk score is elevated - enhance security measures');
      }

      return {
        summary,
        topViolations,
        timeline,
        recommendations,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate security report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate security report');
    }
  }

  /**
   * Check rate limiting for commands
   * @param command The command to check
   * @param config Security configuration
   * @returns True if within rate limit
   */
  private static checkRateLimit(command: string, config: CommandSecurityConfig): boolean {
    try {
      const result = await chrome.storage.local.get([this.RATE_LIMIT_KEY]);
      const rateLimitData = result[this.RATE_LIMIT_KEY] || { commands: [], timestamps: [] };
      
      const now = Date.now();
      const oneMinuteAgo = now - 60000; // 60 seconds ago
      
      // Clean old entries
      const recentTimestamps = rateLimitData.timestamps.filter((timestamp: number) => timestamp > oneMinuteAgo);
      const recentCommands = rateLimitData.commands.filter((_: string, index: number) => recentTimestamps[index] > oneMinuteAgo);
      
      if (recentCommands.length >= config.maxCommandsPerMinute) {
        return false;
      }

      // Add current command
      recentCommands.push(command);
      recentTimestamps.push(now);
      
      // Update storage
      await chrome.storage.local.set({
        [this.RATE_LIMIT_KEY]: {
          commands: recentCommands,
          timestamps: recentTimestamps
        }
      });
      
      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error instanceof Error ? error.message : 'Unknown error');
      return true; // Allow on error
    }
  }

  /**
   * Apply strict validation to command
   * @param command The command to validate
   * @returns Array of strict violations
   */
  private static strictValidation(command: string): CommandValidationResult['violations'] {
    const violations: CommandValidationResult['violations'] = [];

    // Check for extremely long commands
    if (command.length > 1000) {
      violations.push({
        rule: 'Command Length',
        severity: 'medium',
        match: command,
        description: 'Command is unusually long'
      });
    }

    // Check for excessive special characters
    const specialCharCount = (command.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (specialCharCount > command.length * 0.5) {
      violations.push({
        rule: 'Special Characters',
        severity: 'medium',
        match: command,
        description: 'Command contains excessive special characters'
      });
    }

    // Check for repeated patterns
    const repeatedPatterns = command.match(/(.{10,})/gi);
    if (repeatedPatterns) {
      violations.push({
        rule: 'Repeated Patterns',
        severity: 'low',
        match: repeatedPatterns[0],
        description: 'Command contains suspicious repeated patterns'
      });
    }

    return violations;
  }

  /**
   * Sanitize command based on rule
   * @param command The command to sanitize
   * @param rule The security rule that triggered
   * @returns Sanitized command
   */
  private static sanitizeCommand(command: string, rule: CommandRule): string {
    let sanitized = command;

    switch (rule.name) {
      case 'Script Injection':
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        break;
      case 'JavaScript Protocol':
        sanitized = sanitized.replace(/javascript:/gi, '');
        break;
      case 'Path Traversal':
        sanitized = sanitized.replace(/\.\.[\\/]/g, '');
        break;
      case 'DOM Manipulation':
        sanitized = sanitized.replace(/\b(document\.|window\.|eval\()/gi, '[BLOCKED]');
        break;
      case 'Cookie Access':
        sanitized = sanitized.replace(/\b(document\.cookie|localStorage|sessionStorage)\b/gi, '[BLOCKED]');
        break;
      default:
        // Generic sanitization
        sanitized = sanitized.replace(rule.pattern, '[SANITIZED]');
    }

    return sanitized;
  }

  /**
   * Log command for audit purposes
   * @param command The command to log
   * @param isValid Whether the command is valid
   * @param riskScore The calculated risk score
   */
  private static async logCommand(command: string, isValid: boolean, riskScore: number): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.COMMAND_LOG_KEY]);
      const audit: CommandAudit[] = result[this.COMMAND_LOG_KEY] || [];

      audit.push({
        timestamp: Date.now(),
        command: command.substring(0, 500), // Limit command size for storage
        isValid,
        riskScore,
        violations: [], // Will be populated by validation
        source: 'user'
      });

      // Keep only recent entries
      if (audit.length > 1000) {
        audit.splice(0, audit.length - 1000);
      }

      await chrome.storage.local.set({ [this.COMMAND_LOG_KEY]: audit });
    } catch (error) {
      console.error('Failed to log command:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Create custom command security rule
   * @param name Rule name
   * @param description Rule description
   * @param pattern Regular expression to match
   * @param riskLevel Risk level
   * @param action Action to take
   * @returns Custom security rule
   */
  static createCustomRule(
    name: string,
    description: string,
    pattern: RegExp,
    riskLevel: 'low' | 'medium' | 'high',
    action: 'allow' | 'block' | 'sanitize'
  ): CommandRule {
    return {
      name,
      description,
      pattern,
      riskLevel,
      action
    };
  }

  /**
   * Add custom security rule
   * @param rule The custom rule to add
   */
  static addCustomRule(rule: CommandRule): void {
    this.SECURITY_RULES.push(rule);
  }

  /**
   * Remove security rule by name
   * @param name Name of the rule to remove
   */
  static removeRule(name: string): void {
    const index = this.SECURITY_RULES.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.SECURITY_RULES.splice(index, 1);
    }
  }

  /**
   * Get all security rules
   * @returns Array of security rules
   */
  static getSecurityRules(): CommandRule[] {
    return [...this.SECURITY_RULES];
  }

  /**
   * Reset rate limiting data
   * @returns Promise that resolves when rate limit is reset
   */
  static async resetRateLimit(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.RATE_LIMIT_KEY]);
    } catch (error) {
      console.error('Failed to reset rate limit:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to reset rate limit');
    }
  }
}
