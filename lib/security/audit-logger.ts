/**
 * Audit Logger for Ray Chrome Extension
 * Provides comprehensive security audit logging capabilities
 */

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'security' | 'api' | 'permission' | 'storage' | 'network' | 'system' | 'user';
  action: string;
  message: string;
  details?: any;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface AuditLogConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  enablePersistence: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  maxLogEntries: number;
  retentionDays: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  excludedCategories?: string[];
  includedCategories?: string[];
}

export interface AuditLogFilter {
  level?: AuditLogEntry['level'];
  category?: AuditLogEntry['category'];
  action?: string;
  startDate?: number;
  endDate?: number;
  userId?: string;
  sessionId?: string;
  source?: string;
  search?: string;
}

export class AuditLogger {
  private static readonly DEFAULT_CONFIG: AuditLogConfig = {
    enableLogging: true,
    logLevel: 'info',
    enablePersistence: true,
    enableRemoteLogging: false,
    maxLogEntries: 10000,
    retentionDays: 90,
    enableCompression: false,
    enableEncryption: false
  };

  private static readonly STORAGE_KEY = 'auditLogs';
  private static readonly CONFIG_KEY = 'auditLoggerConfig';
  private static readonly SESSION_KEY = 'auditSessionId';
  
  private static sessionId: string;
  private static config: AuditLogConfig;

  /**
   * Initialize audit logger
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<AuditLogConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Generate session ID
      this.sessionId = await this.generateSessionId();

      // Log initialization
      if (this.config.enableLogging) {
        await this.writeLog({
          level: 'info',
          category: 'system',
          action: 'initialize',
          message: 'Audit Logger initialized',
          source: 'AuditLogger'
        });
      }

      console.log('Audit Logger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Audit Logger:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Audit Logger initialization failed');
    }
  }

  /**
   * Log debug message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async debug(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'debug',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log info message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async info(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'info',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log warning message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async warn(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'warn',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log error message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async error(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'error',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log critical message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async critical(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'critical',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log security event
   * @param action Security action
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async security(
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'info',
      category: 'security',
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log API event
   * @param action API action
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async api(
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'info',
      category: 'api',
      action,
      message,
      details,
      source
    });
  }

  /**
   * Get audit logs
   * @param filter Optional filter
   * @param limit Maximum number of entries to return
   * @returns Array of audit log entries
   */
  static async getLogs(filter?: AuditLogFilter, limit?: number): Promise<AuditLogEntry[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      let logs: AuditLogEntry[] = result[this.STORAGE_KEY] || [];

      // Apply filters
      if (filter) {
        if (filter.level) {
          logs = logs.filter(log => log.level === filter.level);
        }
        if (filter.category) {
          logs = logs.filter(log => log.category === filter.category);
        }
        if (filter.action) {
          logs = logs.filter(log => log.action === filter.action);
        }
        if (filter.startDate) {
          logs = logs.filter(log => log.timestamp >= filter.startDate!);
        }
        if (filter.endDate) {
          logs = logs.filter(log => log.timestamp <= filter.endDate!);
        }
        if (filter.userId) {
          logs = logs.filter(log => log.userId === filter.userId);
        }
        if (filter.sessionId) {
          logs = logs.filter(log => log.sessionId === filter.sessionId);
        }
        if (filter.source) {
          logs = logs.filter(log => log.source === filter.source);
        }
        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          logs = logs.filter(log => 
            log.message.toLowerCase().includes(searchLower) ||
            log.action.toLowerCase().includes(searchLower) ||
            (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
          );
        }
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        logs = logs.slice(0, limit);
      }

      return logs;
    } catch (error) {
      console.error('Failed to get audit logs:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Export audit logs
   * @param filter Optional filter
   * @param format Export format ('json' | 'csv')
   * @returns Exported logs as string
   */
  static async exportLogs(filter?: AuditLogFilter, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const logs = await this.getLogs(filter);
      
      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else if (format === 'csv') {
        return this.convertToCSV(logs);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Clear audit logs
   * @param olderThanDays Clear logs older than specified days
   */
  static async clearLogs(olderThanDays?: number): Promise<void> {
    try {
      if (olderThanDays) {
        const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        const logs = await this.getLogs();
        const filteredLogs = logs.filter(log => log.timestamp >= cutoffDate);
        await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredLogs });
      } else {
        await chrome.storage.local.remove([this.STORAGE_KEY]);
      }

      // Log the clear operation
      if (this.config.enableLogging) {
        await this.writeLog({
          level: 'info',
          category: 'system',
          action: 'clear_logs',
          message: `Audit logs cleared${olderThanDays ? ` (older than ${olderThanDays} days)` : ''}`,
          source: 'AuditLogger'
        });
      }
    } catch (error) {
      console.error('Failed to clear audit logs:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear audit logs');
    }
  }

  /**
   * Generate audit report
   * @param days Number of days to include in report
   * @returns Audit report
   */
  static async generateReport(days: number = 7): Promise<{
    summary: {
      totalLogs: number;
      logsByLevel: Record<string, number>;
      logsByCategory: Record<string, number>;
      logsByAction: Record<string, number>;
      uniqueUsers: number;
      uniqueSessions: number;
    };
    topActions: Array<{
      action: string;
      count: number;
      category: string;
    }>;
    timeline: Array<{
      date: number;
      count: number;
      errors: number;
    }>;
    securityEvents: Array<{
      timestamp: number;
      action: string;
      message: string;
      level: string;
    }>;
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (days * 24 * 60 * 60 * 1000);
      
      const logs = await this.getLogs({
        startDate,
        endDate: now
      });

      // Generate summary
      const logsByLevel: Record<string, number> = {};
      const logsByCategory: Record<string, number> = {};
      const logsByAction: Record<string, number> = {};
      const uniqueUsers = new Set<string>();
      const uniqueSessions = new Set<string>();

      for (const log of logs) {
        // Count by level
        logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
        
        // Count by category
        logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
        
        // Count by action
        logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;
        
        // Track unique users and sessions
        if (log.userId) {
          uniqueUsers.add(log.userId);
        }
        if (log.sessionId) {
          uniqueSessions.add(log.sessionId);
        }
      }

      const summary = {
        totalLogs: logs.length,
        logsByLevel,
        logsByCategory,
        logsByAction,
        uniqueUsers: uniqueUsers.size,
        uniqueSessions: uniqueSessions.size
      };

      // Generate top actions
      const actionCounts = new Map<string, { count: number; category: string }>();
      for (const log of logs) {
        const existing = actionCounts.get(log.action) || { count: 0, category: log.category };
        actionCounts.set(log.action, {
          count: existing.count + 1,
          category: log.category
        });
      }

      const topActions = Array.from(actionCounts.entries())
        .map(([action, data]) => ({ action, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { count: number; errors: number }>();
      for (const log of logs) {
        const day = Math.floor(log.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { count: 0, errors: 0 };
        timelineMap.set(day, {
          count: existing.count + 1,
          errors: existing.errors + (log.level === 'error' || log.level === 'critical' ? 1 : 0)
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date - b.date);

      // Generate security events
      const securityEvents = logs
        .filter(log => log.category === 'security')
        .map(log => ({
          timestamp: log.timestamp,
          action: log.action,
          message: log.message,
          level: log.level
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);

      return {
        summary,
        topActions,
        timeline,
        securityEvents,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate audit report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate audit report');
    }
  }

  /**
   * Write log entry
   * @param entry Log entry data
   */
  private static async writeLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>): Promise<void> {
    try {
      // Check if logging is enabled
      if (!this.config.enableLogging) {
        return;
      }

      // Check log level
      if (!this.shouldLog(entry.level)) {
        return;
      }

      // Check category filters
      if (!this.shouldLogCategory(entry.category)) {
        return;
      }

      // Create full log entry
      const fullEntry: AuditLogEntry = {
        ...entry,
        id: this.generateLogId(),
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        ipAddress: await this.getClientIP()
      };

      // Store log if persistence is enabled
      if (this.config.enablePersistence) {
        await this.storeLog(fullEntry);
      }

      // Send to remote endpoint if enabled
      if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
        await this.sendToRemote(fullEntry);
      }

      // Output to console
      this.outputToConsole(fullEntry);
    } catch (error) {
      console.error('Failed to write audit log:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Store log entry
   * @param entry Log entry to store
   */
  private static async storeLog(entry: AuditLogEntry): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const logs: AuditLogEntry[] = result[this.STORAGE_KEY] || [];

      logs.push(entry);

      // Limit logs in storage
      if (logs.length > this.config.maxLogEntries) {
        logs.splice(0, logs.length - this.config.maxLogEntries);
      }

      // Apply retention policy
      const cutoffDate = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
      const filteredLogs = logs.filter(log => log.timestamp >= cutoffDate);

      await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredLogs });
    } catch (error) {
      console.error('Failed to store audit log:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Send log to remote endpoint
   * @param entry Log entry to send
   */
  private static async sendToRemote(entry: AuditLogEntry): Promise<void> {
    try {
      if (!this.config.remoteEndpoint) {
        return;
      }

      const payload = {
        ...entry,
        source: 'ray-extension'
      };

      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send log to remote endpoint:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Output log to console
   * @param entry Log entry to output
   */
  private static outputToConsole(entry: AuditLogEntry): void {
    const message = `[${entry.level.toUpperCase()}] [${entry.category}] ${entry.action}: ${entry.message}`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.details);
        break;
      case 'info':
        console.info(message, entry.details);
        break;
      case 'warn':
        console.warn(message, entry.details);
        break;
      case 'error':
        console.error(message, entry.details);
        break;
      case 'critical':
        console.error(`🚨 CRITICAL: ${message}`, entry.details);
        break;
    }
  }

  /**
   * Check if log level should be logged
   * @param level Log level to check
   * @returns True if should log
   */
  private static shouldLog(level: AuditLogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'critical'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const entryLevelIndex = levels.indexOf(level);
    
    return entryLevelIndex >= configLevelIndex;
  }

  /**
   * Check if category should be logged
   * @param category Category to check
   * @returns True if should log
   */
  private static shouldLogCategory(category: AuditLogEntry['category']): boolean {
    // Check excluded categories
    if (this.config.excludedCategories && this.config.excludedCategories.includes(category)) {
      return false;
    }

    // Check included categories (if specified)
    if (this.config.includedCategories && this.config.includedCategories.length > 0) {
      return this.config.includedCategories.includes(category);
    }

    return true;
  }

  /**
   * Generate log ID
   * @returns Unique log ID
   */
  private static generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   * @returns Session ID
   */
  private static async generateSessionId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get([this.SESSION_KEY]);
      let sessionId = result[this.SESSION_KEY];
      
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await chrome.storage.local.set({ [this.SESSION_KEY]: sessionId });
      }
      
      return sessionId;
    } catch (error) {
      console.error('Failed to generate session ID:', error instanceof Error ? error.message : 'Unknown error');
      return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Get client IP address
   * @returns Client IP address
   */
  private static async getClientIP(): Promise<string> {
    try {
      // In a Chrome extension, we can't directly get the client IP
      // This is a placeholder that would need to be implemented based on requirements
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Convert logs to CSV format
   * @param logs Logs to convert
   * @returns CSV string
   */
  private static convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) {
      return '';
    }

    const headers = [
      'id', 'timestamp', 'level', 'category', 'action', 'message',
      'userId', 'sessionId', 'source', 'userAgent'
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        log.timestamp,
        log.level,
        log.category,
        log.action,
        `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
        log.userId || '',
        log.sessionId || '',
        log.source,
        `"${log.userAgent.replace(/"/g, '""')}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  /**
   * Get audit logger configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<AuditLogConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get audit logger config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update audit logger configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<AuditLogConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });
    } catch (error) {
      console.error('Failed to update audit logger config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update audit logger config');
    }
  }
} * Audit Logger for Ray Chrome Extension
 * Provides comprehensive security audit logging capabilities
 */

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'security' | 'api' | 'permission' | 'storage' | 'network' | 'system' | 'user';
  action: string;
  message: string;
  details?: any;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface AuditLogConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  enablePersistence: boolean;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  maxLogEntries: number;
  retentionDays: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
  excludedCategories?: string[];
  includedCategories?: string[];
}

export interface AuditLogFilter {
  level?: AuditLogEntry['level'];
  category?: AuditLogEntry['category'];
  action?: string;
  startDate?: number;
  endDate?: number;
  userId?: string;
  sessionId?: string;
  source?: string;
  search?: string;
}

export class AuditLogger {
  private static readonly DEFAULT_CONFIG: AuditLogConfig = {
    enableLogging: true,
    logLevel: 'info',
    enablePersistence: true,
    enableRemoteLogging: false,
    maxLogEntries: 10000,
    retentionDays: 90,
    enableCompression: false,
    enableEncryption: false
  };

  private static readonly STORAGE_KEY = 'auditLogs';
  private static readonly CONFIG_KEY = 'auditLoggerConfig';
  private static readonly SESSION_KEY = 'auditSessionId';
  
  private static sessionId: string;
  private static config: AuditLogConfig;

  /**
   * Initialize audit logger
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<AuditLogConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Generate session ID
      this.sessionId = await this.generateSessionId();

      // Log initialization
      if (this.config.enableLogging) {
        await this.writeLog({
          level: 'info',
          category: 'system',
          action: 'initialize',
          message: 'Audit Logger initialized',
          source: 'AuditLogger'
        });
      }

      console.log('Audit Logger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Audit Logger:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Audit Logger initialization failed');
    }
  }

  /**
   * Log debug message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async debug(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'debug',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log info message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async info(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'info',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log warning message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async warn(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'warn',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log error message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async error(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'error',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log critical message
   * @param category Log category
   * @param action Action being performed
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async critical(
    category: AuditLogEntry['category'],
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'critical',
      category,
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log security event
   * @param action Security action
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async security(
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'info',
      category: 'security',
      action,
      message,
      details,
      source
    });
  }

  /**
   * Log API event
   * @param action API action
   * @param message Log message
   * @param details Optional details
   * @param source Log source
   */
  static async api(
    action: string,
    message: string,
    details?: any,
    source: string = 'Unknown'
  ): Promise<void> {
    await this.writeLog({
      level: 'info',
      category: 'api',
      action,
      message,
      details,
      source
    });
  }

  /**
   * Get audit logs
   * @param filter Optional filter
   * @param limit Maximum number of entries to return
   * @returns Array of audit log entries
   */
  static async getLogs(filter?: AuditLogFilter, limit?: number): Promise<AuditLogEntry[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      let logs: AuditLogEntry[] = result[this.STORAGE_KEY] || [];

      // Apply filters
      if (filter) {
        if (filter.level) {
          logs = logs.filter(log => log.level === filter.level);
        }
        if (filter.category) {
          logs = logs.filter(log => log.category === filter.category);
        }
        if (filter.action) {
          logs = logs.filter(log => log.action === filter.action);
        }
        if (filter.startDate) {
          logs = logs.filter(log => log.timestamp >= filter.startDate!);
        }
        if (filter.endDate) {
          logs = logs.filter(log => log.timestamp <= filter.endDate!);
        }
        if (filter.userId) {
          logs = logs.filter(log => log.userId === filter.userId);
        }
        if (filter.sessionId) {
          logs = logs.filter(log => log.sessionId === filter.sessionId);
        }
        if (filter.source) {
          logs = logs.filter(log => log.source === filter.source);
        }
        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          logs = logs.filter(log => 
            log.message.toLowerCase().includes(searchLower) ||
            log.action.toLowerCase().includes(searchLower) ||
            (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
          );
        }
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        logs = logs.slice(0, limit);
      }

      return logs;
    } catch (error) {
      console.error('Failed to get audit logs:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Export audit logs
   * @param filter Optional filter
   * @param format Export format ('json' | 'csv')
   * @returns Exported logs as string
   */
  static async exportLogs(filter?: AuditLogFilter, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const logs = await this.getLogs(filter);
      
      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else if (format === 'csv') {
        return this.convertToCSV(logs);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Clear audit logs
   * @param olderThanDays Clear logs older than specified days
   */
  static async clearLogs(olderThanDays?: number): Promise<void> {
    try {
      if (olderThanDays) {
        const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        const logs = await this.getLogs();
        const filteredLogs = logs.filter(log => log.timestamp >= cutoffDate);
        await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredLogs });
      } else {
        await chrome.storage.local.remove([this.STORAGE_KEY]);
      }

      // Log the clear operation
      if (this.config.enableLogging) {
        await this.writeLog({
          level: 'info',
          category: 'system',
          action: 'clear_logs',
          message: `Audit logs cleared${olderThanDays ? ` (older than ${olderThanDays} days)` : ''}`,
          source: 'AuditLogger'
        });
      }
    } catch (error) {
      console.error('Failed to clear audit logs:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear audit logs');
    }
  }

  /**
   * Generate audit report
   * @param days Number of days to include in report
   * @returns Audit report
   */
  static async generateReport(days: number = 7): Promise<{
    summary: {
      totalLogs: number;
      logsByLevel: Record<string, number>;
      logsByCategory: Record<string, number>;
      logsByAction: Record<string, number>;
      uniqueUsers: number;
      uniqueSessions: number;
    };
    topActions: Array<{
      action: string;
      count: number;
      category: string;
    }>;
    timeline: Array<{
      date: number;
      count: number;
      errors: number;
    }>;
    securityEvents: Array<{
      timestamp: number;
      action: string;
      message: string;
      level: string;
    }>;
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (days * 24 * 60 * 60 * 1000);
      
      const logs = await this.getLogs({
        startDate,
        endDate: now
      });

      // Generate summary
      const logsByLevel: Record<string, number> = {};
      const logsByCategory: Record<string, number> = {};
      const logsByAction: Record<string, number> = {};
      const uniqueUsers = new Set<string>();
      const uniqueSessions = new Set<string>();

      for (const log of logs) {
        // Count by level
        logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
        
        // Count by category
        logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
        
        // Count by action
        logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;
        
        // Track unique users and sessions
        if (log.userId) {
          uniqueUsers.add(log.userId);
        }
        if (log.sessionId) {
          uniqueSessions.add(log.sessionId);
        }
      }

      const summary = {
        totalLogs: logs.length,
        logsByLevel,
        logsByCategory,
        logsByAction,
        uniqueUsers: uniqueUsers.size,
        uniqueSessions: uniqueSessions.size
      };

      // Generate top actions
      const actionCounts = new Map<string, { count: number; category: string }>();
      for (const log of logs) {
        const existing = actionCounts.get(log.action) || { count: 0, category: log.category };
        actionCounts.set(log.action, {
          count: existing.count + 1,
          category: log.category
        });
      }

      const topActions = Array.from(actionCounts.entries())
        .map(([action, data]) => ({ action, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { count: number; errors: number }>();
      for (const log of logs) {
        const day = Math.floor(log.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { count: 0, errors: 0 };
        timelineMap.set(day, {
          count: existing.count + 1,
          errors: existing.errors + (log.level === 'error' || log.level === 'critical' ? 1 : 0)
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date - b.date);

      // Generate security events
      const securityEvents = logs
        .filter(log => log.category === 'security')
        .map(log => ({
          timestamp: log.timestamp,
          action: log.action,
          message: log.message,
          level: log.level
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);

      return {
        summary,
        topActions,
        timeline,
        securityEvents,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate audit report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate audit report');
    }
  }

  /**
   * Write log entry
   * @param entry Log entry data
   */
  private static async writeLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>): Promise<void> {
    try {
      // Check if logging is enabled
      if (!this.config.enableLogging) {
        return;
      }

      // Check log level
      if (!this.shouldLog(entry.level)) {
        return;
      }

      // Check category filters
      if (!this.shouldLogCategory(entry.category)) {
        return;
      }

      // Create full log entry
      const fullEntry: AuditLogEntry = {
        ...entry,
        id: this.generateLogId(),
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        ipAddress: await this.getClientIP()
      };

      // Store log if persistence is enabled
      if (this.config.enablePersistence) {
        await this.storeLog(fullEntry);
      }

      // Send to remote endpoint if enabled
      if (this.config.enableRemoteLogging && this.config.remoteEndpoint) {
        await this.sendToRemote(fullEntry);
      }

      // Output to console
      this.outputToConsole(fullEntry);
    } catch (error) {
      console.error('Failed to write audit log:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Store log entry
   * @param entry Log entry to store
   */
  private static async storeLog(entry: AuditLogEntry): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const logs: AuditLogEntry[] = result[this.STORAGE_KEY] || [];

      logs.push(entry);

      // Limit logs in storage
      if (logs.length > this.config.maxLogEntries) {
        logs.splice(0, logs.length - this.config.maxLogEntries);
      }

      // Apply retention policy
      const cutoffDate = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
      const filteredLogs = logs.filter(log => log.timestamp >= cutoffDate);

      await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredLogs });
    } catch (error) {
      console.error('Failed to store audit log:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Send log to remote endpoint
   * @param entry Log entry to send
   */
  private static async sendToRemote(entry: AuditLogEntry): Promise<void> {
    try {
      if (!this.config.remoteEndpoint) {
        return;
      }

      const payload = {
        ...entry,
        source: 'ray-extension'
      };

      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send log to remote endpoint:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Output log to console
   * @param entry Log entry to output
   */
  private static outputToConsole(entry: AuditLogEntry): void {
    const message = `[${entry.level.toUpperCase()}] [${entry.category}] ${entry.action}: ${entry.message}`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.details);
        break;
      case 'info':
        console.info(message, entry.details);
        break;
      case 'warn':
        console.warn(message, entry.details);
        break;
      case 'error':
        console.error(message, entry.details);
        break;
      case 'critical':
        console.error(`🚨 CRITICAL: ${message}`, entry.details);
        break;
    }
  }

  /**
   * Check if log level should be logged
   * @param level Log level to check
   * @returns True if should log
   */
  private static shouldLog(level: AuditLogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'critical'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const entryLevelIndex = levels.indexOf(level);
    
    return entryLevelIndex >= configLevelIndex;
  }

  /**
   * Check if category should be logged
   * @param category Category to check
   * @returns True if should log
   */
  private static shouldLogCategory(category: AuditLogEntry['category']): boolean {
    // Check excluded categories
    if (this.config.excludedCategories && this.config.excludedCategories.includes(category)) {
      return false;
    }

    // Check included categories (if specified)
    if (this.config.includedCategories && this.config.includedCategories.length > 0) {
      return this.config.includedCategories.includes(category);
    }

    return true;
  }

  /**
   * Generate log ID
   * @returns Unique log ID
   */
  private static generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   * @returns Session ID
   */
  private static async generateSessionId(): Promise<string> {
    try {
      const result = await chrome.storage.local.get([this.SESSION_KEY]);
      let sessionId = result[this.SESSION_KEY];
      
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await chrome.storage.local.set({ [this.SESSION_KEY]: sessionId });
      }
      
      return sessionId;
    } catch (error) {
      console.error('Failed to generate session ID:', error instanceof Error ? error.message : 'Unknown error');
      return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Get client IP address
   * @returns Client IP address
   */
  private static async getClientIP(): Promise<string> {
    try {
      // In a Chrome extension, we can't directly get the client IP
      // This is a placeholder that would need to be implemented based on requirements
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Convert logs to CSV format
   * @param logs Logs to convert
   * @returns CSV string
   */
  private static convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) {
      return '';
    }

    const headers = [
      'id', 'timestamp', 'level', 'category', 'action', 'message',
      'userId', 'sessionId', 'source', 'userAgent'
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        log.timestamp,
        log.level,
        log.category,
        log.action,
        `"${log.message.replace(/"/g, '""')}"`, // Escape quotes
        log.userId || '',
        log.sessionId || '',
        log.source,
        `"${log.userAgent.replace(/"/g, '""')}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  /**
   * Get audit logger configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<AuditLogConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get audit logger config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update audit logger configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<AuditLogConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });
    } catch (error) {
      console.error('Failed to update audit logger config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update audit logger config');
    }
  }
}
