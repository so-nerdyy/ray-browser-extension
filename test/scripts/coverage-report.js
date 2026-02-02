#!/usr/bin/env node

/**
 * Coverage Reporting Script
 * Generates comprehensive coverage reports for the Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  coverageDirectory: 'test/coverage',
  outputDirectory: 'test/reports',
  sourceDirectory: 'src',
  coverageThresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  },
  reportFormats: ['html', 'lcov', 'json', 'text'],
  includePatterns: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/__tests__/**',
    '!src/**/*.spec.{js,ts}'
  ],
  excludePatterns: [
    'src/**/*.mock.{js,ts}',
    'src/**/*.fixture.{js,ts}',
    'src/**/index.ts' // Often just re-exports
  ]
};

/**
 * Ensure output directories exist
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.coverageDirectory,
    CONFIG.outputDirectory,
    path.join(CONFIG.outputDirectory, 'coverage')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Run tests with coverage collection
 */
function runCoverageTests() {
  console.log('🧪 Running tests with coverage collection...');
  
  const jestConfig = {
    collectCoverage: true,
    collectCoverageFrom: CONFIG.includePatterns,
    coverageDirectory: CONFIG.coverageDirectory,
    coverageReporters: CONFIG.reportFormats,
    coverageThreshold: {
      global: CONFIG.coverageThresholds
    },
    testMatch: [
      'test/unit/*.test.js',
      'test/integration/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    verbose: true,
    passWithNoTests: false
  };
  
  const configPath = path.join(CONFIG.outputDirectory, 'jest-coverage.config.json');
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    const command = `npx jest --config ${configPath}`;
    console.log(`Executing: ${command}`);
    
    execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    
    console.log('✅ Coverage tests completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Coverage tests failed:', error.message);
    return false;
  } finally {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Parse coverage summary from Jest output
 */
function parseCoverageSummary() {
  const coverageFile = path.join(CONFIG.coverageDirectory, 'coverage-summary.json');
  
  if (!fs.existsSync(coverageFile)) {
    console.error('❌ Coverage summary file not found');
    return null;
  }
  
  try {
    const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    return coverageData;
  } catch (error) {
    console.error('❌ Failed to parse coverage summary:', error.message);
    return null;
  }
}

/**
 * Generate detailed coverage report
 */
function generateDetailedReport(coverageData) {
  if (!coverageData) {
    console.log('⚠️ No coverage data available for detailed report');
    return;
  }
  
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.outputDirectory, 'coverage', 'detailed-coverage-report.json');
  
  const report = {
    timestamp,
    thresholds: CONFIG.coverageThresholds,
    summary: {
      total: {
        statements: coverageData.total.statements,
        branches: coverageData.total.branches,
        functions: coverageData.total.functions,
        lines: coverageData.total.lines
      },
      coverage: {
        statements: coverageData.total.statements.pct,
        branches: coverageData.total.branches.pct,
        functions: coverageData.total.functions.pct,
        lines: coverageData.total.lines.pct
      }
    },
    files: {},
    thresholdsMet: {
      statements: coverageData.total.statements.pct >= CONFIG.coverageThresholds.statements,
      branches: coverageData.total.branches.pct >= CONFIG.coverageThresholds.branches,
      functions: coverageData.total.functions.pct >= CONFIG.coverageThresholds.functions,
      lines: coverageData.total.lines.pct >= CONFIG.coverageThresholds.lines
    }
  };
  
  // Process each file
  Object.keys(coverageData).forEach(file => {
    if (file !== 'total') {
      report.files[file] = {
        statements: coverageData[file].statements,
        branches: coverageData[file].branches,
        functions: coverageData[file].functions,
        lines: coverageData[file].lines,
        coverage: {
          statements: coverageData[file].statements.pct,
          branches: coverageData[file].branches.pct,
          functions: coverageData[file].functions.pct,
          lines: coverageData[file].lines.pct
        }
      };
    }
  });
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Detailed coverage report written to: ${reportPath}`);
  
  return report;
}

/**
 * Generate HTML coverage summary
 */
function generateHTMLSummary(report) {
  if (!report) {
    console.log('⚠️ No report data available for HTML summary');
    return;
  }
  
  const htmlPath = path.join(CONFIG.outputDirectory, 'coverage', 'coverage-summary.html');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ray Chrome Extension - Coverage Report</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #fafafa;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .metric.good { color: #28a745; }
        .metric.warning { color: #ffc107; }
        .metric.danger { color: #dc3545; }
        .thresholds {
            padding: 0 30px 30px;
        }
        .threshold-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .threshold-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .threshold-passed {
            background: #d4edda;
            color: #155724;
        }
        .threshold-failed {
            background: #f8d7da;
            color: #721c24;
        }
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
            <p>Code Coverage Report</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.statements >= CONFIG.coverageThresholds.statements ? 'good' : 'danger'}">
                    ${report.summary.coverage.statements.toFixed(1)}%
                </div>
                <div class="metric-label">Statements</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.branches >= CONFIG.coverageThresholds.branches ? 'good' : 'danger'}">
                    ${report.summary.coverage.branches.toFixed(1)}%
                </div>
                <div class="metric-label">Branches</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.functions >= CONFIG.coverageThresholds.functions ? 'good' : 'danger'}">
                    ${report.summary.coverage.functions.toFixed(1)}%
                </div>
                <div class="metric-label">Functions</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.lines >= CONFIG.coverageThresholds.lines ? 'good' : 'danger'}">
                    ${report.summary.coverage.lines.toFixed(1)}%
                </div>
                <div class="metric-label">Lines</div>
            </div>
        </div>
        
        <div class="thresholds">
            <h3>Coverage Thresholds</h3>
            <div class="threshold-item">
                <span>Statements (${CONFIG.coverageThresholds.statements}%)</span>
                <span class="threshold-status ${report.thresholdsMet.statements ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.statements ? 'PASSED' : 'FAILED'}
                </span>
            </div>
            <div class="threshold-item">
                <span>Branches (${CONFIG.coverageThresholds.branches}%)</span>
                <span class="threshold-status ${report.thresholdsMet.branches ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.branches ? 'PASSED' : 'FAILED'}
                </span>
            </div>
            <div class="threshold-item">
                <span>Functions (${CONFIG.coverageThresholds.functions}%)</span>
                <span class="threshold-status ${report.thresholdsMet.functions ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.functions ? 'PASSED' : 'FAILED'}
                </span>
            </div>
            <div class="threshold-item">
                <span>Lines (${CONFIG.coverageThresholds.lines}%)</span>
                <span class="threshold-status ${report.thresholdsMet.lines ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.lines ? 'PASSED' : 'FAILED'}
                </span>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by Ray Chrome Extension Test Suite</p>
        </div>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML coverage summary written to: ${htmlPath}`);
}

/**
 * Check if coverage thresholds are met
 */
function checkThresholds(report) {
  if (!report) {
    return false;
  }
  
  const allThresholdsMet = Object.values(report.thresholdsMet).every(met => met);
  
  console.log('\n📊 Coverage Threshold Results:');
  console.log('==============================');
  
  Object.entries(report.thresholdsMet).forEach(([metric, met]) => {
    const threshold = CONFIG.coverageThresholds[metric];
    const actual = report.summary.coverage[metric];
    const status = met ? '✅' : '❌';
    console.log(`${status} ${metric.charAt(0).toUpperCase() + metric.slice(1)}: ${actual.toFixed(1)}% (threshold: ${threshold}%)`);
  });
  
  return allThresholdsMet;
}

/**
 * Copy coverage reports to output directory
 */
function copyCoverageReports() {
  const htmlReportDir = path.join(CONFIG.coverageDirectory, 'lcov-report');
  const outputHtmlDir = path.join(CONFIG.outputDirectory, 'coverage', 'html');
  
  if (fs.existsSync(htmlReportDir)) {
    // Copy HTML coverage report
    const copyCommand = process.platform === 'win32' ? 
      `xcopy "${htmlReportDir}" "${outputHtmlDir}" /E /I /Y` :
      `cp -r "${htmlReportDir}"/* "${outputHtmlDir}/"`;
    
    try {
      execSync(copyCommand);
      console.log(`📁 HTML coverage report copied to: ${outputHtmlDir}`);
    } catch (error) {
      console.error('⚠️ Failed to copy HTML coverage report:', error.message);
    }
  }
  
  // Copy LCOV file
  const lcovFile = path.join(CONFIG.coverageDirectory, 'lcov.info');
  const outputLcovFile = path.join(CONFIG.outputDirectory, 'coverage', 'lcov.info');
  
  if (fs.existsSync(lcovFile)) {
    fs.copyFileSync(lcovFile, outputLcovFile);
    console.log(`📄 LCOV file copied to: ${outputLcovFile}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('📊 Starting Ray Chrome Extension Coverage Report');
  console.log('===============================================');
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Run tests with coverage
  const coverageSuccess = runCoverageTests();
  if (!coverageSuccess) {
    console.log('❌ Coverage collection failed');
    process.exit(1);
  }
  
  // Parse coverage data
  const coverageData = parseCoverageSummary();
  if (!coverageData) {
    console.log('❌ Failed to parse coverage data');
    process.exit(1);
  }
  
  // Generate detailed report
  const report = generateDetailedReport(coverageData);
  
  // Generate HTML summary
  generateHTMLSummary(report);
  
  // Copy coverage reports
  copyCoverageReports();
  
  // Check thresholds
  const thresholdsMet = checkThresholds(report);
  
  // Print final summary
  console.log('\n📋 Coverage Summary:');
  console.log('===================');
  console.log(`Statements: ${coverageData.total.statements.pct.toFixed(1)}%`);
  console.log(`Branches: ${coverageData.total.branches.pct.toFixed(1)}%`);
  console.log(`Functions: ${coverageData.total.functions.pct.toFixed(1)}%`);
  console.log(`Lines: ${coverageData.total.lines.pct.toFixed(1)}%`);
  
  console.log(`\n📁 Reports generated in: ${path.join(CONFIG.outputDirectory, 'coverage')}`);
  
  // Exit with appropriate code
  if (thresholdsMet) {
    console.log('\n🎉 All coverage thresholds met!');
    process.exit(0);
  } else {
    console.log('\n💥 Some coverage thresholds not met!');
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
  runCoverageTests,
  parseCoverageSummary,
  generateDetailedReport,
  generateHTMLSummary,
  checkThresholds,
  CONFIG
};
/**
 * Coverage Reporting Script
 * Generates comprehensive coverage reports for the Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  coverageDirectory: 'test/coverage',
  outputDirectory: 'test/reports',
  sourceDirectory: 'src',
  coverageThresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  },
  reportFormats: ['html', 'lcov', 'json', 'text'],
  includePatterns: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts}',
    '!src/**/__tests__/**',
    '!src/**/*.spec.{js,ts}'
  ],
  excludePatterns: [
    'src/**/*.mock.{js,ts}',
    'src/**/*.fixture.{js,ts}',
    'src/**/index.ts' // Often just re-exports
  ]
};

/**
 * Ensure output directories exist
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.coverageDirectory,
    CONFIG.outputDirectory,
    path.join(CONFIG.outputDirectory, 'coverage')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Run tests with coverage collection
 */
function runCoverageTests() {
  console.log('🧪 Running tests with coverage collection...');
  
  const jestConfig = {
    collectCoverage: true,
    collectCoverageFrom: CONFIG.includePatterns,
    coverageDirectory: CONFIG.coverageDirectory,
    coverageReporters: CONFIG.reportFormats,
    coverageThreshold: {
      global: CONFIG.coverageThresholds
    },
    testMatch: [
      'test/unit/*.test.js',
      'test/integration/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    verbose: true,
    passWithNoTests: false
  };
  
  const configPath = path.join(CONFIG.outputDirectory, 'jest-coverage.config.json');
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    const command = `npx jest --config ${configPath}`;
    console.log(`Executing: ${command}`);
    
    execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    
    console.log('✅ Coverage tests completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Coverage tests failed:', error.message);
    return false;
  } finally {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Parse coverage summary from Jest output
 */
function parseCoverageSummary() {
  const coverageFile = path.join(CONFIG.coverageDirectory, 'coverage-summary.json');
  
  if (!fs.existsSync(coverageFile)) {
    console.error('❌ Coverage summary file not found');
    return null;
  }
  
  try {
    const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    return coverageData;
  } catch (error) {
    console.error('❌ Failed to parse coverage summary:', error.message);
    return null;
  }
}

/**
 * Generate detailed coverage report
 */
function generateDetailedReport(coverageData) {
  if (!coverageData) {
    console.log('⚠️ No coverage data available for detailed report');
    return;
  }
  
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.outputDirectory, 'coverage', 'detailed-coverage-report.json');
  
  const report = {
    timestamp,
    thresholds: CONFIG.coverageThresholds,
    summary: {
      total: {
        statements: coverageData.total.statements,
        branches: coverageData.total.branches,
        functions: coverageData.total.functions,
        lines: coverageData.total.lines
      },
      coverage: {
        statements: coverageData.total.statements.pct,
        branches: coverageData.total.branches.pct,
        functions: coverageData.total.functions.pct,
        lines: coverageData.total.lines.pct
      }
    },
    files: {},
    thresholdsMet: {
      statements: coverageData.total.statements.pct >= CONFIG.coverageThresholds.statements,
      branches: coverageData.total.branches.pct >= CONFIG.coverageThresholds.branches,
      functions: coverageData.total.functions.pct >= CONFIG.coverageThresholds.functions,
      lines: coverageData.total.lines.pct >= CONFIG.coverageThresholds.lines
    }
  };
  
  // Process each file
  Object.keys(coverageData).forEach(file => {
    if (file !== 'total') {
      report.files[file] = {
        statements: coverageData[file].statements,
        branches: coverageData[file].branches,
        functions: coverageData[file].functions,
        lines: coverageData[file].lines,
        coverage: {
          statements: coverageData[file].statements.pct,
          branches: coverageData[file].branches.pct,
          functions: coverageData[file].functions.pct,
          lines: coverageData[file].lines.pct
        }
      };
    }
  });
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Detailed coverage report written to: ${reportPath}`);
  
  return report;
}

/**
 * Generate HTML coverage summary
 */
function generateHTMLSummary(report) {
  if (!report) {
    console.log('⚠️ No report data available for HTML summary');
    return;
  }
  
  const htmlPath = path.join(CONFIG.outputDirectory, 'coverage', 'coverage-summary.html');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ray Chrome Extension - Coverage Report</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #fafafa;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .metric.good { color: #28a745; }
        .metric.warning { color: #ffc107; }
        .metric.danger { color: #dc3545; }
        .thresholds {
            padding: 0 30px 30px;
        }
        .threshold-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .threshold-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .threshold-passed {
            background: #d4edda;
            color: #155724;
        }
        .threshold-failed {
            background: #f8d7da;
            color: #721c24;
        }
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
            <p>Code Coverage Report</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.statements >= CONFIG.coverageThresholds.statements ? 'good' : 'danger'}">
                    ${report.summary.coverage.statements.toFixed(1)}%
                </div>
                <div class="metric-label">Statements</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.branches >= CONFIG.coverageThresholds.branches ? 'good' : 'danger'}">
                    ${report.summary.coverage.branches.toFixed(1)}%
                </div>
                <div class="metric-label">Branches</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.functions >= CONFIG.coverageThresholds.functions ? 'good' : 'danger'}">
                    ${report.summary.coverage.functions.toFixed(1)}%
                </div>
                <div class="metric-label">Functions</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.coverage.lines >= CONFIG.coverageThresholds.lines ? 'good' : 'danger'}">
                    ${report.summary.coverage.lines.toFixed(1)}%
                </div>
                <div class="metric-label">Lines</div>
            </div>
        </div>
        
        <div class="thresholds">
            <h3>Coverage Thresholds</h3>
            <div class="threshold-item">
                <span>Statements (${CONFIG.coverageThresholds.statements}%)</span>
                <span class="threshold-status ${report.thresholdsMet.statements ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.statements ? 'PASSED' : 'FAILED'}
                </span>
            </div>
            <div class="threshold-item">
                <span>Branches (${CONFIG.coverageThresholds.branches}%)</span>
                <span class="threshold-status ${report.thresholdsMet.branches ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.branches ? 'PASSED' : 'FAILED'}
                </span>
            </div>
            <div class="threshold-item">
                <span>Functions (${CONFIG.coverageThresholds.functions}%)</span>
                <span class="threshold-status ${report.thresholdsMet.functions ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.functions ? 'PASSED' : 'FAILED'}
                </span>
            </div>
            <div class="threshold-item">
                <span>Lines (${CONFIG.coverageThresholds.lines}%)</span>
                <span class="threshold-status ${report.thresholdsMet.lines ? 'threshold-passed' : 'threshold-failed'}">
                    ${report.thresholdsMet.lines ? 'PASSED' : 'FAILED'}
                </span>
            </div>
        </div>
        
        <div class="footer">
            <p>Generated by Ray Chrome Extension Test Suite</p>
        </div>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML coverage summary written to: ${htmlPath}`);
}

/**
 * Check if coverage thresholds are met
 */
function checkThresholds(report) {
  if (!report) {
    return false;
  }
  
  const allThresholdsMet = Object.values(report.thresholdsMet).every(met => met);
  
  console.log('\n📊 Coverage Threshold Results:');
  console.log('==============================');
  
  Object.entries(report.thresholdsMet).forEach(([metric, met]) => {
    const threshold = CONFIG.coverageThresholds[metric];
    const actual = report.summary.coverage[metric];
    const status = met ? '✅' : '❌';
    console.log(`${status} ${metric.charAt(0).toUpperCase() + metric.slice(1)}: ${actual.toFixed(1)}% (threshold: ${threshold}%)`);
  });
  
  return allThresholdsMet;
}

/**
 * Copy coverage reports to output directory
 */
function copyCoverageReports() {
  const htmlReportDir = path.join(CONFIG.coverageDirectory, 'lcov-report');
  const outputHtmlDir = path.join(CONFIG.outputDirectory, 'coverage', 'html');
  
  if (fs.existsSync(htmlReportDir)) {
    // Copy HTML coverage report
    const copyCommand = process.platform === 'win32' ? 
      `xcopy "${htmlReportDir}" "${outputHtmlDir}" /E /I /Y` :
      `cp -r "${htmlReportDir}"/* "${outputHtmlDir}/"`;
    
    try {
      execSync(copyCommand);
      console.log(`📁 HTML coverage report copied to: ${outputHtmlDir}`);
    } catch (error) {
      console.error('⚠️ Failed to copy HTML coverage report:', error.message);
    }
  }
  
  // Copy LCOV file
  const lcovFile = path.join(CONFIG.coverageDirectory, 'lcov.info');
  const outputLcovFile = path.join(CONFIG.outputDirectory, 'coverage', 'lcov.info');
  
  if (fs.existsSync(lcovFile)) {
    fs.copyFileSync(lcovFile, outputLcovFile);
    console.log(`📄 LCOV file copied to: ${outputLcovFile}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('📊 Starting Ray Chrome Extension Coverage Report');
  console.log('===============================================');
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Run tests with coverage
  const coverageSuccess = runCoverageTests();
  if (!coverageSuccess) {
    console.log('❌ Coverage collection failed');
    process.exit(1);
  }
  
  // Parse coverage data
  const coverageData = parseCoverageSummary();
  if (!coverageData) {
    console.log('❌ Failed to parse coverage data');
    process.exit(1);
  }
  
  // Generate detailed report
  const report = generateDetailedReport(coverageData);
  
  // Generate HTML summary
  generateHTMLSummary(report);
  
  // Copy coverage reports
  copyCoverageReports();
  
  // Check thresholds
  const thresholdsMet = checkThresholds(report);
  
  // Print final summary
  console.log('\n📋 Coverage Summary:');
  console.log('===================');
  console.log(`Statements: ${coverageData.total.statements.pct.toFixed(1)}%`);
  console.log(`Branches: ${coverageData.total.branches.pct.toFixed(1)}%`);
  console.log(`Functions: ${coverageData.total.functions.pct.toFixed(1)}%`);
  console.log(`Lines: ${coverageData.total.lines.pct.toFixed(1)}%`);
  
  console.log(`\n📁 Reports generated in: ${path.join(CONFIG.outputDirectory, 'coverage')}`);
  
  // Exit with appropriate code
  if (thresholdsMet) {
    console.log('\n🎉 All coverage thresholds met!');
    process.exit(0);
  } else {
    console.log('\n💥 Some coverage thresholds not met!');
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
  runCoverageTests,
  parseCoverageSummary,
  generateDetailedReport,
  generateHTMLSummary,
  checkThresholds,
  CONFIG
};
