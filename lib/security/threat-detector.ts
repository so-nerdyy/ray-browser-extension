/**
 * Threat Detector for Ray Chrome Extension
 * Provides advanced threat detection and analysis capabilities
 */

export interface Threat {
  id: string;
  timestamp: number;
  type: 'malware' | 'phishing' | 'xss' | 'injection' | 'data_exfiltration' | 'privilege_escalation' | 'suspicious_behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  title: string;
  description: string;
  source: string;
  target?: string;
  indicators: string[];
  mitigations: string[];
  falsePositive: boolean;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}

export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  type: Threat['type'];
  pattern: RegExp;
  severity: Threat['severity'];
  confidence: number;
  enabled: boolean;
  created: number;
  updated: number;
}

export interface ThreatDetectorConfig {
  enableDetection: boolean;
  enableBehaviorAnalysis: boolean;
  enableNetworkAnalysis: boolean;
  enableContentAnalysis: boolean;
  enableHeuristics: boolean;
  enableMachineLearning: boolean;
  threatThreshold: number;
  autoMitigation: boolean;
  alertThresholds: {
    threatsPerHour: number;
    criticalThreatsPerHour: number;
    confidenceThreshold: number;
  };
  customPatterns?: ThreatPattern[];
}

export interface BehaviorProfile {
  userId?: string;
  sessionId: string;
  baseline: {
    apiCalls: Record<string, number>;
    domains: Record<string, number>;
    actions: Record<string, number>;
    timeOfDay: number[];
    dayOfWeek: number[];
  };
  current: {
    apiCalls: Record<string, number>;
    domains: Record<string, number>;
    actions: Record<string, number>;
    timeOfDay: number[];
    dayOfWeek: number[];
  };
  anomalies: Array<{
    timestamp: number;
    type: string;
    description: string;
    score: number;
  }>;
  lastUpdated: number;
}

export class ThreatDetector {
  private static readonly DEFAULT_CONFIG: ThreatDetectorConfig = {
    enableDetection: true,
    enableBehaviorAnalysis: true,
    enableNetworkAnalysis: true,
    enableContentAnalysis: true,
    enableHeuristics: true,
    enableMachineLearning: false,
    threatThreshold: 50,
    autoMitigation: false,
    alertThresholds: {
      threatsPerHour: 10,
      criticalThreatsPerHour: 3,
      confidenceThreshold: 70
    }
  };

  private static readonly STORAGE_KEY = 'threats';
  private static readonly PATTERNS_KEY = 'threatPatterns';
  private static readonly PROFILES_KEY = 'behaviorProfiles';
  private static readonly CONFIG_KEY = 'threatDetectorConfig';
  
  private static config: ThreatDetectorConfig;
  private static behaviorProfiles: Map<string, BehaviorProfile> = new Map();
  private static isInitialized = false;

  /**
   * Initialize threat detector
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<ThreatDetectorConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Load behavior profiles
      await this.loadBehaviorProfiles();

      // Initialize default threat patterns
      await this.initializeDefaultPatterns();

      this.isInitialized = true;
      console.log('Threat Detector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Threat Detector:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Threat Detector initialization failed');
    }
  }

  /**
   * Analyze content for threats
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  static async analyzeContent(content: string, source: string): Promise<Threat[]> {
    if (!this.isInitialized || !this.config.enableDetection || !this.config.enableContentAnalysis) {
      return [];
    }

    const threats: Threat[] = [];

    try {
      // Pattern-based detection
      const patternThreats = await this.detectPatterns(content, source);
      threats.push(...patternThreats);

      // Heuristic analysis
      if (this.config.enableHeuristics) {
        const heuristicThreats = await this.heuristicAnalysis(content, source);
        threats.push(...heuristicThreats);
      }

      // Machine learning analysis
      if (this.config.enableMachineLearning) {
        const mlThreats = await this.machineLearningAnalysis(content, source);
        threats.push(...mlThreats);
      }

      // Store threats
      for (const threat of threats) {
        await this.storeThreat(threat);
      }

      // Check alert thresholds
      await this.checkAlertThresholds();

      return threats;
    } catch (error) {
      console.error('Failed to analyze content for threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Analyze network request for threats
   * @param url Request URL
   * @param method HTTP method
   * @param headers Request headers
   * @param body Request body
   * @returns Detected threats
   */
  static async analyzeNetworkRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<Threat[]> {
    if (!this.isInitialized || !this.config.enableDetection || !this.config.enableNetworkAnalysis) {
      return [];
    }

    const threats: Threat[] = [];

    try {
      // URL analysis
      const urlThreats = await this.analyzeURL(url, 'network_request');
      threats.push(...urlThreats);

      // Header analysis
      const headerThreats = await this.analyzeHeaders(headers, url);
      threats.push(...headerThreats);

      // Body analysis
      if (body) {
        const bodyThreats = await this.analyzeContent(body, url);
        threats.push(...bodyThreats);
      }

      // Store threats
      for (const threat of threats) {
        await this.storeThreat(threat);
      }

      return threats;
    } catch (error) {
      console.error('Failed to analyze network request for threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Analyze user behavior for threats
   * @param action User action
   * @param details Action details
   * @param userId Optional user ID
   * @param sessionId Session ID
   * @returns Detected threats
   */
  static async analyzeBehavior(
    action: string,
    details: any,
    userId?: string,
    sessionId?: string
  ): Promise<Threat[]> {
    if (!this.isInitialized || !this.config.enableDetection || !this.config.enableBehaviorAnalysis) {
      return [];
    }

    const threats: Threat[] = [];

    try {
      // Update behavior profile
      if (sessionId) {
        await this.updateBehaviorProfile(action, details, userId, sessionId);
      }

      // Anomaly detection
      const anomalies = await this.detectAnomalies(action, details, userId, sessionId);
      threats.push(...anomalies);

      // Store threats
      for (const threat of threats) {
        await this.storeThreat(threat);
      }

      return threats;
    } catch (error) {
      console.error('Failed to analyze behavior for threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get detected threats
   * @param filters Optional filters
   * @param limit Maximum number of threats to return
   * @returns Array of threats
   */
  static async getThreats(filters?: {
    type?: Threat['type'];
    severity?: Threat['severity'];
    resolved?: boolean;
    startDate?: number;
    endDate?: number;
    minConfidence?: number;
  }, limit?: number): Promise<Threat[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      let threats: Threat[] = result[this.STORAGE_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.type) {
          threats = threats.filter(threat => threat.type === filters.type);
        }
        if (filters.severity) {
          threats = threats.filter(threat => threat.severity === filters.severity);
        }
        if (filters.resolved !== undefined) {
          threats = threats.filter(threat => threat.resolved === filters.resolved);
        }
        if (filters.startDate) {
          threats = threats.filter(threat => threat.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          threats = threats.filter(threat => threat.timestamp <= filters.endDate!);
        }
        if (filters.minConfidence) {
          threats = threats.filter(threat => threat.confidence >= filters.minConfidence!);
        }
      }

      // Sort by timestamp (newest first)
      threats.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        threats = threats.slice(0, limit);
      }

      return threats;
    } catch (error) {
      console.error('Failed to get threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Resolve a threat
   * @param threatId The ID of the threat to resolve
   * @param resolvedBy Who resolved the threat
   * @param falsePositive Whether the threat was a false positive
   */
  static async resolveThreat(threatId: string, resolvedBy: string, falsePositive: boolean = false): Promise<void> {
    try {
      const threats = await this.getThreats();
      const threatIndex = threats.findIndex(threat => threat.id === threatId);
      
      if (threatIndex === -1) {
        throw new Error(`Threat with ID ${threatId} not found`);
      }

      threats[threatIndex].resolved = true;
      threats[threatIndex].resolvedAt = Date.now();
      threats[threatIndex].resolvedBy = resolvedBy;
      threats[threatIndex].falsePositive = falsePositive;

      await chrome.storage.local.set({ [this.STORAGE_KEY]: threats });
    } catch (error) {
      console.error('Failed to resolve threat:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to resolve threat');
    }
  }

  /**
   * Get threat patterns
   * @returns Array of threat patterns
   */
  static async getPatterns(): Promise<ThreatPattern[]> {
    try {
      const result = await chrome.storage.local.get([this.PATTERNS_KEY]);
      return result[this.PATTERNS_KEY] || [];
    } catch (error) {
      console.error('Failed to get threat patterns:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Add threat pattern
   * @param pattern The pattern to add
   */
  static async addPattern(pattern: Omit<ThreatPattern, 'id' | 'created' | 'updated'>): Promise<void> {
    try {
      const patterns = await this.getPatterns();
      const newPattern: ThreatPattern = {
        ...pattern,
        id: this.generatePatternId(),
        created: Date.now(),
        updated: Date.now()
      };

      patterns.push(newPattern);
      await chrome.storage.local.set({ [this.PATTERNS_KEY]: patterns });
    } catch (error) {
      console.error('Failed to add threat pattern:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to add threat pattern');
    }
  }

  /**
   * Generate threat report
   * @param days Number of days to include in report
   * @returns Threat report
   */
  static async generateReport(days: number = 7): Promise<{
    summary: {
      totalThreats: number;
      threatsByType: Record<string, number>;
      threatsBySeverity: Record<string, number>;
      unresolvedThreats: number;
      falsePositives: number;
      averageConfidence: number;
      topSources: Array<{ source: string; count: number }>;
    };
    trends: Array<{
      date: number;
      threats: number;
      critical: number;
      resolved: number;
    }>;
    recommendations: string[];
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (days * 24 * 60 * 60 * 1000);
      
      const threats = await this.getThreats({
        startDate,
        endDate: now
      });

      // Generate summary
      const threatsByType: Record<string, number> = {};
      const threatsBySeverity: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};
      let totalConfidence = 0;
      let unresolvedCount = 0;
      let falsePositiveCount = 0;

      for (const threat of threats) {
        // Count by type
        threatsByType[threat.type] = (threatsByType[threat.type] || 0) + 1;
        
        // Count by severity
        threatsBySeverity[threat.severity] = (threatsBySeverity[threat.severity] || 0) + 1;
        
        // Count by source
        sourceCounts[threat.source] = (sourceCounts[threat.source] || 0) + 1;
        
        // Accumulate confidence
        totalConfidence += threat.confidence;
        
        // Count unresolved
        if (!threat.resolved) {
          unresolvedCount++;
        }
        
        // Count false positives
        if (threat.falsePositive) {
          falsePositiveCount++;
        }
      }

      const topSources = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const summary = {
        totalThreats: threats.length,
        threatsByType,
        threatsBySeverity,
        unresolvedThreats: unresolvedCount,
        falsePositives: falsePositiveCount,
        averageConfidence: threats.length > 0 ? totalConfidence / threats.length : 0,
        topSources
      };

      // Generate trends
      const trendsMap = new Map<number, { threats: number; critical: number; resolved: number }>();
      for (const threat of threats) {
        const day = Math.floor(threat.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = trendsMap.get(day) || { threats: 0, critical: 0, resolved: 0 };
        trendsMap.set(day, {
          threats: existing.threats + 1,
          critical: existing.critical + (threat.severity === 'critical' ? 1 : 0),
          resolved: existing.resolved + (threat.resolved ? 1 : 0)
        });
      }

      const trends = Array.from(trendsMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date - b.date);

      // Generate recommendations
      const recommendations = this.generateRecommendations(threats);

      return {
        summary,
        trends,
        recommendations,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate threat report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate threat report');
    }
  }

  /**
   * Detect threats using patterns
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  private static async detectPatterns(content: string, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];
    const patterns = await this.getPatterns();

    for (const pattern of patterns) {
      if (!pattern.enabled) {
        continue;
      }

      const matches = content.match(pattern.pattern);
      if (matches) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: pattern.type,
          severity: pattern.severity,
          confidence: pattern.confidence,
          title: `${pattern.name} Detected`,
          description: pattern.description,
          source,
          indicators: matches.slice(0, 5), // Limit to 5 indicators
          mitigations: this.getDefaultMitigations(pattern.type),
          falsePositive: false,
          resolved: false,
          metadata: {
            patternId: pattern.id,
            matches: matches.length
          }
        });
      }
    }

    return threats;
  }

  /**
   * Perform heuristic analysis
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  private static async heuristicAnalysis(content: string, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /eval\s*\(/gi, type: 'xss' as Threat['type'], severity: 'high' as Threat['severity'], description: 'Potential XSS via eval()' },
      { pattern: /document\.write\s*\(/gi, type: 'xss' as Threat['type'], severity: 'medium' as Threat['severity'], description: 'Potential XSS via document.write()' },
      { pattern: /innerHTML\s*=/gi, type: 'xss' as Threat['type'], severity: 'medium' as Threat['severity'], description: 'Potential XSS via innerHTML' },
      { pattern: /<script[^>]*>.*?<\/script>/gi, type: 'xss' as Threat['type'], severity: 'critical' as Threat['severity'], description: 'Script tag detected' },
      { pattern: /javascript:/gi, type: 'xss' as Threat['type'], severity: 'high' as Threat['severity'], description: 'JavaScript protocol detected' },
      { pattern: /union\s+select/gi, type: 'injection' as Threat['type'], severity: 'high' as Threat['severity'], description: 'Potential SQL injection' },
      { pattern: /drop\s+table/gi, type: 'injection' as Threat['type'], severity: 'critical' as Threat['severity'], description: 'Potential SQL injection' },
      { pattern: /\.\.[\/\\]/g, type: 'data_exfiltration' as Threat['type'], severity: 'medium' as Threat['severity'], description: 'Path traversal attempt' },
      { pattern: /etc\/passwd/gi, type: 'data_exfiltration' as Threat['type'], severity: 'high' as Threat['severity'], description: 'System file access attempt' },
      { pattern: /cmd\.exe|powershell|bash/gi, type: 'privilege_escalation' as Threat['type'], severity: 'critical' as Threat['severity'], description: 'Command execution attempt' }
    ];

    for (const { pattern, type, severity, description } of suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type,
          severity,
          confidence: 75,
          title: `Heuristic Detection: ${type}`,
          description,
          source,
          indicators: matches.slice(0, 5),
          mitigations: this.getDefaultMitigations(type),
          falsePositive: false,
          resolved: false,
          metadata: {
            heuristic: true,
            matches: matches.length
          }
        });
      }
    }

    return threats;
  }

  /**
   * Perform machine learning analysis
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  private static async machineLearningAnalysis(content: string, source: string): Promise<Threat[]> {
    // This is a placeholder for machine learning analysis
    // In a real implementation, this would use a trained model
    return [];
  }

  /**
   * Analyze URL for threats
   * @param url URL to analyze
   * @param source Source of the URL
   * @returns Detected threats
   */
  private static async analyzeURL(url: string, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];

    try {
      const parsedURL = new URL(url);

      // Check for suspicious domains
      const suspiciousDomains = [
        /bit\.ly/i,
        /tinyurl\.com/i,
        /shortened/i,
        /phishing/i,
        /malware/i
      ];

      for (const pattern of suspiciousDomains) {
        if (pattern.test(parsedURL.hostname)) {
          threats.push({
            id: this.generateThreatId(),
            timestamp: Date.now(),
            type: 'phishing',
            severity: 'high',
            confidence: 80,
            title: 'Suspicious Domain Detected',
            description: `Domain ${parsedURL.hostname} matches suspicious pattern`,
            source,
            target: url,
            indicators: [parsedURL.hostname],
            mitigations: this.getDefaultMitigations('phishing'),
            falsePositive: false,
            resolved: false
          });
        }
      }

      // Check for suspicious parameters
      const suspiciousParams = [
        /cmd=/i,
        /exec=/i,
        /system=/i,
        /eval=/i,
        /redirect=/i
      ];

      for (const [key, value] of parsedURL.searchParams) {
        for (const pattern of suspiciousParams) {
          if (pattern.test(key) || pattern.test(value)) {
            threats.push({
              id: this.generateThreatId(),
              timestamp: Date.now(),
              type: 'injection',
              severity: 'medium',
              confidence: 70,
              title: 'Suspicious URL Parameter',
              description: `Parameter ${key} contains suspicious content`,
              source,
              target: url,
              indicators: [`${key}=${value}`],
              mitigations: this.getDefaultMitigations('injection'),
              falsePositive: false,
              resolved: false
            });
          }
        }
      }
    } catch (error) {
      // Invalid URL
      threats.push({
        id: this.generateThreatId(),
        timestamp: Date.now(),
        type: 'suspicious_behavior',
        severity: 'low',
        confidence: 50,
        title: 'Invalid URL',
        description: 'URL format is invalid',
        source,
        target: url,
        indicators: [url],
        mitigations: this.getDefaultMitigations('suspicious_behavior'),
        falsePositive: false,
        resolved: false
      });
    }

    return threats;
  }

  /**
   * Analyze headers for threats
   * @param headers Headers to analyze
   * @param source Source of the headers
   * @returns Detected threats
   */
  private static async analyzeHeaders(headers: Record<string, string>, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];

    // Check for suspicious headers
    const suspiciousHeaders = [
      { key: 'user-agent', pattern: /bot|crawler|spider/i, type: 'suspicious_behavior' as Threat['type'], description: 'Suspicious User-Agent' },
      { key: 'referer', pattern: /phishing|malware/i, type: 'phishing' as Threat['type'], description: 'Suspicious Referer' },
      { key: 'x-forwarded-for', pattern: /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/, type: 'suspicious_behavior' as Threat['type'], description: 'Internal IP in header' }
    ];

    for (const { key, pattern, type, description } of suspiciousHeaders) {
      const value = headers[key.toLowerCase()];
      if (value && pattern.test(value)) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type,
          severity: 'medium',
          confidence: 65,
          title: `Suspicious Header: ${key}`,
          description,
          source,
          indicators: [`${key}: ${value}`],
          mitigations: this.getDefaultMitigations(type),
          falsePositive: false,
          resolved: false
        });
      }
    }

    return threats;
  }

  /**
   * Update behavior profile
   * @param action User action
   * @param details Action details
   * @param userId Optional user ID
   * @param sessionId Session ID
   */
  private static async updateBehaviorProfile(
    action: string,
    details: any,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    try {
      let profile = this.behaviorProfiles.get(sessionId);
      
      if (!profile) {
        // Create new profile
        profile = {
          userId,
          sessionId,
          baseline: {
            apiCalls: {},
            domains: {},
            actions: {},
            timeOfDay: [],
            dayOfWeek: []
          },
          current: {
            apiCalls: {},
            domains: {},
            actions: {},
            timeOfDay: [],
            dayOfWeek: []
          },
          anomalies: [],
          lastUpdated: Date.now()
        };
        this.behaviorProfiles.set(sessionId, profile);
      }

      // Update current behavior
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();

      profile.current.actions[action] = (profile.current.actions[action] || 0) + 1;
      profile.current.timeOfDay.push(hour);
      profile.current.dayOfWeek.push(day);

      // Update API calls if applicable
      if (details.api) {
        profile.current.apiCalls[details.api] = (profile.current.apiCalls[details.api] || 0) + 1;
      }

      // Update domains if applicable
      if (details.domain) {
        profile.current.domains[details.domain] = (profile.current.domains[details.domain] || 0) + 1;
      }

      profile.lastUpdated = Date.now();

      // Save to storage
      await this.saveBehaviorProfiles();
    } catch (error) {
      console.error('Failed to update behavior profile:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Detect anomalies in behavior
   * @param action User action
   * @param details Action details
   * @param userId Optional user ID
   * @param sessionId Session ID
   * @returns Detected threats
   */
  private static async detectAnomalies(
    action: string,
    details: any,
    userId?: string,
    sessionId?: string
  ): Promise<Threat[]> {
    const threats: Threat[] = [];

    if (!sessionId) {
      return threats;
    }

    try {
      const profile = this.behaviorProfiles.get(sessionId);
      if (!profile) {
        return threats;
      }

      // Check for unusual actions
      const actionCount = profile.current.actions[action] || 0;
      const baselineActionCount = profile.baseline.actions[action] || 0;
      
      if (baselineActionCount > 0 && actionCount > baselineActionCount * 5) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: 'suspicious_behavior',
          severity: 'medium',
          confidence: 70,
          title: 'Unusual Activity Pattern',
          description: `Action ${action} frequency is significantly higher than baseline`,
          source: 'behavior_analysis',
          indicators: [action],
          mitigations: this.getDefaultMitigations('suspicious_behavior'),
          falsePositive: false,
          resolved: false,
          metadata: {
            userId,
            sessionId,
            action,
            currentCount: actionCount,
            baselineCount: baselineActionCount
          }
        });
      }

      // Check for unusual time patterns
      const now = new Date();
      const hour = now.getHours();
      
      if (profile.baseline.timeOfDay.length > 0) {
        const avgHour = profile.baseline.timeOfDay.reduce((sum, h) => sum + h, 0) / profile.baseline.timeOfDay.length;
        const hourDiff = Math.abs(hour - avgHour);
        
        if (hourDiff > 8) { // More than 8 hours from average
          threats.push({
            id: this.generateThreatId(),
            timestamp: Date.now(),
            type: 'suspicious_behavior',
            severity: 'low',
            confidence: 60,
            title: 'Unusual Time Pattern',
            description: `Activity at unusual time: ${hour}:00`,
            source: 'behavior_analysis',
            indicators: [hour.toString()],
            mitigations: this.getDefaultMitigations('suspicious_behavior'),
            falsePositive: false,
            resolved: false,
            metadata: {
              userId,
              sessionId,
              currentHour: hour,
              averageHour: avgHour
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect anomalies:', error instanceof Error ? error.message : 'Unknown error');
    }

    return threats;
  }

  /**
   * Store threat
   * @param threat Threat to store
   */
  private static async storeThreat(threat: Threat): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const threats: Threat[] = result[this.STORAGE_KEY] || [];

      threats.push(threat);

      // Limit threats in storage
      if (threats.length > 1000) {
        threats.splice(0, threats.length - 1000);
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: threats });
    } catch (error) {
      console.error('Failed to store threat:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Check alert thresholds
   */
  private static async checkAlertThresholds(): Promise<void> {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const threats = await this.getThreats({
        startDate: oneHourAgo,
        endDate: now
      });

      const criticalThreats = threats.filter(threat => threat.severity === 'critical').length;
      const totalThreats = threats.length;

      // Check thresholds and create alert threats
      if (criticalThreats >= this.config.alertThresholds.criticalThreatsPerHour) {
        await this.storeThreat({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: 'suspicious_behavior',
          severity: 'high',
          confidence: 90,
          title: 'Critical Threat Threshold Exceeded',
          description: `${criticalThreats} critical threats detected in the last hour`,
          source: 'threat_detector',
          indicators: [criticalThreats.toString()],
          mitigations: ['Investigate all critical threats immediately', 'Consider implementing additional security measures'],
          falsePositive: false,
          resolved: false
        });
      }

      if (totalThreats >= this.config.alertThresholds.threatsPerHour) {
        await this.storeThreat({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: 'suspicious_behavior',
          severity: 'medium',
          confidence: 80,
          title: 'Threat Threshold Exceeded',
          description: `${totalThreats} threats detected in the last hour`,
          source: 'threat_detector',
          indicators: [totalThreats.toString()],
          mitigations: ['Review all detected threats', 'Consider adjusting security settings'],
          falsePositive: false,
          resolved: false
        });
      }
    } catch (error) {
      console.error('Failed to check alert thresholds:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Initialize default threat patterns
   */
  private static async initializeDefaultPatterns(): Promise<void> {
    try {
      const existingPatterns = await this.getPatterns();
      
      if (existingPatterns.length === 0) {
        const defaultPatterns: Omit<ThreatPattern, 'id' | 'created' | 'updated'>[] = [
          {
            name: 'Script Tag Detection',
            description: 'Detects script tags in content',
            type: 'xss',
            pattern: /<script[^>]*>.*?<\/script>/gi,
            severity: 'critical',
            confidence: 95,
            enabled: true
          },
          {
            name: 'SQL Injection Union',
            description: 'Detects SQL UNION injection attempts',
            type: 'injection',
            pattern: /union\s+select/gi,
            severity: 'high',
            confidence: 85,
            enabled: true
          },
          {
            name: 'Path Traversal',
            description: 'Detects path traversal attempts',
            type: 'data_exfiltration',
            pattern: /\.\.[\/\\]/g,
            severity: 'medium',
            confidence: 75,
            enabled: true
          },
          {
            name: 'Command Execution',
            description: 'Detects command execution attempts',
            type: 'privilege_escalation',
            pattern: /cmd\.exe|powershell|bash/gi,
            severity: 'critical',
            confidence: 90,
            enabled: true
          }
        ];

        for (const pattern of defaultPatterns) {
          await this.addPattern(pattern);
        }
      }
    } catch (error) {
      console.error('Failed to initialize default patterns:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get default mitigations for threat type
   * @param type Threat type
   * @returns Array of mitigations
   */
  private static getDefaultMitigations(type: Threat['type']): string[] {
    const mitigations: Record<Threat['type'], string[]> = {
      malware: ['Scan with antivirus', 'Isolate affected system', 'Update security software'],
      phishing: ['Block suspicious domain', 'Educate users', 'Implement email filtering'],
      xss: ['Sanitize input', 'Implement CSP', 'Use textContent instead of innerHTML'],
      injection: ['Use parameterized queries', 'Validate input', 'Implement WAF'],
      data_exfiltration: ['Monitor data transfers', 'Implement DLP', 'Restrict file access'],
      privilege_escalation: ['Review permissions', 'Implement principle of least privilege', 'Monitor admin activities'],
      suspicious_behavior: ['Investigate user activity', 'Review access logs', 'Consider temporary restrictions']
    };

    return mitigations[type] || ['Investigate further', 'Consult security team'];
  }

  /**
   * Generate recommendations based on threats
   * @param threats Array of threats
   * @returns Array of recommendations
   */
  private static generateRecommendations(threats: Threat[]): string[] {
    const recommendations: string[] = [];
    
    // Analyze threats and generate recommendations
    const threatsByType = new Map<Threat['type'], number>();
    const threatsBySeverity = new Map<Threat['severity'], number>();

    for (const threat of threats) {
      threatsByType.set(threat.type, (threatsByType.get(threat.type) || 0) + 1);
      threatsBySeverity.set(threat.severity, (threatsBySeverity.get(threat.severity) || 0) + 1);
    }

    // Type-specific recommendations
    if (threatsByType.get('xss') > 0) {
      recommendations.push('Multiple XSS threats detected - strengthen input validation and CSP policies');
    }

    if (threatsByType.get('injection') > 0) {
      recommendations.push('Injection threats detected - review and secure database queries');
    }

    if (threatsByType.get('phishing') > 0) {
      recommendations.push('Phishing threats detected - implement domain filtering and user education');
    }

    // Severity-specific recommendations
    if (threatsBySeverity.get('critical') > 0) {
      recommendations.push(`${threatsBySeverity.get('critical')} critical threats detected - immediate action required`);
    }

    if (threatsBySeverity.get('high') > 5) {
      recommendations.push('Multiple high-severity threats detected - review security measures');
    }

    // General recommendations
    const unresolvedThreats = threats.filter(threat => !threat.resolved).length;
    if (unresolvedThreats > 10) {
      recommendations.push('High number of unresolved threats - implement regular security reviews');
    }

    const falsePositives = threats.filter(threat => threat.falsePositive).length;
    if (falsePositives > threats.length * 0.3) {
      recommendations.push('High false positive rate - adjust threat detection parameters');
    }

    return recommendations;
  }

  /**
   * Load behavior profiles
   */
  private static async loadBehaviorProfiles(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.PROFILES_KEY]);
      const profiles: Record<string, BehaviorProfile> = result[this.PROFILES_KEY] || {};
      
      this.behaviorProfiles = new Map(Object.entries(profiles));
    } catch (error) {
      console.error('Failed to load behavior profiles:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save behavior profiles
   */
  private static async saveBehaviorProfiles(): Promise<void> {
    try {
      const profiles = Object.fromEntries(this.behaviorProfiles);
      await chrome.storage.local.set({ [this.PROFILES_KEY]: profiles });
    } catch (error) {
      console.error('Failed to save behavior profiles:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate threat ID
   * @returns Unique threat ID
   */
  private static generateThreatId(): string {
    return `thr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate pattern ID
   * @returns Unique pattern ID
   */
  private static generatePatternId(): string {
    return `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get threat detector configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<ThreatDetectorConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get threat detector config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update threat detector configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<ThreatDetectorConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });
    } catch (error) {
      console.error('Failed to update threat detector config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update threat detector config');
    }
  }
} * Threat Detector for Ray Chrome Extension
 * Provides advanced threat detection and analysis capabilities
 */

export interface Threat {
  id: string;
  timestamp: number;
  type: 'malware' | 'phishing' | 'xss' | 'injection' | 'data_exfiltration' | 'privilege_escalation' | 'suspicious_behavior';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  title: string;
  description: string;
  source: string;
  target?: string;
  indicators: string[];
  mitigations: string[];
  falsePositive: boolean;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  metadata?: Record<string, any>;
}

export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  type: Threat['type'];
  pattern: RegExp;
  severity: Threat['severity'];
  confidence: number;
  enabled: boolean;
  created: number;
  updated: number;
}

export interface ThreatDetectorConfig {
  enableDetection: boolean;
  enableBehaviorAnalysis: boolean;
  enableNetworkAnalysis: boolean;
  enableContentAnalysis: boolean;
  enableHeuristics: boolean;
  enableMachineLearning: boolean;
  threatThreshold: number;
  autoMitigation: boolean;
  alertThresholds: {
    threatsPerHour: number;
    criticalThreatsPerHour: number;
    confidenceThreshold: number;
  };
  customPatterns?: ThreatPattern[];
}

export interface BehaviorProfile {
  userId?: string;
  sessionId: string;
  baseline: {
    apiCalls: Record<string, number>;
    domains: Record<string, number>;
    actions: Record<string, number>;
    timeOfDay: number[];
    dayOfWeek: number[];
  };
  current: {
    apiCalls: Record<string, number>;
    domains: Record<string, number>;
    actions: Record<string, number>;
    timeOfDay: number[];
    dayOfWeek: number[];
  };
  anomalies: Array<{
    timestamp: number;
    type: string;
    description: string;
    score: number;
  }>;
  lastUpdated: number;
}

export class ThreatDetector {
  private static readonly DEFAULT_CONFIG: ThreatDetectorConfig = {
    enableDetection: true,
    enableBehaviorAnalysis: true,
    enableNetworkAnalysis: true,
    enableContentAnalysis: true,
    enableHeuristics: true,
    enableMachineLearning: false,
    threatThreshold: 50,
    autoMitigation: false,
    alertThresholds: {
      threatsPerHour: 10,
      criticalThreatsPerHour: 3,
      confidenceThreshold: 70
    }
  };

  private static readonly STORAGE_KEY = 'threats';
  private static readonly PATTERNS_KEY = 'threatPatterns';
  private static readonly PROFILES_KEY = 'behaviorProfiles';
  private static readonly CONFIG_KEY = 'threatDetectorConfig';
  
  private static config: ThreatDetectorConfig;
  private static behaviorProfiles: Map<string, BehaviorProfile> = new Map();
  private static isInitialized = false;

  /**
   * Initialize threat detector
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<ThreatDetectorConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Load behavior profiles
      await this.loadBehaviorProfiles();

      // Initialize default threat patterns
      await this.initializeDefaultPatterns();

      this.isInitialized = true;
      console.log('Threat Detector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Threat Detector:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Threat Detector initialization failed');
    }
  }

  /**
   * Analyze content for threats
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  static async analyzeContent(content: string, source: string): Promise<Threat[]> {
    if (!this.isInitialized || !this.config.enableDetection || !this.config.enableContentAnalysis) {
      return [];
    }

    const threats: Threat[] = [];

    try {
      // Pattern-based detection
      const patternThreats = await this.detectPatterns(content, source);
      threats.push(...patternThreats);

      // Heuristic analysis
      if (this.config.enableHeuristics) {
        const heuristicThreats = await this.heuristicAnalysis(content, source);
        threats.push(...heuristicThreats);
      }

      // Machine learning analysis
      if (this.config.enableMachineLearning) {
        const mlThreats = await this.machineLearningAnalysis(content, source);
        threats.push(...mlThreats);
      }

      // Store threats
      for (const threat of threats) {
        await this.storeThreat(threat);
      }

      // Check alert thresholds
      await this.checkAlertThresholds();

      return threats;
    } catch (error) {
      console.error('Failed to analyze content for threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Analyze network request for threats
   * @param url Request URL
   * @param method HTTP method
   * @param headers Request headers
   * @param body Request body
   * @returns Detected threats
   */
  static async analyzeNetworkRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<Threat[]> {
    if (!this.isInitialized || !this.config.enableDetection || !this.config.enableNetworkAnalysis) {
      return [];
    }

    const threats: Threat[] = [];

    try {
      // URL analysis
      const urlThreats = await this.analyzeURL(url, 'network_request');
      threats.push(...urlThreats);

      // Header analysis
      const headerThreats = await this.analyzeHeaders(headers, url);
      threats.push(...headerThreats);

      // Body analysis
      if (body) {
        const bodyThreats = await this.analyzeContent(body, url);
        threats.push(...bodyThreats);
      }

      // Store threats
      for (const threat of threats) {
        await this.storeThreat(threat);
      }

      return threats;
    } catch (error) {
      console.error('Failed to analyze network request for threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Analyze user behavior for threats
   * @param action User action
   * @param details Action details
   * @param userId Optional user ID
   * @param sessionId Session ID
   * @returns Detected threats
   */
  static async analyzeBehavior(
    action: string,
    details: any,
    userId?: string,
    sessionId?: string
  ): Promise<Threat[]> {
    if (!this.isInitialized || !this.config.enableDetection || !this.config.enableBehaviorAnalysis) {
      return [];
    }

    const threats: Threat[] = [];

    try {
      // Update behavior profile
      if (sessionId) {
        await this.updateBehaviorProfile(action, details, userId, sessionId);
      }

      // Anomaly detection
      const anomalies = await this.detectAnomalies(action, details, userId, sessionId);
      threats.push(...anomalies);

      // Store threats
      for (const threat of threats) {
        await this.storeThreat(threat);
      }

      return threats;
    } catch (error) {
      console.error('Failed to analyze behavior for threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get detected threats
   * @param filters Optional filters
   * @param limit Maximum number of threats to return
   * @returns Array of threats
   */
  static async getThreats(filters?: {
    type?: Threat['type'];
    severity?: Threat['severity'];
    resolved?: boolean;
    startDate?: number;
    endDate?: number;
    minConfidence?: number;
  }, limit?: number): Promise<Threat[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      let threats: Threat[] = result[this.STORAGE_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.type) {
          threats = threats.filter(threat => threat.type === filters.type);
        }
        if (filters.severity) {
          threats = threats.filter(threat => threat.severity === filters.severity);
        }
        if (filters.resolved !== undefined) {
          threats = threats.filter(threat => threat.resolved === filters.resolved);
        }
        if (filters.startDate) {
          threats = threats.filter(threat => threat.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          threats = threats.filter(threat => threat.timestamp <= filters.endDate!);
        }
        if (filters.minConfidence) {
          threats = threats.filter(threat => threat.confidence >= filters.minConfidence!);
        }
      }

      // Sort by timestamp (newest first)
      threats.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        threats = threats.slice(0, limit);
      }

      return threats;
    } catch (error) {
      console.error('Failed to get threats:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Resolve a threat
   * @param threatId The ID of the threat to resolve
   * @param resolvedBy Who resolved the threat
   * @param falsePositive Whether the threat was a false positive
   */
  static async resolveThreat(threatId: string, resolvedBy: string, falsePositive: boolean = false): Promise<void> {
    try {
      const threats = await this.getThreats();
      const threatIndex = threats.findIndex(threat => threat.id === threatId);
      
      if (threatIndex === -1) {
        throw new Error(`Threat with ID ${threatId} not found`);
      }

      threats[threatIndex].resolved = true;
      threats[threatIndex].resolvedAt = Date.now();
      threats[threatIndex].resolvedBy = resolvedBy;
      threats[threatIndex].falsePositive = falsePositive;

      await chrome.storage.local.set({ [this.STORAGE_KEY]: threats });
    } catch (error) {
      console.error('Failed to resolve threat:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to resolve threat');
    }
  }

  /**
   * Get threat patterns
   * @returns Array of threat patterns
   */
  static async getPatterns(): Promise<ThreatPattern[]> {
    try {
      const result = await chrome.storage.local.get([this.PATTERNS_KEY]);
      return result[this.PATTERNS_KEY] || [];
    } catch (error) {
      console.error('Failed to get threat patterns:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Add threat pattern
   * @param pattern The pattern to add
   */
  static async addPattern(pattern: Omit<ThreatPattern, 'id' | 'created' | 'updated'>): Promise<void> {
    try {
      const patterns = await this.getPatterns();
      const newPattern: ThreatPattern = {
        ...pattern,
        id: this.generatePatternId(),
        created: Date.now(),
        updated: Date.now()
      };

      patterns.push(newPattern);
      await chrome.storage.local.set({ [this.PATTERNS_KEY]: patterns });
    } catch (error) {
      console.error('Failed to add threat pattern:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to add threat pattern');
    }
  }

  /**
   * Generate threat report
   * @param days Number of days to include in report
   * @returns Threat report
   */
  static async generateReport(days: number = 7): Promise<{
    summary: {
      totalThreats: number;
      threatsByType: Record<string, number>;
      threatsBySeverity: Record<string, number>;
      unresolvedThreats: number;
      falsePositives: number;
      averageConfidence: number;
      topSources: Array<{ source: string; count: number }>;
    };
    trends: Array<{
      date: number;
      threats: number;
      critical: number;
      resolved: number;
    }>;
    recommendations: string[];
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (days * 24 * 60 * 60 * 1000);
      
      const threats = await this.getThreats({
        startDate,
        endDate: now
      });

      // Generate summary
      const threatsByType: Record<string, number> = {};
      const threatsBySeverity: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};
      let totalConfidence = 0;
      let unresolvedCount = 0;
      let falsePositiveCount = 0;

      for (const threat of threats) {
        // Count by type
        threatsByType[threat.type] = (threatsByType[threat.type] || 0) + 1;
        
        // Count by severity
        threatsBySeverity[threat.severity] = (threatsBySeverity[threat.severity] || 0) + 1;
        
        // Count by source
        sourceCounts[threat.source] = (sourceCounts[threat.source] || 0) + 1;
        
        // Accumulate confidence
        totalConfidence += threat.confidence;
        
        // Count unresolved
        if (!threat.resolved) {
          unresolvedCount++;
        }
        
        // Count false positives
        if (threat.falsePositive) {
          falsePositiveCount++;
        }
      }

      const topSources = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const summary = {
        totalThreats: threats.length,
        threatsByType,
        threatsBySeverity,
        unresolvedThreats: unresolvedCount,
        falsePositives: falsePositiveCount,
        averageConfidence: threats.length > 0 ? totalConfidence / threats.length : 0,
        topSources
      };

      // Generate trends
      const trendsMap = new Map<number, { threats: number; critical: number; resolved: number }>();
      for (const threat of threats) {
        const day = Math.floor(threat.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = trendsMap.get(day) || { threats: 0, critical: 0, resolved: 0 };
        trendsMap.set(day, {
          threats: existing.threats + 1,
          critical: existing.critical + (threat.severity === 'critical' ? 1 : 0),
          resolved: existing.resolved + (threat.resolved ? 1 : 0)
        });
      }

      const trends = Array.from(trendsMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date - b.date);

      // Generate recommendations
      const recommendations = this.generateRecommendations(threats);

      return {
        summary,
        trends,
        recommendations,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate threat report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate threat report');
    }
  }

  /**
   * Detect threats using patterns
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  private static async detectPatterns(content: string, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];
    const patterns = await this.getPatterns();

    for (const pattern of patterns) {
      if (!pattern.enabled) {
        continue;
      }

      const matches = content.match(pattern.pattern);
      if (matches) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: pattern.type,
          severity: pattern.severity,
          confidence: pattern.confidence,
          title: `${pattern.name} Detected`,
          description: pattern.description,
          source,
          indicators: matches.slice(0, 5), // Limit to 5 indicators
          mitigations: this.getDefaultMitigations(pattern.type),
          falsePositive: false,
          resolved: false,
          metadata: {
            patternId: pattern.id,
            matches: matches.length
          }
        });
      }
    }

    return threats;
  }

  /**
   * Perform heuristic analysis
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  private static async heuristicAnalysis(content: string, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];

    // Check for suspicious patterns
    const suspiciousPatterns = [
      { pattern: /eval\s*\(/gi, type: 'xss' as Threat['type'], severity: 'high' as Threat['severity'], description: 'Potential XSS via eval()' },
      { pattern: /document\.write\s*\(/gi, type: 'xss' as Threat['type'], severity: 'medium' as Threat['severity'], description: 'Potential XSS via document.write()' },
      { pattern: /innerHTML\s*=/gi, type: 'xss' as Threat['type'], severity: 'medium' as Threat['severity'], description: 'Potential XSS via innerHTML' },
      { pattern: /<script[^>]*>.*?<\/script>/gi, type: 'xss' as Threat['type'], severity: 'critical' as Threat['severity'], description: 'Script tag detected' },
      { pattern: /javascript:/gi, type: 'xss' as Threat['type'], severity: 'high' as Threat['severity'], description: 'JavaScript protocol detected' },
      { pattern: /union\s+select/gi, type: 'injection' as Threat['type'], severity: 'high' as Threat['severity'], description: 'Potential SQL injection' },
      { pattern: /drop\s+table/gi, type: 'injection' as Threat['type'], severity: 'critical' as Threat['severity'], description: 'Potential SQL injection' },
      { pattern: /\.\.[\/\\]/g, type: 'data_exfiltration' as Threat['type'], severity: 'medium' as Threat['severity'], description: 'Path traversal attempt' },
      { pattern: /etc\/passwd/gi, type: 'data_exfiltration' as Threat['type'], severity: 'high' as Threat['severity'], description: 'System file access attempt' },
      { pattern: /cmd\.exe|powershell|bash/gi, type: 'privilege_escalation' as Threat['type'], severity: 'critical' as Threat['severity'], description: 'Command execution attempt' }
    ];

    for (const { pattern, type, severity, description } of suspiciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type,
          severity,
          confidence: 75,
          title: `Heuristic Detection: ${type}`,
          description,
          source,
          indicators: matches.slice(0, 5),
          mitigations: this.getDefaultMitigations(type),
          falsePositive: false,
          resolved: false,
          metadata: {
            heuristic: true,
            matches: matches.length
          }
        });
      }
    }

    return threats;
  }

  /**
   * Perform machine learning analysis
   * @param content Content to analyze
   * @param source Source of the content
   * @returns Detected threats
   */
  private static async machineLearningAnalysis(content: string, source: string): Promise<Threat[]> {
    // This is a placeholder for machine learning analysis
    // In a real implementation, this would use a trained model
    return [];
  }

  /**
   * Analyze URL for threats
   * @param url URL to analyze
   * @param source Source of the URL
   * @returns Detected threats
   */
  private static async analyzeURL(url: string, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];

    try {
      const parsedURL = new URL(url);

      // Check for suspicious domains
      const suspiciousDomains = [
        /bit\.ly/i,
        /tinyurl\.com/i,
        /shortened/i,
        /phishing/i,
        /malware/i
      ];

      for (const pattern of suspiciousDomains) {
        if (pattern.test(parsedURL.hostname)) {
          threats.push({
            id: this.generateThreatId(),
            timestamp: Date.now(),
            type: 'phishing',
            severity: 'high',
            confidence: 80,
            title: 'Suspicious Domain Detected',
            description: `Domain ${parsedURL.hostname} matches suspicious pattern`,
            source,
            target: url,
            indicators: [parsedURL.hostname],
            mitigations: this.getDefaultMitigations('phishing'),
            falsePositive: false,
            resolved: false
          });
        }
      }

      // Check for suspicious parameters
      const suspiciousParams = [
        /cmd=/i,
        /exec=/i,
        /system=/i,
        /eval=/i,
        /redirect=/i
      ];

      for (const [key, value] of parsedURL.searchParams) {
        for (const pattern of suspiciousParams) {
          if (pattern.test(key) || pattern.test(value)) {
            threats.push({
              id: this.generateThreatId(),
              timestamp: Date.now(),
              type: 'injection',
              severity: 'medium',
              confidence: 70,
              title: 'Suspicious URL Parameter',
              description: `Parameter ${key} contains suspicious content`,
              source,
              target: url,
              indicators: [`${key}=${value}`],
              mitigations: this.getDefaultMitigations('injection'),
              falsePositive: false,
              resolved: false
            });
          }
        }
      }
    } catch (error) {
      // Invalid URL
      threats.push({
        id: this.generateThreatId(),
        timestamp: Date.now(),
        type: 'suspicious_behavior',
        severity: 'low',
        confidence: 50,
        title: 'Invalid URL',
        description: 'URL format is invalid',
        source,
        target: url,
        indicators: [url],
        mitigations: this.getDefaultMitigations('suspicious_behavior'),
        falsePositive: false,
        resolved: false
      });
    }

    return threats;
  }

  /**
   * Analyze headers for threats
   * @param headers Headers to analyze
   * @param source Source of the headers
   * @returns Detected threats
   */
  private static async analyzeHeaders(headers: Record<string, string>, source: string): Promise<Threat[]> {
    const threats: Threat[] = [];

    // Check for suspicious headers
    const suspiciousHeaders = [
      { key: 'user-agent', pattern: /bot|crawler|spider/i, type: 'suspicious_behavior' as Threat['type'], description: 'Suspicious User-Agent' },
      { key: 'referer', pattern: /phishing|malware/i, type: 'phishing' as Threat['type'], description: 'Suspicious Referer' },
      { key: 'x-forwarded-for', pattern: /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/, type: 'suspicious_behavior' as Threat['type'], description: 'Internal IP in header' }
    ];

    for (const { key, pattern, type, description } of suspiciousHeaders) {
      const value = headers[key.toLowerCase()];
      if (value && pattern.test(value)) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type,
          severity: 'medium',
          confidence: 65,
          title: `Suspicious Header: ${key}`,
          description,
          source,
          indicators: [`${key}: ${value}`],
          mitigations: this.getDefaultMitigations(type),
          falsePositive: false,
          resolved: false
        });
      }
    }

    return threats;
  }

  /**
   * Update behavior profile
   * @param action User action
   * @param details Action details
   * @param userId Optional user ID
   * @param sessionId Session ID
   */
  private static async updateBehaviorProfile(
    action: string,
    details: any,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    if (!sessionId) {
      return;
    }

    try {
      let profile = this.behaviorProfiles.get(sessionId);
      
      if (!profile) {
        // Create new profile
        profile = {
          userId,
          sessionId,
          baseline: {
            apiCalls: {},
            domains: {},
            actions: {},
            timeOfDay: [],
            dayOfWeek: []
          },
          current: {
            apiCalls: {},
            domains: {},
            actions: {},
            timeOfDay: [],
            dayOfWeek: []
          },
          anomalies: [],
          lastUpdated: Date.now()
        };
        this.behaviorProfiles.set(sessionId, profile);
      }

      // Update current behavior
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();

      profile.current.actions[action] = (profile.current.actions[action] || 0) + 1;
      profile.current.timeOfDay.push(hour);
      profile.current.dayOfWeek.push(day);

      // Update API calls if applicable
      if (details.api) {
        profile.current.apiCalls[details.api] = (profile.current.apiCalls[details.api] || 0) + 1;
      }

      // Update domains if applicable
      if (details.domain) {
        profile.current.domains[details.domain] = (profile.current.domains[details.domain] || 0) + 1;
      }

      profile.lastUpdated = Date.now();

      // Save to storage
      await this.saveBehaviorProfiles();
    } catch (error) {
      console.error('Failed to update behavior profile:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Detect anomalies in behavior
   * @param action User action
   * @param details Action details
   * @param userId Optional user ID
   * @param sessionId Session ID
   * @returns Detected threats
   */
  private static async detectAnomalies(
    action: string,
    details: any,
    userId?: string,
    sessionId?: string
  ): Promise<Threat[]> {
    const threats: Threat[] = [];

    if (!sessionId) {
      return threats;
    }

    try {
      const profile = this.behaviorProfiles.get(sessionId);
      if (!profile) {
        return threats;
      }

      // Check for unusual actions
      const actionCount = profile.current.actions[action] || 0;
      const baselineActionCount = profile.baseline.actions[action] || 0;
      
      if (baselineActionCount > 0 && actionCount > baselineActionCount * 5) {
        threats.push({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: 'suspicious_behavior',
          severity: 'medium',
          confidence: 70,
          title: 'Unusual Activity Pattern',
          description: `Action ${action} frequency is significantly higher than baseline`,
          source: 'behavior_analysis',
          indicators: [action],
          mitigations: this.getDefaultMitigations('suspicious_behavior'),
          falsePositive: false,
          resolved: false,
          metadata: {
            userId,
            sessionId,
            action,
            currentCount: actionCount,
            baselineCount: baselineActionCount
          }
        });
      }

      // Check for unusual time patterns
      const now = new Date();
      const hour = now.getHours();
      
      if (profile.baseline.timeOfDay.length > 0) {
        const avgHour = profile.baseline.timeOfDay.reduce((sum, h) => sum + h, 0) / profile.baseline.timeOfDay.length;
        const hourDiff = Math.abs(hour - avgHour);
        
        if (hourDiff > 8) { // More than 8 hours from average
          threats.push({
            id: this.generateThreatId(),
            timestamp: Date.now(),
            type: 'suspicious_behavior',
            severity: 'low',
            confidence: 60,
            title: 'Unusual Time Pattern',
            description: `Activity at unusual time: ${hour}:00`,
            source: 'behavior_analysis',
            indicators: [hour.toString()],
            mitigations: this.getDefaultMitigations('suspicious_behavior'),
            falsePositive: false,
            resolved: false,
            metadata: {
              userId,
              sessionId,
              currentHour: hour,
              averageHour: avgHour
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect anomalies:', error instanceof Error ? error.message : 'Unknown error');
    }

    return threats;
  }

  /**
   * Store threat
   * @param threat Threat to store
   */
  private static async storeThreat(threat: Threat): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const threats: Threat[] = result[this.STORAGE_KEY] || [];

      threats.push(threat);

      // Limit threats in storage
      if (threats.length > 1000) {
        threats.splice(0, threats.length - 1000);
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: threats });
    } catch (error) {
      console.error('Failed to store threat:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Check alert thresholds
   */
  private static async checkAlertThresholds(): Promise<void> {
    try {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const threats = await this.getThreats({
        startDate: oneHourAgo,
        endDate: now
      });

      const criticalThreats = threats.filter(threat => threat.severity === 'critical').length;
      const totalThreats = threats.length;

      // Check thresholds and create alert threats
      if (criticalThreats >= this.config.alertThresholds.criticalThreatsPerHour) {
        await this.storeThreat({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: 'suspicious_behavior',
          severity: 'high',
          confidence: 90,
          title: 'Critical Threat Threshold Exceeded',
          description: `${criticalThreats} critical threats detected in the last hour`,
          source: 'threat_detector',
          indicators: [criticalThreats.toString()],
          mitigations: ['Investigate all critical threats immediately', 'Consider implementing additional security measures'],
          falsePositive: false,
          resolved: false
        });
      }

      if (totalThreats >= this.config.alertThresholds.threatsPerHour) {
        await this.storeThreat({
          id: this.generateThreatId(),
          timestamp: Date.now(),
          type: 'suspicious_behavior',
          severity: 'medium',
          confidence: 80,
          title: 'Threat Threshold Exceeded',
          description: `${totalThreats} threats detected in the last hour`,
          source: 'threat_detector',
          indicators: [totalThreats.toString()],
          mitigations: ['Review all detected threats', 'Consider adjusting security settings'],
          falsePositive: false,
          resolved: false
        });
      }
    } catch (error) {
      console.error('Failed to check alert thresholds:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Initialize default threat patterns
   */
  private static async initializeDefaultPatterns(): Promise<void> {
    try {
      const existingPatterns = await this.getPatterns();
      
      if (existingPatterns.length === 0) {
        const defaultPatterns: Omit<ThreatPattern, 'id' | 'created' | 'updated'>[] = [
          {
            name: 'Script Tag Detection',
            description: 'Detects script tags in content',
            type: 'xss',
            pattern: /<script[^>]*>.*?<\/script>/gi,
            severity: 'critical',
            confidence: 95,
            enabled: true
          },
          {
            name: 'SQL Injection Union',
            description: 'Detects SQL UNION injection attempts',
            type: 'injection',
            pattern: /union\s+select/gi,
            severity: 'high',
            confidence: 85,
            enabled: true
          },
          {
            name: 'Path Traversal',
            description: 'Detects path traversal attempts',
            type: 'data_exfiltration',
            pattern: /\.\.[\/\\]/g,
            severity: 'medium',
            confidence: 75,
            enabled: true
          },
          {
            name: 'Command Execution',
            description: 'Detects command execution attempts',
            type: 'privilege_escalation',
            pattern: /cmd\.exe|powershell|bash/gi,
            severity: 'critical',
            confidence: 90,
            enabled: true
          }
        ];

        for (const pattern of defaultPatterns) {
          await this.addPattern(pattern);
        }
      }
    } catch (error) {
      console.error('Failed to initialize default patterns:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get default mitigations for threat type
   * @param type Threat type
   * @returns Array of mitigations
   */
  private static getDefaultMitigations(type: Threat['type']): string[] {
    const mitigations: Record<Threat['type'], string[]> = {
      malware: ['Scan with antivirus', 'Isolate affected system', 'Update security software'],
      phishing: ['Block suspicious domain', 'Educate users', 'Implement email filtering'],
      xss: ['Sanitize input', 'Implement CSP', 'Use textContent instead of innerHTML'],
      injection: ['Use parameterized queries', 'Validate input', 'Implement WAF'],
      data_exfiltration: ['Monitor data transfers', 'Implement DLP', 'Restrict file access'],
      privilege_escalation: ['Review permissions', 'Implement principle of least privilege', 'Monitor admin activities'],
      suspicious_behavior: ['Investigate user activity', 'Review access logs', 'Consider temporary restrictions']
    };

    return mitigations[type] || ['Investigate further', 'Consult security team'];
  }

  /**
   * Generate recommendations based on threats
   * @param threats Array of threats
   * @returns Array of recommendations
   */
  private static generateRecommendations(threats: Threat[]): string[] {
    const recommendations: string[] = [];
    
    // Analyze threats and generate recommendations
    const threatsByType = new Map<Threat['type'], number>();
    const threatsBySeverity = new Map<Threat['severity'], number>();

    for (const threat of threats) {
      threatsByType.set(threat.type, (threatsByType.get(threat.type) || 0) + 1);
      threatsBySeverity.set(threat.severity, (threatsBySeverity.get(threat.severity) || 0) + 1);
    }

    // Type-specific recommendations
    if (threatsByType.get('xss') > 0) {
      recommendations.push('Multiple XSS threats detected - strengthen input validation and CSP policies');
    }

    if (threatsByType.get('injection') > 0) {
      recommendations.push('Injection threats detected - review and secure database queries');
    }

    if (threatsByType.get('phishing') > 0) {
      recommendations.push('Phishing threats detected - implement domain filtering and user education');
    }

    // Severity-specific recommendations
    if (threatsBySeverity.get('critical') > 0) {
      recommendations.push(`${threatsBySeverity.get('critical')} critical threats detected - immediate action required`);
    }

    if (threatsBySeverity.get('high') > 5) {
      recommendations.push('Multiple high-severity threats detected - review security measures');
    }

    // General recommendations
    const unresolvedThreats = threats.filter(threat => !threat.resolved).length;
    if (unresolvedThreats > 10) {
      recommendations.push('High number of unresolved threats - implement regular security reviews');
    }

    const falsePositives = threats.filter(threat => threat.falsePositive).length;
    if (falsePositives > threats.length * 0.3) {
      recommendations.push('High false positive rate - adjust threat detection parameters');
    }

    return recommendations;
  }

  /**
   * Load behavior profiles
   */
  private static async loadBehaviorProfiles(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.PROFILES_KEY]);
      const profiles: Record<string, BehaviorProfile> = result[this.PROFILES_KEY] || {};
      
      this.behaviorProfiles = new Map(Object.entries(profiles));
    } catch (error) {
      console.error('Failed to load behavior profiles:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save behavior profiles
   */
  private static async saveBehaviorProfiles(): Promise<void> {
    try {
      const profiles = Object.fromEntries(this.behaviorProfiles);
      await chrome.storage.local.set({ [this.PROFILES_KEY]: profiles });
    } catch (error) {
      console.error('Failed to save behavior profiles:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate threat ID
   * @returns Unique threat ID
   */
  private static generateThreatId(): string {
    return `thr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate pattern ID
   * @returns Unique pattern ID
   */
  private static generatePatternId(): string {
    return `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get threat detector configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<ThreatDetectorConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get threat detector config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update threat detector configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<ThreatDetectorConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });
    } catch (error) {
      console.error('Failed to update threat detector config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update threat detector config');
    }
  }
}
