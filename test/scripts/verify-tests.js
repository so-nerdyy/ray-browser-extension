#!/usr/bin/env node

/**
 * Test Verification Script
 * Verifies that all tests pass and meet requirements for Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  outputDirectory: 'test/reports',
  testCategories: {
    unit: 'test/unit/*.test.js',
    integration: 'test/integration/*.test.js',
    e2e: 'test/e2e/*.test.js',
    security: 'test/security/*.test.js',
    performance: 'test/performance/*.test.js',
    browser: 'test/browser/*.test.js'
  },
  requirements: {
    unitTests: {
      minTests: 5,
      minCoverage: 80
    },
    integrationTests: {
      minTests: 5
    },
    e2eTests: {
      minTests: 5
    },
    securityTests: {
      minTests: 5
    },
    performanceTests: {
      minTests: 5
    },
    browserTests: {
      minTests: 5
    }
  }
};

/**
 * Count test files in a directory
 */
function countTestFiles(pattern) {
  const glob = require('glob');
  const files = glob.sync(pattern);
  return files.length;
}

/**
 * Verify test file requirements
 */
function verifyTestFiles() {
  console.log('🔍 Verifying test file requirements...');
  
  const results = {};
  
  Object.entries(CONFIG.testCategories).forEach(([category, pattern]) => {
    const count = countTestFiles(pattern);
    const required = CONFIG.requirements[`${category}Tests`].minTests;
    
    results[category] = {
      count,
      required,
      met: count >= required
    };
    
    const status = count >= required ? '✅' : '❌';
    console.log(`${status} ${category}: ${count} tests (required: ${required})`);
  });
  
  return results;
}

/**
 * Verify coverage requirements
 */
function verifyCoverageRequirements() {
  console.log('\n📊 Verifying coverage requirements...');
  
  const coverageFile = path.join(CONFIG.outputDirectory, 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(coverageFile)) {
    console.log('❌ Coverage report not found. Run: npm run test:coverage');
    return false;
  }
  
  try {
    const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    const total = coverageData.total;
    
    const statements = total.statements.pct;
    const branches = total.branches.pct;
    const functions = total.functions.pct;
    const lines = total.lines.pct;
    
    const required = CONFIG.requirements.unitTests.minCoverage;
    
    const results = {
      statements: { value: statements, required, met: statements >= required },
      branches: { value: branches, required, met: branches >= required },
      functions: { value: functions, required, met: functions >= required },
      lines: { value: lines, required, met: lines >= required }
    };
    
    Object.entries(results).forEach(([metric, data]) => {
      const status = data.met ? '✅' : '❌';
      console.log(`${status} ${metric}: ${data.value.toFixed(1)}% (required: ${required}%)`);
    });
    
    return Object.values(results).every(result => result.met);
  } catch (error) {
    console.error('❌ Failed to parse coverage report:', error.message);
    return false;
  }
}

/**
 * Verify performance requirements
 */
function verifyPerformanceRequirements() {
  console.log('\n🚀 Verifying performance requirements...');
  
  const performanceFile = path.join(CONFIG.outputDirectory, 'performance-benchmarks.json');
  
  if (!fs.existsSync(performanceFile)) {
    console.log('❌ Performance benchmarks report not found. Run: npm run test:performance-benchmarks');
    return false;
  }
  
  try {
    const performanceData = JSON.parse(fs.readFileSync(performanceFile, 'utf8'));
    const thresholds = performanceData.thresholds;
    const current = performanceData.current;
    
    const results = {};
    
    Object.entries(thresholds).forEach(([category, threshold]) => {
      if (current[category]) {
        const value = current[category].loadTime || current[category].responseTime || current[category].heapUsed || current[category].injectionTime || current[category].executionTime;
        const target = threshold.target;
        
        // Convert memory usage to MB for comparison
        const compareValue = category === 'memoryUsage' ? value / (1024 * 1024) : value;
        const compareTarget = category === 'memoryUsage' ? target / (1024 * 1024) : target;
        
        results[category] = {
          value: compareValue,
          target: compareTarget,
          met: compareValue <= compareTarget
        };
        
        const status = compareValue <= compareTarget ? '✅' : '❌';
        const unit = category === 'memoryUsage' ? 'MB' : 'ms';
        console.log(`${status} ${category}: ${compareValue}${unit} (target: ${compareTarget}${unit})`);
      }
    });
    
    return Object.values(results).every(result => result.met);
  } catch (error) {
    console.error('❌ Failed to parse performance benchmarks:', error.message);
    return false;
  }
}

/**
 * Verify security requirements
 */
function verifySecurityRequirements() {
  console.log('\n🔒 Verifying security requirements...');
  
  const securityFile = path.join(CONFIG.outputDirectory, 'security-scan-report.json');
  
  if (!fs.existsSync(securityFile)) {
    console.log('❌ Security scan report not found. Run: npm run test:security-scan');
    return false;
  }
  
  try {
    const securityData = JSON.parse(fs.readFileSync(securityFile, 'utf8'));
    const thresholds = securityData.thresholds;
    const counts = securityData.summary.vulnerabilityCounts;
    
    const results = {};
    
    Object.entries(thresholds).forEach(([severity, threshold]) => {
      const count = counts[severity] || 0;
      
      results[severity] = {
        count,
        threshold,
        met: count <= threshold
      };
      
      const status = count <= threshold ? '✅' : '❌';
      console.log(`${status} ${severity}: ${count} (threshold: ${threshold})`);
    });
    
    return Object.values(results).every(result => result.met);
  } catch (error) {
    console.error('❌ Failed to parse security scan report:', error.message);
    return false;
  }
}

/**
 * Verify report structure
 */
function verifyReportStructure() {
  console.log('\n📁 Verifying report structure...');
  
  const requiredReports = [
    'coverage-report.html',
    'performance-benchmarks.json',
    'security-scan-report.json'
  ];
  
  const results = {};
  
  requiredReports.forEach(report => {
    const reportPath = path.join(CONFIG.outputDirectory, report);
    const exists = fs.existsSync(reportPath);
    
    results[report] = {
      exists,
      met: exists
    };
    
    const status = exists ? '✅' : '❌';
    console.log(`${status} ${report}: ${exists ? 'found' : 'missing'}`);
  });
  
  return Object.values(results).every(result => result.met);
}

/**
 * Generate verification report
 */
function generateVerificationReport(testFiles, coverage, performance, security, reportStructure) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.outputDirectory, 'verification-report.json');
  
  const report = {
    timestamp,
    requirements: {
      testFiles: {
        met: Object.values(testFiles).every(result => result.met),
        details: testFiles
      },
      coverage: {
        met: coverage,
        requirement: `${CONFIG.requirements.unitTests.minCoverage}% coverage`
      },
      performance: {
        met: performance,
        requirement: 'All performance targets met'
      },
      security: {
        met: security,
        requirement: 'All security thresholds met'
      },
      reportStructure: {
        met: reportStructure,
        requirement: 'All required reports generated'
      }
    },
    summary: {
      overall: {
        met: Object.values(testFiles).every(result => result.met) && coverage && performance && security && reportStructure,
        status: 'pending'
      }
    }
  };
  
  // Set overall status
  report.summary.overall.status = report.summary.overall.met ? 'passed' : 'failed';
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Verification report written to: ${reportPath}`);
  
  return report;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔍 Starting Ray Chrome Extension Test Verification');
  console.log('==================================================');
  
  // Verify test files
  const testFiles = verifyTestFiles();
  
  // Verify coverage requirements
  const coverage = verifyCoverageRequirements();
  
  // Verify performance requirements
  const performance = verifyPerformanceRequirements();
  
  // Verify security requirements
  const security = verifySecurityRequirements();
  
  // Verify report structure
  const reportStructure = verifyReportStructure();
  
  // Generate verification report
  const report = generateVerificationReport(testFiles, coverage, performance, security, reportStructure);
  
  // Print final summary
  console.log('\n📋 Verification Summary:');
  console.log('======================');
  console.log(`Test Files: ${Object.values(testFiles).every(result => result.met) ? '✅' : '❌'} All requirements met`);
  console.log(`Coverage: ${coverage ? '✅' : '❌'} ${CONFIG.requirements.unitTests.minCoverage}% coverage requirement met`);
  console.log(`Performance: ${performance ? '✅' : '❌'} All performance targets met`);
  console.log(`Security: ${security ? '✅' : '❌'} All security thresholds met`);
  console.log(`Report Structure: ${reportStructure ? '✅' : '❌'} All required reports generated`);
  
  const overallStatus = report.summary.overall.status;
  console.log(`\n🎯 Overall Status: ${overallStatus.toUpperCase()}`);
  
  if (overallStatus === 'passed') {
    console.log('\n🎉 All tests pass and meet requirements!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests do not meet requirements!');
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
  verifyTestFiles,
  verifyCoverageRequirements,
  verifyPerformanceRequirements,
  verifySecurityRequirements,
  verifyReportStructure,
  generateVerificationReport,
  CONFIG
};
/**
 * Test Verification Script
 * Verifies that all tests pass and meet requirements for Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  outputDirectory: 'test/reports',
  testCategories: {
    unit: 'test/unit/*.test.js',
    integration: 'test/integration/*.test.js',
    e2e: 'test/e2e/*.test.js',
    security: 'test/security/*.test.js',
    performance: 'test/performance/*.test.js',
    browser: 'test/browser/*.test.js'
  },
  requirements: {
    unitTests: {
      minTests: 5,
      minCoverage: 80
    },
    integrationTests: {
      minTests: 5
    },
    e2eTests: {
      minTests: 5
    },
    securityTests: {
      minTests: 5
    },
    performanceTests: {
      minTests: 5
    },
    browserTests: {
      minTests: 5
    }
  }
};

/**
 * Count test files in a directory
 */
function countTestFiles(pattern) {
  const glob = require('glob');
  const files = glob.sync(pattern);
  return files.length;
}

/**
 * Verify test file requirements
 */
function verifyTestFiles() {
  console.log('🔍 Verifying test file requirements...');
  
  const results = {};
  
  Object.entries(CONFIG.testCategories).forEach(([category, pattern]) => {
    const count = countTestFiles(pattern);
    const required = CONFIG.requirements[`${category}Tests`].minTests;
    
    results[category] = {
      count,
      required,
      met: count >= required
    };
    
    const status = count >= required ? '✅' : '❌';
    console.log(`${status} ${category}: ${count} tests (required: ${required})`);
  });
  
  return results;
}

/**
 * Verify coverage requirements
 */
function verifyCoverageRequirements() {
  console.log('\n📊 Verifying coverage requirements...');
  
  const coverageFile = path.join(CONFIG.outputDirectory, 'coverage', 'coverage-summary.json');
  
  if (!fs.existsSync(coverageFile)) {
    console.log('❌ Coverage report not found. Run: npm run test:coverage');
    return false;
  }
  
  try {
    const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    const total = coverageData.total;
    
    const statements = total.statements.pct;
    const branches = total.branches.pct;
    const functions = total.functions.pct;
    const lines = total.lines.pct;
    
    const required = CONFIG.requirements.unitTests.minCoverage;
    
    const results = {
      statements: { value: statements, required, met: statements >= required },
      branches: { value: branches, required, met: branches >= required },
      functions: { value: functions, required, met: functions >= required },
      lines: { value: lines, required, met: lines >= required }
    };
    
    Object.entries(results).forEach(([metric, data]) => {
      const status = data.met ? '✅' : '❌';
      console.log(`${status} ${metric}: ${data.value.toFixed(1)}% (required: ${required}%)`);
    });
    
    return Object.values(results).every(result => result.met);
  } catch (error) {
    console.error('❌ Failed to parse coverage report:', error.message);
    return false;
  }
}

/**
 * Verify performance requirements
 */
function verifyPerformanceRequirements() {
  console.log('\n🚀 Verifying performance requirements...');
  
  const performanceFile = path.join(CONFIG.outputDirectory, 'performance-benchmarks.json');
  
  if (!fs.existsSync(performanceFile)) {
    console.log('❌ Performance benchmarks report not found. Run: npm run test:performance-benchmarks');
    return false;
  }
  
  try {
    const performanceData = JSON.parse(fs.readFileSync(performanceFile, 'utf8'));
    const thresholds = performanceData.thresholds;
    const current = performanceData.current;
    
    const results = {};
    
    Object.entries(thresholds).forEach(([category, threshold]) => {
      if (current[category]) {
        const value = current[category].loadTime || current[category].responseTime || current[category].heapUsed || current[category].injectionTime || current[category].executionTime;
        const target = threshold.target;
        
        // Convert memory usage to MB for comparison
        const compareValue = category === 'memoryUsage' ? value / (1024 * 1024) : value;
        const compareTarget = category === 'memoryUsage' ? target / (1024 * 1024) : target;
        
        results[category] = {
          value: compareValue,
          target: compareTarget,
          met: compareValue <= compareTarget
        };
        
        const status = compareValue <= compareTarget ? '✅' : '❌';
        const unit = category === 'memoryUsage' ? 'MB' : 'ms';
        console.log(`${status} ${category}: ${compareValue}${unit} (target: ${compareTarget}${unit})`);
      }
    });
    
    return Object.values(results).every(result => result.met);
  } catch (error) {
    console.error('❌ Failed to parse performance benchmarks:', error.message);
    return false;
  }
}

/**
 * Verify security requirements
 */
function verifySecurityRequirements() {
  console.log('\n🔒 Verifying security requirements...');
  
  const securityFile = path.join(CONFIG.outputDirectory, 'security-scan-report.json');
  
  if (!fs.existsSync(securityFile)) {
    console.log('❌ Security scan report not found. Run: npm run test:security-scan');
    return false;
  }
  
  try {
    const securityData = JSON.parse(fs.readFileSync(securityFile, 'utf8'));
    const thresholds = securityData.thresholds;
    const counts = securityData.summary.vulnerabilityCounts;
    
    const results = {};
    
    Object.entries(thresholds).forEach(([severity, threshold]) => {
      const count = counts[severity] || 0;
      
      results[severity] = {
        count,
        threshold,
        met: count <= threshold
      };
      
      const status = count <= threshold ? '✅' : '❌';
      console.log(`${status} ${severity}: ${count} (threshold: ${threshold})`);
    });
    
    return Object.values(results).every(result => result.met);
  } catch (error) {
    console.error('❌ Failed to parse security scan report:', error.message);
    return false;
  }
}

/**
 * Verify report structure
 */
function verifyReportStructure() {
  console.log('\n📁 Verifying report structure...');
  
  const requiredReports = [
    'coverage-report.html',
    'performance-benchmarks.json',
    'security-scan-report.json'
  ];
  
  const results = {};
  
  requiredReports.forEach(report => {
    const reportPath = path.join(CONFIG.outputDirectory, report);
    const exists = fs.existsSync(reportPath);
    
    results[report] = {
      exists,
      met: exists
    };
    
    const status = exists ? '✅' : '❌';
    console.log(`${status} ${report}: ${exists ? 'found' : 'missing'}`);
  });
  
  return Object.values(results).every(result => result.met);
}

/**
 * Generate verification report
 */
function generateVerificationReport(testFiles, coverage, performance, security, reportStructure) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.outputDirectory, 'verification-report.json');
  
  const report = {
    timestamp,
    requirements: {
      testFiles: {
        met: Object.values(testFiles).every(result => result.met),
        details: testFiles
      },
      coverage: {
        met: coverage,
        requirement: `${CONFIG.requirements.unitTests.minCoverage}% coverage`
      },
      performance: {
        met: performance,
        requirement: 'All performance targets met'
      },
      security: {
        met: security,
        requirement: 'All security thresholds met'
      },
      reportStructure: {
        met: reportStructure,
        requirement: 'All required reports generated'
      }
    },
    summary: {
      overall: {
        met: Object.values(testFiles).every(result => result.met) && coverage && performance && security && reportStructure,
        status: 'pending'
      }
    }
  };
  
  // Set overall status
  report.summary.overall.status = report.summary.overall.met ? 'passed' : 'failed';
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Verification report written to: ${reportPath}`);
  
  return report;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔍 Starting Ray Chrome Extension Test Verification');
  console.log('==================================================');
  
  // Verify test files
  const testFiles = verifyTestFiles();
  
  // Verify coverage requirements
  const coverage = verifyCoverageRequirements();
  
  // Verify performance requirements
  const performance = verifyPerformanceRequirements();
  
  // Verify security requirements
  const security = verifySecurityRequirements();
  
  // Verify report structure
  const reportStructure = verifyReportStructure();
  
  // Generate verification report
  const report = generateVerificationReport(testFiles, coverage, performance, security, reportStructure);
  
  // Print final summary
  console.log('\n📋 Verification Summary:');
  console.log('======================');
  console.log(`Test Files: ${Object.values(testFiles).every(result => result.met) ? '✅' : '❌'} All requirements met`);
  console.log(`Coverage: ${coverage ? '✅' : '❌'} ${CONFIG.requirements.unitTests.minCoverage}% coverage requirement met`);
  console.log(`Performance: ${performance ? '✅' : '❌'} All performance targets met`);
  console.log(`Security: ${security ? '✅' : '❌'} All security thresholds met`);
  console.log(`Report Structure: ${reportStructure ? '✅' : '❌'} All required reports generated`);
  
  const overallStatus = report.summary.overall.status;
  console.log(`\n🎯 Overall Status: ${overallStatus.toUpperCase()}`);
  
  if (overallStatus === 'passed') {
    console.log('\n🎉 All tests pass and meet requirements!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests do not meet requirements!');
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
  verifyTestFiles,
  verifyCoverageRequirements,
  verifyPerformanceRequirements,
  verifySecurityRequirements,
  verifyReportStructure,
  generateVerificationReport,
  CONFIG
};
