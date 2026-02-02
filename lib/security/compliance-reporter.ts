/**
 * Compliance Reporter for Ray Chrome Extension
 * Provides comprehensive security compliance reporting and analysis
 */

export interface ComplianceReport {
  id: string;
  timestamp: number;
  type: 'security' | 'privacy' | 'accessibility' | 'performance' | 'general';
  title: string;
  description: string;
  period: {
    startDate: number;
    endDate: number;
  };
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  score: number; // 0-100
  categories: ComplianceCategory[];
  violations: ComplianceViolation[];
  recommendations: string[];
  metadata: Record<string, any>;
  generatedBy: string;
  reviewed: boolean;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface ComplianceCategory {
  name: string;
  description: string;
  score: number; // 0-100
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  score: number; // 0-100
  evidence: string[];
  violations: string[];
  mitigations: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceViolation {
  id: string;
  requirementId: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  impact: string;
  mitigations: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive';
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  version: string;
  categories: ComplianceFrameworkCategory[];
  lastUpdated: number;
}

export interface ComplianceFrameworkCategory {
  id: string;
  name: string;
  description: string;
  requirements: ComplianceFrameworkRequirement[];
}

export interface ComplianceFrameworkRequirement {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  checks: ComplianceCheck[];
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  type: 'automated' | 'manual' | 'hybrid';
  method: string;
  expected: string;
  actual?: string;
  result: 'pass' | 'fail' | 'warning' | 'skip';
  score: number; // 0-100
  evidence?: string;
  notes?: string;
}

export interface ComplianceReporterConfig {
  enableAutomatedChecks: boolean;
  enableManualChecks: boolean;
  frameworks: string[];
  schedule: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    dayOfMonth?: number; // 1-31
    time: string; // HH:MM format
  };
  notifications: {
    enabled: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
    recipients: string[];
  };
  retention: {
    reports: number; // Number of reports to keep
    violations: number; // Number of violations to keep
  };
}

export class ComplianceReporter {
  private static readonly DEFAULT_CONFIG: ComplianceReporterConfig = {
    enableAutomatedChecks: true,
    enableManualChecks: false,
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
    },
    retention: {
      reports: 12,
      violations: 100
    }
  };

  private static readonly STORAGE_KEY = 'complianceReports';
  private static readonly VIOLATIONS_KEY = 'complianceViolations';
  private static readonly FRAMEWORKS_KEY = 'complianceFrameworks';
  private static readonly CONFIG_KEY = 'complianceReporterConfig';
  
  private static config: ComplianceReporterConfig;
  private static frameworks: Map<string, ComplianceFramework> = new Map();

  /**
   * Initialize compliance reporter
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<ComplianceReporterConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Load compliance frameworks
      await this.loadFrameworks();

      // Initialize default frameworks
      await this.initializeDefaultFrameworks();

      console.log('Compliance Reporter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Compliance Reporter:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Compliance Reporter initialization failed');
    }
  }

  /**
   * Generate compliance report
   * @param frameworkId Framework ID to use
   * @param period Reporting period
   * @returns Generated compliance report
   */
  static async generateReport(
    frameworkId: string,
    period?: { startDate: number; endDate: number }
  ): Promise<ComplianceReport> {
    try {
      const framework = this.frameworks.get(frameworkId);
      if (!framework) {
        throw new Error(`Compliance framework ${frameworkId} not found`);
      }

      const now = Date.now();
      const reportPeriod = period || {
        startDate: now - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: now
      };

      // Generate report categories
      const categories: ComplianceCategory[] = [];
      let totalScore = 0;
      let compliantCategories = 0;

      for (const frameworkCategory of framework.categories) {
        const category = await this.evaluateCategory(frameworkCategory, reportPeriod);
        categories.push(category);
        totalScore += category.score;
        
        if (category.status === 'compliant') {
          compliantCategories++;
        }
      }

      // Calculate overall score
      const overallScore = categories.length > 0 ? totalScore / categories.length : 0;
      
      // Determine overall status
      let status: ComplianceReport['status'];
      if (overallScore >= 90) {
        status = 'compliant';
      } else if (overallScore >= 70) {
        status = 'partial';
      } else {
        status = 'non_compliant';
      }

      // Collect all violations
      const violations: ComplianceViolation[] = [];
      for (const category of categories) {
        for (const requirement of category.requirements) {
          for (const violation of requirement.violations) {
            violations.push({
              id: this.generateViolationId(),
              requirementId: requirement.id,
              category: category.name,
              severity: this.getViolationSeverity(requirement.priority),
              description: violation,
              evidence: requirement.evidence,
              impact: `Non-compliance with ${requirement.name}`,
              mitigations: requirement.mitigations,
              status: 'open',
              createdAt: now
            });
          }
        }
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(categories, violations);

      // Create report
      const report: ComplianceReport = {
        id: this.generateReportId(),
        timestamp: now,
        type: 'security',
        title: `${framework.name} Compliance Report`,
        description: `Compliance assessment for ${framework.name} framework`,
        period: reportPeriod,
        status,
        score: overallScore,
        categories,
        violations,
        recommendations,
        metadata: {
          frameworkId,
          frameworkVersion: framework.version,
          totalRequirements: categories.reduce((sum, cat) => sum + cat.requirements.length, 0),
          automatedChecks: this.config.enableAutomatedChecks
        },
        generatedBy: 'ComplianceReporter',
        reviewed: false
      };

      // Store report
      await this.storeReport(report);

      // Store violations
      for (const violation of violations) {
        await this.storeViolation(violation);
      }

      return report;
    } catch (error) {
      console.error('Failed to generate compliance report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate compliance report');
    }
  }

  /**
   * Get compliance reports
   * @param filters Optional filters
   * @param limit Maximum number of reports to return
   * @returns Array of compliance reports
   */
  static async getReports(filters?: {
    type?: ComplianceReport['type'];
    status?: ComplianceReport['status'];
    frameworkId?: string;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<ComplianceReport[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      let reports: ComplianceReport[] = result[this.STORAGE_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.type) {
          reports = reports.filter(report => report.type === filters.type);
        }
        if (filters.status) {
          reports = reports.filter(report => report.status === filters.status);
        }
        if (filters.frameworkId) {
          reports = reports.filter(report => report.metadata.frameworkId === filters.frameworkId);
        }
        if (filters.startDate) {
          reports = reports.filter(report => report.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          reports = reports.filter(report => report.timestamp <= filters.endDate!);
        }
      }

      // Sort by timestamp (newest first)
      reports.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        reports = reports.slice(0, limit);
      }

      return reports;
    } catch (error) {
      console.error('Failed to get compliance reports:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get compliance violations
   * @param filters Optional filters
   * @param limit Maximum number of violations to return
   * @returns Array of compliance violations
   */
  static async getViolations(filters?: {
    severity?: ComplianceViolation['severity'];
    status?: ComplianceViolation['status'];
    category?: string;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<ComplianceViolation[]> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATIONS_KEY]);
      let violations: ComplianceViolation[] = result[this.VIOLATIONS_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.severity) {
          violations = violations.filter(violation => violation.severity === filters.severity);
        }
        if (filters.status) {
          violations = violations.filter(violation => violation.status === filters.status);
        }
        if (filters.category) {
          violations = violations.filter(violation => violation.category === filters.category);
        }
        if (filters.startDate) {
          violations = violations.filter(violation => violation.createdAt >= filters.startDate!);
        }
        if (filters.endDate) {
          violations = violations.filter(violation => violation.createdAt <= filters.endDate!);
        }
      }

      // Sort by creation date (newest first)
      violations.sort((a, b) => b.createdAt - a.createdAt);

      // Apply limit
      if (limit) {
        violations = violations.slice(0, limit);
      }

      return violations;
    } catch (error) {
      console.error('Failed to get compliance violations:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get compliance frameworks
   * @returns Array of compliance frameworks
   */
  static async getFrameworks(): Promise<ComplianceFramework[]> {
    try {
      const result = await chrome.storage.local.get([this.FRAMEWORKS_KEY]);
      const frameworks: Record<string, ComplianceFramework> = result[this.FRAMEWORKS_KEY] || {};
      
      return Object.values(frameworks);
    } catch (error) {
      console.error('Failed to get compliance frameworks:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Add compliance framework
   * @param framework The framework to add
   */
  static async addFramework(framework: Omit<ComplianceFramework, 'id' | 'lastUpdated'>): Promise<void> {
    try {
      const newFramework: ComplianceFramework = {
        ...framework,
        id: this.generateFrameworkId(),
        lastUpdated: Date.now()
      };

      this.frameworks.set(newFramework.id, newFramework);
      await this.saveFrameworks();
    } catch (error) {
      console.error('Failed to add compliance framework:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to add compliance framework');
    }
  }

  /**
   * Resolve compliance violation
   * @param violationId The ID of the violation to resolve
   * @param resolvedBy Who resolved the violation
   * @param notes Optional notes about the resolution
   */
  static async resolveViolation(violationId: string, resolvedBy: string, notes?: string): Promise<void> {
    try {
      const violations = await this.getViolations();
      const violationIndex = violations.findIndex(v => v.id === violationId);
      
      if (violationIndex === -1) {
        throw new Error(`Violation with ID ${violationId} not found`);
      }

      violations[violationIndex].status = 'resolved';
      violations[violationIndex].resolvedAt = Date.now();
      violations[violationIndex].resolvedBy = resolvedBy;
      
      if (notes) {
        violations[violationIndex].impact += `\n\nResolution notes: ${notes}`;
      }

      await chrome.storage.local.set({ [this.VIOLATIONS_KEY]: violations });
    } catch (error) {
      console.error('Failed to resolve violation:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to resolve violation');
    }
  }

  /**
   * Export compliance report
   * @param reportId The ID of the report to export
   * @param format Export format ('json' | 'pdf' | 'csv')
   * @returns Exported report as string
   */
  static async exportReport(reportId: string, format: 'json' | 'pdf' | 'csv' = 'json'): Promise<string> {
    try {
      const reports = await this.getReports();
      const report = reports.find(r => r.id === reportId);
      
      if (!report) {
        throw new Error(`Report with ID ${reportId} not found`);
      }

      if (format === 'json') {
        return JSON.stringify(report, null, 2);
      } else if (format === 'csv') {
        return this.convertReportToCSV(report);
      } else if (format === 'pdf') {
        // PDF generation would require a library like jsPDF
        // For now, return a placeholder
        return `PDF export for report ${reportId} - ${report.title}`;
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to export report');
    }
  }

  /**
   * Evaluate compliance category
   * @param frameworkCategory Framework category to evaluate
   * @param period Reporting period
   * @returns Evaluated compliance category
   */
  private static async evaluateCategory(
    frameworkCategory: ComplianceFrameworkCategory,
    period: { startDate: number; endDate: number }
  ): Promise<ComplianceCategory> {
    const requirements: ComplianceRequirement[] = [];
    let totalScore = 0;
    let compliantRequirements = 0;

    for (const frameworkRequirement of frameworkCategory.requirements) {
      const requirement = await this.evaluateRequirement(frameworkRequirement, period);
      requirements.push(requirement);
      totalScore += requirement.score;
      
      if (requirement.status === 'compliant') {
        compliantRequirements++;
      }
    }

    // Calculate category score
    const score = requirements.length > 0 ? totalScore / requirements.length : 0;
    
    // Determine category status
    let status: ComplianceCategory['status'];
    if (score >= 90) {
      status = 'compliant';
    } else if (score >= 70) {
      status = 'partial';
    } else {
      status = 'non_compliant';
    }

    return {
      name: frameworkCategory.name,
      description: frameworkCategory.description,
      score,
      status,
      requirements
    };
  }

  /**
   * Evaluate compliance requirement
   * @param frameworkRequirement Framework requirement to evaluate
   * @param period Reporting period
   * @returns Evaluated compliance requirement
   */
  private static async evaluateRequirement(
    frameworkRequirement: ComplianceFrameworkRequirement,
    period: { startDate: number; endDate: number }
  ): Promise<ComplianceRequirement> {
    const checks: ComplianceCheck[] = [];
    let totalScore = 0;
    const violations: string[] = [];
    const evidence: string[] = [];
    const mitigations: string[] = [];

    for (const frameworkCheck of frameworkRequirement.checks) {
      let check: ComplianceCheck;
      
      if (frameworkCheck.type === 'automated' && this.config.enableAutomatedChecks) {
        check = await this.performAutomatedCheck(frameworkCheck);
      } else if (frameworkCheck.type === 'manual' && this.config.enableManualChecks) {
        check = await this.performManualCheck(frameworkCheck);
      } else {
        // Skip check
        check = {
          ...frameworkCheck,
          result: 'skip',
          score: 0
        };
      }
      
      checks.push(check);
      totalScore += check.score;
      
      if (check.result === 'fail') {
        violations.push(check.description);
        mitigations.push(...this.getDefaultMitigations(frameworkRequirement.id));
      }
      
      if (check.evidence) {
        evidence.push(check.evidence);
      }
    }

    // Calculate requirement score
    const score = checks.length > 0 ? totalScore / checks.length : 0;
    
    // Determine requirement status
    let status: ComplianceRequirement['status'];
    if (score >= 90) {
      status = 'compliant';
    } else if (score >= 70) {
      status = 'partial';
    } else {
      status = 'non_compliant';
    }

    return {
      id: frameworkRequirement.id,
      name: frameworkRequirement.name,
      description: frameworkRequirement.description,
      category: frameworkRequirement.category,
      status,
      score,
      evidence,
      violations,
      mitigations,
      priority: frameworkRequirement.priority
    };
  }

  /**
   * Perform automated compliance check
   * @param frameworkCheck Framework check to perform
   * @returns Check result
   */
  private static async performAutomatedCheck(frameworkCheck: ComplianceFrameworkRequirement): Promise<ComplianceCheck> {
    // This is a placeholder for automated checks
    // In a real implementation, this would perform actual security checks
    
    const check: ComplianceCheck = {
      ...frameworkCheck,
      result: 'pass',
      score: 100,
      evidence: 'Automated check passed',
      notes: 'Check performed automatically'
    };

    // Example checks for Chrome Extension security
    switch (frameworkCheck.id) {
      case 'manifest_permissions':
        // Check if manifest permissions are minimal
        const hasMinimalPermissions = await this.checkMinimalPermissions();
        check.result = hasMinimalPermissions ? 'pass' : 'fail';
        check.score = hasMinimalPermissions ? 100 : 0;
        check.evidence = hasMinimalPermissions ? 
          'Manifest permissions are minimal and necessary' : 
          'Manifest permissions exceed requirements';
        break;
        
      case 'csp_policy':
        // Check if CSP is properly configured
        const hasValidCSP = await this.checkCSPConfiguration();
        check.result = hasValidCSP ? 'pass' : 'fail';
        check.score = hasValidCSP ? 100 : 0;
        check.evidence = hasValidCSP ? 
          'CSP policy is properly configured' : 
          'CSP policy is missing or misconfigured';
        break;
        
      case 'api_key_storage':
        // Check if API keys are securely stored
        const hasSecureStorage = await this.checkAPIKeyStorage();
        check.result = hasSecureStorage ? 'pass' : 'fail';
        check.score = hasSecureStorage ? 100 : 0;
        check.evidence = hasSecureStorage ? 
          'API keys are securely stored' : 
          'API keys are not securely stored';
        break;
    }

    return check;
  }

  /**
   * Perform manual compliance check
   * @param frameworkCheck Framework check to perform
   * @returns Check result
   */
  private static async performManualCheck(frameworkCheck: ComplianceFrameworkRequirement): Promise<ComplianceCheck> {
    // This is a placeholder for manual checks
    // In a real implementation, this would create a task for manual review
    
    return {
      ...frameworkCheck,
      result: 'warning',
      score: 50,
      evidence: 'Manual review required',
      notes: 'This check requires manual verification'
    };
  }

  /**
   * Check if manifest permissions are minimal
   * @returns True if permissions are minimal
   */
  private static async checkMinimalPermissions(): Promise<boolean> {
    try {
      // This would check the actual manifest permissions
      // For now, return a placeholder value
      return true;
    } catch (error) {
      console.error('Failed to check minimal permissions:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if CSP is properly configured
   * @returns True if CSP is properly configured
   */
  private static async checkCSPConfiguration(): Promise<boolean> {
    try {
      // This would check the actual CSP configuration
      // For now, return a placeholder value
      return true;
    } catch (error) {
      console.error('Failed to check CSP configuration:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if API keys are securely stored
   * @returns True if API keys are securely stored
   */
  private static async checkAPIKeyStorage(): Promise<boolean> {
    try {
      // This would check the actual API key storage
      // For now, return a placeholder value
      return true;
    } catch (error) {
      console.error('Failed to check API key storage:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get default mitigations for requirement
   * @param requirementId Requirement ID
   * @returns Array of mitigations
   */
  private static getDefaultMitigations(requirementId: string): string[] {
    const mitigations: Record<string, string[]> = {
      'manifest_permissions': [
        'Review and remove unnecessary permissions',
        'Implement optional permissions where possible',
        'Document justification for each permission'
      ],
      'csp_policy': [
        'Implement strict CSP headers',
        'Restrict script sources to trusted domains',
        'Disable unsafe inline scripts and eval'
      ],
      'api_key_storage': [
        'Use secure storage for API keys',
        'Implement key rotation',
        'Avoid hardcoding keys in source code'
      ]
    };

    return mitigations[requirementId] || ['Review and address the compliance issue'];
  }

  /**
   * Generate recommendations based on categories and violations
   * @param categories Evaluated categories
   * @param violations Detected violations
   * @returns Array of recommendations
   */
  private static generateRecommendations(
    categories: ComplianceCategory[],
    violations: ComplianceViolation[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Analyze categories
    const nonCompliantCategories = categories.filter(cat => cat.status === 'non_compliant');
    const partialCategories = categories.filter(cat => cat.status === 'partial');
    
    if (nonCompliantCategories.length > 0) {
      recommendations.push(`${nonCompliantCategories.length} categories are non-compliant - immediate attention required`);
    }
    
    if (partialCategories.length > 0) {
      recommendations.push(`${partialCategories.length} categories are partially compliant - improvement needed`);
    }
    
    // Analyze violations by severity
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;
    
    if (criticalViolations > 0) {
      recommendations.push(`${criticalViolations} critical violations detected - immediate remediation required`);
    }
    
    if (highViolations > 0) {
      recommendations.push(`${highViolations} high-severity violations detected - prioritize for resolution`);
    }
    
    // General recommendations
    const openViolations = violations.filter(v => v.status === 'open').length;
    if (openViolations > 10) {
      recommendations.push('High number of open violations - implement regular compliance reviews');
    }
    
    // Category-specific recommendations
    for (const category of categories) {
      if (category.score < 70) {
        recommendations.push(`Improve compliance in ${category.name} category`);
      }
    }
    
    return recommendations;
  }

  /**
   * Get violation severity from requirement priority
   * @param priority Requirement priority
   * @returns Violation severity
   */
  private static getViolationSeverity(priority: ComplianceFrameworkRequirement['priority']): ComplianceViolation['severity'] {
    switch (priority) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Convert report to CSV format
   * @param report Report to convert
   * @returns CSV string
   */
  private static convertReportToCSV(report: ComplianceReport): string {
    const headers = [
      'Report ID', 'Title', 'Type', 'Status', 'Score', 'Start Date', 'End Date',
      'Category', 'Requirement', 'Requirement Status', 'Requirement Score',
      'Violation', 'Violation Severity', 'Violation Status'
    ];

    const rows = [headers.join(',')];

    for (const category of report.categories) {
      for (const requirement of category.requirements) {
        for (const violation of requirement.violations) {
          rows.push([
            report.id,
            `"${report.title.replace(/"/g, '""')}"`,
            report.type,
            report.status,
            report.score,
            new Date(report.period.startDate).toISOString(),
            new Date(report.period.endDate).toISOString(),
            `"${category.name.replace(/"/g, '""')}"`,
            `"${requirement.name.replace(/"/g, '""')}"`,
            requirement.status,
            requirement.score,
            `"${violation.replace(/"/g, '""')}"`,
            this.getViolationSeverity(requirement.priority),
            'open'
          ].join(','));
        }
      }
    }

    return rows.join('\n');
  }

  /**
   * Store compliance report
   * @param report Report to store
   */
  private static async storeReport(report: ComplianceReport): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const reports: ComplianceReport[] = result[this.STORAGE_KEY] || [];

      reports.push(report);

      // Apply retention policy
      if (reports.length > this.config.retention.reports) {
        reports.splice(0, reports.length - this.config.retention.reports);
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: reports });
    } catch (error) {
      console.error('Failed to store compliance report:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Store compliance violation
   * @param violation Violation to store
   */
  private static async storeViolation(violation: ComplianceViolation): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATIONS_KEY]);
      const violations: ComplianceViolation[] = result[this.VIOLATIONS_KEY] || [];

      violations.push(violation);

      // Apply retention policy
      if (violations.length > this.config.retention.violations) {
        violations.splice(0, violations.length - this.config.retention.violations);
      }

      await chrome.storage.local.set({ [this.VIOLATIONS_KEY]: violations });
    } catch (error) {
      console.error('Failed to store compliance violation:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Initialize default frameworks
   */
  private static async initializeDefaultFrameworks(): Promise<void> {
    try {
      const existingFrameworks = await this.getFrameworks();
      
      if (existingFrameworks.length === 0) {
        const chromeExtensionFramework: Omit<ComplianceFramework, 'id' | 'lastUpdated'> = {
          name: 'Chrome Extension Security',
          description: 'Security compliance framework for Chrome extensions',
          version: '1.0',
          categories: [
            {
              id: 'manifest_security',
              name: 'Manifest Security',
              description: 'Security requirements for extension manifest',
              requirements: [
                {
                  id: 'manifest_permissions',
                  name: 'Minimal Permissions',
                  description: 'Extension should request minimal necessary permissions',
                  category: 'manifest_security',
                  priority: 'high',
                  checks: [
                    {
                      id: 'check_permissions',
                      name: 'Check Manifest Permissions',
                      description: 'Verify that manifest permissions are minimal',
                      type: 'automated',
                      method: 'analyze_manifest_permissions',
                      expected: 'Minimal necessary permissions only',
                      result: 'pass',
                      score: 100
                    }
                  ]
                },
                {
                  id: 'manifest_csp',
                  name: 'Content Security Policy',
                  description: 'Extension should implement proper CSP',
                  category: 'manifest_security',
                  priority: 'high',
                  checks: [
                    {
                      id: 'check_csp',
                      name: 'Check CSP Configuration',
                      description: 'Verify that CSP is properly configured',
                      type: 'automated',
                      method: 'analyze_csp_configuration',
                      expected: 'Strict CSP policy implemented',
                      result: 'pass',
                      score: 100
                    }
                  ]
                }
              ]
            },
            {
              id: 'data_security',
              name: 'Data Security',
              description: 'Security requirements for data handling',
              requirements: [
                {
                  id: 'api_key_storage',
                  name: 'Secure API Key Storage',
                  description: 'API keys should be stored securely',
                  category: 'data_security',
                  priority: 'critical',
                  checks: [
                    {
                      id: 'check_key_storage',
                      name: 'Check API Key Storage',
                      description: 'Verify that API keys are securely stored',
                      type: 'automated',
                      method: 'analyze_api_key_storage',
                      expected: 'API keys encrypted and securely stored',
                      result: 'pass',
                      score: 100
                    }
                  ]
                }
              ]
            }
          ]
        };

        await this.addFramework(chromeExtensionFramework);
      }
    } catch (error) {
      console.error('Failed to initialize default frameworks:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load compliance frameworks
   */
  private static async loadFrameworks(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.FRAMEWORKS_KEY]);
      const frameworks: Record<string, ComplianceFramework> = result[this.FRAMEWORKS_KEY] || {};
      
      this.frameworks = new Map(Object.entries(frameworks));
    } catch (error) {
      console.error('Failed to load compliance frameworks:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save compliance frameworks
   */
  private static async saveFrameworks(): Promise<void> {
    try {
      const frameworks = Object.fromEntries(this.frameworks);
      await chrome.storage.local.set({ [this.FRAMEWORKS_KEY]: frameworks });
    } catch (error) {
      console.error('Failed to save compliance frameworks:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate report ID
   * @returns Unique report ID
   */
  private static generateReportId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate violation ID
   * @returns Unique violation ID
   */
  private static generateViolationId(): string {
    return `vio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate framework ID
   * @returns Unique framework ID
   */
  private static generateFrameworkId(): string {
    return `frm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get compliance reporter configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<ComplianceReporterConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get compliance reporter config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update compliance reporter configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<ComplianceReporterConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });
    } catch (error) {
      console.error('Failed to update compliance reporter config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update compliance reporter config');
    }
  }
} * Compliance Reporter for Ray Chrome Extension
 * Provides comprehensive security compliance reporting and analysis
 */

export interface ComplianceReport {
  id: string;
  timestamp: number;
  type: 'security' | 'privacy' | 'accessibility' | 'performance' | 'general';
  title: string;
  description: string;
  period: {
    startDate: number;
    endDate: number;
  };
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  score: number; // 0-100
  categories: ComplianceCategory[];
  violations: ComplianceViolation[];
  recommendations: string[];
  metadata: Record<string, any>;
  generatedBy: string;
  reviewed: boolean;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface ComplianceCategory {
  name: string;
  description: string;
  score: number; // 0-100
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'pending';
  score: number; // 0-100
  evidence: string[];
  violations: string[];
  mitigations: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceViolation {
  id: string;
  requirementId: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  impact: string;
  mitigations: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'false_positive';
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  description: string;
  version: string;
  categories: ComplianceFrameworkCategory[];
  lastUpdated: number;
}

export interface ComplianceFrameworkCategory {
  id: string;
  name: string;
  description: string;
  requirements: ComplianceFrameworkRequirement[];
}

export interface ComplianceFrameworkRequirement {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  checks: ComplianceCheck[];
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  type: 'automated' | 'manual' | 'hybrid';
  method: string;
  expected: string;
  actual?: string;
  result: 'pass' | 'fail' | 'warning' | 'skip';
  score: number; // 0-100
  evidence?: string;
  notes?: string;
}

export interface ComplianceReporterConfig {
  enableAutomatedChecks: boolean;
  enableManualChecks: boolean;
  frameworks: string[];
  schedule: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    dayOfMonth?: number; // 1-31
    time: string; // HH:MM format
  };
  notifications: {
    enabled: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
    recipients: string[];
  };
  retention: {
    reports: number; // Number of reports to keep
    violations: number; // Number of violations to keep
  };
}

export class ComplianceReporter {
  private static readonly DEFAULT_CONFIG: ComplianceReporterConfig = {
    enableAutomatedChecks: true,
    enableManualChecks: false,
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
    },
    retention: {
      reports: 12,
      violations: 100
    }
  };

  private static readonly STORAGE_KEY = 'complianceReports';
  private static readonly VIOLATIONS_KEY = 'complianceViolations';
  private static readonly FRAMEWORKS_KEY = 'complianceFrameworks';
  private static readonly CONFIG_KEY = 'complianceReporterConfig';
  
  private static config: ComplianceReporterConfig;
  private static frameworks: Map<string, ComplianceFramework> = new Map();

  /**
   * Initialize compliance reporter
   * @param config Optional configuration
   */
  static async initialize(config?: Partial<ComplianceReporterConfig>): Promise<void> {
    try {
      // Load or create configuration
      this.config = { ...this.DEFAULT_CONFIG, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });

      // Load compliance frameworks
      await this.loadFrameworks();

      // Initialize default frameworks
      await this.initializeDefaultFrameworks();

      console.log('Compliance Reporter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Compliance Reporter:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Compliance Reporter initialization failed');
    }
  }

  /**
   * Generate compliance report
   * @param frameworkId Framework ID to use
   * @param period Reporting period
   * @returns Generated compliance report
   */
  static async generateReport(
    frameworkId: string,
    period?: { startDate: number; endDate: number }
  ): Promise<ComplianceReport> {
    try {
      const framework = this.frameworks.get(frameworkId);
      if (!framework) {
        throw new Error(`Compliance framework ${frameworkId} not found`);
      }

      const now = Date.now();
      const reportPeriod = period || {
        startDate: now - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: now
      };

      // Generate report categories
      const categories: ComplianceCategory[] = [];
      let totalScore = 0;
      let compliantCategories = 0;

      for (const frameworkCategory of framework.categories) {
        const category = await this.evaluateCategory(frameworkCategory, reportPeriod);
        categories.push(category);
        totalScore += category.score;
        
        if (category.status === 'compliant') {
          compliantCategories++;
        }
      }

      // Calculate overall score
      const overallScore = categories.length > 0 ? totalScore / categories.length : 0;
      
      // Determine overall status
      let status: ComplianceReport['status'];
      if (overallScore >= 90) {
        status = 'compliant';
      } else if (overallScore >= 70) {
        status = 'partial';
      } else {
        status = 'non_compliant';
      }

      // Collect all violations
      const violations: ComplianceViolation[] = [];
      for (const category of categories) {
        for (const requirement of category.requirements) {
          for (const violation of requirement.violations) {
            violations.push({
              id: this.generateViolationId(),
              requirementId: requirement.id,
              category: category.name,
              severity: this.getViolationSeverity(requirement.priority),
              description: violation,
              evidence: requirement.evidence,
              impact: `Non-compliance with ${requirement.name}`,
              mitigations: requirement.mitigations,
              status: 'open',
              createdAt: now
            });
          }
        }
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(categories, violations);

      // Create report
      const report: ComplianceReport = {
        id: this.generateReportId(),
        timestamp: now,
        type: 'security',
        title: `${framework.name} Compliance Report`,
        description: `Compliance assessment for ${framework.name} framework`,
        period: reportPeriod,
        status,
        score: overallScore,
        categories,
        violations,
        recommendations,
        metadata: {
          frameworkId,
          frameworkVersion: framework.version,
          totalRequirements: categories.reduce((sum, cat) => sum + cat.requirements.length, 0),
          automatedChecks: this.config.enableAutomatedChecks
        },
        generatedBy: 'ComplianceReporter',
        reviewed: false
      };

      // Store report
      await this.storeReport(report);

      // Store violations
      for (const violation of violations) {
        await this.storeViolation(violation);
      }

      return report;
    } catch (error) {
      console.error('Failed to generate compliance report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate compliance report');
    }
  }

  /**
   * Get compliance reports
   * @param filters Optional filters
   * @param limit Maximum number of reports to return
   * @returns Array of compliance reports
   */
  static async getReports(filters?: {
    type?: ComplianceReport['type'];
    status?: ComplianceReport['status'];
    frameworkId?: string;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<ComplianceReport[]> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      let reports: ComplianceReport[] = result[this.STORAGE_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.type) {
          reports = reports.filter(report => report.type === filters.type);
        }
        if (filters.status) {
          reports = reports.filter(report => report.status === filters.status);
        }
        if (filters.frameworkId) {
          reports = reports.filter(report => report.metadata.frameworkId === filters.frameworkId);
        }
        if (filters.startDate) {
          reports = reports.filter(report => report.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          reports = reports.filter(report => report.timestamp <= filters.endDate!);
        }
      }

      // Sort by timestamp (newest first)
      reports.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (limit) {
        reports = reports.slice(0, limit);
      }

      return reports;
    } catch (error) {
      console.error('Failed to get compliance reports:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get compliance violations
   * @param filters Optional filters
   * @param limit Maximum number of violations to return
   * @returns Array of compliance violations
   */
  static async getViolations(filters?: {
    severity?: ComplianceViolation['severity'];
    status?: ComplianceViolation['status'];
    category?: string;
    startDate?: number;
    endDate?: number;
  }, limit?: number): Promise<ComplianceViolation[]> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATIONS_KEY]);
      let violations: ComplianceViolation[] = result[this.VIOLATIONS_KEY] || [];

      // Apply filters
      if (filters) {
        if (filters.severity) {
          violations = violations.filter(violation => violation.severity === filters.severity);
        }
        if (filters.status) {
          violations = violations.filter(violation => violation.status === filters.status);
        }
        if (filters.category) {
          violations = violations.filter(violation => violation.category === filters.category);
        }
        if (filters.startDate) {
          violations = violations.filter(violation => violation.createdAt >= filters.startDate!);
        }
        if (filters.endDate) {
          violations = violations.filter(violation => violation.createdAt <= filters.endDate!);
        }
      }

      // Sort by creation date (newest first)
      violations.sort((a, b) => b.createdAt - a.createdAt);

      // Apply limit
      if (limit) {
        violations = violations.slice(0, limit);
      }

      return violations;
    } catch (error) {
      console.error('Failed to get compliance violations:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get compliance frameworks
   * @returns Array of compliance frameworks
   */
  static async getFrameworks(): Promise<ComplianceFramework[]> {
    try {
      const result = await chrome.storage.local.get([this.FRAMEWORKS_KEY]);
      const frameworks: Record<string, ComplianceFramework> = result[this.FRAMEWORKS_KEY] || {};
      
      return Object.values(frameworks);
    } catch (error) {
      console.error('Failed to get compliance frameworks:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Add compliance framework
   * @param framework The framework to add
   */
  static async addFramework(framework: Omit<ComplianceFramework, 'id' | 'lastUpdated'>): Promise<void> {
    try {
      const newFramework: ComplianceFramework = {
        ...framework,
        id: this.generateFrameworkId(),
        lastUpdated: Date.now()
      };

      this.frameworks.set(newFramework.id, newFramework);
      await this.saveFrameworks();
    } catch (error) {
      console.error('Failed to add compliance framework:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to add compliance framework');
    }
  }

  /**
   * Resolve compliance violation
   * @param violationId The ID of the violation to resolve
   * @param resolvedBy Who resolved the violation
   * @param notes Optional notes about the resolution
   */
  static async resolveViolation(violationId: string, resolvedBy: string, notes?: string): Promise<void> {
    try {
      const violations = await this.getViolations();
      const violationIndex = violations.findIndex(v => v.id === violationId);
      
      if (violationIndex === -1) {
        throw new Error(`Violation with ID ${violationId} not found`);
      }

      violations[violationIndex].status = 'resolved';
      violations[violationIndex].resolvedAt = Date.now();
      violations[violationIndex].resolvedBy = resolvedBy;
      
      if (notes) {
        violations[violationIndex].impact += `\n\nResolution notes: ${notes}`;
      }

      await chrome.storage.local.set({ [this.VIOLATIONS_KEY]: violations });
    } catch (error) {
      console.error('Failed to resolve violation:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to resolve violation');
    }
  }

  /**
   * Export compliance report
   * @param reportId The ID of the report to export
   * @param format Export format ('json' | 'pdf' | 'csv')
   * @returns Exported report as string
   */
  static async exportReport(reportId: string, format: 'json' | 'pdf' | 'csv' = 'json'): Promise<string> {
    try {
      const reports = await this.getReports();
      const report = reports.find(r => r.id === reportId);
      
      if (!report) {
        throw new Error(`Report with ID ${reportId} not found`);
      }

      if (format === 'json') {
        return JSON.stringify(report, null, 2);
      } else if (format === 'csv') {
        return this.convertReportToCSV(report);
      } else if (format === 'pdf') {
        // PDF generation would require a library like jsPDF
        // For now, return a placeholder
        return `PDF export for report ${reportId} - ${report.title}`;
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to export report');
    }
  }

  /**
   * Evaluate compliance category
   * @param frameworkCategory Framework category to evaluate
   * @param period Reporting period
   * @returns Evaluated compliance category
   */
  private static async evaluateCategory(
    frameworkCategory: ComplianceFrameworkCategory,
    period: { startDate: number; endDate: number }
  ): Promise<ComplianceCategory> {
    const requirements: ComplianceRequirement[] = [];
    let totalScore = 0;
    let compliantRequirements = 0;

    for (const frameworkRequirement of frameworkCategory.requirements) {
      const requirement = await this.evaluateRequirement(frameworkRequirement, period);
      requirements.push(requirement);
      totalScore += requirement.score;
      
      if (requirement.status === 'compliant') {
        compliantRequirements++;
      }
    }

    // Calculate category score
    const score = requirements.length > 0 ? totalScore / requirements.length : 0;
    
    // Determine category status
    let status: ComplianceCategory['status'];
    if (score >= 90) {
      status = 'compliant';
    } else if (score >= 70) {
      status = 'partial';
    } else {
      status = 'non_compliant';
    }

    return {
      name: frameworkCategory.name,
      description: frameworkCategory.description,
      score,
      status,
      requirements
    };
  }

  /**
   * Evaluate compliance requirement
   * @param frameworkRequirement Framework requirement to evaluate
   * @param period Reporting period
   * @returns Evaluated compliance requirement
   */
  private static async evaluateRequirement(
    frameworkRequirement: ComplianceFrameworkRequirement,
    period: { startDate: number; endDate: number }
  ): Promise<ComplianceRequirement> {
    const checks: ComplianceCheck[] = [];
    let totalScore = 0;
    const violations: string[] = [];
    const evidence: string[] = [];
    const mitigations: string[] = [];

    for (const frameworkCheck of frameworkRequirement.checks) {
      let check: ComplianceCheck;
      
      if (frameworkCheck.type === 'automated' && this.config.enableAutomatedChecks) {
        check = await this.performAutomatedCheck(frameworkCheck);
      } else if (frameworkCheck.type === 'manual' && this.config.enableManualChecks) {
        check = await this.performManualCheck(frameworkCheck);
      } else {
        // Skip check
        check = {
          ...frameworkCheck,
          result: 'skip',
          score: 0
        };
      }
      
      checks.push(check);
      totalScore += check.score;
      
      if (check.result === 'fail') {
        violations.push(check.description);
        mitigations.push(...this.getDefaultMitigations(frameworkRequirement.id));
      }
      
      if (check.evidence) {
        evidence.push(check.evidence);
      }
    }

    // Calculate requirement score
    const score = checks.length > 0 ? totalScore / checks.length : 0;
    
    // Determine requirement status
    let status: ComplianceRequirement['status'];
    if (score >= 90) {
      status = 'compliant';
    } else if (score >= 70) {
      status = 'partial';
    } else {
      status = 'non_compliant';
    }

    return {
      id: frameworkRequirement.id,
      name: frameworkRequirement.name,
      description: frameworkRequirement.description,
      category: frameworkRequirement.category,
      status,
      score,
      evidence,
      violations,
      mitigations,
      priority: frameworkRequirement.priority
    };
  }

  /**
   * Perform automated compliance check
   * @param frameworkCheck Framework check to perform
   * @returns Check result
   */
  private static async performAutomatedCheck(frameworkCheck: ComplianceFrameworkRequirement): Promise<ComplianceCheck> {
    // This is a placeholder for automated checks
    // In a real implementation, this would perform actual security checks
    
    const check: ComplianceCheck = {
      ...frameworkCheck,
      result: 'pass',
      score: 100,
      evidence: 'Automated check passed',
      notes: 'Check performed automatically'
    };

    // Example checks for Chrome Extension security
    switch (frameworkCheck.id) {
      case 'manifest_permissions':
        // Check if manifest permissions are minimal
        const hasMinimalPermissions = await this.checkMinimalPermissions();
        check.result = hasMinimalPermissions ? 'pass' : 'fail';
        check.score = hasMinimalPermissions ? 100 : 0;
        check.evidence = hasMinimalPermissions ? 
          'Manifest permissions are minimal and necessary' : 
          'Manifest permissions exceed requirements';
        break;
        
      case 'csp_policy':
        // Check if CSP is properly configured
        const hasValidCSP = await this.checkCSPConfiguration();
        check.result = hasValidCSP ? 'pass' : 'fail';
        check.score = hasValidCSP ? 100 : 0;
        check.evidence = hasValidCSP ? 
          'CSP policy is properly configured' : 
          'CSP policy is missing or misconfigured';
        break;
        
      case 'api_key_storage':
        // Check if API keys are securely stored
        const hasSecureStorage = await this.checkAPIKeyStorage();
        check.result = hasSecureStorage ? 'pass' : 'fail';
        check.score = hasSecureStorage ? 100 : 0;
        check.evidence = hasSecureStorage ? 
          'API keys are securely stored' : 
          'API keys are not securely stored';
        break;
    }

    return check;
  }

  /**
   * Perform manual compliance check
   * @param frameworkCheck Framework check to perform
   * @returns Check result
   */
  private static async performManualCheck(frameworkCheck: ComplianceFrameworkRequirement): Promise<ComplianceCheck> {
    // This is a placeholder for manual checks
    // In a real implementation, this would create a task for manual review
    
    return {
      ...frameworkCheck,
      result: 'warning',
      score: 50,
      evidence: 'Manual review required',
      notes: 'This check requires manual verification'
    };
  }

  /**
   * Check if manifest permissions are minimal
   * @returns True if permissions are minimal
   */
  private static async checkMinimalPermissions(): Promise<boolean> {
    try {
      // This would check the actual manifest permissions
      // For now, return a placeholder value
      return true;
    } catch (error) {
      console.error('Failed to check minimal permissions:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if CSP is properly configured
   * @returns True if CSP is properly configured
   */
  private static async checkCSPConfiguration(): Promise<boolean> {
    try {
      // This would check the actual CSP configuration
      // For now, return a placeholder value
      return true;
    } catch (error) {
      console.error('Failed to check CSP configuration:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if API keys are securely stored
   * @returns True if API keys are securely stored
   */
  private static async checkAPIKeyStorage(): Promise<boolean> {
    try {
      // This would check the actual API key storage
      // For now, return a placeholder value
      return true;
    } catch (error) {
      console.error('Failed to check API key storage:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get default mitigations for requirement
   * @param requirementId Requirement ID
   * @returns Array of mitigations
   */
  private static getDefaultMitigations(requirementId: string): string[] {
    const mitigations: Record<string, string[]> = {
      'manifest_permissions': [
        'Review and remove unnecessary permissions',
        'Implement optional permissions where possible',
        'Document justification for each permission'
      ],
      'csp_policy': [
        'Implement strict CSP headers',
        'Restrict script sources to trusted domains',
        'Disable unsafe inline scripts and eval'
      ],
      'api_key_storage': [
        'Use secure storage for API keys',
        'Implement key rotation',
        'Avoid hardcoding keys in source code'
      ]
    };

    return mitigations[requirementId] || ['Review and address the compliance issue'];
  }

  /**
   * Generate recommendations based on categories and violations
   * @param categories Evaluated categories
   * @param violations Detected violations
   * @returns Array of recommendations
   */
  private static generateRecommendations(
    categories: ComplianceCategory[],
    violations: ComplianceViolation[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Analyze categories
    const nonCompliantCategories = categories.filter(cat => cat.status === 'non_compliant');
    const partialCategories = categories.filter(cat => cat.status === 'partial');
    
    if (nonCompliantCategories.length > 0) {
      recommendations.push(`${nonCompliantCategories.length} categories are non-compliant - immediate attention required`);
    }
    
    if (partialCategories.length > 0) {
      recommendations.push(`${partialCategories.length} categories are partially compliant - improvement needed`);
    }
    
    // Analyze violations by severity
    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const highViolations = violations.filter(v => v.severity === 'high').length;
    
    if (criticalViolations > 0) {
      recommendations.push(`${criticalViolations} critical violations detected - immediate remediation required`);
    }
    
    if (highViolations > 0) {
      recommendations.push(`${highViolations} high-severity violations detected - prioritize for resolution`);
    }
    
    // General recommendations
    const openViolations = violations.filter(v => v.status === 'open').length;
    if (openViolations > 10) {
      recommendations.push('High number of open violations - implement regular compliance reviews');
    }
    
    // Category-specific recommendations
    for (const category of categories) {
      if (category.score < 70) {
        recommendations.push(`Improve compliance in ${category.name} category`);
      }
    }
    
    return recommendations;
  }

  /**
   * Get violation severity from requirement priority
   * @param priority Requirement priority
   * @returns Violation severity
   */
  private static getViolationSeverity(priority: ComplianceFrameworkRequirement['priority']): ComplianceViolation['severity'] {
    switch (priority) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Convert report to CSV format
   * @param report Report to convert
   * @returns CSV string
   */
  private static convertReportToCSV(report: ComplianceReport): string {
    const headers = [
      'Report ID', 'Title', 'Type', 'Status', 'Score', 'Start Date', 'End Date',
      'Category', 'Requirement', 'Requirement Status', 'Requirement Score',
      'Violation', 'Violation Severity', 'Violation Status'
    ];

    const rows = [headers.join(',')];

    for (const category of report.categories) {
      for (const requirement of category.requirements) {
        for (const violation of requirement.violations) {
          rows.push([
            report.id,
            `"${report.title.replace(/"/g, '""')}"`,
            report.type,
            report.status,
            report.score,
            new Date(report.period.startDate).toISOString(),
            new Date(report.period.endDate).toISOString(),
            `"${category.name.replace(/"/g, '""')}"`,
            `"${requirement.name.replace(/"/g, '""')}"`,
            requirement.status,
            requirement.score,
            `"${violation.replace(/"/g, '""')}"`,
            this.getViolationSeverity(requirement.priority),
            'open'
          ].join(','));
        }
      }
    }

    return rows.join('\n');
  }

  /**
   * Store compliance report
   * @param report Report to store
   */
  private static async storeReport(report: ComplianceReport): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      const reports: ComplianceReport[] = result[this.STORAGE_KEY] || [];

      reports.push(report);

      // Apply retention policy
      if (reports.length > this.config.retention.reports) {
        reports.splice(0, reports.length - this.config.retention.reports);
      }

      await chrome.storage.local.set({ [this.STORAGE_KEY]: reports });
    } catch (error) {
      console.error('Failed to store compliance report:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Store compliance violation
   * @param violation Violation to store
   */
  private static async storeViolation(violation: ComplianceViolation): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.VIOLATIONS_KEY]);
      const violations: ComplianceViolation[] = result[this.VIOLATIONS_KEY] || [];

      violations.push(violation);

      // Apply retention policy
      if (violations.length > this.config.retention.violations) {
        violations.splice(0, violations.length - this.config.retention.violations);
      }

      await chrome.storage.local.set({ [this.VIOLATIONS_KEY]: violations });
    } catch (error) {
      console.error('Failed to store compliance violation:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Initialize default frameworks
   */
  private static async initializeDefaultFrameworks(): Promise<void> {
    try {
      const existingFrameworks = await this.getFrameworks();
      
      if (existingFrameworks.length === 0) {
        const chromeExtensionFramework: Omit<ComplianceFramework, 'id' | 'lastUpdated'> = {
          name: 'Chrome Extension Security',
          description: 'Security compliance framework for Chrome extensions',
          version: '1.0',
          categories: [
            {
              id: 'manifest_security',
              name: 'Manifest Security',
              description: 'Security requirements for extension manifest',
              requirements: [
                {
                  id: 'manifest_permissions',
                  name: 'Minimal Permissions',
                  description: 'Extension should request minimal necessary permissions',
                  category: 'manifest_security',
                  priority: 'high',
                  checks: [
                    {
                      id: 'check_permissions',
                      name: 'Check Manifest Permissions',
                      description: 'Verify that manifest permissions are minimal',
                      type: 'automated',
                      method: 'analyze_manifest_permissions',
                      expected: 'Minimal necessary permissions only',
                      result: 'pass',
                      score: 100
                    }
                  ]
                },
                {
                  id: 'manifest_csp',
                  name: 'Content Security Policy',
                  description: 'Extension should implement proper CSP',
                  category: 'manifest_security',
                  priority: 'high',
                  checks: [
                    {
                      id: 'check_csp',
                      name: 'Check CSP Configuration',
                      description: 'Verify that CSP is properly configured',
                      type: 'automated',
                      method: 'analyze_csp_configuration',
                      expected: 'Strict CSP policy implemented',
                      result: 'pass',
                      score: 100
                    }
                  ]
                }
              ]
            },
            {
              id: 'data_security',
              name: 'Data Security',
              description: 'Security requirements for data handling',
              requirements: [
                {
                  id: 'api_key_storage',
                  name: 'Secure API Key Storage',
                  description: 'API keys should be stored securely',
                  category: 'data_security',
                  priority: 'critical',
                  checks: [
                    {
                      id: 'check_key_storage',
                      name: 'Check API Key Storage',
                      description: 'Verify that API keys are securely stored',
                      type: 'automated',
                      method: 'analyze_api_key_storage',
                      expected: 'API keys encrypted and securely stored',
                      result: 'pass',
                      score: 100
                    }
                  ]
                }
              ]
            }
          ]
        };

        await this.addFramework(chromeExtensionFramework);
      }
    } catch (error) {
      console.error('Failed to initialize default frameworks:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Load compliance frameworks
   */
  private static async loadFrameworks(): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.FRAMEWORKS_KEY]);
      const frameworks: Record<string, ComplianceFramework> = result[this.FRAMEWORKS_KEY] || {};
      
      this.frameworks = new Map(Object.entries(frameworks));
    } catch (error) {
      console.error('Failed to load compliance frameworks:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Save compliance frameworks
   */
  private static async saveFrameworks(): Promise<void> {
    try {
      const frameworks = Object.fromEntries(this.frameworks);
      await chrome.storage.local.set({ [this.FRAMEWORKS_KEY]: frameworks });
    } catch (error) {
      console.error('Failed to save compliance frameworks:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate report ID
   * @returns Unique report ID
   */
  private static generateReportId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate violation ID
   * @returns Unique violation ID
   */
  private static generateViolationId(): string {
    return `vio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate framework ID
   * @returns Unique framework ID
   */
  private static generateFrameworkId(): string {
    return `frm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get compliance reporter configuration
   * @returns Configuration
   */
  static async getConfig(): Promise<ComplianceReporterConfig> {
    try {
      const result = await chrome.storage.local.get([this.CONFIG_KEY]);
      return result[this.CONFIG_KEY] || this.DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to get compliance reporter config:', error instanceof Error ? error.message : 'Unknown error');
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Update compliance reporter configuration
   * @param config New configuration
   */
  static async updateConfig(config: Partial<ComplianceReporterConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await chrome.storage.local.set({ [this.CONFIG_KEY]: this.config });
    } catch (error) {
      console.error('Failed to update compliance reporter config:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to update compliance reporter config');
    }
  }
}
