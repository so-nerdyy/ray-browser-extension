#!/usr/bin/env node

/**
 * Test Runner Script
 * Runs all tests for the Ray Chrome Extension with proper categorization and reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test categories and their corresponding file patterns
const TEST_CATEGORIES = {
  unit: {
    pattern: 'test/unit/*.test.js',
    description: 'Unit Tests - Individual component testing',
    timeout: 30000 // 30 seconds
  },
  integration: {
    pattern: 'test/integration/*.test.js',
    description: 'Integration Tests - Component interaction testing',
    timeout: 60000 // 1 minute
  },
  e2e: {
    pattern: 'test/e2e/*.test.js',
    description: 'End-to-End Tests - Full workflow testing',
    timeout: 120000 // 2 minutes
  },
  security: {
    pattern: 'test/security/*.test.js',
    description: 'Security Tests - Security validation testing',
    timeout: 60000 // 1 minute
  },
  performance: {
    pattern: 'test/performance/*.test.js',
    description: 'Performance Tests - Performance benchmarking',
    timeout: 90000 // 1.5 minutes
  },
  browser: {
    pattern: 'test/browser/*.test.js',
    description: 'Browser Tests - Browser verification testing',
    timeout: 120000 // 2 minutes
  }
};

// Configuration options
const CONFIG = {
  coverage: true,
  verbose: true,
  bail: false, // Don't stop on first failure
  maxWorkers: 4, // Parallel test execution
  testTimeout: 300000, // 5 minutes total timeout
  reporters: ['default', 'jest-html-reporters'],
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageDirectory: 'test/coverage',
  outputDirectory: 'test/reports'
};

/**
 * Create necessary directories for test outputs
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.coverageDirectory,
    CONFIG.outputDirectory,
    'test/logs'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Generate Jest configuration for a specific test category
 */
function generateJestConfig(category, options = {}) {
  const categoryConfig = TEST_CATEGORIES[category];
  
  return {
    testMatch: [categoryConfig.pattern],
    testTimeout: categoryConfig.timeout,
    collectCoverage: CONFIG.coverage && !options.skipCoverage,
    collectCoverageFrom: [
      'src/**/*.{js,ts}',
      '!src/**/*.d.ts',
      '!src/**/*.test.{js,ts}',
      '!src/**/__tests__/**'
    ],
    coverageDirectory: CONFIG.coverageDirectory,
    coverageReporters: CONFIG.coverageReporters,
    verbose: CONFIG.verbose,
    bail: CONFIG.bail,
    maxWorkers: CONFIG.maxWorkers,
    reporters: CONFIG.reporters,
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    transform: {
      '^.+\\.(js|ts)$': 'babel-jest'
    },
    moduleFileExtensions: ['js', 'ts', 'json'],
    testResultsProcessor: undefined,
    outputName: `${category}-test-results`,
    outputDirectory: CONFIG.outputDirectory
  };
}

/**
 * Run tests for a specific category
 */
async function runTestCategory(category) {
  console.log(`\n🧪 Running ${TEST_CATEGORIES[category].description}...`);
  console.log(`Pattern: ${TEST_CATEGORIES[category].pattern}`);
  console.log(`Timeout: ${TEST_CATEGORIES[category].timeout}ms`);
  
  const startTime = Date.now();
  const jestConfig = generateJestConfig(category);
  const configPath = path.join(CONFIG.outputDirectory, `jest-${category}.config.json`);
  
  // Write temporary config file
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    // Build Jest command
    const jestArgs = [
      '--config', configPath,
      '--passWithNoTests' // Don't fail if no tests found
    ];
    
    if (CONFIG.verbose) {
      jestArgs.push('--verbose');
    }
    
    // Run Jest
    const command = `npx jest ${jestArgs.join(' ')}`;
    console.log(`Executing: ${command}`);
    
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: CONFIG.testTimeout
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${category} tests completed in ${duration}ms`);
    
    return {
      category,
      success: true,
      duration,
      output
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${category} tests failed in ${duration}ms`);
    
    return {
      category,
      success: false,
      duration,
      error: error.message,
      output: error.stdout
    };
  } finally {
    // Clean up temporary config file
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Generate combined test report
 */
function generateReport(results) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.outputDirectory, 'test-summary.json');
  
  const summary = {
    timestamp,
    totalCategories: Object.keys(TEST_CATEGORIES).length,
    results: results,
    summary: {
      totalPassed: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\n📊 Test summary written to: ${reportPath}`);
  
  // Print summary to console
  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log(`Total Categories: ${summary.totalCategories}`);
  console.log(`Passed: ${summary.summary.totalPassed}`);
  console.log(`Failed: ${summary.summary.totalFailed}`);
  console.log(`Total Duration: ${summary.summary.totalDuration}ms`);
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.category}: ${result.duration}ms`);
  });
  
  return summary;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Ray Chrome Extension Test Runner');
  console.log('===========================================');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const categoriesToRun = args.length > 0 ? 
    args.filter(arg => Object.keys(TEST_CATEGORIES).includes(arg)) :
    Object.keys(TEST_CATEGORIES);
  
  if (categoriesToRun.length === 0) {
    console.error('❌ No valid test categories specified');
    console.log('Available categories:', Object.keys(TEST_CATEGORIES).join(', '));
    process.exit(1);
  }
  
  console.log(`Running test categories: ${categoriesToRun.join(', ')}`);
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Run tests for each category
  const results = [];
  let hasFailures = false;
  
  for (const category of categoriesToRun) {
    const result = await runTestCategory(category);
    results.push(result);
    
    if (!result.success) {
      hasFailures = true;
      
      if (CONFIG.bail) {
        console.log(`\n💥 Stopping test execution due to failure in ${category}`);
        break;
      }
    }
  }
  
  // Generate combined report
  generateReport(results);
  
  // Exit with appropriate code
  if (hasFailures) {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
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
  runTestCategory,
  generateJestConfig,
  generateReport,
  TEST_CATEGORIES,
  CONFIG
};
/**
 * Test Runner Script
 * Runs all tests for the Ray Chrome Extension with proper categorization and reporting
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test categories and their corresponding file patterns
const TEST_CATEGORIES = {
  unit: {
    pattern: 'test/unit/*.test.js',
    description: 'Unit Tests - Individual component testing',
    timeout: 30000 // 30 seconds
  },
  integration: {
    pattern: 'test/integration/*.test.js',
    description: 'Integration Tests - Component interaction testing',
    timeout: 60000 // 1 minute
  },
  e2e: {
    pattern: 'test/e2e/*.test.js',
    description: 'End-to-End Tests - Full workflow testing',
    timeout: 120000 // 2 minutes
  },
  security: {
    pattern: 'test/security/*.test.js',
    description: 'Security Tests - Security validation testing',
    timeout: 60000 // 1 minute
  },
  performance: {
    pattern: 'test/performance/*.test.js',
    description: 'Performance Tests - Performance benchmarking',
    timeout: 90000 // 1.5 minutes
  },
  browser: {
    pattern: 'test/browser/*.test.js',
    description: 'Browser Tests - Browser verification testing',
    timeout: 120000 // 2 minutes
  }
};

// Configuration options
const CONFIG = {
  coverage: true,
  verbose: true,
  bail: false, // Don't stop on first failure
  maxWorkers: 4, // Parallel test execution
  testTimeout: 300000, // 5 minutes total timeout
  reporters: ['default', 'jest-html-reporters'],
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageDirectory: 'test/coverage',
  outputDirectory: 'test/reports'
};

/**
 * Create necessary directories for test outputs
 */
function ensureDirectories() {
  const dirs = [
    CONFIG.coverageDirectory,
    CONFIG.outputDirectory,
    'test/logs'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

/**
 * Generate Jest configuration for a specific test category
 */
function generateJestConfig(category, options = {}) {
  const categoryConfig = TEST_CATEGORIES[category];
  
  return {
    testMatch: [categoryConfig.pattern],
    testTimeout: categoryConfig.timeout,
    collectCoverage: CONFIG.coverage && !options.skipCoverage,
    collectCoverageFrom: [
      'src/**/*.{js,ts}',
      '!src/**/*.d.ts',
      '!src/**/*.test.{js,ts}',
      '!src/**/__tests__/**'
    ],
    coverageDirectory: CONFIG.coverageDirectory,
    coverageReporters: CONFIG.coverageReporters,
    verbose: CONFIG.verbose,
    bail: CONFIG.bail,
    maxWorkers: CONFIG.maxWorkers,
    reporters: CONFIG.reporters,
    setupFilesAfterEnv: ['<rootDir>/test/setup/test-config.js'],
    testEnvironment: 'jsdom',
    transform: {
      '^.+\\.(js|ts)$': 'babel-jest'
    },
    moduleFileExtensions: ['js', 'ts', 'json'],
    testResultsProcessor: undefined,
    outputName: `${category}-test-results`,
    outputDirectory: CONFIG.outputDirectory
  };
}

/**
 * Run tests for a specific category
 */
async function runTestCategory(category) {
  console.log(`\n🧪 Running ${TEST_CATEGORIES[category].description}...`);
  console.log(`Pattern: ${TEST_CATEGORIES[category].pattern}`);
  console.log(`Timeout: ${TEST_CATEGORIES[category].timeout}ms`);
  
  const startTime = Date.now();
  const jestConfig = generateJestConfig(category);
  const configPath = path.join(CONFIG.outputDirectory, `jest-${category}.config.json`);
  
  // Write temporary config file
  fs.writeFileSync(configPath, JSON.stringify(jestConfig, null, 2));
  
  try {
    // Build Jest command
    const jestArgs = [
      '--config', configPath,
      '--passWithNoTests' // Don't fail if no tests found
    ];
    
    if (CONFIG.verbose) {
      jestArgs.push('--verbose');
    }
    
    // Run Jest
    const command = `npx jest ${jestArgs.join(' ')}`;
    console.log(`Executing: ${command}`);
    
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'inherit',
      timeout: CONFIG.testTimeout
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${category} tests completed in ${duration}ms`);
    
    return {
      category,
      success: true,
      duration,
      output
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${category} tests failed in ${duration}ms`);
    
    return {
      category,
      success: false,
      duration,
      error: error.message,
      output: error.stdout
    };
  } finally {
    // Clean up temporary config file
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }
}

/**
 * Generate combined test report
 */
function generateReport(results) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(CONFIG.outputDirectory, 'test-summary.json');
  
  const summary = {
    timestamp,
    totalCategories: Object.keys(TEST_CATEGORIES).length,
    results: results,
    summary: {
      totalPassed: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
    }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`\n📊 Test summary written to: ${reportPath}`);
  
  // Print summary to console
  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log(`Total Categories: ${summary.totalCategories}`);
  console.log(`Passed: ${summary.summary.totalPassed}`);
  console.log(`Failed: ${summary.summary.totalFailed}`);
  console.log(`Total Duration: ${summary.summary.totalDuration}ms`);
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.category}: ${result.duration}ms`);
  });
  
  return summary;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting Ray Chrome Extension Test Runner');
  console.log('===========================================');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const categoriesToRun = args.length > 0 ? 
    args.filter(arg => Object.keys(TEST_CATEGORIES).includes(arg)) :
    Object.keys(TEST_CATEGORIES);
  
  if (categoriesToRun.length === 0) {
    console.error('❌ No valid test categories specified');
    console.log('Available categories:', Object.keys(TEST_CATEGORIES).join(', '));
    process.exit(1);
  }
  
  console.log(`Running test categories: ${categoriesToRun.join(', ')}`);
  
  // Ensure output directories exist
  ensureDirectories();
  
  // Run tests for each category
  const results = [];
  let hasFailures = false;
  
  for (const category of categoriesToRun) {
    const result = await runTestCategory(category);
    results.push(result);
    
    if (!result.success) {
      hasFailures = true;
      
      if (CONFIG.bail) {
        console.log(`\n💥 Stopping test execution due to failure in ${category}`);
        break;
      }
    }
  }
  
  // Generate combined report
  generateReport(results);
  
  // Exit with appropriate code
  if (hasFailures) {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
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
  runTestCategory,
  generateJestConfig,
  generateReport,
  TEST_CATEGORIES,
  CONFIG
};
