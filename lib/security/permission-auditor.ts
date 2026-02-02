/**
 * Permission Auditing for Ray Chrome Extension
 * Handles permission usage monitoring and compliance auditing
 */

import { PermissionManager, PermissionAudit } from './permission-manager';

export interface PermissionUsageStats {
  permission: string;
  granted: boolean;
  requestedAt: number;
  grantedAt?: number;
  lastUsed?: number;
  usageCount: number;
  usageFrequency: number; // Uses per day
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface PermissionAuditReport {
  auditPeriod: {
    startDate: number;
    endDate: number;
  };
  totalPermissions: number;
  grantedPermissions: number;
  unusedPermissions: number;
  highRiskPermissions: number;
  usageStats: PermissionUsageStats[];
  complianceScore: number;
  recommendations: string[];
  lastAudited: number;
}

export interface PermissionTrend {
  permission: string;
  timeline: {
    date: number;
    granted: boolean;
    usageCount: number;
  }[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export class PermissionAuditor {
  private static readonly AUDIT_STORAGE_KEY = 'permissionAuditHistory';
  private static readonly MAX_AUDIT_ENTRIES = 50;

  /**
   * Perform comprehensive permission audit
   * @param daysToAnalyze Number of days to analyze for usage patterns
   * @returns Promise that resolves with audit report
   */
  static async performAudit(daysToAnalyze: number = 30): Promise<PermissionAuditReport> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const auditData = await PermissionManager.getPermissionAudit();
      const currentStatus = await PermissionManager.getCurrentStatus();
      
      // Generate usage statistics
      const usageStats = this.generateUsageStats(auditData, startDate, now);
      
      // Calculate metrics
      const totalPermissions = auditData.length;
      const grantedPermissions = auditData.filter(a => a.granted).length;
      const unusedPermissions = usageStats.filter(s => s.usageCount === 0).length;
      const highRiskPermissions = usageStats.filter(s => s.riskLevel === 'high').length;
      
      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(usageStats, grantedPermissions);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(usageStats, complianceScore);
      
      // Store audit snapshot
      await this.storeAuditSnapshot({
        auditPeriod: { startDate, endDate: now },
        totalPermissions,
        grantedPermissions,
        unusedPermissions,
        highRiskPermissions,
        usageStats,
        complianceScore,
        recommendations,
        lastAudited: now
      });

      return {
        auditPeriod: { startDate, endDate: now },
        totalPermissions,
        grantedPermissions,
        unusedPermissions,
        highRiskPermissions,
        usageStats,
        complianceScore,
        recommendations,
        lastAudited: now
      };
    } catch (error) {
      console.error('Permission audit failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to perform permission audit');
    }
  }

  /**
   * Get historical audit data
   * @param limit Maximum number of historical audits to retrieve
   * @returns Promise that resolves with historical audit reports
   */
  static async getAuditHistory(limit: number = 10): Promise<PermissionAuditReport[]> {
    try {
      const result = await chrome.storage.local.get([this.AUDIT_STORAGE_KEY]);
      const history: PermissionAuditReport[] = result[this.AUDIT_STORAGE_KEY] || [];
      
      // Return most recent audits
      return history.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get audit history:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Analyze permission usage trends over time
   * @param permission The permission to analyze
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with trend analysis
   */
  static async analyzePermissionTrend(permission: string, daysToAnalyze: number = 90): Promise<PermissionTrend | null> {
    try {
      const history = await this.getAuditHistory(Math.ceil(daysToAnalyze / 30));
      const auditData = await PermissionManager.getPermissionAudit();
      
      // Build timeline from historical data
      const timeline: PermissionTrend['timeline'] = [];
      
      // Add current data point
      const currentEntry = auditData.find(a => a.permission === permission);
      if (currentEntry) {
        timeline.push({
          date: Date.now(),
          granted: currentEntry.granted,
          usageCount: currentEntry.usageCount
        });
      }
      
      // Add historical data points
      for (const audit of history) {
        const stat = audit.usageStats.find(s => s.permission === permission);
        if (stat) {
          timeline.push({
            date: audit.lastAudited,
            granted: stat.granted,
            usageCount: stat.usageCount
          });
        }
      }
      
      // Sort by date
      timeline.sort((a, b) => a.date - b.date);
      
      if (timeline.length < 2) {
        return null;
      }
      
      // Calculate trend
      const trend = this.calculateTrend(timeline);
      
      return {
        permission,
        timeline,
        trend
      };
    } catch (error) {
      console.error('Failed to analyze permission trend:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Get permission risk assessment
   * @param permission The permission to assess
   * @returns Risk level and description
   */
  static getPermissionRisk(permission: string): { level: 'low' | 'medium' | 'high'; description: string } {
    const lowRiskPermissions = [
      'storage',
      'activeTab',
      'contextMenus'
    ];

    const mediumRiskPermissions = [
      'tabs',
      'scripting',
      'webNavigation',
      'webRequest',
      'cookies'
    ];

    const highRiskPermissions = [
      'nativeMessaging',
      'debugger',
      'pageCapture',
      'privacy',
      'processes',
      'background'
    ];

    if (lowRiskPermissions.includes(permission)) {
      return {
        level: 'low',
        description: 'Minimal security impact, commonly used permissions'
      };
    }

    if (mediumRiskPermissions.includes(permission)) {
      return {
        level: 'medium',
        description: 'Moderate security impact, requires careful implementation'
      };
    }

    if (highRiskPermissions.includes(permission)) {
      return {
        level: 'high',
        description: 'High security impact, requires strong justification and security measures'
      };
    }

    // Assess origin permissions
    if (permission.includes('http://') || permission.includes('https://')) {
      if (permission.includes('<all_urls>') || permission.includes('*://*/*')) {
        return {
          level: 'high',
          description: 'Broad host permissions - can access any website'
        };
      }
      return {
        level: 'medium',
        description: 'Specific host permissions - limited to specified domains'
      };
    }

    // Unknown permissions - assume high risk
    return {
      level: 'high',
      description: 'Unknown permission - requires security assessment'
    };
  }

  /**
   * Generate usage statistics for permissions
   * @param auditData Raw audit data
   * @param startDate Analysis start date
   * @param endDate Analysis end date
   * @returns Array of usage statistics
   */
  private static generateUsageStats(
    auditData: PermissionAudit[], 
    startDate: number, 
    endDate: number
  ): PermissionUsageStats[] {
    const daysInRange = (endDate - startDate) / (24 * 60 * 60 * 1000);
    
    return auditData.map(entry => {
      const risk = this.getPermissionRisk(entry.permission);
      
      // Calculate usage frequency (uses per day)
      const usageFrequency = daysInRange > 0 ? entry.usageCount / daysInRange : 0;
      
      // Generate recommendation based on usage and risk
      const recommendation = this.generatePermissionRecommendation(entry, risk, usageFrequency);
      
      return {
        permission: entry.permission,
        granted: entry.granted,
        requestedAt: entry.requestedAt,
        grantedAt: entry.grantedAt,
        lastUsed: entry.lastUsed,
        usageCount: entry.usageCount,
        usageFrequency,
        riskLevel: risk.level,
        recommendation
      };
    });
  }

  /**
   * Generate recommendation for a specific permission
   * @param entry Permission audit entry
   * @param risk Risk assessment
   * @param usageFrequency Usage frequency per day
   * @returns Recommendation string
   */
  private static generatePermissionRecommendation(
    entry: PermissionAudit, 
    risk: { level: string }, 
    usageFrequency: number
  ): string {
    // Unused permissions
    if (entry.usageCount === 0) {
      if (risk.level === 'high') {
        return 'REMOVE: High-risk permission that is not being used';
      }
      return 'Consider removing if not needed';
    }

    // Low usage high-risk permissions
    if (risk.level === 'high' && usageFrequency < 0.1) {
      return 'Review necessity: High-risk permission with minimal usage';
    }

    // High usage permissions
    if (usageFrequency > 10) {
      return 'Monitor: High usage permission - ensure proper security measures';
    }

    // Recently granted but unused
    if (entry.grantedAt && entry.usageCount === 0) {
      const daysSinceGranted = (Date.now() - entry.grantedAt) / (24 * 60 * 60 * 1000);
      if (daysSinceGranted > 7) {
        return 'Review: Permission granted but not used within a week';
      }
    }

    // Normal usage
    return 'Permission usage appears normal';
  }

  /**
   * Calculate compliance score based on permission usage and risk
   * @param usageStats Usage statistics
   * @param grantedCount Number of granted permissions
   * @returns Compliance score (0-100)
   */
  private static calculateComplianceScore(usageStats: PermissionUsageStats[], grantedCount: number): number {
    let score = 100;
    
    // Deduct points for unused permissions
    const unusedCount = usageStats.filter(s => s.usageCount === 0 && s.granted).length;
    score -= unusedCount * 10;
    
    // Deduct points for high-risk permissions
    const highRiskCount = usageStats.filter(s => s.riskLevel === 'high' && s.granted).length;
    score -= highRiskCount * 15;
    
    // Deduct points for excessive permissions
    if (grantedCount > 10) {
      score -= (grantedCount - 10) * 5;
    }
    
    // Bonus points for good practices
    const lowUsageHighRisk = usageStats.filter(s => s.riskLevel === 'high' && s.usageFrequency < 0.1).length;
    if (lowUsageHighRisk === 0) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate overall recommendations based on audit results
   * @param usageStats Usage statistics
   * @param complianceScore Compliance score
   * @returns Array of recommendations
   */
  private static generateRecommendations(usageStats: PermissionUsageStats[], complianceScore: number): string[] {
    const recommendations: string[] = [];
    
    // High-level recommendations based on compliance score
    if (complianceScore < 50) {
      recommendations.push('Critical: Review and reduce permissions immediately');
    } else if (complianceScore < 70) {
      recommendations.push('Warning: Permission configuration needs improvement');
    } else if (complianceScore < 90) {
      recommendations.push('Good: Consider minor permission optimizations');
    } else {
      recommendations.push('Excellent: Permission configuration is well-optimized');
    }
    
    // Specific recommendations based on usage patterns
    const unusedPermissions = usageStats.filter(s => s.usageCount === 0 && s.granted);
    if (unusedPermissions.length > 0) {
      recommendations.push(`Remove ${unusedPermissions.length} unused permissions`);
    }
    
    const highRiskUnused = usageStats.filter(s => s.riskLevel === 'high' && s.usageCount === 0);
    if (highRiskUnused.length > 0) {
      recommendations.push(`Priority: Remove ${highRiskUnused.length} unused high-risk permissions`);
    }
    
    const highUsage = usageStats.filter(s => s.usageFrequency > 10);
    if (highUsage.length > 0) {
      recommendations.push(`Monitor ${highUsage.length} high-usage permissions for security`);
    }
    
    // General recommendations
    recommendations.push('Regularly audit permission usage and necessity');
    recommendations.push('Document justification for all high-risk permissions');
    recommendations.push('Consider implementing permission request flows for optional features');
    
    return recommendations;
  }

  /**
   * Calculate trend from timeline data
   * @param timeline Timeline data points
   * @returns Trend direction
   */
  private static calculateTrend(timeline: PermissionTrend['timeline']): 'increasing' | 'decreasing' | 'stable' {
    if (timeline.length < 2) {
      return 'stable';
    }
    
    // Simple linear regression to determine trend
    const n = timeline.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = timeline[i].usageCount;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.1) {
      return 'stable';
    }
    
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Store audit snapshot for historical tracking
   * @param auditReport Audit report to store
   */
  private static async storeAuditSnapshot(auditReport: PermissionAuditReport): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.AUDIT_STORAGE_KEY]);
      const history: PermissionAuditReport[] = result[this.AUDIT_STORAGE_KEY] || [];
      
      history.push(auditReport);
      
      // Keep only the most recent entries
      if (history.length > this.MAX_AUDIT_ENTRIES) {
        history.splice(0, history.length - this.MAX_AUDIT_ENTRIES);
      }
      
      await chrome.storage.local.set({ [this.AUDIT_STORAGE_KEY]: history });
    } catch (error) {
      console.error('Failed to store audit snapshot:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Clear audit history
   * @returns Promise that resolves when history is cleared
   */
  static async clearAuditHistory(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.AUDIT_STORAGE_KEY]);
    } catch (error) {
      console.error('Failed to clear audit history:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear audit history');
    }
  }

  /**
   * Get permission usage summary for dashboard
   * @returns Promise that resolves with usage summary
   */
  static async getUsageSummary(): Promise<{
    totalPermissions: number;
    activePermissions: number;
    highRiskPermissions: number;
    lastAudit: number;
  }> {
    try {
      const auditData = await PermissionManager.getPermissionAudit();
      const history = await this.getAuditHistory(1);
      
      const totalPermissions = auditData.length;
      const activePermissions = auditData.filter(a => a.granted).length;
      const highRiskPermissions = auditData.filter(a => 
        this.getPermissionRisk(a.permission).level === 'high' && a.granted
      ).length;
      
      const lastAudit = history.length > 0 ? history[0].lastAudited : 0;
      
      return {
        totalPermissions,
        activePermissions,
        highRiskPermissions,
        lastAudit
      };
    } catch (error) {
      console.error('Failed to get usage summary:', error instanceof Error ? error.message : 'Unknown error');
      return {
        totalPermissions: 0,
        activePermissions: 0,
        highRiskPermissions: 0,
        lastAudit: 0
      };
    }
  }
} * Permission Auditing for Ray Chrome Extension
 * Handles permission usage monitoring and compliance auditing
 */

import { PermissionManager, PermissionAudit } from './permission-manager';

export interface PermissionUsageStats {
  permission: string;
  granted: boolean;
  requestedAt: number;
  grantedAt?: number;
  lastUsed?: number;
  usageCount: number;
  usageFrequency: number; // Uses per day
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface PermissionAuditReport {
  auditPeriod: {
    startDate: number;
    endDate: number;
  };
  totalPermissions: number;
  grantedPermissions: number;
  unusedPermissions: number;
  highRiskPermissions: number;
  usageStats: PermissionUsageStats[];
  complianceScore: number;
  recommendations: string[];
  lastAudited: number;
}

export interface PermissionTrend {
  permission: string;
  timeline: {
    date: number;
    granted: boolean;
    usageCount: number;
  }[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export class PermissionAuditor {
  private static readonly AUDIT_STORAGE_KEY = 'permissionAuditHistory';
  private static readonly MAX_AUDIT_ENTRIES = 50;

  /**
   * Perform comprehensive permission audit
   * @param daysToAnalyze Number of days to analyze for usage patterns
   * @returns Promise that resolves with audit report
   */
  static async performAudit(daysToAnalyze: number = 30): Promise<PermissionAuditReport> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const auditData = await PermissionManager.getPermissionAudit();
      const currentStatus = await PermissionManager.getCurrentStatus();
      
      // Generate usage statistics
      const usageStats = this.generateUsageStats(auditData, startDate, now);
      
      // Calculate metrics
      const totalPermissions = auditData.length;
      const grantedPermissions = auditData.filter(a => a.granted).length;
      const unusedPermissions = usageStats.filter(s => s.usageCount === 0).length;
      const highRiskPermissions = usageStats.filter(s => s.riskLevel === 'high').length;
      
      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(usageStats, grantedPermissions);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(usageStats, complianceScore);
      
      // Store audit snapshot
      await this.storeAuditSnapshot({
        auditPeriod: { startDate, endDate: now },
        totalPermissions,
        grantedPermissions,
        unusedPermissions,
        highRiskPermissions,
        usageStats,
        complianceScore,
        recommendations,
        lastAudited: now
      });

      return {
        auditPeriod: { startDate, endDate: now },
        totalPermissions,
        grantedPermissions,
        unusedPermissions,
        highRiskPermissions,
        usageStats,
        complianceScore,
        recommendations,
        lastAudited: now
      };
    } catch (error) {
      console.error('Permission audit failed:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to perform permission audit');
    }
  }

  /**
   * Get historical audit data
   * @param limit Maximum number of historical audits to retrieve
   * @returns Promise that resolves with historical audit reports
   */
  static async getAuditHistory(limit: number = 10): Promise<PermissionAuditReport[]> {
    try {
      const result = await chrome.storage.local.get([this.AUDIT_STORAGE_KEY]);
      const history: PermissionAuditReport[] = result[this.AUDIT_STORAGE_KEY] || [];
      
      // Return most recent audits
      return history.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get audit history:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Analyze permission usage trends over time
   * @param permission The permission to analyze
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with trend analysis
   */
  static async analyzePermissionTrend(permission: string, daysToAnalyze: number = 90): Promise<PermissionTrend | null> {
    try {
      const history = await this.getAuditHistory(Math.ceil(daysToAnalyze / 30));
      const auditData = await PermissionManager.getPermissionAudit();
      
      // Build timeline from historical data
      const timeline: PermissionTrend['timeline'] = [];
      
      // Add current data point
      const currentEntry = auditData.find(a => a.permission === permission);
      if (currentEntry) {
        timeline.push({
          date: Date.now(),
          granted: currentEntry.granted,
          usageCount: currentEntry.usageCount
        });
      }
      
      // Add historical data points
      for (const audit of history) {
        const stat = audit.usageStats.find(s => s.permission === permission);
        if (stat) {
          timeline.push({
            date: audit.lastAudited,
            granted: stat.granted,
            usageCount: stat.usageCount
          });
        }
      }
      
      // Sort by date
      timeline.sort((a, b) => a.date - b.date);
      
      if (timeline.length < 2) {
        return null;
      }
      
      // Calculate trend
      const trend = this.calculateTrend(timeline);
      
      return {
        permission,
        timeline,
        trend
      };
    } catch (error) {
      console.error('Failed to analyze permission trend:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Get permission risk assessment
   * @param permission The permission to assess
   * @returns Risk level and description
   */
  static getPermissionRisk(permission: string): { level: 'low' | 'medium' | 'high'; description: string } {
    const lowRiskPermissions = [
      'storage',
      'activeTab',
      'contextMenus'
    ];

    const mediumRiskPermissions = [
      'tabs',
      'scripting',
      'webNavigation',
      'webRequest',
      'cookies'
    ];

    const highRiskPermissions = [
      'nativeMessaging',
      'debugger',
      'pageCapture',
      'privacy',
      'processes',
      'background'
    ];

    if (lowRiskPermissions.includes(permission)) {
      return {
        level: 'low',
        description: 'Minimal security impact, commonly used permissions'
      };
    }

    if (mediumRiskPermissions.includes(permission)) {
      return {
        level: 'medium',
        description: 'Moderate security impact, requires careful implementation'
      };
    }

    if (highRiskPermissions.includes(permission)) {
      return {
        level: 'high',
        description: 'High security impact, requires strong justification and security measures'
      };
    }

    // Assess origin permissions
    if (permission.includes('http://') || permission.includes('https://')) {
      if (permission.includes('<all_urls>') || permission.includes('*://*/*')) {
        return {
          level: 'high',
          description: 'Broad host permissions - can access any website'
        };
      }
      return {
        level: 'medium',
        description: 'Specific host permissions - limited to specified domains'
      };
    }

    // Unknown permissions - assume high risk
    return {
      level: 'high',
      description: 'Unknown permission - requires security assessment'
    };
  }

  /**
   * Generate usage statistics for permissions
   * @param auditData Raw audit data
   * @param startDate Analysis start date
   * @param endDate Analysis end date
   * @returns Array of usage statistics
   */
  private static generateUsageStats(
    auditData: PermissionAudit[], 
    startDate: number, 
    endDate: number
  ): PermissionUsageStats[] {
    const daysInRange = (endDate - startDate) / (24 * 60 * 60 * 1000);
    
    return auditData.map(entry => {
      const risk = this.getPermissionRisk(entry.permission);
      
      // Calculate usage frequency (uses per day)
      const usageFrequency = daysInRange > 0 ? entry.usageCount / daysInRange : 0;
      
      // Generate recommendation based on usage and risk
      const recommendation = this.generatePermissionRecommendation(entry, risk, usageFrequency);
      
      return {
        permission: entry.permission,
        granted: entry.granted,
        requestedAt: entry.requestedAt,
        grantedAt: entry.grantedAt,
        lastUsed: entry.lastUsed,
        usageCount: entry.usageCount,
        usageFrequency,
        riskLevel: risk.level,
        recommendation
      };
    });
  }

  /**
   * Generate recommendation for a specific permission
   * @param entry Permission audit entry
   * @param risk Risk assessment
   * @param usageFrequency Usage frequency per day
   * @returns Recommendation string
   */
  private static generatePermissionRecommendation(
    entry: PermissionAudit, 
    risk: { level: string }, 
    usageFrequency: number
  ): string {
    // Unused permissions
    if (entry.usageCount === 0) {
      if (risk.level === 'high') {
        return 'REMOVE: High-risk permission that is not being used';
      }
      return 'Consider removing if not needed';
    }

    // Low usage high-risk permissions
    if (risk.level === 'high' && usageFrequency < 0.1) {
      return 'Review necessity: High-risk permission with minimal usage';
    }

    // High usage permissions
    if (usageFrequency > 10) {
      return 'Monitor: High usage permission - ensure proper security measures';
    }

    // Recently granted but unused
    if (entry.grantedAt && entry.usageCount === 0) {
      const daysSinceGranted = (Date.now() - entry.grantedAt) / (24 * 60 * 60 * 1000);
      if (daysSinceGranted > 7) {
        return 'Review: Permission granted but not used within a week';
      }
    }

    // Normal usage
    return 'Permission usage appears normal';
  }

  /**
   * Calculate compliance score based on permission usage and risk
   * @param usageStats Usage statistics
   * @param grantedCount Number of granted permissions
   * @returns Compliance score (0-100)
   */
  private static calculateComplianceScore(usageStats: PermissionUsageStats[], grantedCount: number): number {
    let score = 100;
    
    // Deduct points for unused permissions
    const unusedCount = usageStats.filter(s => s.usageCount === 0 && s.granted).length;
    score -= unusedCount * 10;
    
    // Deduct points for high-risk permissions
    const highRiskCount = usageStats.filter(s => s.riskLevel === 'high' && s.granted).length;
    score -= highRiskCount * 15;
    
    // Deduct points for excessive permissions
    if (grantedCount > 10) {
      score -= (grantedCount - 10) * 5;
    }
    
    // Bonus points for good practices
    const lowUsageHighRisk = usageStats.filter(s => s.riskLevel === 'high' && s.usageFrequency < 0.1).length;
    if (lowUsageHighRisk === 0) {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate overall recommendations based on audit results
   * @param usageStats Usage statistics
   * @param complianceScore Compliance score
   * @returns Array of recommendations
   */
  private static generateRecommendations(usageStats: PermissionUsageStats[], complianceScore: number): string[] {
    const recommendations: string[] = [];
    
    // High-level recommendations based on compliance score
    if (complianceScore < 50) {
      recommendations.push('Critical: Review and reduce permissions immediately');
    } else if (complianceScore < 70) {
      recommendations.push('Warning: Permission configuration needs improvement');
    } else if (complianceScore < 90) {
      recommendations.push('Good: Consider minor permission optimizations');
    } else {
      recommendations.push('Excellent: Permission configuration is well-optimized');
    }
    
    // Specific recommendations based on usage patterns
    const unusedPermissions = usageStats.filter(s => s.usageCount === 0 && s.granted);
    if (unusedPermissions.length > 0) {
      recommendations.push(`Remove ${unusedPermissions.length} unused permissions`);
    }
    
    const highRiskUnused = usageStats.filter(s => s.riskLevel === 'high' && s.usageCount === 0);
    if (highRiskUnused.length > 0) {
      recommendations.push(`Priority: Remove ${highRiskUnused.length} unused high-risk permissions`);
    }
    
    const highUsage = usageStats.filter(s => s.usageFrequency > 10);
    if (highUsage.length > 0) {
      recommendations.push(`Monitor ${highUsage.length} high-usage permissions for security`);
    }
    
    // General recommendations
    recommendations.push('Regularly audit permission usage and necessity');
    recommendations.push('Document justification for all high-risk permissions');
    recommendations.push('Consider implementing permission request flows for optional features');
    
    return recommendations;
  }

  /**
   * Calculate trend from timeline data
   * @param timeline Timeline data points
   * @returns Trend direction
   */
  private static calculateTrend(timeline: PermissionTrend['timeline']): 'increasing' | 'decreasing' | 'stable' {
    if (timeline.length < 2) {
      return 'stable';
    }
    
    // Simple linear regression to determine trend
    const n = timeline.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      const x = i;
      const y = timeline[i].usageCount;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.1) {
      return 'stable';
    }
    
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Store audit snapshot for historical tracking
   * @param auditReport Audit report to store
   */
  private static async storeAuditSnapshot(auditReport: PermissionAuditReport): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.AUDIT_STORAGE_KEY]);
      const history: PermissionAuditReport[] = result[this.AUDIT_STORAGE_KEY] || [];
      
      history.push(auditReport);
      
      // Keep only the most recent entries
      if (history.length > this.MAX_AUDIT_ENTRIES) {
        history.splice(0, history.length - this.MAX_AUDIT_ENTRIES);
      }
      
      await chrome.storage.local.set({ [this.AUDIT_STORAGE_KEY]: history });
    } catch (error) {
      console.error('Failed to store audit snapshot:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Clear audit history
   * @returns Promise that resolves when history is cleared
   */
  static async clearAuditHistory(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.AUDIT_STORAGE_KEY]);
    } catch (error) {
      console.error('Failed to clear audit history:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear audit history');
    }
  }

  /**
   * Get permission usage summary for dashboard
   * @returns Promise that resolves with usage summary
   */
  static async getUsageSummary(): Promise<{
    totalPermissions: number;
    activePermissions: number;
    highRiskPermissions: number;
    lastAudit: number;
  }> {
    try {
      const auditData = await PermissionManager.getPermissionAudit();
      const history = await this.getAuditHistory(1);
      
      const totalPermissions = auditData.length;
      const activePermissions = auditData.filter(a => a.granted).length;
      const highRiskPermissions = auditData.filter(a => 
        this.getPermissionRisk(a.permission).level === 'high' && a.granted
      ).length;
      
      const lastAudit = history.length > 0 ? history[0].lastAudited : 0;
      
      return {
        totalPermissions,
        activePermissions,
        highRiskPermissions,
        lastAudit
      };
    } catch (error) {
      console.error('Failed to get usage summary:', error instanceof Error ? error.message : 'Unknown error');
      return {
        totalPermissions: 0,
        activePermissions: 0,
        highRiskPermissions: 0,
        lastAudit: 0
      };
    }
  }
}
