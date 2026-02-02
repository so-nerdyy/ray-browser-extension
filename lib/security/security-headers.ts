/**
 * Security Headers Management for Ray Chrome Extension
 * Handles security header configuration and validation
 */

export interface SecurityHeader {
  name: string;
  value: string;
  description: string;
  required: boolean;
  category: 'csp' | 'transport' | 'content' | 'privacy' | 'misc';
}

export interface SecurityHeaderConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXFrameOptions: boolean;
  enableXContentTypeOptions: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;
  customHeaders?: SecurityHeader[];
}

export interface HeaderValidationResult {
  isValid: boolean;
  missing: SecurityHeader[];
  misconfigured: Array<{
    header: SecurityHeader;
    issue: string;
    recommendation: string;
  }>;
  warnings: string[];
  score: number;
}

export class SecurityHeaders {
  private static readonly DEFAULT_CONFIG: SecurityHeaderConfig = {
    enableCSP: true,
    enableHSTS: false, // Not applicable for extensions
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true
  };

  private static readonly RECOMMENDED_HEADERS: SecurityHeader[] = [
    {
      name: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self'; connect-src 'self' https://openrouter.ai; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self';",
      description: 'Defines approved sources of content for the extension',
      required: true,
      category: 'csp'
    },
    {
      name: 'X-Frame-Options',
      value: 'DENY',
      description: 'Prevents clickjacking attacks by controlling whether the extension can be embedded in frames',
      required: true,
      category: 'content'
    },
    {
      name: 'X-Content-Type-Options',
      value: 'nosniff',
      description: 'Prevents MIME-type sniffing attacks',
      required: true,
      category: 'content'
    },
    {
      name: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
      description: 'Controls how much referrer information is sent with requests',
      required: true,
      category: 'privacy'
    },
    {
      name: 'Permissions-Policy',
      value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
      description: 'Controls which browser features can be used',
      required: true,
      category: 'privacy'
    },
    {
      name: 'X-XSS-Protection',
      value: '1; mode=block',
      description: 'Enables XSS filtering in browsers that support it',
      required: false,
      category: 'content'
    },
    {
      name: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
      description: 'Enforces HTTPS connections (not applicable for extension pages)',
      required: false,
      category: 'transport'
    }
  ];

  /**
   * Generate security headers configuration
   * @param config Optional security header configuration
   * @returns Array of security headers
   */
  static generateHeaders(config?: Partial<SecurityHeaderConfig>): SecurityHeader[] {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const headers: SecurityHeader[] = [];

    // Add CSP if enabled
    if (finalConfig.enableCSP) {
      const cspHeader = this.RECOMMENDED_HEADERS.find(h => h.name === 'Content-Security-Policy');
      if (cspHeader) {
        headers.push(cspHeader);
      }
    }

    // Add other headers based on configuration
    const headerMappings = [
      { config: 'enableXFrameOptions', header: 'X-Frame-Options' },
      { config: 'enableXContentTypeOptions', header: 'X-Content-Type-Options' },
      { config: 'enableReferrerPolicy', header: 'Referrer-Policy' },
      { config: 'enablePermissionsPolicy', header: 'Permissions-Policy' },
      { config: 'enableHSTS', header: 'Strict-Transport-Security' }
    ];

    for (const mapping of headerMappings) {
      if (finalConfig[mapping.config as keyof SecurityHeaderConfig]) {
        const header = this.RECOMMENDED_HEADERS.find(h => h.name === mapping.header);
        if (header) {
          headers.push(header);
        }
      }
    }

    // Add custom headers
    if (finalConfig.customHeaders) {
      headers.push(...finalConfig.customHeaders);
    }

    return headers;
  }

  /**
   * Generate security headers for manifest.json
   * @param config Optional security header configuration
   * @returns Security headers configuration for manifest
   */
  static generateManifestHeaders(config?: Partial<SecurityHeaderConfig>): Record<string, string> {
    const headers = this.generateHeaders(config);
    const manifestHeaders: Record<string, string> = {};

    // For Chrome extensions, only CSP is typically configurable in manifest
    const cspHeader = headers.find(h => h.name === 'Content-Security-Policy');
    if (cspHeader) {
      manifestHeaders['Content-Security-Policy'] = cspHeader.value;
    }

    return manifestHeaders;
  }

  /**
   * Validate security headers configuration
   * @param headers Headers to validate
   * @returns Validation result
   */
  static validateHeaders(headers: SecurityHeader[]): HeaderValidationResult {
    const missing: SecurityHeader[] = [];
    const misconfigured: HeaderValidationResult['misconfigured'] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check for missing required headers
    for (const recommended of this.RECOMMENDED_HEADERS) {
      if (recommended.required) {
        const found = headers.find(h => h.name === recommended.name);
        if (!found) {
          missing.push(recommended);
          score -= 20;
        }
      }
    }

    // Validate each header
    for (const header of headers) {
      const validation = this.validateHeader(header);
      if (!validation.isValid) {
        misconfigured.push(validation);
        score -= 10;
      }
    }

    // Check for conflicting headers
    const cspHeader = headers.find(h => h.name === 'Content-Security-Policy');
    const xssHeader = headers.find(h => h.name === 'X-XSS-Protection');
    
    if (cspHeader && xssHeader) {
      warnings.push('X-XSS-Protection is redundant when CSP is properly configured');
    }

    // Check for insecure values
    for (const header of headers) {
      if (this.isInsecureValue(header)) {
        warnings.push(`Insecure value in ${header.name}: ${header.value}`);
        score -= 15;
      }
    }

    return {
      isValid: missing.length === 0 && misconfigured.length === 0,
      missing,
      misconfigured,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate individual security header
   * @param header Header to validate
   * @returns Validation result
   */
  private static validateHeader(header: SecurityHeader): {
    isValid: boolean;
    header: SecurityHeader;
    issue: string;
    recommendation: string;
  } {
    const recommended = this.RECOMMENDED_HEADERS.find(h => h.name === header.name);
    
    if (!recommended) {
      return {
        isValid: true,
        header,
        issue: '',
        recommendation: ''
      };
    }

    // CSP validation
    if (header.name === 'Content-Security-Policy') {
      if (!header.value.includes('default-src')) {
        return {
          isValid: false,
          header,
          issue: 'CSP missing default-src directive',
          recommendation: 'Add default-src directive to CSP'
        };
      }

      if (header.value.includes("'unsafe-eval'")) {
        return {
          isValid: false,
          header,
          issue: 'CSP contains unsafe-eval',
          recommendation: 'Remove unsafe-eval from CSP'
        };
      }
    }

    // X-Frame-Options validation
    if (header.name === 'X-Frame-Options') {
      const validValues = ['DENY', 'SAMEORIGIN'];
      if (!validValues.includes(header.value.toUpperCase())) {
        return {
          isValid: false,
          header,
          issue: `Invalid X-Frame-Options value: ${header.value}`,
          recommendation: 'Use DENY or SAMEORIGIN'
        };
      }
    }

    // X-Content-Type-Options validation
    if (header.name === 'X-Content-Type-Options') {
      if (header.value.toLowerCase() !== 'nosniff') {
        return {
          isValid: false,
          header,
          issue: `Invalid X-Content-Type-Options value: ${header.value}`,
          recommendation: 'Use nosniff'
        };
      }
    }

    return {
      isValid: true,
      header,
      issue: '',
      recommendation: ''
    };
  }

  /**
   * Check if header value is insecure
   * @param header Header to check
   * @returns True if insecure
   */
  private static isInsecureValue(header: SecurityHeader): boolean {
    switch (header.name) {
      case 'Content-Security-Policy':
        return header.value.includes("'unsafe-inline'") || 
               header.value.includes("'unsafe-eval'") ||
               header.value.includes('*') ||
               header.value.includes('http:');

      case 'X-Frame-Options':
        return !['DENY', 'SAMEORIGIN'].includes(header.value.toUpperCase());

      case 'X-Content-Type-Options':
        return header.value.toLowerCase() !== 'nosniff';

      case 'Referrer-Policy':
        const unsafePolicies = ['no-referrer-when-downgrade', 'unsafe-url'];
        return unsafePolicies.includes(header.value);

      default:
        return false;
    }
  }

  /**
   * Get recommended security headers
   * @param category Optional category filter
   * @returns Array of recommended headers
   */
  static getRecommendedHeaders(category?: SecurityHeader['category']): SecurityHeader[] {
    if (category) {
      return this.RECOMMENDED_HEADERS.filter(h => h.category === category);
    }
    return [...this.RECOMMENDED_HEADERS];
  }

  /**
   * Create custom security header
   * @param name Header name
   * @param value Header value
   * @param description Header description
   * @param category Header category
   * @returns Custom security header
   */
  static createCustomHeader(
    name: string,
    value: string,
    description: string,
    category: SecurityHeader['category'] = 'misc'
  ): SecurityHeader {
    return {
      name,
      value,
      description,
      required: false,
      category
    };
  }

  /**
   * Generate security headers report
   * @param headers Current security headers
   * @returns Security headers report
   */
  static generateReport(headers: SecurityHeader[]): {
    summary: {
      totalHeaders: number;
      requiredHeaders: number;
      optionalHeaders: number;
      securityScore: number;
    };
    categories: Record<string, {
      count: number;
      headers: SecurityHeader[];
    }>;
    recommendations: string[];
    generatedAt: number;
  } {
    const validation = this.validateHeaders(headers);
    
    // Categorize headers
    const categories: Record<string, { count: number; headers: SecurityHeader[] }> = {};
    for (const header of headers) {
      if (!categories[header.category]) {
        categories[header.category] = { count: 0, headers: [] };
      }
      categories[header.category].count++;
      categories[header.category].headers.push(header);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (validation.missing.length > 0) {
      recommendations.push(`Add ${validation.missing.length} missing required security headers`);
    }

    if (validation.misconfigured.length > 0) {
      recommendations.push(`Fix ${validation.misconfigured.length} misconfigured security headers`);
    }

    if (validation.warnings.length > 0) {
      recommendations.push(`Address ${validation.warnings.length} security warnings`);
    }

    const requiredHeaders = this.RECOMMENDED_HEADERS.filter(h => h.required).length;
    const implementedRequiredHeaders = requiredHeaders - validation.missing.length;

    return {
      summary: {
        totalHeaders: headers.length,
        requiredHeaders: implementedRequiredHeaders,
        optionalHeaders: headers.length - implementedRequiredHeaders,
        securityScore: validation.score
      },
      categories,
      recommendations,
      generatedAt: Date.now()
    };
  }

  /**
   * Check if security headers are properly configured for Chrome extensions
   * @param headers Headers to check
   * @returns Extension-specific validation result
   */
  static validateForExtension(headers: SecurityHeader[]): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for CSP
    const cspHeader = headers.find(h => h.name === 'Content-Security-Policy');
    if (!cspHeader) {
      issues.push('Missing Content-Security-Policy header');
      recommendations.push('Add CSP header to extension pages');
    } else {
      // Check if CSP allows OpenRouter
      if (!cspHeader.value.includes('openrouter.ai')) {
        issues.push('CSP does not allow OpenRouter API access');
        recommendations.push('Add https://openrouter.ai to connect-src directive');
      }
    }

    // Check for unnecessary headers in extension context
    const hstsHeader = headers.find(h => h.name === 'Strict-Transport-Security');
    if (hstsHeader) {
      issues.push('Strict-Transport-Security is not applicable to extension pages');
      recommendations.push('Remove HSTS header for extension context');
    }

    // Check for proper frame protection
    const frameHeader = headers.find(h => h.name === 'X-Frame-Options');
    if (!frameHeader) {
      issues.push('Missing X-Frame-Options header');
      recommendations.push('Add X-Frame-Options: DENY to prevent clickjacking');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Get security header by name
   * @param name Header name
   * @returns Header definition or null
   */
  static getHeader(name: string): SecurityHeader | null {
    return this.RECOMMENDED_HEADERS.find(h => h.name === name) || null;
  }

  /**
   * Update security header value
   * @param headers Current headers
   * @param name Header name to update
   * @param newValue New header value
   * @returns Updated headers array
   */
  static updateHeaderValue(
    headers: SecurityHeader[],
    name: string,
    newValue: string
  ): SecurityHeader[] {
    return headers.map(header => {
      if (header.name === name) {
        return { ...header, value: newValue };
      }
      return header;
    });
  }
} * Security Headers Management for Ray Chrome Extension
 * Handles security header configuration and validation
 */

export interface SecurityHeader {
  name: string;
  value: string;
  description: string;
  required: boolean;
  category: 'csp' | 'transport' | 'content' | 'privacy' | 'misc';
}

export interface SecurityHeaderConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXFrameOptions: boolean;
  enableXContentTypeOptions: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;
  customHeaders?: SecurityHeader[];
}

export interface HeaderValidationResult {
  isValid: boolean;
  missing: SecurityHeader[];
  misconfigured: Array<{
    header: SecurityHeader;
    issue: string;
    recommendation: string;
  }>;
  warnings: string[];
  score: number;
}

export class SecurityHeaders {
  private static readonly DEFAULT_CONFIG: SecurityHeaderConfig = {
    enableCSP: true,
    enableHSTS: false, // Not applicable for extensions
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true
  };

  private static readonly RECOMMENDED_HEADERS: SecurityHeader[] = [
    {
      name: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self'; connect-src 'self' https://openrouter.ai; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self';",
      description: 'Defines approved sources of content for the extension',
      required: true,
      category: 'csp'
    },
    {
      name: 'X-Frame-Options',
      value: 'DENY',
      description: 'Prevents clickjacking attacks by controlling whether the extension can be embedded in frames',
      required: true,
      category: 'content'
    },
    {
      name: 'X-Content-Type-Options',
      value: 'nosniff',
      description: 'Prevents MIME-type sniffing attacks',
      required: true,
      category: 'content'
    },
    {
      name: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
      description: 'Controls how much referrer information is sent with requests',
      required: true,
      category: 'privacy'
    },
    {
      name: 'Permissions-Policy',
      value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
      description: 'Controls which browser features can be used',
      required: true,
      category: 'privacy'
    },
    {
      name: 'X-XSS-Protection',
      value: '1; mode=block',
      description: 'Enables XSS filtering in browsers that support it',
      required: false,
      category: 'content'
    },
    {
      name: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
      description: 'Enforces HTTPS connections (not applicable for extension pages)',
      required: false,
      category: 'transport'
    }
  ];

  /**
   * Generate security headers configuration
   * @param config Optional security header configuration
   * @returns Array of security headers
   */
  static generateHeaders(config?: Partial<SecurityHeaderConfig>): SecurityHeader[] {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const headers: SecurityHeader[] = [];

    // Add CSP if enabled
    if (finalConfig.enableCSP) {
      const cspHeader = this.RECOMMENDED_HEADERS.find(h => h.name === 'Content-Security-Policy');
      if (cspHeader) {
        headers.push(cspHeader);
      }
    }

    // Add other headers based on configuration
    const headerMappings = [
      { config: 'enableXFrameOptions', header: 'X-Frame-Options' },
      { config: 'enableXContentTypeOptions', header: 'X-Content-Type-Options' },
      { config: 'enableReferrerPolicy', header: 'Referrer-Policy' },
      { config: 'enablePermissionsPolicy', header: 'Permissions-Policy' },
      { config: 'enableHSTS', header: 'Strict-Transport-Security' }
    ];

    for (const mapping of headerMappings) {
      if (finalConfig[mapping.config as keyof SecurityHeaderConfig]) {
        const header = this.RECOMMENDED_HEADERS.find(h => h.name === mapping.header);
        if (header) {
          headers.push(header);
        }
      }
    }

    // Add custom headers
    if (finalConfig.customHeaders) {
      headers.push(...finalConfig.customHeaders);
    }

    return headers;
  }

  /**
   * Generate security headers for manifest.json
   * @param config Optional security header configuration
   * @returns Security headers configuration for manifest
   */
  static generateManifestHeaders(config?: Partial<SecurityHeaderConfig>): Record<string, string> {
    const headers = this.generateHeaders(config);
    const manifestHeaders: Record<string, string> = {};

    // For Chrome extensions, only CSP is typically configurable in manifest
    const cspHeader = headers.find(h => h.name === 'Content-Security-Policy');
    if (cspHeader) {
      manifestHeaders['Content-Security-Policy'] = cspHeader.value;
    }

    return manifestHeaders;
  }

  /**
   * Validate security headers configuration
   * @param headers Headers to validate
   * @returns Validation result
   */
  static validateHeaders(headers: SecurityHeader[]): HeaderValidationResult {
    const missing: SecurityHeader[] = [];
    const misconfigured: HeaderValidationResult['misconfigured'] = [];
    const warnings: string[] = [];
    let score = 100;

    // Check for missing required headers
    for (const recommended of this.RECOMMENDED_HEADERS) {
      if (recommended.required) {
        const found = headers.find(h => h.name === recommended.name);
        if (!found) {
          missing.push(recommended);
          score -= 20;
        }
      }
    }

    // Validate each header
    for (const header of headers) {
      const validation = this.validateHeader(header);
      if (!validation.isValid) {
        misconfigured.push(validation);
        score -= 10;
      }
    }

    // Check for conflicting headers
    const cspHeader = headers.find(h => h.name === 'Content-Security-Policy');
    const xssHeader = headers.find(h => h.name === 'X-XSS-Protection');
    
    if (cspHeader && xssHeader) {
      warnings.push('X-XSS-Protection is redundant when CSP is properly configured');
    }

    // Check for insecure values
    for (const header of headers) {
      if (this.isInsecureValue(header)) {
        warnings.push(`Insecure value in ${header.name}: ${header.value}`);
        score -= 15;
      }
    }

    return {
      isValid: missing.length === 0 && misconfigured.length === 0,
      missing,
      misconfigured,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate individual security header
   * @param header Header to validate
   * @returns Validation result
   */
  private static validateHeader(header: SecurityHeader): {
    isValid: boolean;
    header: SecurityHeader;
    issue: string;
    recommendation: string;
  } {
    const recommended = this.RECOMMENDED_HEADERS.find(h => h.name === header.name);
    
    if (!recommended) {
      return {
        isValid: true,
        header,
        issue: '',
        recommendation: ''
      };
    }

    // CSP validation
    if (header.name === 'Content-Security-Policy') {
      if (!header.value.includes('default-src')) {
        return {
          isValid: false,
          header,
          issue: 'CSP missing default-src directive',
          recommendation: 'Add default-src directive to CSP'
        };
      }

      if (header.value.includes("'unsafe-eval'")) {
        return {
          isValid: false,
          header,
          issue: 'CSP contains unsafe-eval',
          recommendation: 'Remove unsafe-eval from CSP'
        };
      }
    }

    // X-Frame-Options validation
    if (header.name === 'X-Frame-Options') {
      const validValues = ['DENY', 'SAMEORIGIN'];
      if (!validValues.includes(header.value.toUpperCase())) {
        return {
          isValid: false,
          header,
          issue: `Invalid X-Frame-Options value: ${header.value}`,
          recommendation: 'Use DENY or SAMEORIGIN'
        };
      }
    }

    // X-Content-Type-Options validation
    if (header.name === 'X-Content-Type-Options') {
      if (header.value.toLowerCase() !== 'nosniff') {
        return {
          isValid: false,
          header,
          issue: `Invalid X-Content-Type-Options value: ${header.value}`,
          recommendation: 'Use nosniff'
        };
      }
    }

    return {
      isValid: true,
      header,
      issue: '',
      recommendation: ''
    };
  }

  /**
   * Check if header value is insecure
   * @param header Header to check
   * @returns True if insecure
   */
  private static isInsecureValue(header: SecurityHeader): boolean {
    switch (header.name) {
      case 'Content-Security-Policy':
        return header.value.includes("'unsafe-inline'") || 
               header.value.includes("'unsafe-eval'") ||
               header.value.includes('*') ||
               header.value.includes('http:');

      case 'X-Frame-Options':
        return !['DENY', 'SAMEORIGIN'].includes(header.value.toUpperCase());

      case 'X-Content-Type-Options':
        return header.value.toLowerCase() !== 'nosniff';

      case 'Referrer-Policy':
        const unsafePolicies = ['no-referrer-when-downgrade', 'unsafe-url'];
        return unsafePolicies.includes(header.value);

      default:
        return false;
    }
  }

  /**
   * Get recommended security headers
   * @param category Optional category filter
   * @returns Array of recommended headers
   */
  static getRecommendedHeaders(category?: SecurityHeader['category']): SecurityHeader[] {
    if (category) {
      return this.RECOMMENDED_HEADERS.filter(h => h.category === category);
    }
    return [...this.RECOMMENDED_HEADERS];
  }

  /**
   * Create custom security header
   * @param name Header name
   * @param value Header value
   * @param description Header description
   * @param category Header category
   * @returns Custom security header
   */
  static createCustomHeader(
    name: string,
    value: string,
    description: string,
    category: SecurityHeader['category'] = 'misc'
  ): SecurityHeader {
    return {
      name,
      value,
      description,
      required: false,
      category
    };
  }

  /**
   * Generate security headers report
   * @param headers Current security headers
   * @returns Security headers report
   */
  static generateReport(headers: SecurityHeader[]): {
    summary: {
      totalHeaders: number;
      requiredHeaders: number;
      optionalHeaders: number;
      securityScore: number;
    };
    categories: Record<string, {
      count: number;
      headers: SecurityHeader[];
    }>;
    recommendations: string[];
    generatedAt: number;
  } {
    const validation = this.validateHeaders(headers);
    
    // Categorize headers
    const categories: Record<string, { count: number; headers: SecurityHeader[] }> = {};
    for (const header of headers) {
      if (!categories[header.category]) {
        categories[header.category] = { count: 0, headers: [] };
      }
      categories[header.category].count++;
      categories[header.category].headers.push(header);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (validation.missing.length > 0) {
      recommendations.push(`Add ${validation.missing.length} missing required security headers`);
    }

    if (validation.misconfigured.length > 0) {
      recommendations.push(`Fix ${validation.misconfigured.length} misconfigured security headers`);
    }

    if (validation.warnings.length > 0) {
      recommendations.push(`Address ${validation.warnings.length} security warnings`);
    }

    const requiredHeaders = this.RECOMMENDED_HEADERS.filter(h => h.required).length;
    const implementedRequiredHeaders = requiredHeaders - validation.missing.length;

    return {
      summary: {
        totalHeaders: headers.length,
        requiredHeaders: implementedRequiredHeaders,
        optionalHeaders: headers.length - implementedRequiredHeaders,
        securityScore: validation.score
      },
      categories,
      recommendations,
      generatedAt: Date.now()
    };
  }

  /**
   * Check if security headers are properly configured for Chrome extensions
   * @param headers Headers to check
   * @returns Extension-specific validation result
   */
  static validateForExtension(headers: SecurityHeader[]): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for CSP
    const cspHeader = headers.find(h => h.name === 'Content-Security-Policy');
    if (!cspHeader) {
      issues.push('Missing Content-Security-Policy header');
      recommendations.push('Add CSP header to extension pages');
    } else {
      // Check if CSP allows OpenRouter
      if (!cspHeader.value.includes('openrouter.ai')) {
        issues.push('CSP does not allow OpenRouter API access');
        recommendations.push('Add https://openrouter.ai to connect-src directive');
      }
    }

    // Check for unnecessary headers in extension context
    const hstsHeader = headers.find(h => h.name === 'Strict-Transport-Security');
    if (hstsHeader) {
      issues.push('Strict-Transport-Security is not applicable to extension pages');
      recommendations.push('Remove HSTS header for extension context');
    }

    // Check for proper frame protection
    const frameHeader = headers.find(h => h.name === 'X-Frame-Options');
    if (!frameHeader) {
      issues.push('Missing X-Frame-Options header');
      recommendations.push('Add X-Frame-Options: DENY to prevent clickjacking');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Get security header by name
   * @param name Header name
   * @returns Header definition or null
   */
  static getHeader(name: string): SecurityHeader | null {
    return this.RECOMMENDED_HEADERS.find(h => h.name === name) || null;
  }

  /**
   * Update security header value
   * @param headers Current headers
   * @param name Header name to update
   * @param newValue New header value
   * @returns Updated headers array
   */
  static updateHeaderValue(
    headers: SecurityHeader[],
    name: string,
    newValue: string
  ): SecurityHeader[] {
    return headers.map(header => {
      if (header.name === name) {
        return { ...header, value: newValue };
      }
      return header;
    });
  }
}
