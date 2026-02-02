#!/usr/bin/env node

/**
 * Performance Benchmarks Script
 * Runs performance tests and generates benchmark reports for Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  outputDirectory: 'test/reports',
  benchmarkDirectory: 'test/reports/performance',
  testPattern: 'test/performance/*.test.js',
  thresholds: {
    popupLoad: {
      max: 200, // 200ms max popup load time
      target: 100 // 100ms target popup load time
    },
    apiResponse: {
      max: 1000, // 1000ms max API response time
      target: 500 // 500ms target API response time
    },
    memoryUsage: {
      max: 50 * 1024 * 1024, // 50MB max memory usage
      target: 20 * 1024 * 1024 // 20MB target memory usage
    },
    contentScriptLoad: {
      max: 100, // 100ms max content script load time
      target: 50 // 50ms target content script load time
    },
    automationExecution: {
      max: 5000, // 5000ms max automation execution time
      target: 2000 // 2000ms target automation execution time
    }
  },
  reportFormats: ['json', 'html'],
  historyFile: 'test/reports/performance/history.json'
};

/**
 * Ensure output directories exist
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.outputDirectory,
    CONFIG.benchmarkDirectory
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Run performance tests
 */
function runPerformanceTests() {
  console.log('🚀 Running performance tests...');
  
  const jestConfig = {
    testMatch: [CONFIG.testPattern],
    testTimeout: 30000, // 30 seconds per test
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    reporters: ['default', 'jest-json-reporter'],
    jsonReporters: ['jest-json-reporter']
  };
  
  const configPath = path.join(CONFIG.outputDirectory, 'jest-performance.config.json');
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    const command = `npx jest --config ${configPath} --json --outputFile=${path.join(CONFIG.benchmarkDirectory, 'performance-results.json')}`;
    console.log(`Executing: ${command}`);
    
    execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    
    console.log('✅ Performance tests completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Performance tests failed:', error.message);
    return false;
  } finally {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Parse performance test results
 */
function parsePerformanceResults() {
  const resultsFile = path.join(CONFIG.benchmarkDirectory, 'performance-results.json');
  
  if (!fs.existsSync(resultsFile)) {
    console.error('❌ Performance results file not found');
    return null;
  }
  
  try {
    const resultsData = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    
    // Extract performance metrics from test results
    const benchmarks = {};
    
    resultsData.testResults.forEach(testResult => {
      const testTitle = testResult.title;
      const testFilePath = testResult.testFilePath;
      const testSuite = path.basename(testFilePath, '.test.js');
      
      // Extract performance metrics from test results
      if (testResult.perfStats) {
        benchmarks[testSuite] = {
          runtime: testResult.perfStats.runtime || 0,
          slow: testResult.perfStats.slow || false,
          memoryUsage: testResult.perfStats.memoryUsage || 0
        };
      }
      
      // Extract custom performance data from test assertions
      if (testResult.assertionResults) {
        testResult.assertionResults.forEach(assertion => {
          if (assertion.failureMessages && assertion.failureMessages.length > 0) {
            // Look for performance data in failure messages (our tests report metrics this way)
            const perfMatch = assertion.failureMessages[0].match(/Performance: (\{.*\})/);
            if (perfMatch) {
              try {
                const perfData = JSON.parse(perfMatch[1]);
                benchmarks[testSuite] = { ...benchmarks[testSuite], ...perfData };
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          }
        });
      }
    });
    
    return benchmarks;
  } catch (error) {
    console.error('❌ Failed to parse performance results:', error.message);
    return null;
  }
}

/**
 * Load historical performance data
 */
function loadHistoricalData() {
  if (!fs.existsSync(CONFIG.historyFile)) {
    return [];
  }
  
  try {
    const historyData = JSON.parse(fs.readFileSync(CONFIG.historyFile, 'utf8'));
    return Array.isArray(historyData) ? historyData : [];
  } catch (error) {
    console.warn('⚠️ Failed to load historical data:', error.message);
    return [];
  }
}

/**
 * Save historical performance data
 */
function saveHistoricalData(historyData) {
  try {
    fs.writeFileSync(CONFIG.historyFile, JSON.stringify(historyData, null, 2));
    console.log(`💾 Historical data saved to: ${CONFIG.historyFile}`);
  } catch (error) {
    console.error('❌ Failed to save historical data:', error.message);
  }
}

/**
 * Generate performance benchmark report
 */
function generateBenchmarkReport(benchmarks, historicalData) {
  if (!benchmarks) {
    console.log('⚠️ No benchmark data available');
    return null;
  }
  
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.benchmarkDirectory, 'benchmark-report.json');
  
  // Add current benchmarks to history
  const currentEntry = {
    timestamp,
    benchmarks: { ...benchmarks }
  };
  
  const updatedHistory = [...historicalData, currentEntry];
  
  // Keep only last 30 entries
  if (updatedHistory.length > 30) {
    updatedHistory.splice(0, updatedHistory.length - 30);
  }
  
  // Calculate trends and statistics
  const trends = {};
  const statistics = {};
  
  Object.keys(benchmarks).forEach(category => {
    const categoryHistory = updatedHistory
      .filter(entry => entry.benchmarks[category])
      .map(entry => entry.benchmarks[category]);
    
    if (categoryHistory.length > 1) {
      const recent = categoryHistory[categoryHistory.length - 1];
      const previous = categoryHistory[categoryHistory.length - 2];
      
      // Calculate trend (percentage change)
      trends[category] = {};
      Object.keys(recent).forEach(metric => {
        if (typeof recent[metric] === 'number' && typeof previous[metric] === 'number') {
          const change = ((recent[metric] - previous[metric]) / previous[metric]) * 100;
          trends[category][metric] = {
            change: change,
            direction: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable'
          };
        }
      });
      
      // Calculate statistics
      const values = categoryHistory.map(entry => entry.runtime || 0);
      statistics[category] = {
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
      };
    }
  });
  
  const report = {
    timestamp,
    thresholds: CONFIG.thresholds,
    current: benchmarks,
    trends,
    statistics,
    history: updatedHistory,
    summary: {
      totalCategories: Object.keys(benchmarks).length,
      thresholdsMet: {},
      overallPerformance: 'good' // Will be calculated below
    }
  };
  
  // Check thresholds
  Object.keys(CONFIG.thresholds).forEach(category => {
    if (benchmarks[category]) {
      const threshold = CONFIG.thresholds[category];
      const current = benchmarks[category];
      
      report.summary.thresholdsMet[category] = {
        max: false,
        target: false
      };
      
      // Check different metric types
      if (category === 'memoryUsage') {
        report.summary.thresholdsMet[category].max = current.memoryUsage <= threshold.max;
        report.summary.thresholdsMet[category].target = current.memoryUsage <= threshold.target;
      } else if (category === 'popupLoad') {
        report.summary.thresholdsMet[category].max = current.loadTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.loadTime <= threshold.target;
      } else if (category === 'apiResponse') {
        report.summary.thresholdsMet[category].max = current.responseTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.responseTime <= threshold.target;
      } else if (category === 'contentScriptLoad') {
        report.summary.thresholdsMet[category].max = current.injectionTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.injectionTime <= threshold.target;
      } else if (category === 'automationExecution') {
        report.summary.thresholdsMet[category].max = current.executionTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.executionTime <= threshold.target;
      }
    }
  });
  
  // Calculate overall performance
  const allTargetsMet = Object.values(report.summary.thresholdsMet).every(
    thresholds => thresholds.target
  );
  const allMaxMet = Object.values(report.summary.thresholdsMet).every(
    thresholds => thresholds.max
  );
  
  if (allTargetsMet) {
    report.summary.overallPerformance = 'excellent';
  } else if (allMaxMet) {
    report.summary.overallPerformance = 'good';
  } else {
    report.summary.overallPerformance = 'needs-improvement';
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Benchmark report written to: ${reportPath}`);
  
  // Save updated history
  saveHistoricalData(updatedHistory);
  
  return report;
}

/**
 * Generate HTML benchmark report
 */
function generateHTMLBenchmarkReport(report) {
  if (!report) {
    console.log('⚠️ No report data available for HTML benchmark report');
    return;
  }
  
  const htmlPath = path.join(CONFIG.benchmarkDirectory, 'benchmark-report.html');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ray Chrome Extension - Performance Benchmarks</title>
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
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
        .overall-performance {
            padding: 20px;
            text-align: center;
            font-size: 1.2em;
            font-weight: bold;
        }
        .performance-excellent { background: #d4edda; color: #155724; }
        .performance-good { background: #d1ecf1; color: #0c5460; }
        .performance-needs-improvement { background: #f8d7da; color: #721c24; }
        .benchmarks {
            padding: 0 30px 30px;
        }
        .benchmark-item {
            margin-bottom: 30px;
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
        }
        .benchmark-header {
            background: #f8f9fa;
            padding: 15px 20px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .benchmark-metrics {
            padding: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .metric {
            text-align: center;
            padding: 15px;
            background: #fafafa;
            border-radius: 6px;
        }
        .metric-value {
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .threshold-indicator {
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
        .trend {
            display: inline-block;
            margin-left: 5px;
            font-size: 0.9em;
        }
        .trend-up { color: #dc3545; }
        .trend-down { color: #28a745; }
        .trend-stable { color: #6c757d; }
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
            <p>Performance Benchmarks</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="overall-performance performance-${report.summary.overallPerformance}">
            Overall Performance: ${report.summary.overallPerformance.replace('-', ' ').toUpperCase()}
        </div>
        
        <div class="benchmarks">
            ${generateBenchmarkHTML(report)}
        </div>
        
        <div class="footer">
            <p>Generated by Ray Chrome Extension Performance Test Suite</p>
        </div>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML benchmark report written to: ${htmlPath}`);
}

/**
 * Generate HTML for individual benchmarks
 */
function generateBenchmarkHTML(report) {
  let html = '';
  
  Object.keys(report.current).forEach(category => {
    const current = report.current[category];
    const thresholds = CONFIG.thresholds[category];
    const thresholdMet = report.summary.thresholdsMet[category];
    const trend = report.trends[category];
    
    html += `
      <div class="benchmark-item">
        <div class="benchmark-header">
          <span>${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
          <span>
            <span class="threshold-indicator ${thresholdMet.target ? 'threshold-passed' : 'threshold-failed'}">
              ${thresholdMet.target ? 'TARGET MET' : 'TARGET MISSED'}
            </span>
          </span>
        </div>
        <div class="benchmark-metrics">
    `;
    
    // Add metrics based on category
    if (category === 'memoryUsage') {
      html += `
        <div class="metric">
          <div class="metric-value">${(current.memoryUsage / 1024 / 1024).toFixed(1)} MB</div>
          <div class="metric-label">Memory Usage</div>
          <div class="metric-label">Target: ${(thresholds.target / 1024 / 1024).toFixed(1)} MB</div>
          ${trend && trend.memoryUsage ? `
            <div class="trend trend-${trend.memoryUsage.direction}">
              ${trend.memoryUsage.direction === 'increasing' ? '↑' : trend.memoryUsage.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.memoryUsage.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'popupLoad') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.loadTime} ms</div>
          <div class="metric-label">Load Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.loadTime ? `
            <div class="trend trend-${trend.loadTime.direction}">
              ${trend.loadTime.direction === 'increasing' ? '↑' : trend.loadTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.loadTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'apiResponse') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.responseTime} ms</div>
          <div class="metric-label">Response Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.responseTime ? `
            <div class="trend trend-${trend.responseTime.direction}">
              ${trend.responseTime.direction === 'increasing' ? '↑' : trend.responseTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.responseTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'contentScriptLoad') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.injectionTime} ms</div>
          <div class="metric-label">Injection Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.injectionTime ? `
            <div class="trend trend-${trend.injectionTime.direction}">
              ${trend.injectionTime.direction === 'increasing' ? '↑' : trend.injectionTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.injectionTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'automationExecution') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.executionTime} ms</div>
          <div class="metric-label">Execution Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.executionTime ? `
            <div class="trend trend-${trend.executionTime.direction}">
              ${trend.executionTime.direction === 'increasing' ? '↑' : trend.executionTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.executionTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
  });
  
  return html;
}

/**
 * Check if performance thresholds are met
 */
function checkThresholds(report) {
  if (!report) {
    return false;
  }
  
  const allTargetsMet = Object.values(report.summary.thresholdsMet).every(
    thresholds => thresholds.target
  );
  
  console.log('\n📊 Performance Threshold Results:');
  console.log('=================================');
  
  Object.entries(report.summary.thresholdsMet).forEach(([category, thresholds]) => {
    const targetStatus = thresholds.target ? '✅' : '❌';
    const maxStatus = thresholds.max ? '✅' : '❌';
    console.log(`${targetStatus} ${category}: Target ${thresholds.target ? 'MET' : 'MISSED'}, Max ${thresholds.max ? 'MET' : 'MISSED'}`);
  });
  
  console.log(`\n🎯 Overall Performance: ${report.summary.overallPerformance}`);
  
  return allTargetsMet;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Ray Chrome Extension Performance Benchmarks');
  console.log('===================================================');
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Load historical data
  const historicalData = loadHistoricalData();
  console.log(`📈 Loaded ${historicalData.length} historical data points`);
  
  // Run performance tests
  const testsSuccess = runPerformanceTests();
  if (!testsSuccess) {
    console.log('❌ Performance tests failed');
    process.exit(1);
  }
  
  // Parse performance results
  const benchmarks = parsePerformanceResults();
  if (!benchmarks) {
    console.log('❌ Failed to parse performance results');
    process.exit(1);
  }
  
  // Generate benchmark report
  const report = generateBenchmarkReport(benchmarks, historicalData);
  
  // Generate HTML report
  generateHTMLBenchmarkReport(report);
  
  // Check thresholds
  const thresholdsMet = checkThresholds(report);
  
  // Print final summary
  console.log('\n📋 Performance Summary:');
  console.log('======================');
  console.log(`Overall Performance: ${report.summary.overallPerformance}`);
  console.log(`Categories Tested: ${report.summary.totalCategories}`);
  
  console.log(`\n📁 Reports generated in: ${CONFIG.benchmarkDirectory}`);
  
  // Exit with appropriate code
  if (thresholdsMet) {
    console.log('\n🎉 All performance targets met!');
    process.exit(0);
  } else {
    console.log('\n💥 Some performance targets not met!');
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
  runPerformanceTests,
  parsePerformanceResults,
  generateBenchmarkReport,
  generateHTMLBenchmarkReport,
  checkThresholds,
  CONFIG
};
/**
 * Performance Benchmarks Script
 * Runs performance tests and generates benchmark reports for Ray Chrome Extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  outputDirectory: 'test/reports',
  benchmarkDirectory: 'test/reports/performance',
  testPattern: 'test/performance/*.test.js',
  thresholds: {
    popupLoad: {
      max: 200, // 200ms max popup load time
      target: 100 // 100ms target popup load time
    },
    apiResponse: {
      max: 1000, // 1000ms max API response time
      target: 500 // 500ms target API response time
    },
    memoryUsage: {
      max: 50 * 1024 * 1024, // 50MB max memory usage
      target: 20 * 1024 * 1024 // 20MB target memory usage
    },
    contentScriptLoad: {
      max: 100, // 100ms max content script load time
      target: 50 // 50ms target content script load time
    },
    automationExecution: {
      max: 5000, // 5000ms max automation execution time
      target: 2000 // 2000ms target automation execution time
    }
  },
  reportFormats: ['json', 'html'],
  historyFile: 'test/reports/performance/history.json'
};

/**
 * Ensure output directories exist
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.outputDirectory,
    CONFIG.benchmarkDirectory
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Run performance tests
 */
function runPerformanceTests() {
  console.log('🚀 Running performance tests...');
  
  const jestConfig = {
    testMatch: [CONFIG.testPattern],
    testTimeout: 30000, // 30 seconds per test
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    reporters: ['default', 'jest-json-reporter'],
    jsonReporters: ['jest-json-reporter']
  };
  
  const configPath = path.join(CONFIG.outputDirectory, 'jest-performance.config.json');
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    const command = `npx jest --config ${configPath} --json --outputFile=${path.join(CONFIG.benchmarkDirectory, 'performance-results.json')}`;
    console.log(`Executing: ${command}`);
    
    execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });
    
    console.log('✅ Performance tests completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Performance tests failed:', error.message);
    return false;
  } finally {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Parse performance test results
 */
function parsePerformanceResults() {
  const resultsFile = path.join(CONFIG.benchmarkDirectory, 'performance-results.json');
  
  if (!fs.existsSync(resultsFile)) {
    console.error('❌ Performance results file not found');
    return null;
  }
  
  try {
    const resultsData = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    
    // Extract performance metrics from test results
    const benchmarks = {};
    
    resultsData.testResults.forEach(testResult => {
      const testTitle = testResult.title;
      const testFilePath = testResult.testFilePath;
      const testSuite = path.basename(testFilePath, '.test.js');
      
      // Extract performance metrics from test results
      if (testResult.perfStats) {
        benchmarks[testSuite] = {
          runtime: testResult.perfStats.runtime || 0,
          slow: testResult.perfStats.slow || false,
          memoryUsage: testResult.perfStats.memoryUsage || 0
        };
      }
      
      // Extract custom performance data from test assertions
      if (testResult.assertionResults) {
        testResult.assertionResults.forEach(assertion => {
          if (assertion.failureMessages && assertion.failureMessages.length > 0) {
            // Look for performance data in failure messages (our tests report metrics this way)
            const perfMatch = assertion.failureMessages[0].match(/Performance: (\{.*\})/);
            if (perfMatch) {
              try {
                const perfData = JSON.parse(perfMatch[1]);
                benchmarks[testSuite] = { ...benchmarks[testSuite], ...perfData };
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          }
        });
      }
    });
    
    return benchmarks;
  } catch (error) {
    console.error('❌ Failed to parse performance results:', error.message);
    return null;
  }
}

/**
 * Load historical performance data
 */
function loadHistoricalData() {
  if (!fs.existsSync(CONFIG.historyFile)) {
    return [];
  }
  
  try {
    const historyData = JSON.parse(fs.readFileSync(CONFIG.historyFile, 'utf8'));
    return Array.isArray(historyData) ? historyData : [];
  } catch (error) {
    console.warn('⚠️ Failed to load historical data:', error.message);
    return [];
  }
}

/**
 * Save historical performance data
 */
function saveHistoricalData(historyData) {
  try {
    fs.writeFileSync(CONFIG.historyFile, JSON.stringify(historyData, null, 2));
    console.log(`💾 Historical data saved to: ${CONFIG.historyFile}`);
  } catch (error) {
    console.error('❌ Failed to save historical data:', error.message);
  }
}

/**
 * Generate performance benchmark report
 */
function generateBenchmarkReport(benchmarks, historicalData) {
  if (!benchmarks) {
    console.log('⚠️ No benchmark data available');
    return null;
  }
  
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.benchmarkDirectory, 'benchmark-report.json');
  
  // Add current benchmarks to history
  const currentEntry = {
    timestamp,
    benchmarks: { ...benchmarks }
  };
  
  const updatedHistory = [...historicalData, currentEntry];
  
  // Keep only last 30 entries
  if (updatedHistory.length > 30) {
    updatedHistory.splice(0, updatedHistory.length - 30);
  }
  
  // Calculate trends and statistics
  const trends = {};
  const statistics = {};
  
  Object.keys(benchmarks).forEach(category => {
    const categoryHistory = updatedHistory
      .filter(entry => entry.benchmarks[category])
      .map(entry => entry.benchmarks[category]);
    
    if (categoryHistory.length > 1) {
      const recent = categoryHistory[categoryHistory.length - 1];
      const previous = categoryHistory[categoryHistory.length - 2];
      
      // Calculate trend (percentage change)
      trends[category] = {};
      Object.keys(recent).forEach(metric => {
        if (typeof recent[metric] === 'number' && typeof previous[metric] === 'number') {
          const change = ((recent[metric] - previous[metric]) / previous[metric]) * 100;
          trends[category][metric] = {
            change: change,
            direction: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable'
          };
        }
      });
      
      // Calculate statistics
      const values = categoryHistory.map(entry => entry.runtime || 0);
      statistics[category] = {
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
      };
    }
  });
  
  const report = {
    timestamp,
    thresholds: CONFIG.thresholds,
    current: benchmarks,
    trends,
    statistics,
    history: updatedHistory,
    summary: {
      totalCategories: Object.keys(benchmarks).length,
      thresholdsMet: {},
      overallPerformance: 'good' // Will be calculated below
    }
  };
  
  // Check thresholds
  Object.keys(CONFIG.thresholds).forEach(category => {
    if (benchmarks[category]) {
      const threshold = CONFIG.thresholds[category];
      const current = benchmarks[category];
      
      report.summary.thresholdsMet[category] = {
        max: false,
        target: false
      };
      
      // Check different metric types
      if (category === 'memoryUsage') {
        report.summary.thresholdsMet[category].max = current.memoryUsage <= threshold.max;
        report.summary.thresholdsMet[category].target = current.memoryUsage <= threshold.target;
      } else if (category === 'popupLoad') {
        report.summary.thresholdsMet[category].max = current.loadTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.loadTime <= threshold.target;
      } else if (category === 'apiResponse') {
        report.summary.thresholdsMet[category].max = current.responseTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.responseTime <= threshold.target;
      } else if (category === 'contentScriptLoad') {
        report.summary.thresholdsMet[category].max = current.injectionTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.injectionTime <= threshold.target;
      } else if (category === 'automationExecution') {
        report.summary.thresholdsMet[category].max = current.executionTime <= threshold.max;
        report.summary.thresholdsMet[category].target = current.executionTime <= threshold.target;
      }
    }
  });
  
  // Calculate overall performance
  const allTargetsMet = Object.values(report.summary.thresholdsMet).every(
    thresholds => thresholds.target
  );
  const allMaxMet = Object.values(report.summary.thresholdsMet).every(
    thresholds => thresholds.max
  );
  
  if (allTargetsMet) {
    report.summary.overallPerformance = 'excellent';
  } else if (allMaxMet) {
    report.summary.overallPerformance = 'good';
  } else {
    report.summary.overallPerformance = 'needs-improvement';
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Benchmark report written to: ${reportPath}`);
  
  // Save updated history
  saveHistoricalData(updatedHistory);
  
  return report;
}

/**
 * Generate HTML benchmark report
 */
function generateHTMLBenchmarkReport(report) {
  if (!report) {
    console.log('⚠️ No report data available for HTML benchmark report');
    return;
  }
  
  const htmlPath = path.join(CONFIG.benchmarkDirectory, 'benchmark-report.html');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ray Chrome Extension - Performance Benchmarks</title>
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
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
        .overall-performance {
            padding: 20px;
            text-align: center;
            font-size: 1.2em;
            font-weight: bold;
        }
        .performance-excellent { background: #d4edda; color: #155724; }
        .performance-good { background: #d1ecf1; color: #0c5460; }
        .performance-needs-improvement { background: #f8d7da; color: #721c24; }
        .benchmarks {
            padding: 0 30px 30px;
        }
        .benchmark-item {
            margin-bottom: 30px;
            border: 1px solid #eee;
            border-radius: 8px;
            overflow: hidden;
        }
        .benchmark-header {
            background: #f8f9fa;
            padding: 15px 20px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .benchmark-metrics {
            padding: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .metric {
            text-align: center;
            padding: 15px;
            background: #fafafa;
            border-radius: 6px;
        }
        .metric-value {
            font-size: 1.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .threshold-indicator {
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
        .trend {
            display: inline-block;
            margin-left: 5px;
            font-size: 0.9em;
        }
        .trend-up { color: #dc3545; }
        .trend-down { color: #28a745; }
        .trend-stable { color: #6c757d; }
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
            <p>Performance Benchmarks</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="overall-performance performance-${report.summary.overallPerformance}">
            Overall Performance: ${report.summary.overallPerformance.replace('-', ' ').toUpperCase()}
        </div>
        
        <div class="benchmarks">
            ${generateBenchmarkHTML(report)}
        </div>
        
        <div class="footer">
            <p>Generated by Ray Chrome Extension Performance Test Suite</p>
        </div>
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML benchmark report written to: ${htmlPath}`);
}

/**
 * Generate HTML for individual benchmarks
 */
function generateBenchmarkHTML(report) {
  let html = '';
  
  Object.keys(report.current).forEach(category => {
    const current = report.current[category];
    const thresholds = CONFIG.thresholds[category];
    const thresholdMet = report.summary.thresholdsMet[category];
    const trend = report.trends[category];
    
    html += `
      <div class="benchmark-item">
        <div class="benchmark-header">
          <span>${category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
          <span>
            <span class="threshold-indicator ${thresholdMet.target ? 'threshold-passed' : 'threshold-failed'}">
              ${thresholdMet.target ? 'TARGET MET' : 'TARGET MISSED'}
            </span>
          </span>
        </div>
        <div class="benchmark-metrics">
    `;
    
    // Add metrics based on category
    if (category === 'memoryUsage') {
      html += `
        <div class="metric">
          <div class="metric-value">${(current.memoryUsage / 1024 / 1024).toFixed(1)} MB</div>
          <div class="metric-label">Memory Usage</div>
          <div class="metric-label">Target: ${(thresholds.target / 1024 / 1024).toFixed(1)} MB</div>
          ${trend && trend.memoryUsage ? `
            <div class="trend trend-${trend.memoryUsage.direction}">
              ${trend.memoryUsage.direction === 'increasing' ? '↑' : trend.memoryUsage.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.memoryUsage.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'popupLoad') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.loadTime} ms</div>
          <div class="metric-label">Load Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.loadTime ? `
            <div class="trend trend-${trend.loadTime.direction}">
              ${trend.loadTime.direction === 'increasing' ? '↑' : trend.loadTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.loadTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'apiResponse') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.responseTime} ms</div>
          <div class="metric-label">Response Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.responseTime ? `
            <div class="trend trend-${trend.responseTime.direction}">
              ${trend.responseTime.direction === 'increasing' ? '↑' : trend.responseTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.responseTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'contentScriptLoad') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.injectionTime} ms</div>
          <div class="metric-label">Injection Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.injectionTime ? `
            <div class="trend trend-${trend.injectionTime.direction}">
              ${trend.injectionTime.direction === 'increasing' ? '↑' : trend.injectionTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.injectionTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    } else if (category === 'automationExecution') {
      html += `
        <div class="metric">
          <div class="metric-value">${current.executionTime} ms</div>
          <div class="metric-label">Execution Time</div>
          <div class="metric-label">Target: ${thresholds.target} ms</div>
          ${trend && trend.executionTime ? `
            <div class="trend trend-${trend.executionTime.direction}">
              ${trend.executionTime.direction === 'increasing' ? '↑' : trend.executionTime.direction === 'decreasing' ? '↓' : '→'}
              ${Math.abs(trend.executionTime.change).toFixed(1)}%
            </div>
          ` : ''}
        </div>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
  });
  
  return html;
}

/**
 * Check if performance thresholds are met
 */
function checkThresholds(report) {
  if (!report) {
    return false;
  }
  
  const allTargetsMet = Object.values(report.summary.thresholdsMet).every(
    thresholds => thresholds.target
  );
  
  console.log('\n📊 Performance Threshold Results:');
  console.log('=================================');
  
  Object.entries(report.summary.thresholdsMet).forEach(([category, thresholds]) => {
    const targetStatus = thresholds.target ? '✅' : '❌';
    const maxStatus = thresholds.max ? '✅' : '❌';
    console.log(`${targetStatus} ${category}: Target ${thresholds.target ? 'MET' : 'MISSED'}, Max ${thresholds.max ? 'MET' : 'MISSED'}`);
  });
  
  console.log(`\n🎯 Overall Performance: ${report.summary.overallPerformance}`);
  
  return allTargetsMet;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Ray Chrome Extension Performance Benchmarks');
  console.log('===================================================');
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Load historical data
  const historicalData = loadHistoricalData();
  console.log(`📈 Loaded ${historicalData.length} historical data points`);
  
  // Run performance tests
  const testsSuccess = runPerformanceTests();
  if (!testsSuccess) {
    console.log('❌ Performance tests failed');
    process.exit(1);
  }
  
  // Parse performance results
  const benchmarks = parsePerformanceResults();
  if (!benchmarks) {
    console.log('❌ Failed to parse performance results');
    process.exit(1);
  }
  
  // Generate benchmark report
  const report = generateBenchmarkReport(benchmarks, historicalData);
  
  // Generate HTML report
  generateHTMLBenchmarkReport(report);
  
  // Check thresholds
  const thresholdsMet = checkThresholds(report);
  
  // Print final summary
  console.log('\n📋 Performance Summary:');
  console.log('======================');
  console.log(`Overall Performance: ${report.summary.overallPerformance}`);
  console.log(`Categories Tested: ${report.summary.totalCategories}`);
  
  console.log(`\n📁 Reports generated in: ${CONFIG.benchmarkDirectory}`);
  
  // Exit with appropriate code
  if (thresholdsMet) {
    console.log('\n🎉 All performance targets met!');
    process.exit(0);
  } else {
    console.log('\n💥 Some performance targets not met!');
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
  runPerformanceTests,
  parsePerformanceResults,
  generateBenchmarkReport,
  generateHTMLBenchmarkReport,
  checkThresholds,
  CONFIG
};
