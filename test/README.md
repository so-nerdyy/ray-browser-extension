# Ray Chrome Extension Testing Framework

This directory contains the comprehensive testing framework for the Ray Chrome Extension, implemented by Agent Finley as part of the quality assurance process.

## Overview

The testing framework is designed to ensure the Ray Chrome Extension meets high standards of quality, security, and performance. It includes unit tests, integration tests, end-to-end tests, security tests, performance benchmarks, and browser verification tests.

## Directory Structure

```
test/
├── setup/                 # Test setup and configuration
│   ├── jest.config.js     # Jest configuration
│   ├── test-config.ts    # Global test configuration
│   └── chrome-mock.js    # Chrome API mocks
├── utils/                 # Test utilities and helpers
│   └── test-helpers.ts   # Reusable test utilities
├── mocks/                 # Test mocks and fixtures
│   └── chrome-api-mocks.ts # Chrome API mocks
├── unit/                  # Unit tests
├── integration/            # Integration tests
├── e2e/                   # End-to-end tests
├── security/               # Security tests
├── performance/            # Performance benchmarks
├── browser/                # Browser verification tests
├── scripts/                # Test automation scripts
│   ├── run-all-tests.js          # Main test runner
│   ├── coverage-report.js        # Coverage reporting
│   ├── performance-benchmarks.js  # Performance benchmarking
│   ├── security-scan.js          # Security vulnerability scanning
│   └── verify-tests.js           # Test verification
└── reports/                # Test reports
    ├── coverage/            # Coverage reports
    ├── performance/         # Performance reports
    ├── security/            # Security reports
    └── *.html              # HTML report templates
```

## Test Categories

### 1. Unit Tests
Location: `test/unit/`

Tests individual components in isolation:
- API key storage functionality
- Command parsing and validation
- OpenRouter API client
- Chrome API wrapper functions
- Content script message handling

### 2. Integration Tests
Location: `test/integration/`

Tests component interactions:
- OpenRouter API integration
- Background ↔ Content Script communication
- Popup ↔ Background communication
- Multi-tab workflows
- Permission handling

### 3. End-to-End Tests
Location: `test/e2e/`

Tests complete user workflows:
- Basic navigation automation
- Form interaction and submission
- API key setup
- Multi-step workflows
- Error recovery scenarios

### 4. Security Tests
Location: `test/security/`

Tests security measures:
- API key security validation
- Permission validation
- CSP compliance
- Input sanitization
- XSS protection

### 5. Performance Benchmarks
Location: `test/performance/`

Tests performance metrics:
- Popup load time
- API response time
- Memory usage
- Content script load time
- Automation execution speed

### 6. Browser Verification Tests
Location: `test/browser/`

Tests in real browser environment:
- Extension popup functionality
- Chrome Extensions page testing
- Service worker functionality
- Content script injection
- API key storage

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests only
npm run test:e2e

# Security tests only
npm run test:security

# Performance tests only
npm run test:performance

# Browser tests only
npm run test:browser
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Run Performance Benchmarks
```bash
npm run test:performance-benchmarks
```

### Run Security Scan
```bash
npm run test:security-scan
```

### Verify All Tests
```bash
npm run test:verify
```

### Run CI Pipeline
```bash
npm run test:ci
```

## Test Reports

After running tests, reports are generated in the `test/reports/` directory:

- **Coverage Reports**: `test/reports/coverage/`
  - HTML coverage report
  - LCOV data for CI integration
  - JSON coverage data

- **Performance Reports**: `test/reports/performance/`
  - Performance benchmarks
  - Historical performance data
  - Performance trends

- **Security Reports**: `test/reports/security/`
  - Security vulnerability scan
  - Dependency audit results
  - Code analysis results

## Configuration

### Jest Configuration
The Jest configuration is defined in `test/setup/jest.config.js` and includes:
- Test environment setup
- Coverage collection
- Module resolution
- Transform configuration

### Test Configuration
Global test configuration is defined in `test/setup/test-config.ts` and includes:
- Test timeouts
- Mock configurations
- Helper functions
- Custom matchers

## Requirements

### Coverage Requirements
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

### Performance Requirements
- Popup load time: < 200ms (target: 100ms)
- API response time: < 1000ms (target: 500ms)
- Memory usage: < 50MB (target: 20MB)
- Content script load: < 100ms (target: 50ms)
- Automation execution: < 5000ms (target: 2000ms)

### Security Requirements
- High vulnerabilities: 0
- Medium vulnerabilities: ≤ 2
- Low vulnerabilities: ≤ 5
- Info vulnerabilities: ≤ 10

## CI/CD Integration

The testing framework is integrated with GitHub Actions for automated testing:
- Triggered on push and pull requests
- Runs on multiple Node.js versions
- Generates and uploads test reports
- Creates releases on successful tests
- Provides PR comments with test results

## Contributing

When adding new tests:
1. Place tests in the appropriate category directory
2. Follow the existing test patterns and naming conventions
3. Ensure tests are independent and reproducible
4. Include appropriate assertions and error handling
5. Update this README if adding new test categories

## Troubleshooting

### Common Issues

1. **Tests Fail to Run**
   - Ensure all dependencies are installed: `npm install`
   - Check Node.js version compatibility
   - Verify test file paths and patterns

2. **Coverage Reports Not Generated**
   - Ensure tests are actually running
   - Check coverage configuration in Jest config
   - Verify source file paths in coverage settings

3. **Performance Tests Fail**
   - Check if browser is running in headless mode
   - Verify performance thresholds are realistic
   - Ensure test environment is stable

4. **Security Scan Fails**
   - Check if security scan tools are installed
   - Verify source code paths in scan configuration
   - Update security patterns if needed

## License

This testing framework is part of the Ray Chrome Extension project and is licensed under the MIT License.
This directory contains the comprehensive testing framework for the Ray Chrome Extension, implemented by Agent Finley as part of the quality assurance process.

## Overview

The testing framework is designed to ensure the Ray Chrome Extension meets high standards of quality, security, and performance. It includes unit tests, integration tests, end-to-end tests, security tests, performance benchmarks, and browser verification tests.

## Directory Structure

```
test/
├── setup/                 # Test setup and configuration
│   ├── jest.config.js     # Jest configuration
│   ├── test-config.ts    # Global test configuration
│   └── chrome-mock.js    # Chrome API mocks
├── utils/                 # Test utilities and helpers
│   └── test-helpers.ts   # Reusable test utilities
├── mocks/                 # Test mocks and fixtures
│   └── chrome-api-mocks.ts # Chrome API mocks
├── unit/                  # Unit tests
├── integration/            # Integration tests
├── e2e/                   # End-to-end tests
├── security/               # Security tests
├── performance/            # Performance benchmarks
├── browser/                # Browser verification tests
├── scripts/                # Test automation scripts
│   ├── run-all-tests.js          # Main test runner
│   ├── coverage-report.js        # Coverage reporting
│   ├── performance-benchmarks.js  # Performance benchmarking
│   ├── security-scan.js          # Security vulnerability scanning
│   └── verify-tests.js           # Test verification
└── reports/                # Test reports
    ├── coverage/            # Coverage reports
    ├── performance/         # Performance reports
    ├── security/            # Security reports
    └── *.html              # HTML report templates
```

## Test Categories

### 1. Unit Tests
Location: `test/unit/`

Tests individual components in isolation:
- API key storage functionality
- Command parsing and validation
- OpenRouter API client
- Chrome API wrapper functions
- Content script message handling

### 2. Integration Tests
Location: `test/integration/`

Tests component interactions:
- OpenRouter API integration
- Background ↔ Content Script communication
- Popup ↔ Background communication
- Multi-tab workflows
- Permission handling

### 3. End-to-End Tests
Location: `test/e2e/`

Tests complete user workflows:
- Basic navigation automation
- Form interaction and submission
- API key setup
- Multi-step workflows
- Error recovery scenarios

### 4. Security Tests
Location: `test/security/`

Tests security measures:
- API key security validation
- Permission validation
- CSP compliance
- Input sanitization
- XSS protection

### 5. Performance Benchmarks
Location: `test/performance/`

Tests performance metrics:
- Popup load time
- API response time
- Memory usage
- Content script load time
- Automation execution speed

### 6. Browser Verification Tests
Location: `test/browser/`

Tests in real browser environment:
- Extension popup functionality
- Chrome Extensions page testing
- Service worker functionality
- Content script injection
- API key storage

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests only
npm run test:e2e

# Security tests only
npm run test:security

# Performance tests only
npm run test:performance

# Browser tests only
npm run test:browser
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Run Performance Benchmarks
```bash
npm run test:performance-benchmarks
```

### Run Security Scan
```bash
npm run test:security-scan
```

### Verify All Tests
```bash
npm run test:verify
```

### Run CI Pipeline
```bash
npm run test:ci
```

## Test Reports

After running tests, reports are generated in the `test/reports/` directory:

- **Coverage Reports**: `test/reports/coverage/`
  - HTML coverage report
  - LCOV data for CI integration
  - JSON coverage data

- **Performance Reports**: `test/reports/performance/`
  - Performance benchmarks
  - Historical performance data
  - Performance trends

- **Security Reports**: `test/reports/security/`
  - Security vulnerability scan
  - Dependency audit results
  - Code analysis results

## Configuration

### Jest Configuration
The Jest configuration is defined in `test/setup/jest.config.js` and includes:
- Test environment setup
- Coverage collection
- Module resolution
- Transform configuration

### Test Configuration
Global test configuration is defined in `test/setup/test-config.ts` and includes:
- Test timeouts
- Mock configurations
- Helper functions
- Custom matchers

## Requirements

### Coverage Requirements
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

### Performance Requirements
- Popup load time: < 200ms (target: 100ms)
- API response time: < 1000ms (target: 500ms)
- Memory usage: < 50MB (target: 20MB)
- Content script load: < 100ms (target: 50ms)
- Automation execution: < 5000ms (target: 2000ms)

### Security Requirements
- High vulnerabilities: 0
- Medium vulnerabilities: ≤ 2
- Low vulnerabilities: ≤ 5
- Info vulnerabilities: ≤ 10

## CI/CD Integration

The testing framework is integrated with GitHub Actions for automated testing:
- Triggered on push and pull requests
- Runs on multiple Node.js versions
- Generates and uploads test reports
- Creates releases on successful tests
- Provides PR comments with test results

## Contributing

When adding new tests:
1. Place tests in the appropriate category directory
2. Follow the existing test patterns and naming conventions
3. Ensure tests are independent and reproducible
4. Include appropriate assertions and error handling
5. Update this README if adding new test categories

## Troubleshooting

### Common Issues

1. **Tests Fail to Run**
   - Ensure all dependencies are installed: `npm install`
   - Check Node.js version compatibility
   - Verify test file paths and patterns

2. **Coverage Reports Not Generated**
   - Ensure tests are actually running
   - Check coverage configuration in Jest config
   - Verify source file paths in coverage settings

3. **Performance Tests Fail**
   - Check if browser is running in headless mode
   - Verify performance thresholds are realistic
   - Ensure test environment is stable

4. **Security Scan Fails**
   - Check if security scan tools are installed
   - Verify source code paths in scan configuration
   - Update security patterns if needed

## License

This testing framework is part of the Ray Chrome Extension project and is licensed under the MIT License.
