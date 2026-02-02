/**
 * Security Monitor for Ray Chrome Extension
 * Provides real-time security monitoring and threat detection
 */

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'threat' | 'violation' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'api' | 'permission' | 'csp' | 'input' | 'storage' | 'network' | 'system';
  title: string;
  description: string;
  source: string;
  data?: any;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByCategory: Record<string, number>;
  unresolvedEvents: number;
  criticalEvents: number;
  averageResolutionTime: number;
  eventsLast24h: number;
  eventsLast7d: number;
  eventsLast30d: number;
}

export interface SecurityMonitorConfig {
  enableRealTimeMonitoring: boolean;
  enableThreatDetection: boolean;
  enableBehaviorAnalysis: boolean;
  enablePerformanceMonitoring: boolean;
  maxEventsInMemory: number;
  eventRetentionDays: number;
  alertThresholds: {
    criticalEventsPerHour: number;
    highEventsPerHour: number;
    totalEventsPerHour: number;
  };
}

export class SecurityMonitor {
  private static readonly DEFAULT_CONFIG: SecurityMonitorConfig = {
    enableRealTimeMonitoring: true,
    enableThreatDetection: true,
    enableBehaviorAnalysis: true,
    enablePerformanceMonitoring: true,
    maxEventsInMemory: 1000,
    eventRetentionDays: 30,
    alertThresholds: {
      criticalEventsPerHour: 5,
      highEventsPerHour: 10,
      totalEventsPerHour: 50
    }
  };

  private static readonly STORAGE_KEY = 'securityEvents';
  private static readonly CONFIG_KEY = 'securityMonitorConfig';
  private static readonly METRICS_KEY = 'securityMetrics';
  
  private static eventHandlers: Map<string, (event: SecurityEvent) => void> = new Map();
  private static isMonitoring = false;
  private static monitoringInterval?: number;

  /**
   * Initialize security monitoring
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<SecurityMonitorConfig>): Promise<void> {
    try {
      // Load or create configuration
      const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: finalConfig });

      // Start monitoring if enabled
      if (finalConfig.enableRealTimeMonitoring) {
        this.startMonitoring();
      }

      // Initialize metrics
      await this.initializeMetrics();

      console.log('Security Monitor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Security Monitor:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security Monitor initialization failed');
    }
  }

  /**
   * Record a security event
   * @param event The security event to record
   */
  static async recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<string> {
    try {
      const fullEvent: SecurityEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: Date.now(),
        resolved: false
      };

      // Store event
      await this.storeEvent(fullEvent);

      // Update metrics
      await this.updateMetrics(fullEvent);

      // Trigger event handlers
      this.triggerEventHandlers(fullEvent);

      // Check alert thresholds
      await this.checkAlertThresholds();

      return fullEvent.id;
    } catch (error) {
      console.error('Failed to record security event:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to record security event');
    }
  }

  /**
   * Get security events
   * @param filters Optional filters
   * @param limit Maximum number of events to return
   * @returns Array of security events
   */
  static async getEvents(filters?: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    category?: SecurityEvent['category'];
    resolved?: boolean;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<SecurityEvent[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const events: SecurityEvent[] = result[this.STORAGE_KEY] || [];

      let filteredEvents = events;

      // Apply filters
      if (filters) {
        if (filters.type) {
          filteredEvents = filteredEvents.filter(event => event.type === filters.type);
        }
        if (filters.severity) {
          filteredEvents = filteredEvents.filter(event => event.severity === filters.severity);
        }
        if (filters.category) {
          filteredEvents = filteredEvents.filter(event => event.category === filters.category);
        }
        if (filters.resolved !== undefined) {
          filteredEvents = filteredEvents.filter(event => event.resolved === filters.resolved);
        }
        if (filters.startDate) {
          filteredEvents = filteredEvents.filter(event => event.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          filteredEvents = filteredEvents.filter(event => event.timestamp <= filters.endDate!);
        }
      }

      // Sort by timestamp (newest first)
      filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        filteredEvents = filteredEvents.slice(0, limit);
      }

      return filteredEvents;
    } catch (error) {
      console.error('Failed to get security events:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get security metrics
   * @returns Security metrics
   */
  static async getMetrics(): Promise<SecurityMetrics> {
    try {
      const result = await chrome.storage.local.get([this.METRICS_KEY]);
      return result[this.METRICS_KEY] || this.createEmptyMetrics();
    } catch (error) {
      console.error('Failed to get security metrics:', error instanceof Error ? error.message : 'Unknown error');
      return this.createEmptyMetrics();
    }
  }

  /**
   * Resolve a security event
   * @param eventId The ID of the event to resolve
   * @param resolvedBy Who resolved the event
   */
  static async resolveEvent(eventId: string, resolvedBy: string): Promise<void> {
    try {
      const events = await this.getEvents();
      const eventIndex = events.findIndex(event => event.id === eventId);
      
      if (eventIndex === -1) {
        throw new Error(`Event with ID ${eventId} not found`);
      }

      events[eventIndex].resolved = true;
      events[eventIndex].resolvedAt = Date.now();
      events[eventIndex].resolvedBy = resolvedBy;

      await chrome.storage.local.set({ [this.STORAGE_KEY]: events });
      await this.updateMetrics(events[eventIndex]);
    } catch (error) {
      console.error('Failed to resolve security event:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to resolve security event');
    }
  }

  /**
   * Register event handler
   * @param id Handler ID
   * @param handler Event handler function
   */
  static registerEventHandler(id: string, handler: (event: SecurityEvent) => void): void {
    this.eventHandlers.set(id, handler);
  }

  /**
   * Unregister event handler
   * @param id Handler ID
   */
  static unregisterEventHandler(id: string): void {
    this.eventHandlers.delete(id);
  }

  /**
   * Generate security report
   * @param days Number of days to include in report
   * @returns Security report
   */
  static async generateReport(days: number = 7): Promise<{
    summary: SecurityMetrics;
    topThreats: Array<{
      title: string;
      count: number;
      severity: string;
    }>;
    timeline: Array<{
      date: number;
      events: number;
      critical: number;
    }>;
    recommendations: string[];
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (days * 24 * 60 * 60 * 1000);
      
      const events = await this.getEvents({
        startDate,
        endDate: now
      });

      // Generate summary
      const summary = await this.getMetrics();

      // Generate top threats
      const threatCounts = new Map<string, { count: number; severity: string }>();
      for (const event of events) {
        const existing = threatCounts.get(event.title) || { count: 0, severity: event.severity };
        threatCounts.set(event.title, {
          count: existing.count + 1,
          severity: event.severity
        });
      }

      const topThreats = Array.from(threatCounts.entries())
        .map(([title, data]) => ({ title, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { events: number; critical: number }>();
      for (const event of events) {
        const day = Math.floor(event.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { events: 0, critical: 0 };
        timelineMap.set(day, {
          events: existing.events + 1,
          critical: existing.critical + (event.severity === 'critical' ? 1 : 0)
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date - b.date);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(events);

      return {
        summary,
        topThreats,
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
   * Clear security events
   * @param olderThanDays Clear events older than specified days
   */
  static async clearEvents(olderThanDays?: number): Promise<void> {
    try {
      if (olderThanDays) {
        const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        const events = await this.getEvents();
        const filteredEvents = events.filter(event => event.timestamp >= cutoffDate);
        await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredEvents });
      } else {
        await chrome.storage.local.remove([this.STORAGE_KEY]);
      }

      // Reset metrics
      await this.initializeMetrics();
    } catch (error) {
      console.error('Failed to clear security events:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear security events');
    }
  }

  /**
   * Start real-time monitoring
   */
  static startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, 60000); // Check every minute

    console.log('Security monitoring started');
  }

  /**
   * Stop real-time monitoring
   */
  static stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Security monitoring stopped');
  }

  /**
   * Store security event
   * @param event The event to store
   */
  private static async storeEvent(event: SecurityEvent): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const events: SecurityEvent[] = result[this.STORAGE_KEY] || [];

      events.push(event);

      // Limit events in storage
      const config = await this.getConfig();
      if (events.length > config.maxEventsInMemory) {
        events.splice(0, events.length - config.maxEventsInMemory);
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: events });
    } catch (error) {
      console.error('Failed to store security event:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Update security metrics
   * @param event The event to include in metrics
   */
  private static async updateMetrics(event?: SecurityEvent): Promise<void> {
    try {
      const events = event ? [event] : await this.getEvents();
      const metrics = this.calculateMetrics(events);
      await chrome.storage.local.set({ [this.METRICS_KEY]: metrics });
    } catch (error) {
      console.error('Failed to update security metrics:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Calculate security metrics from events
   * @param events The events to analyze
   * @returns Calculated metrics
   */
  private static calculateMetrics(events: SecurityEvent[]): SecurityMetrics {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const last7d = now - (7 * 24 * 60 * 60 * 1000);
    const last30d = now - (30 * 24 * 60 * 60 * 1000);

    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const eventsByCategory: Record<string, number> = {};

    let unresolvedEvents = 0;
    let criticalEvents = 0;
    let eventsLast24h = 0;
    let eventsLast7d = 0;
    let eventsLast30d = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const event of events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Count by category
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;

      // Count unresolved events
      if (!event.resolved) {
        unresolvedEvents++;
      }

      // Count critical events
      if (event.severity === 'critical') {
        criticalEvents++;
      }

      // Count events by time period
      if (event.timestamp >= last24h) {
        eventsLast24h++;
      }
      if (event.timestamp >= last7d) {
        eventsLast7d++;
      }
      if (event.timestamp >= last30d) {
        eventsLast30d++;
      }

      // Calculate resolution time
      if (event.resolved && event.resolvedAt) {
        totalResolutionTime += event.resolvedAt - event.timestamp;
        resolvedCount++;
      }
    }

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      eventsByCategory,
      unresolvedEvents,
      criticalEvents,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      eventsLast24h,
      eventsLast7d,
      eventsLast30d
    };
  }

  /**
   * Create empty metrics object
   * @returns Empty metrics
   */
  private static createEmptyMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      eventsByCategory: {},
      unresolvedEvents: 0,
      criticalEvents: 0,
      averageResolutionTime: 0,
      eventsLast24h: 0,
      eventsLast7d: 0,
      eventsLast30d: 0
    };
  }

  /**
   * Initialize metrics
   */
  private static async initializeMetrics(): Promise<void> {
    try {
      const events = await this.getEvents();
      const metrics = this.calculateMetrics(events);
      await chrome.storage.local.set({ [this.METRICS_KEY]: metrics });
    } catch (error) {
      console.error('Failed to initialize metrics:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate event ID
   * @returns Unique event ID
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Trigger event handlers
   * @param event The event to trigger handlers for
   */
  private static triggerEventHandlers(event: SecurityEvent): void {
    for (const [id, handler] of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Event handler ${id} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Check alert thresholds
   */
  private static async checkAlertThresholds(): Promise<void> {
    try {
      const config = await this.getConfig();
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const events = await this.getEvents({
        startDate: oneHourAgo,
        endDate: now
      });

      const criticalEvents = events.filter(event => event.severity === 'critical').length;
      const highEvents = events.filter(event => event.severity === 'high').length;
      const totalEvents = events.length;

      // Check thresholds and create alert events
      if (criticalEvents >= config.alertThresholds.criticalEventsPerHour) {
        await this.recordEvent({
          type: 'warning',
          severity: 'high',
          category: 'system',
          title: 'Critical Event Threshold Exceeded',
          description: `${criticalEvents} critical events detected in the last hour`,
          source: 'SecurityMonitor'
        });
      }

      if (highEvents >= config.alertThresholds.highEventsPerHour) {
        await this.recordEvent({
          type: 'warning',
          severity: 'medium',
          category: 'system',
          title: 'High Event Threshold Exceeded',
          description: `${highEvents} high-severity events detected in the last hour`,
          source: 'SecurityMonitor'
        });
      }

      if (totalEvents >= config.alertThresholds.totalEventsPerHour) {
        await this.recordEvent({
          type: 'warning',
          severity: 'medium',
          category: 'system',
          title: 'Total Event Threshold Exceeded',
          description: `${totalEvents} total events detected in the last hour`,
          source: 'SecurityMonitor'
        });
      }
    } catch (error) {
      console.error('Failed to check alert thresholds:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Perform monitoring check
   */
  private static async performMonitoringCheck(): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (config.enableThreatDetection) {
        await this.performThreatDetection();
      }
      
      if (config.enableBehaviorAnalysis) {
        await this.performBehaviorAnalysis();
      }
      
      if (config.enablePerformanceMonitoring) {
        await this.performPerformanceMonitoring();
      }
    } catch (error) {
      console.error('Monitoring check failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Perform threat detection
   */
  private static async performThreatDetection(): Promise<void> {
    // This would implement specific threat detection logic
    // For now, it's a placeholder for future implementation
  }

  /**
   * Perform behavior analysis
   */
  private static async performBehaviorAnalysis(): Promise<void> {
    // This would implement behavior analysis logic
    // For now, it's a placeholder for future implementation
  }

  /**
   * Perform performance monitoring
   */
  private static async performPerformanceMonitoring(): Promise<void> {
    // This would implement performance monitoring logic
    // For now, it's a placeholder for future implementation
  }

  /**
   * Generate security recommendations
   * @param events The events to analyze
   * @returns Array of recommendations
   */
  private static async generateRecommendations(events: SecurityEvent[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Analyze events and generate recommendations
    const unresolvedEvents = events.filter(event => !event.resolved);
    const criticalEvents = events.filter(event => event.severity === 'critical');
    const highEvents = events.filter(event => event.severity === 'high');

    if (unresolvedEvents.length > 10) {
      recommendations.push('High number of unresolved security events - consider reviewing and resolving them');
    }

    if (criticalEvents.length > 0) {
      recommendations.push(`${criticalEvents.length} critical security events detected - immediate attention required`);
    }

    if (highEvents.length > 5) {
      recommendations.push('Multiple high-severity security events detected - review security measures');
    }

    // Category-specific recommendations
    const apiEvents = events.filter(event => event.category === 'api');
    const permissionEvents = events.filter(event => event.category === 'permission');
    const inputEvents = events.filter(event => event.category === 'input');

    if (apiEvents.length > 5) {
      recommendations.push('Multiple API-related security events - review API security measures');
    }

    if (permissionEvents.length > 3) {
      recommendations.push('Permission-related security issues detected - review permission management');
    }

    if (inputEvents.length > 5) {
      recommendations.push('Input validation issues detected - strengthen input validation measures');
    }

    return recommendations;
  }

  /**
   * Get security monitor configuration
   * @returns Configuration
   */
  private static async getConfig(): Promise<SecurityMonitorConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get security monitor config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }
} * Security Monitor for Ray Chrome Extension
 * Provides real-time security monitoring and threat detection
 */

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'threat' | 'violation' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'api' | 'permission' | 'csp' | 'input' | 'storage' | 'network' | 'system';
  title: string;
  description: string;
  source: string;
  data?: any;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByCategory: Record<string, number>;
  unresolvedEvents: number;
  criticalEvents: number;
  averageResolutionTime: number;
  eventsLast24h: number;
  eventsLast7d: number;
  eventsLast30d: number;
}

export interface SecurityMonitorConfig {
  enableRealTimeMonitoring: boolean;
  enableThreatDetection: boolean;
  enableBehaviorAnalysis: boolean;
  enablePerformanceMonitoring: boolean;
  maxEventsInMemory: number;
  eventRetentionDays: number;
  alertThresholds: {
    criticalEventsPerHour: number;
    highEventsPerHour: number;
    totalEventsPerHour: number;
  };
}

export class SecurityMonitor {
  private static readonly DEFAULT_CONFIG: SecurityMonitorConfig = {
    enableRealTimeMonitoring: true,
    enableThreatDetection: true,
    enableBehaviorAnalysis: true,
    enablePerformanceMonitoring: true,
    maxEventsInMemory: 1000,
    eventRetentionDays: 30,
    alertThresholds: {
      criticalEventsPerHour: 5,
      highEventsPerHour: 10,
      totalEventsPerHour: 50
    }
  };

  private static readonly STORAGE_KEY = 'securityEvents';
  private static readonly CONFIG_KEY = 'securityMonitorConfig';
  private static readonly METRICS_KEY = 'securityMetrics';
  
  private static eventHandlers: Map<string, (event: SecurityEvent) => void> = new Map();
  private static isMonitoring = false;
  private static monitoringInterval?: number;

  /**
   * Initialize security monitoring
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<SecurityMonitorConfig>): Promise<void> {
    try {
      // Load or create configuration
      const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: finalConfig });

      // Start monitoring if enabled
      if (finalConfig.enableRealTimeMonitoring) {
        this.startMonitoring();
      }

      // Initialize metrics
      await this.initializeMetrics();

      console.log('Security Monitor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Security Monitor:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Security Monitor initialization failed');
    }
  }

  /**
   * Record a security event
   * @param event The security event to record
   */
  static async recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<string> {
    try {
      const fullEvent: SecurityEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: Date.now(),
        resolved: false
      };

      // Store event
      await this.storeEvent(fullEvent);

      // Update metrics
      await this.updateMetrics(fullEvent);

      // Trigger event handlers
      this.triggerEventHandlers(fullEvent);

      // Check alert thresholds
      await this.checkAlertThresholds();

      return fullEvent.id;
    } catch (error) {
      console.error('Failed to record security event:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to record security event');
    }
  }

  /**
   * Get security events
   * @param filters Optional filters
   * @param limit Maximum number of events to return
   * @returns Array of security events
   */
  static async getEvents(filters?: {
    type?: SecurityEvent['type'];
    severity?: SecurityEvent['severity'];
    category?: SecurityEvent['category'];
    resolved?: boolean;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<SecurityEvent[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const events: SecurityEvent[] = result[this.STORAGE_KEY] || [];

      let filteredEvents = events;

      // Apply filters
      if (filters) {
        if (filters.type) {
          filteredEvents = filteredEvents.filter(event => event.type === filters.type);
        }
        if (filters.severity) {
          filteredEvents = filteredEvents.filter(event => event.severity === filters.severity);
        }
        if (filters.category) {
          filteredEvents = filteredEvents.filter(event => event.category === filters.category);
        }
        if (filters.resolved !== undefined) {
          filteredEvents = filteredEvents.filter(event => event.resolved === filters.resolved);
        }
        if (filters.startDate) {
          filteredEvents = filteredEvents.filter(event => event.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          filteredEvents = filteredEvents.filter(event => event.timestamp <= filters.endDate!);
        }
      }

      // Sort by timestamp (newest first)
      filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        filteredEvents = filteredEvents.slice(0, limit);
      }

      return filteredEvents;
    } catch (error) {
      console.error('Failed to get security events:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get security metrics
   * @returns Security metrics
   */
  static async getMetrics(): Promise<SecurityMetrics> {
    try {
      const result = await chrome.storage.local.get([this.METRICS_KEY]);
      return result[this.METRICS_KEY] || this.createEmptyMetrics();
    } catch (error) {
      console.error('Failed to get security metrics:', error instanceof Error ? error.message : 'Unknown error');
      return this.createEmptyMetrics();
    }
  }

  /**
   * Resolve a security event
   * @param eventId The ID of the event to resolve
   * @param resolvedBy Who resolved the event
   */
  static async resolveEvent(eventId: string, resolvedBy: string): Promise<void> {
    try {
      const events = await this.getEvents();
      const eventIndex = events.findIndex(event => event.id === eventId);
      
      if (eventIndex === -1) {
        throw new Error(`Event with ID ${eventId} not found`);
      }

      events[eventIndex].resolved = true;
      events[eventIndex].resolvedAt = Date.now();
      events[eventIndex].resolvedBy = resolvedBy;

      await chrome.storage.local.set({ [this.STORAGE_KEY]: events });
      await this.updateMetrics(events[eventIndex]);
    } catch (error) {
      console.error('Failed to resolve security event:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to resolve security event');
    }
  }

  /**
   * Register event handler
   * @param id Handler ID
   * @param handler Event handler function
   */
  static registerEventHandler(id: string, handler: (event: SecurityEvent) => void): void {
    this.eventHandlers.set(id, handler);
  }

  /**
   * Unregister event handler
   * @param id Handler ID
   */
  static unregisterEventHandler(id: string): void {
    this.eventHandlers.delete(id);
  }

  /**
   * Generate security report
   * @param days Number of days to include in report
   * @returns Security report
   */
  static async generateReport(days: number = 7): Promise<{
    summary: SecurityMetrics;
    topThreats: Array<{
      title: string;
      count: number;
      severity: string;
    }>;
    timeline: Array<{
      date: number;
      events: number;
      critical: number;
    }>;
    recommendations: string[];
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (days * 24 * 60 * 60 * 1000);
      
      const events = await this.getEvents({
        startDate,
        endDate: now
      });

      // Generate summary
      const summary = await this.getMetrics();

      // Generate top threats
      const threatCounts = new Map<string, { count: number; severity: string }>();
      for (const event of events) {
        const existing = threatCounts.get(event.title) || { count: 0, severity: event.severity };
        threatCounts.set(event.title, {
          count: existing.count + 1,
          severity: event.severity
        });
      }

      const topThreats = Array.from(threatCounts.entries())
        .map(([title, data]) => ({ title, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { events: number; critical: number }>();
      for (const event of events) {
        const day = Math.floor(event.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { events: 0, critical: 0 };
        timelineMap.set(day, {
          events: existing.events + 1,
          critical: existing.critical + (event.severity === 'critical' ? 1 : 0)
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date - b.date);

      // Generate recommendations
      const recommendations = await this.generateRecommendations(events);

      return {
        summary,
        topThreats,
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
   * Clear security events
   * @param olderThanDays Clear events older than specified days
   */
  static async clearEvents(olderThanDays?: number): Promise<void> {
    try {
      if (olderThanDays) {
        const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        const events = await this.getEvents();
        const filteredEvents = events.filter(event => event.timestamp >= cutoffDate);
        await chrome.storage.local.set({ [this.STORAGE_KEY]: filteredEvents });
      } else {
        await chrome.storage.local.remove([this.STORAGE_KEY]);
      }

      // Reset metrics
      await this.initializeMetrics();
    } catch (error) {
      console.error('Failed to clear security events:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear security events');
    }
  }

  /**
   * Start real-time monitoring
   */
  static startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCheck();
    }, 60000); // Check every minute

    console.log('Security monitoring started');
  }

  /**
   * Stop real-time monitoring
   */
  static stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('Security monitoring stopped');
  }

  /**
   * Store security event
   * @param event The event to store
   */
  private static async storeEvent(event: SecurityEvent): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const events: SecurityEvent[] = result[this.STORAGE_KEY] || [];

      events.push(event);

      // Limit events in storage
      const config = await this.getConfig();
      if (events.length > config.maxEventsInMemory) {
        events.splice(0, events.length - config.maxEventsInMemory);
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: events });
    } catch (error) {
      console.error('Failed to store security event:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Update security metrics
   * @param event The event to include in metrics
   */
  private static async updateMetrics(event?: SecurityEvent): Promise<void> {
    try {
      const events = event ? [event] : await this.getEvents();
      const metrics = this.calculateMetrics(events);
      await chrome.storage.local.set({ [this.METRICS_KEY]: metrics });
    } catch (error) {
      console.error('Failed to update security metrics:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Calculate security metrics from events
   * @param events The events to analyze
   * @returns Calculated metrics
   */
  private static calculateMetrics(events: SecurityEvent[]): SecurityMetrics {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const last7d = now - (7 * 24 * 60 * 60 * 1000);
    const last30d = now - (30 * 24 * 60 * 60 * 1000);

    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const eventsByCategory: Record<string, number> = {};

    let unresolvedEvents = 0;
    let criticalEvents = 0;
    let eventsLast24h = 0;
    let eventsLast7d = 0;
    let eventsLast30d = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const event of events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      // Count by severity
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      // Count by category
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;

      // Count unresolved events
      if (!event.resolved) {
        unresolvedEvents++;
      }

      // Count critical events
      if (event.severity === 'critical') {
        criticalEvents++;
      }

      // Count events by time period
      if (event.timestamp >= last24h) {
        eventsLast24h++;
      }
      if (event.timestamp >= last7d) {
        eventsLast7d++;
      }
      if (event.timestamp >= last30d) {
        eventsLast30d++;
      }

      // Calculate resolution time
      if (event.resolved && event.resolvedAt) {
        totalResolutionTime += event.resolvedAt - event.timestamp;
        resolvedCount++;
      }
    }

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      eventsByCategory,
      unresolvedEvents,
      criticalEvents,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      eventsLast24h,
      eventsLast7d,
      eventsLast30d
    };
  }

  /**
   * Create empty metrics object
   * @returns Empty metrics
   */
  private static createEmptyMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      eventsByCategory: {},
      unresolvedEvents: 0,
      criticalEvents: 0,
      averageResolutionTime: 0,
      eventsLast24h: 0,
      eventsLast7d: 0,
      eventsLast30d: 0
    };
  }

  /**
   * Initialize metrics
   */
  private static async initializeMetrics(): Promise<void> {
    try {
      const events = await this.getEvents();
      const metrics = this.calculateMetrics(events);
      await chrome.storage.local.set({ [this.METRICS_KEY]: metrics });
    } catch (error) {
      console.error('Failed to initialize metrics:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate event ID
   * @returns Unique event ID
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Trigger event handlers
   * @param event The event to trigger handlers for
   */
  private static triggerEventHandlers(event: SecurityEvent): void {
    for (const [id, handler] of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Event handler ${id} failed:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  /**
   * Check alert thresholds
   */
  private static async checkAlertThresholds(): Promise<void> {
    try {
      const config = await this.getConfig();
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const events = await this.getEvents({
        startDate: oneHourAgo,
        endDate: now
      });

      const criticalEvents = events.filter(event => event.severity === 'critical').length;
      const highEvents = events.filter(event => event.severity === 'high').length;
      const totalEvents = events.length;

      // Check thresholds and create alert events
      if (criticalEvents >= config.alertThresholds.criticalEventsPerHour) {
        await this.recordEvent({
          type: 'warning',
          severity: 'high',
          category: 'system',
          title: 'Critical Event Threshold Exceeded',
          description: `${criticalEvents} critical events detected in the last hour`,
          source: 'SecurityMonitor'
        });
      }

      if (highEvents >= config.alertThresholds.highEventsPerHour) {
        await this.recordEvent({
          type: 'warning',
          severity: 'medium',
          category: 'system',
          title: 'High Event Threshold Exceeded',
          description: `${highEvents} high-severity events detected in the last hour`,
          source: 'SecurityMonitor'
        });
      }

      if (totalEvents >= config.alertThresholds.totalEventsPerHour) {
        await this.recordEvent({
          type: 'warning',
          severity: 'medium',
          category: 'system',
          title: 'Total Event Threshold Exceeded',
          description: `${totalEvents} total events detected in the last hour`,
          source: 'SecurityMonitor'
        });
      }
    } catch (error) {
      console.error('Failed to check alert thresholds:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Perform monitoring check
   */
  private static async performMonitoringCheck(): Promise<void> {
    try {
      const config = await this.getConfig();
      
      if (config.enableThreatDetection) {
        await this.performThreatDetection();
      }
      
      if (config.enableBehaviorAnalysis) {
        await this.performBehaviorAnalysis();
      }
      
      if (config.enablePerformanceMonitoring) {
        await this.performPerformanceMonitoring();
      }
    } catch (error) {
      console.error('Monitoring check failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Perform threat detection
   */
  private static async performThreatDetection(): Promise<void> {
    // This would implement specific threat detection logic
    // For now, it's a placeholder for future implementation
  }

  /**
   * Perform behavior analysis
   */
  private static async performBehaviorAnalysis(): Promise<void> {
    // This would implement behavior analysis logic
    // For now, it's a placeholder for future implementation
  }

  /**
   * Perform performance monitoring
   */
  private static async performPerformanceMonitoring(): Promise<void> {
    // This would implement performance monitoring logic
    // For now, it's a placeholder for future implementation
  }

  /**
   * Generate security recommendations
   * @param events The events to analyze
   * @returns Array of recommendations
   */
  private static async generateRecommendations(events: SecurityEvent[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Analyze events and generate recommendations
    const unresolvedEvents = events.filter(event => !event.resolved);
    const criticalEvents = events.filter(event => event.severity === 'critical');
    const highEvents = events.filter(event => event.severity === 'high');

    if (unresolvedEvents.length > 10) {
      recommendations.push('High number of unresolved security events - consider reviewing and resolving them');
    }

    if (criticalEvents.length > 0) {
      recommendations.push(`${criticalEvents.length} critical security events detected - immediate attention required`);
    }

    if (highEvents.length > 5) {
      recommendations.push('Multiple high-severity security events detected - review security measures');
    }

    // Category-specific recommendations
    const apiEvents = events.filter(event => event.category === 'api');
    const permissionEvents = events.filter(event => event.category === 'permission');
    const inputEvents = events.filter(event => event.category === 'input');

    if (apiEvents.length > 5) {
      recommendations.push('Multiple API-related security events - review API security measures');
    }

    if (permissionEvents.length > 3) {
      recommendations.push('Permission-related security issues detected - review permission management');
    }

    if (inputEvents.length > 5) {
      recommendations.push('Input validation issues detected - strengthen input validation measures');
    }

    return recommendations;
  }

  /**
   * Get security monitor configuration
   * @returns Configuration
   */
  private static async getConfig(): Promise<SecurityMonitorConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get security monitor config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }
}
