#!/usr/bin/env node

/**
 * Security Vulnerability Scanning Script
 * Runs security tests and vulnerability scans for Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  outputDirectory: 'test/reports',
  securityDirectory: 'test/reports/security',
  testPattern: 'test/security/*.test.js',
  sourceDirectory: 'src',
  vulnerabilityThresholds: {
    high: 0, // No high vulnerabilities allowed
    medium: 2, // Max 2 medium vulnerabilities
    low: 5, // Max 5 low vulnerabilities
    info: 10 // Max 10 info vulnerabilities
  },
  securityChecks: {
    dependencyAudit: true,
    codeAnalysis: true,
    permissionAnalysis: true,
    manifestValidation: true,
    contentSecurityPolicy: true
  },
  reportFormats: ['json', 'html'],
  historyFile: 'test/reports/security/security-history.json'
};

/**
 * Ensure output directories exist
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.outputDirectory,
    CONFIG.securityDirectory
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Run security tests
 */
function runSecurityTests() {
  console.log('🔒 Running security tests...');
  
  const jestConfig = {
    testMatch: [CONFIG.testPattern],
    testTimeout: 30000, // 30 seconds per test
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    reporters: ['default', 'jest-json-reporter']
  };
  
  const configPath = path.join(CONFIG.securityDirectory, 'jest-security.config.json');
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    const command = `npx jest --config ${configPath} --json --outputFile=${path.join(CONFIG.securityDirectory, 'security-test-results.json')}`;
    console.log(`Executing: ${command}`);
    
    execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    
    console.log('✅ Security tests completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Security tests failed:', error.message);
    return false;
  } finally {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Run dependency vulnerability audit
 */
function runDependencyAudit() {
  console.log('🔍 Running dependency vulnerability audit...');
  
  try {
    // Run npm audit
    const auditCommand = 'npm audit --json';
    console.log(`Executing: ${auditCommand}`);
    
    const auditOutput = execSync(auditCommand, {
      encoding: 'utf8',
      timeout: 60000 // 1 minute
    });
    
    const auditData = JSON.parse(auditOutput);
    
    // Save audit results
    const auditPath = path.join(CONFIG.securityDirectory, 'dependency-audit.json');
    fs.writeFileSync(auditPath, JSON.stringify(auditData, null, 2));
    
    console.log('✅ Dependency audit completed');
    return auditData;
  } catch (error) {
    console.warn('⚠️ Dependency audit failed or found vulnerabilities:', error.message);
    
    // Try to parse partial output
    try {
      const auditData = JSON.parse(error.stdout);
      return auditData;
    } catch (parseError) {
      // Return empty audit data if parsing fails
      return {
        metadata: { vulnerabilities: {} },
        vulnerabilities: {}
      };
    }
  }
}

/**
 * Analyze source code for security issues
 */
function analyzeSourceCode() {
  console.log('🔬 Analyzing source code for security issues...');
  
  const issues = [];
  
  // Check for common security issues
  const securityPatterns = [
    {
      pattern: /eval\s*\(/g,
      type: 'high',
      description: 'Use of eval() function detected',
      recommendation: 'Avoid using eval() as it can execute arbitrary code'
    },
    {
      pattern: /innerHTML\s*=/g,
      type: 'medium',
      description: 'Direct innerHTML assignment detected',
      recommendation: 'Use textContent or sanitize HTML before assignment'
    },
    {
      pattern: /document\.write\s*\(/g,
      type: 'high',
      description: 'Use of document.write() detected',
      recommendation: 'Avoid document.write() as it can cause security issues'
    },
    {
      pattern: /Function\s*\(/g,
      type: 'medium',
      description: 'Function constructor detected',
      recommendation: 'Avoid Function constructor as it can execute arbitrary code'
    },
    {
      pattern: /setTimeout\s*\(\s*["']/g,
      type: 'low',
      description: 'setTimeout with string argument detected',
      recommendation: 'Use function references instead of string arguments'
    },
    {
      pattern: /setInterval\s*\(\s*["']/g,
      type: 'low',
      description: 'setInterval with string argument detected',
      recommendation: 'Use function references instead of string arguments'
    },
    {
      pattern: /crypto\.subtle\.decrypt/g,
      type: 'medium',
      description: 'Cryptographic decryption detected',
      recommendation: 'Ensure proper key management and validation'
    },
    {
      pattern: /localStorage\.setItem/g,
      type: 'low',
      description: 'localStorage usage detected',
      recommendation: 'Consider using chrome.storage.local for extension data'
    },
    {
      pattern: /sessionStorage\.setItem/g,
      type: 'low',
      description: 'sessionStorage usage detected',
      recommendation: 'Consider using chrome.storage.session for extension data'
    }
  ];
  
  // Scan source files
  if (fs.existsSync(CONFIG.sourceDirectory)) {
    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else if (file.match(/\.(js|ts|jsx|tsx)$/)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          securityPatterns.forEach(securityPattern => {
            const matches = content.match(securityPattern.pattern);
            if (matches) {
              issues.push({
                file: path.relative(process.cwd(), filePath),
                type: securityPattern.type,
                description: securityPattern.description,
                recommendation: securityPattern.recommendation,
                occurrences: matches.length
              });
            }
          });
        }
      });
    };
    
    scanDirectory(CONFIG.sourceDirectory);
  }
  
  // Save code analysis results
  const analysisPath = path.join(CONFIG.securityDirectory, 'code-analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(issues, null, 2));
  
  console.log(`✅ Code analysis completed. Found ${issues.length} potential issues`);
  return issues;
}

/**
 * Analyze Chrome extension permissions
 */
function analyzePermissions() {
  console.log('🔐 Analyzing Chrome extension permissions...');
  
  const manifestPath = path.join(CONFIG.sourceDirectory, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️ manifest.json not found');
    return { issues: [], permissions: [] };
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const permissions = manifest.permissions || [];
    const optionalPermissions = manifest.optional_permissions || [];
    const hostPermissions = manifest.host_permissions || [];
    
    const issues = [];
    
    // Check for overly broad permissions
    const dangerousPermissions = [
      'tabs', 'background', 'scripting', 'activeTab', 'cookies', 'webNavigation'
    ];
    
    dangerousPermissions.forEach(permission => {
      if (permissions.includes(permission)) {
        issues.push({
          type: 'medium',
          permission: permission,
          description: `Dangerous permission: ${permission}`,
          recommendation: 'Ensure this permission is absolutely necessary and document its use'
        });
      }
    });
    
    // Check for broad host permissions
    hostPermissions.forEach(host => {
      if (host.includes('*://*/*') || host.includes('<all_urls>')) {
        issues.push({
          type: 'high',
          permission: host,
          description: 'Overly broad host permission',
          recommendation: 'Restrict host permissions to specific domains when possible'
        });
      }
    });
    
    const analysis = {
      permissions,
      optionalPermissions,
      hostPermissions,
      issues
    };
    
    // Save permission analysis results
    const analysisPath = path.join(CONFIG.securityDirectory, 'permission-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    
    console.log('✅ Permission analysis completed');
    return analysis;
  } catch (error) {
    console.error('❌ Failed to analyze permissions:', error.message);
    return { issues: [], permissions: [] };
  }
}

/**
 * Validate Content Security Policy
 */
function validateCSP() {
  console.log('🛡️ Validating Content Security Policy...');
  
  const manifestPath = path.join(CONFIG.sourceDirectory, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️ manifest.json not found');
    return { valid: false, issues: ['manifest.json not found'] };
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const csp = manifest.content_security_policy;
    
    const issues = [];
    
    if (!csp) {
      issues.push({
        type: 'high',
        description: 'No Content Security Policy defined',
        recommendation: 'Define a strict CSP to prevent XSS attacks'
      });
    } else {
      // Check for unsafe directives
      if (csp.includes("'unsafe-inline'")) {
        issues.push({
          type: 'high',
          description: 'CSP contains unsafe-inline',
          recommendation: 'Remove unsafe-inline from CSP to prevent XSS attacks'
        });
      }
      
      if (csp.includes("'unsafe-eval'")) {
        issues.push({
          type: 'high',
          description: 'CSP contains unsafe-eval',
          recommendation: 'Remove unsafe-eval from CSP to prevent code injection'
        });
      }
      
      if (csp.includes('*') || csp.includes('data:')) {
        issues.push({
          type: 'medium',
          description: 'CSP contains overly permissive sources',
          recommendation: 'Restrict CSP sources to specific domains when possible'
        });
      }
    }
    
    const validation = {
      valid: issues.length === 0,
      csp,
      issues
    };
    
    // Save CSP validation results
    const validationPath = path.join(CONFIG.securityDirectory, 'csp-validation.json');
    fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2));
    
    console.log('✅ CSP validation completed');
    return validation;
  } catch (error) {
    console.error('❌ Failed to validate CSP:', error.message);
    return { valid: false, issues: ['Failed to parse manifest.json'] };
  }
}

/**
 * Generate comprehensive security report
 */
function generateSecurityReport(testResults, auditData, codeIssues, permissionAnalysis, cspValidation) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.securityDirectory, 'security-report.json');
  
  // Count vulnerabilities by severity
  const vulnerabilityCounts = {
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };
  
  // Count from dependency audit
  if (auditData && auditData.vulnerabilities) {
    Object.values(auditData.vulnerabilities).forEach(vuln => {
      const severity = vuln.severity || 'info';
      if (vulnerabilityCounts[severity] !== undefined) {
        vulnerabilityCounts[severity]++;
      }
    });
  }
  
  // Count from code analysis
  codeIssues.forEach(issue => {
    if (vulnerabilityCounts[issue.type] !== undefined) {
      vulnerabilityCounts[issue.type]++;
    }
  });
  
  // Count from permission analysis
  permissionAnalysis.issues.forEach(issue => {
    if (vulnerabilityCounts[issue.type] !== undefined) {
      vulnerabilityCounts[issue.type]++;
    }
  });
  
  // Count from CSP validation
  cspValidation.issues.forEach(issue => {
    if (vulnerabilityCounts[issue.type] !== undefined) {
      vulnerabilityCounts[issue.type]++;
    }
  });
  
  // Check if thresholds are met
  const thresholdsMet = {
    high: vulnerabilityCounts.high <= CONFIG.vulnerabilityThresholds.high,
    medium: vulnerabilityCounts.medium <= CONFIG.vulnerabilityThresholds.medium,
    low: vulnerabilityCounts.low <= CONFIG.vulnerabilityThresholds.low,
    info: vulnerabilityCounts.info <= CONFIG.vulnerabilityThresholds.info
  };
  
  const allThresholdsMet = Object.values(thresholdsMet).every(met => met);
  
  const report = {
    timestamp,
    thresholds: CONFIG.vulnerabilityThresholds,
    summary: {
      totalVulnerabilities: Object.values(vulnerabilityCounts).reduce((sum, count) => sum + count, 0),
      vulnerabilityCounts,
      thresholdsMet,
      overallSecurity: allThresholdsMet ? 'secure' : 'vulnerable'
    },
    testResults,
    dependencyAudit: auditData,
    codeAnalysis: {
      issues: codeIssues,
      totalIssues: codeIssues.length
    },
    permissionAnalysis,
    cspValidation,
    recommendations: generateRecommendations(vulnerabilityCounts, codeIssues, permissionAnalysis, cspValidation)
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Security report written to: ${reportPath}`);
  
  return report;
}

/**
 * Generate security recommendations
 */
function generateRecommendations(vulnerabilityCounts, codeIssues, permissionAnalysis, cspValidation) {
  const recommendations = [];
  
  // Dependency recommendations
  if (vulnerabilityCounts.high > 0 || vulnerabilityCounts.medium > 0) {
    recommendations.push({
      priority: 'high',
      category: 'Dependencies',
      description: 'Update dependencies to fix security vulnerabilities',
      action: 'Run npm audit fix to update vulnerable packages'
    });
  }
  
  // Code analysis recommendations
  if (codeIssues.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'Code Security',
      description: 'Address potential security issues in source code',
      action: 'Review and fix identified security patterns in the codebase'
    });
  }
  
  // Permission recommendations
  if (permissionAnalysis.issues.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'Permissions',
      description: 'Review and minimize extension permissions',
      action: 'Remove unnecessary permissions and document required ones'
    });
  }
  
  // CSP recommendations
  if (!cspValidation.valid) {
    recommendations.push({
      priority: 'high',
      category: 'Content Security Policy',
      description: 'Implement a strict Content Security Policy',
      action: 'Define a CSP without unsafe-inline or unsafe-eval'
    });
  }
  
  return recommendations;
}

/**
 * Generate HTML security report
 */
function generateHTMLSecurityReport(report) {
  if (!report) {
    console.log('⚠️ No report data available for HTML security report');
    return;
  }
  
  const htmlPath = path.join(CONFIG.securityDirectory, 'security-report.html');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ray Chrome Extension - Security Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .security-status {
            padding: 20px;
            text-align: center;
            font-size: 1.2em;
            font-weight: bold;
        }
        .status-secure { background: #d4edda; color: #155724; }
        .status-vulnerable { background: #f8d7da; color: #721c24; }
        .vulnerability-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #fafafa;
        }
        .vulnerability-item {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vulnerability-count {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .vulnerability-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .high { color: #dc3545; }
        .medium { color: #fd7e14; }
        .low { color: #ffc107; }
        .info { color: #17a2b8; }
        .sections {
            padding: 0 30px 30px;
        }
        .section {
            margin-bottom: 30px;
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
        }
        .section-header {
            background: #f8f9fa;
            padding: 15px 20px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-content {
            padding: 20px;
        }
        .issue-item {
            margin-bottom: 15px;
            padding: 15px;
            background: #fafafa;
            border-radius: 6px;
            border-left: 4px solid #dc3545;
        }
        .issue-medium { border-left-color: #fd7e14; }
        .issue-low { border-left-color: #ffc107; }
        .issue-info { border-left-color: #17a2b8; }
        .recommendation {
            margin-bottom: 15px;
            padding: 15px;
            background: #e7f3ff;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        .priority-high { border-left-color: #dc3545; }
        .priority-medium { border-left-color: #fd7e14; }
        .priority-low { border-left-color: #ffc107; }
        .footer {
            padding: 20px 30px;
            background: #f8f9fa;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ray Chrome Extension</h1>
            <p>Security Vulnerability Report</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="security-status status-${report.summary.overallSecurity}">
            Overall Security Status: ${report.summary.overallSecurity.toUpperCase()}
        </div>
        
        <div class="vulnerability-summary">
            <div class="vulnerability-item">
                <div class="vulnerability-count high">${report.summary.vulnerabilityCounts.high}</div>
                <div class="vulnerability-label">High</div>
            </div>
            <div class="vulnerability-item">
                <div class="vulnerability-count medium">${report.summary.vulnerabilityCounts.medium}</div>
                <div class="vulnerability-label">Medium</div>
            </div>
            <div class="vulnerability-item">
                <div class="vulnerability-count low">${report.summary.vulnerabilityCounts.low}</div>
                <div class="vulnerability-label">Low</div>
            </div>
            <div class="vulnerability-item">
                <div class="vulnerability-count info">${report.summary.vulnerabilityCounts.info}</div>
                <div class="vulnerability-label">Info</div>
            </div>
        </div>
        
        <div class="sections">
            ${generateSecuritySectionsHTML(report)}
        </div>
        
        <div class="footer">
            <p>Generated by Ray Chrome Extension Security Test Suite</p>
        </div>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML security report written to: ${htmlPath}`);
}

/**
 * Generate HTML for security sections
 */
function generateSecuritySectionsHTML(report) {
  let html = '';
  
  // Code Analysis Section
  if (report.codeAnalysis.totalIssues > 0) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Code Analysis Issues</span>
          <span>${report.codeAnalysis.totalIssues} issues found</span>
        </div>
        <div class="section-content">
    `;
    
    report.codeAnalysis.issues.forEach(issue => {
      html += `
        <div class="issue-item issue-${issue.type}">
          <strong>${issue.description}</strong>
          <p><em>File:</em> ${issue.file}</p>
          <p><em>Occurrences:</em> ${issue.occurrences}</p>
          <p><em>Recommendation:</em> ${issue.recommendation}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // Permission Analysis Section
  if (report.permissionAnalysis.issues.length > 0) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Permission Analysis</span>
          <span>${report.permissionAnalysis.issues.length} issues found</span>
        </div>
        <div class="section-content">
    `;
    
    report.permissionAnalysis.issues.forEach(issue => {
      html += `
        <div class="issue-item issue-${issue.type}">
          <strong>${issue.description}</strong>
          <p><em>Permission:</em> ${issue.permission}</p>
          <p><em>Recommendation:</em> ${issue.recommendation}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // CSP Validation Section
  if (!report.cspValidation.valid) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Content Security Policy</span>
          <span>${report.cspValidation.issues.length} issues found</span>
        </div>
        <div class="section-content">
    `;
    
    report.cspValidation.issues.forEach(issue => {
      html += `
        <div class="issue-item issue-${issue.type}">
          <strong>${issue.description}</strong>
          <p><em>Recommendation:</em> ${issue.recommendation}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // Recommendations Section
  if (report.recommendations.length > 0) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Security Recommendations</span>
          <span>${report.recommendations.length} recommendations</span>
        </div>
        <div class="section-content">
    `;
    
    report.recommendations.forEach(rec => {
      html += `
        <div class="recommendation priority-${rec.priority}">
          <strong>${rec.category} - ${rec.priority.toUpperCase()} Priority</strong>
          <p>${rec.description}</p>
          <p><em>Action:</em> ${rec.action}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  return html;
}

/**
 * Check if security thresholds are met
 */
function checkSecurityThresholds(report) {
  if (!report) {
    return false;
  }
  
  const allThresholdsMet = Object.values(report.summary.thresholdsMet).every(met => met);
  
  console.log('\n🔒 Security Threshold Results:');
  console.log('==============================');
  
  Object.entries(report.summary.thresholdsMet).forEach(([severity, met]) => {
    const threshold = CONFIG.vulnerabilityThresholds[severity];
    const count = report.summary.vulnerabilityCounts[severity];
    const status = met ? '✅' : '❌';
    console.log(`${status} ${severity}: ${count} (threshold: ${threshold})`);
  });
  
  console.log(`\n🛡️ Overall Security Status: ${report.summary.overallSecurity}`);
  
  return allThresholdsMet;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔒 Starting Ray Chrome Extension Security Scan');
  console.log('=============================================');
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Run security tests
  const testsSuccess = runSecurityTests();
  
  // Run dependency audit
  const auditData = runDependencyAudit();
  
  // Analyze source code
  const codeIssues = analyzeSourceCode();
  
  // Analyze permissions
  const permissionAnalysis = analyzePermissions();
  
  // Validate CSP
  const cspValidation = validateCSP();
  
  // Generate comprehensive report
  const report = generateSecurityReport(testsSuccess, auditData, codeIssues, permissionAnalysis, cspValidation);
  
  // Generate HTML report
  generateHTMLSecurityReport(report);
  
  // Check thresholds
  const thresholdsMet = checkSecurityThresholds(report);
  
  // Print final summary
  console.log('\n📋 Security Summary:');
  console.log('====================');
  console.log(`Overall Security Status: ${report.summary.overallSecurity}`);
  console.log(`Total Vulnerabilities: ${report.summary.totalVulnerabilities}`);
  
  console.log(`\n📁 Reports generated in: ${CONFIG.securityDirectory}`);
  
  // Exit with appropriate code
  if (thresholdsMet) {
    console.log('\n🎉 All security thresholds met!');
    process.exit(0);
  } else {
    console.log('\n💥 Some security thresholds not met!');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runSecurityTests,
  runDependencyAudit,
  analyzeSourceCode,
  analyzePermissions,
  validateCSP,
  generateSecurityReport,
  generateHTMLSecurityReport,
  checkSecurityThresholds,
  CONFIG
};
/**
 * Security Vulnerability Scanning Script
 * Runs security tests and vulnerability scans for Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  outputDirectory: 'test/reports',
  securityDirectory: 'test/reports/security',
  testPattern: 'test/security/*.test.js',
  sourceDirectory: 'src',
  vulnerabilityThresholds: {
    high: 0, // No high vulnerabilities allowed
    medium: 2, // Max 2 medium vulnerabilities
    low: 5, // Max 5 low vulnerabilities
    info: 10 // Max 10 info vulnerabilities
  },
  securityChecks: {
    dependencyAudit: true,
    codeAnalysis: true,
    permissionAnalysis: true,
    manifestValidation: true,
    contentSecurityPolicy: true
  },
  reportFormats: ['json', 'html'],
  historyFile: 'test/reports/security/security-history.json'
};

/**
 * Ensure output directories exist
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.outputDirectory,
    CONFIG.securityDirectory
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Run security tests
 */
function runSecurityTests() {
  console.log('🔒 Running security tests...');
  
  const jestConfig = {
    testMatch: [CONFIG.testPattern],
    testTimeout: 30000, // 30 seconds per test
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    reporters: ['default', 'jest-json-reporter']
  };
  
  const configPath = path.join(CONFIG.securityDirectory, 'jest-security.config.json');
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    const command = `npx jest --config ${configPath} --json --outputFile=${path.join(CONFIG.securityDirectory, 'security-test-results.json')}`;
    console.log(`Executing: ${command}`);
    
    execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    
    console.log('✅ Security tests completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Security tests failed:', error.message);
    return false;
  } finally {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Run dependency vulnerability audit
 */
function runDependencyAudit() {
  console.log('🔍 Running dependency vulnerability audit...');
  
  try {
    // Run npm audit
    const auditCommand = 'npm audit --json';
    console.log(`Executing: ${auditCommand}`);
    
    const auditOutput = execSync(auditCommand, {
      encoding: 'utf8',
      timeout: 60000 // 1 minute
    });
    
    const auditData = JSON.parse(auditOutput);
    
    // Save audit results
    const auditPath = path.join(CONFIG.securityDirectory, 'dependency-audit.json');
    fs.writeFileSync(auditPath, JSON.stringify(auditData, null, 2));
    
    console.log('✅ Dependency audit completed');
    return auditData;
  } catch (error) {
    console.warn('⚠️ Dependency audit failed or found vulnerabilities:', error.message);
    
    // Try to parse partial output
    try {
      const auditData = JSON.parse(error.stdout);
      return auditData;
    } catch (parseError) {
      // Return empty audit data if parsing fails
      return {
        metadata: { vulnerabilities: {} },
        vulnerabilities: {}
      };
    }
  }
}

/**
 * Analyze source code for security issues
 */
function analyzeSourceCode() {
  console.log('🔬 Analyzing source code for security issues...');
  
  const issues = [];
  
  // Check for common security issues
  const securityPatterns = [
    {
      pattern: /eval\s*\(/g,
      type: 'high',
      description: 'Use of eval() function detected',
      recommendation: 'Avoid using eval() as it can execute arbitrary code'
    },
    {
      pattern: /innerHTML\s*=/g,
      type: 'medium',
      description: 'Direct innerHTML assignment detected',
      recommendation: 'Use textContent or sanitize HTML before assignment'
    },
    {
      pattern: /document\.write\s*\(/g,
      type: 'high',
      description: 'Use of document.write() detected',
      recommendation: 'Avoid document.write() as it can cause security issues'
    },
    {
      pattern: /Function\s*\(/g,
      type: 'medium',
      description: 'Function constructor detected',
      recommendation: 'Avoid Function constructor as it can execute arbitrary code'
    },
    {
      pattern: /setTimeout\s*\(\s*["']/g,
      type: 'low',
      description: 'setTimeout with string argument detected',
      recommendation: 'Use function references instead of string arguments'
    },
    {
      pattern: /setInterval\s*\(\s*["']/g,
      type: 'low',
      description: 'setInterval with string argument detected',
      recommendation: 'Use function references instead of string arguments'
    },
    {
      pattern: /crypto\.subtle\.decrypt/g,
      type: 'medium',
      description: 'Cryptographic decryption detected',
      recommendation: 'Ensure proper key management and validation'
    },
    {
      pattern: /localStorage\.setItem/g,
      type: 'low',
      description: 'localStorage usage detected',
      recommendation: 'Consider using chrome.storage.local for extension data'
    },
    {
      pattern: /sessionStorage\.setItem/g,
      type: 'low',
      description: 'sessionStorage usage detected',
      recommendation: 'Consider using chrome.storage.session for extension data'
    }
  ];
  
  // Scan source files
  if (fs.existsSync(CONFIG.sourceDirectory)) {
    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else if (file.match(/\.(js|ts|jsx|tsx)$/)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          securityPatterns.forEach(securityPattern => {
            const matches = content.match(securityPattern.pattern);
            if (matches) {
              issues.push({
                file: path.relative(process.cwd(), filePath),
                type: securityPattern.type,
                description: securityPattern.description,
                recommendation: securityPattern.recommendation,
                occurrences: matches.length
              });
            }
          });
        }
      });
    };
    
    scanDirectory(CONFIG.sourceDirectory);
  }
  
  // Save code analysis results
  const analysisPath = path.join(CONFIG.securityDirectory, 'code-analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(issues, null, 2));
  
  console.log(`✅ Code analysis completed. Found ${issues.length} potential issues`);
  return issues;
}

/**
 * Analyze Chrome extension permissions
 */
function analyzePermissions() {
  console.log('🔐 Analyzing Chrome extension permissions...');
  
  const manifestPath = path.join(CONFIG.sourceDirectory, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️ manifest.json not found');
    return { issues: [], permissions: [] };
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const permissions = manifest.permissions || [];
    const optionalPermissions = manifest.optional_permissions || [];
    const hostPermissions = manifest.host_permissions || [];
    
    const issues = [];
    
    // Check for overly broad permissions
    const dangerousPermissions = [
      'tabs', 'background', 'scripting', 'activeTab', 'cookies', 'webNavigation'
    ];
    
    dangerousPermissions.forEach(permission => {
      if (permissions.includes(permission)) {
        issues.push({
          type: 'medium',
          permission: permission,
          description: `Dangerous permission: ${permission}`,
          recommendation: 'Ensure this permission is absolutely necessary and document its use'
        });
      }
    });
    
    // Check for broad host permissions
    hostPermissions.forEach(host => {
      if (host.includes('*://*/*') || host.includes('<all_urls>')) {
        issues.push({
          type: 'high',
          permission: host,
          description: 'Overly broad host permission',
          recommendation: 'Restrict host permissions to specific domains when possible'
        });
      }
    });
    
    const analysis = {
      permissions,
      optionalPermissions,
      hostPermissions,
      issues
    };
    
    // Save permission analysis results
    const analysisPath = path.join(CONFIG.securityDirectory, 'permission-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    
    console.log('✅ Permission analysis completed');
    return analysis;
  } catch (error) {
    console.error('❌ Failed to analyze permissions:', error.message);
    return { issues: [], permissions: [] };
  }
}

/**
 * Validate Content Security Policy
 */
function validateCSP() {
  console.log('🛡️ Validating Content Security Policy...');
  
  const manifestPath = path.join(CONFIG.sourceDirectory, 'manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️ manifest.json not found');
    return { valid: false, issues: ['manifest.json not found'] };
  }
  
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const csp = manifest.content_security_policy;
    
    const issues = [];
    
    if (!csp) {
      issues.push({
        type: 'high',
        description: 'No Content Security Policy defined',
        recommendation: 'Define a strict CSP to prevent XSS attacks'
      });
    } else {
      // Check for unsafe directives
      if (csp.includes("'unsafe-inline'")) {
        issues.push({
          type: 'high',
          description: 'CSP contains unsafe-inline',
          recommendation: 'Remove unsafe-inline from CSP to prevent XSS attacks'
        });
      }
      
      if (csp.includes("'unsafe-eval'")) {
        issues.push({
          type: 'high',
          description: 'CSP contains unsafe-eval',
          recommendation: 'Remove unsafe-eval from CSP to prevent code injection'
        });
      }
      
      if (csp.includes('*') || csp.includes('data:')) {
        issues.push({
          type: 'medium',
          description: 'CSP contains overly permissive sources',
          recommendation: 'Restrict CSP sources to specific domains when possible'
        });
      }
    }
    
    const validation = {
      valid: issues.length === 0,
      csp,
      issues
    };
    
    // Save CSP validation results
    const validationPath = path.join(CONFIG.securityDirectory, 'csp-validation.json');
    fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2));
    
    console.log('✅ CSP validation completed');
    return validation;
  } catch (error) {
    console.error('❌ Failed to validate CSP:', error.message);
    return { valid: false, issues: ['Failed to parse manifest.json'] };
  }
}

/**
 * Generate comprehensive security report
 */
function generateSecurityReport(testResults, auditData, codeIssues, permissionAnalysis, cspValidation) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.securityDirectory, 'security-report.json');
  
  // Count vulnerabilities by severity
  const vulnerabilityCounts = {
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };
  
  // Count from dependency audit
  if (auditData && auditData.vulnerabilities) {
    Object.values(auditData.vulnerabilities).forEach(vuln => {
      const severity = vuln.severity || 'info';
      if (vulnerabilityCounts[severity] !== undefined) {
        vulnerabilityCounts[severity]++;
      }
    });
  }
  
  // Count from code analysis
  codeIssues.forEach(issue => {
    if (vulnerabilityCounts[issue.type] !== undefined) {
      vulnerabilityCounts[issue.type]++;
    }
  });
  
  // Count from permission analysis
  permissionAnalysis.issues.forEach(issue => {
    if (vulnerabilityCounts[issue.type] !== undefined) {
      vulnerabilityCounts[issue.type]++;
    }
  });
  
  // Count from CSP validation
  cspValidation.issues.forEach(issue => {
    if (vulnerabilityCounts[issue.type] !== undefined) {
      vulnerabilityCounts[issue.type]++;
    }
  });
  
  // Check if thresholds are met
  const thresholdsMet = {
    high: vulnerabilityCounts.high <= CONFIG.vulnerabilityThresholds.high,
    medium: vulnerabilityCounts.medium <= CONFIG.vulnerabilityThresholds.medium,
    low: vulnerabilityCounts.low <= CONFIG.vulnerabilityThresholds.low,
    info: vulnerabilityCounts.info <= CONFIG.vulnerabilityThresholds.info
  };
  
  const allThresholdsMet = Object.values(thresholdsMet).every(met => met);
  
  const report = {
    timestamp,
    thresholds: CONFIG.vulnerabilityThresholds,
    summary: {
      totalVulnerabilities: Object.values(vulnerabilityCounts).reduce((sum, count) => sum + count, 0),
      vulnerabilityCounts,
      thresholdsMet,
      overallSecurity: allThresholdsMet ? 'secure' : 'vulnerable'
    },
    testResults,
    dependencyAudit: auditData,
    codeAnalysis: {
      issues: codeIssues,
      totalIssues: codeIssues.length
    },
    permissionAnalysis,
    cspValidation,
    recommendations: generateRecommendations(vulnerabilityCounts, codeIssues, permissionAnalysis, cspValidation)
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Security report written to: ${reportPath}`);
  
  return report;
}

/**
 * Generate security recommendations
 */
function generateRecommendations(vulnerabilityCounts, codeIssues, permissionAnalysis, cspValidation) {
  const recommendations = [];
  
  // Dependency recommendations
  if (vulnerabilityCounts.high > 0 || vulnerabilityCounts.medium > 0) {
    recommendations.push({
      priority: 'high',
      category: 'Dependencies',
      description: 'Update dependencies to fix security vulnerabilities',
      action: 'Run npm audit fix to update vulnerable packages'
    });
  }
  
  // Code analysis recommendations
  if (codeIssues.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'Code Security',
      description: 'Address potential security issues in source code',
      action: 'Review and fix identified security patterns in the codebase'
    });
  }
  
  // Permission recommendations
  if (permissionAnalysis.issues.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'Permissions',
      description: 'Review and minimize extension permissions',
      action: 'Remove unnecessary permissions and document required ones'
    });
  }
  
  // CSP recommendations
  if (!cspValidation.valid) {
    recommendations.push({
      priority: 'high',
      category: 'Content Security Policy',
      description: 'Implement a strict Content Security Policy',
      action: 'Define a CSP without unsafe-inline or unsafe-eval'
    });
  }
  
  return recommendations;
}

/**
 * Generate HTML security report
 */
function generateHTMLSecurityReport(report) {
  if (!report) {
    console.log('⚠️ No report data available for HTML security report');
    return;
  }
  
  const htmlPath = path.join(CONFIG.securityDirectory, 'security-report.html');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ray Chrome Extension - Security Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .security-status {
            padding: 20px;
            text-align: center;
            font-size: 1.2em;
            font-weight: bold;
        }
        .status-secure { background: #d4edda; color: #155724; }
        .status-vulnerable { background: #f8d7da; color: #721c24; }
        .vulnerability-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #fafafa;
        }
        .vulnerability-item {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vulnerability-count {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .vulnerability-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .high { color: #dc3545; }
        .medium { color: #fd7e14; }
        .low { color: #ffc107; }
        .info { color: #17a2b8; }
        .sections {
            padding: 0 30px 30px;
        }
        .section {
            margin-bottom: 30px;
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
        }
        .section-header {
            background: #f8f9fa;
            padding: 15px 20px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-content {
            padding: 20px;
        }
        .issue-item {
            margin-bottom: 15px;
            padding: 15px;
            background: #fafafa;
            border-radius: 6px;
            border-left: 4px solid #dc3545;
        }
        .issue-medium { border-left-color: #fd7e14; }
        .issue-low { border-left-color: #ffc107; }
        .issue-info { border-left-color: #17a2b8; }
        .recommendation {
            margin-bottom: 15px;
            padding: 15px;
            background: #e7f3ff;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        .priority-high { border-left-color: #dc3545; }
        .priority-medium { border-left-color: #fd7e14; }
        .priority-low { border-left-color: #ffc107; }
        .footer {
            padding: 20px 30px;
            background: #f8f9fa;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ray Chrome Extension</h1>
            <p>Security Vulnerability Report</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="security-status status-${report.summary.overallSecurity}">
            Overall Security Status: ${report.summary.overallSecurity.toUpperCase()}
        </div>
        
        <div class="vulnerability-summary">
            <div class="vulnerability-item">
                <div class="vulnerability-count high">${report.summary.vulnerabilityCounts.high}</div>
                <div class="vulnerability-label">High</div>
            </div>
            <div class="vulnerability-item">
                <div class="vulnerability-count medium">${report.summary.vulnerabilityCounts.medium}</div>
                <div class="vulnerability-label">Medium</div>
            </div>
            <div class="vulnerability-item">
                <div class="vulnerability-count low">${report.summary.vulnerabilityCounts.low}</div>
                <div class="vulnerability-label">Low</div>
            </div>
            <div class="vulnerability-item">
                <div class="vulnerability-count info">${report.summary.vulnerabilityCounts.info}</div>
                <div class="vulnerability-label">Info</div>
            </div>
        </div>
        
        <div class="sections">
            ${generateSecuritySectionsHTML(report)}
        </div>
        
        <div class="footer">
            <p>Generated by Ray Chrome Extension Security Test Suite</p>
        </div>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML security report written to: ${htmlPath}`);
}

/**
 * Generate HTML for security sections
 */
function generateSecuritySectionsHTML(report) {
  let html = '';
  
  // Code Analysis Section
  if (report.codeAnalysis.totalIssues > 0) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Code Analysis Issues</span>
          <span>${report.codeAnalysis.totalIssues} issues found</span>
        </div>
        <div class="section-content">
    `;
    
    report.codeAnalysis.issues.forEach(issue => {
      html += `
        <div class="issue-item issue-${issue.type}">
          <strong>${issue.description}</strong>
          <p><em>File:</em> ${issue.file}</p>
          <p><em>Occurrences:</em> ${issue.occurrences}</p>
          <p><em>Recommendation:</em> ${issue.recommendation}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // Permission Analysis Section
  if (report.permissionAnalysis.issues.length > 0) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Permission Analysis</span>
          <span>${report.permissionAnalysis.issues.length} issues found</span>
        </div>
        <div class="section-content">
    `;
    
    report.permissionAnalysis.issues.forEach(issue => {
      html += `
        <div class="issue-item issue-${issue.type}">
          <strong>${issue.description}</strong>
          <p><em>Permission:</em> ${issue.permission}</p>
          <p><em>Recommendation:</em> ${issue.recommendation}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // CSP Validation Section
  if (!report.cspValidation.valid) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Content Security Policy</span>
          <span>${report.cspValidation.issues.length} issues found</span>
        </div>
        <div class="section-content">
    `;
    
    report.cspValidation.issues.forEach(issue => {
      html += `
        <div class="issue-item issue-${issue.type}">
          <strong>${issue.description}</strong>
          <p><em>Recommendation:</em> ${issue.recommendation}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // Recommendations Section
  if (report.recommendations.length > 0) {
    html += `
      <div class="section">
        <div class="section-header">
          <span>Security Recommendations</span>
          <span>${report.recommendations.length} recommendations</span>
        </div>
        <div class="section-content">
    `;
    
    report.recommendations.forEach(rec => {
      html += `
        <div class="recommendation priority-${rec.priority}">
          <strong>${rec.category} - ${rec.priority.toUpperCase()} Priority</strong>
          <p>${rec.description}</p>
          <p><em>Action:</em> ${rec.action}</p>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  return html;
}

/**
 * Check if security thresholds are met
 */
function checkSecurityThresholds(report) {
  if (!report) {
    return false;
  }
  
  const allThresholdsMet = Object.values(report.summary.thresholdsMet).every(met => met);
  
  console.log('\n🔒 Security Threshold Results:');
  console.log('==============================');
  
  Object.entries(report.summary.thresholdsMet).forEach(([severity, met]) => {
    const threshold = CONFIG.vulnerabilityThresholds[severity];
    const count = report.summary.vulnerabilityCounts[severity];
    const status = met ? '✅' : '❌';
    console.log(`${status} ${severity}: ${count} (threshold: ${threshold})`);
  });
  
  console.log(`\n🛡️ Overall Security Status: ${report.summary.overallSecurity}`);
  
  return allThresholdsMet;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔒 Starting Ray Chrome Extension Security Scan');
  console.log('=============================================');
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Run security tests
  const testsSuccess = runSecurityTests();
  
  // Run dependency audit
  const auditData = runDependencyAudit();
  
  // Analyze source code
  const codeIssues = analyzeSourceCode();
  
  // Analyze permissions
  const permissionAnalysis = analyzePermissions();
  
  // Validate CSP
  const cspValidation = validateCSP();
  
  // Generate comprehensive report
  const report = generateSecurityReport(testsSuccess, auditData, codeIssues, permissionAnalysis, cspValidation);
  
  // Generate HTML report
  generateHTMLSecurityReport(report);
  
  // Check thresholds
  const thresholdsMet = checkSecurityThresholds(report);
  
  // Print final summary
  console.log('\n📋 Security Summary:');
  console.log('====================');
  console.log(`Overall Security Status: ${report.summary.overallSecurity}`);
  console.log(`Total Vulnerabilities: ${report.summary.totalVulnerabilities}`);
  
  console.log(`\n📁 Reports generated in: ${CONFIG.securityDirectory}`);
  
  // Exit with appropriate code
  if (thresholdsMet) {
    console.log('\n🎉 All security thresholds met!');
    process.exit(0);
  } else {
    console.log('\n💥 Some security thresholds not met!');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runSecurityTests,
  runDependencyAudit,
  analyzeSourceCode,
  analyzePermissions,
  validateCSP,
  generateSecurityReport,
  generateHTMLSecurityReport,
  checkSecurityThresholds,
  CONFIG
};
