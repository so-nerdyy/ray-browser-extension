/**
 * XSS Protection for Ray Chrome Extension
 * Handles Cross-Site Scripting prevention and detection
 */

export interface XSSPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface XSSDetectionResult {
  isXSS: boolean;
  patterns: Array<{
    name: string;
    severity: 'low' | 'medium' | 'high';
    matches: string[];
  }>;
  sanitized: string;
  riskScore: number;
}

export interface XSSProtectionConfig {
  enableDetection: boolean;
  enablePrevention: boolean;
  sanitizeOutput: boolean;
  logDetections: boolean;
  customPatterns?: XSSPattern[];
}

export class XSSProtection {
  private static readonly DEFAULT_CONFIG: XSSProtectionConfig = {
    enableDetection: true,
    enablePrevention: true,
    sanitizeOutput: true,
    logDetections: true
  };

  private static readonly XSS_PATTERNS: XSSPattern[] = [
    {
      name: 'Script Tag Injection',
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      description: 'Detects script tag injection attempts',
      severity: 'high'
    },
    {
      name: 'JavaScript Protocol',
      pattern: /javascript:/gi,
      description: 'Detects javascript: protocol usage',
      severity: 'high'
    },
    {
      name: 'Event Handler Injection',
      pattern: /on\w+\s*=/gi,
      description: 'Detects event handler injection',
      severity: 'high'
    },
    {
      name: 'VBScript Protocol',
      pattern: /vbscript:/gi,
      description: 'Detects VBScript protocol usage',
      severity: 'high'
    },
    {
      name: 'Data URL Script',
      pattern: /data:text\/html/gi,
      description: 'Detects data URL script injection',
      severity: 'high'
    },
    {
      name: 'Expression Injection',
      pattern: /expression\s*\(/gi,
      description: 'Detects CSS expression injection',
      severity: 'medium'
    },
    {
      name: 'Import Injection',
      pattern: /@import/gi,
      description: 'Detects CSS import injection',
      severity: 'medium'
    },
    {
      name: 'Binding Injection',
      pattern: /binding\s*:/gi,
      description: 'Detects CSS binding injection',
      severity: 'medium'
    },
    {
      name: 'HTML Comment Injection',
      pattern: /<!--[\s\S]*?-->/g,
      description: 'Detects HTML comment injection',
      severity: 'low'
    },
    {
      name: 'CDATA Section',
      pattern: /<!\[CDATA\[[\s\S]*?\]\]>/g,
      description: 'Detects CDATA section injection',
      severity: 'medium'
    },
    {
      name: 'Meta Redirect',
      pattern: /<meta[^>]*http-equiv\s*=\s*["']?refresh/gi,
      description: 'Detects meta refresh redirect injection',
      severity: 'medium'
    },
    {
      name: 'Iframe Injection',
      pattern: /<iframe\b[^>]*>/gi,
      description: 'Detects iframe injection attempts',
      severity: 'high'
    },
    {
      name: 'Object Injection',
      pattern: /<object\b[^>]*>/gi,
      description: 'Detects object injection attempts',
      severity: 'high'
    },
    {
      name: 'Embed Injection',
      pattern: /<embed\b[^>]*>/gi,
      description: 'Detects embed injection attempts',
      severity: 'high'
    },
    {
      name: 'Form Action Injection',
      pattern: /<form[^>]*action\s*=\s*["']?javascript:/gi,
      description: 'Detects form action JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Link Href Injection',
      pattern: /<link[^>]*href\s*=\s*["']?javascript:/gi,
      description: 'Detects link href JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Img Src Injection',
      pattern: /<img[^>]*src\s*=\s*["']?javascript:/gi,
      description: 'Detects img src JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Background Injection',
      pattern: /background\s*:\s*["']?javascript:/gi,
      description: 'Detects background JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Style Injection',
      pattern: /style\s*=\s*["'][^"']*expression/gi,
      description: 'Detects style expression injection',
      severity: 'high'
    }
  ];

  private static readonly LOG_KEY = 'xssDetections';

  /**
   * Detect XSS patterns in input
   * @param input The input to check for XSS
   * @param config Optional XSS protection configuration
   * @returns XSS detection result
   */
  static detectXSS(input: string, config?: Partial<XSSProtectionConfig>): XSSDetectionResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    if (!finalConfig.enableDetection) {
      return {
        isXSS: false,
        patterns: [],
        sanitized: input,
        riskScore: 0
      };
    }

    const patterns = [...this.XSS_PATTERNS, ...(finalConfig.customPatterns || [])];
    const detectedPatterns: XSSDetectionResult['patterns'] = [];
    let sanitized = input;
    let riskScore = 0;

    // Check each pattern
    for (const xssPattern of patterns) {
      const matches = input.match(xssPattern.pattern);
      if (matches) {
        detectedPatterns.push({
          name: xssPattern.name,
          severity: xssPattern.severity,
          matches: matches.slice(0, 5) // Limit matches to prevent huge arrays
        });

        // Calculate risk score based on severity
        switch (xssPattern.severity) {
          case 'high':
            riskScore += 10;
            break;
          case 'medium':
            riskScore += 5;
            break;
          case 'low':
            riskScore += 1;
            break;
        }

        // Remove dangerous content if prevention is enabled
        if (finalConfig.enablePrevention) {
          sanitized = sanitized.replace(xssPattern.pattern, '');
        }
      }
    }

    const isXSS = detectedPatterns.length > 0;

    // Log detection if enabled
    if (finalConfig.logDetections && isXSS) {
      this.logXSSDetection(input, detectedPatterns, riskScore);
    }

    // Additional sanitization if enabled
    if (finalConfig.sanitizeOutput) {
      sanitized = this.sanitizeForXSS(sanitized);
    }

    return {
      isXSS,
      patterns: detectedPatterns,
      sanitized,
      riskScore
    };
  }

  /**
   * Check if HTML content is safe from XSS
   * @param html The HTML content to check
   * @param config Optional XSS protection configuration
   * @returns True if safe, false otherwise
   */
  static isHTMLSafe(html: string, config?: Partial<XSSProtectionConfig>): boolean {
    const result = this.detectXSS(html, config);
    return !result.isXSS && result.riskScore < 5;
  }

  /**
   * Sanitize content specifically for XSS protection
   * @param input The input to sanitize
   * @returns Sanitized input
   */
  static sanitizeForXSS(input: string): string {
    let sanitized = input;

    // Remove dangerous content
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi,
      /expression\s*\(/gi,
      /@import/gi,
      /binding\s*:/gi
    ];

    for (const pattern of dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove HTML tags if they contain dangerous attributes
    sanitized = sanitized.replace(/<[^>]*\bon\w+\s*=[^>]*>/gi, '');
    sanitized = sanitized.replace(/<[^>]*\bhref\s*=\s*["']?javascript:[^>]*>/gi, '');
    sanitized = sanitized.replace(/<[^>]*\bsrc\s*=\s*["']?javascript:[^>]*>/gi, '');

    // Encode dangerous characters
    sanitized = sanitized.replace(/</g, '<');
    sanitized = sanitized.replace(/>/g, '>');
    sanitized = sanitized.replace(/"/g, '"');
    sanitized = sanitized.replace(/'/g, '&#x27;');
    sanitized = sanitized.replace(/\//g, '&#x2F;');

    return sanitized;
  }

  /**
   * Create safe HTML element with XSS protection
   * @param tagName The tag name for the element
   * @param attributes Object of attributes to set
   * @param content Optional content for the element
   * @returns Safe HTML element
   */
  static createSafeElement(
    tagName: string,
    attributes: Record<string, string> = {},
    content?: string
  ): HTMLElement {
    const element = document.createElement(tagName);

    // Set attributes safely
    for (const [attr, value] of Object.entries(attributes)) {
      // Skip dangerous attributes
      if (this.isDangerousAttribute(attr)) {
        continue;
      }

      // Sanitize attribute values
      const sanitizedValue = this.sanitizeForXSS(value);
      element.setAttribute(attr, sanitizedValue);
    }

    // Set content safely
    if (content !== undefined) {
      // Use textContent to prevent script execution
      element.textContent = this.sanitizeForXSS(content);
    }

    return element;
  }

  /**
   * Check if an attribute is dangerous
   * @param attribute The attribute name to check
   * @returns True if dangerous
   */
  private static isDangerousAttribute(attribute: string): boolean {
    const dangerousAttributes = [
      'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur',
      'onchange', 'onsubmit', 'onreset', 'onselect', 'onunload',
      'onabort', 'oncanplay', 'oncanplaythrough', 'onchange', 'onclick',
      'oncontextmenu', 'ondblclick', 'ondrag', 'ondragend', 'ondragenter',
      'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'ondurationchange',
      'onemptied', 'onended', 'onerror', 'onfocus', 'onformchange', 'onforminput',
      'oninput', 'oninvalid', 'onkeydown', 'onkeypress', 'onkeyup', 'onload',
      'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onmousedown', 'onmousemove',
      'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel', 'onpause',
      'onplay', 'onplaying', 'onprogress', 'onratechange', 'onreadystatechange',
      'onreset', 'onscroll', 'onseeked', 'onseeking', 'onselect', 'onshow',
      'onstalled', 'onsubmit', 'onsuspend', 'ontimeupdate', 'onvolumechange',
      'onwaiting'
    ];

    return dangerousAttributes.includes(attribute.toLowerCase()) ||
           attribute.toLowerCase().startsWith('on');
  }

  /**
   * Log XSS detection for monitoring
   * @param input The original input
   * @param patterns Detected patterns
   * @param riskScore Calculated risk score
   */
  private static async logXSSDetection(
    input: string,
    patterns: XSSDetectionResult['patterns'],
    riskScore: number
  ): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const detections = result[this.LOG_KEY] || [];

      detections.push({
        timestamp: Date.now(),
        input: input.substring(0, 500), // Limit input size
        patterns: patterns.map(p => ({ name: p.name, severity: p.severity })),
        riskScore
      });

      // Keep only recent detections
      if (detections.length > 1000) {
        detections.splice(0, detections.length - 1000);
      }

      await chrome.storage.local.set({ [this.LOG_KEY]: detections });
    } catch (error) {
      console.error('Failed to log XSS detection:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get XSS detection history
   * @param limit Maximum number of detections to retrieve
   * @returns Promise that resolves with XSS detection history
   */
  static async getDetectionHistory(limit: number = 100): Promise<Array<{
    timestamp: number;
    input: string;
    patterns: Array<{ name: string; severity: string }>;
    riskScore: number;
  }>> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const detections = result[this.LOG_KEY] || [];

      // Return most recent detections
      return detections.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get XSS detection history:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Clear XSS detection history
   * @returns Promise that resolves when history is cleared
   */
  static async clearDetectionHistory(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.LOG_KEY]);
    } catch (error) {
      console.error('Failed to clear XSS detection history:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear XSS detection history');
    }
  }

  /**
   * Add custom XSS detection pattern
   * @param pattern The custom pattern to add
   */
  static addCustomPattern(pattern: XSSPattern): void {
    this.XSS_PATTERNS.push(pattern);
  }

  /**
   * Remove XSS detection pattern by name
   * @param name Name of the pattern to remove
   */
  static removePattern(name: string): void {
    const index = this.XSS_PATTERNS.findIndex(p => p.name === name);
    if (index !== -1) {
      this.XSS_PATTERNS.splice(index, 1);
    }
  }

  /**
   * Get all XSS detection patterns
   * @returns Array of XSS patterns
   */
  static getPatterns(): XSSPattern[] {
    return [...this.XSS_PATTERNS];
  }

  /**
   * Generate XSS protection report
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with XSS protection report
   */
  static async generateReport(daysToAnalyze: number = 7): Promise<{
    summary: {
      totalDetections: number;
      highRiskDetections: number;
      mediumRiskDetections: number;
      lowRiskDetections: number;
      averageRiskScore: number;
    };
    topPatterns: Array<{
      name: string;
      count: number;
      severity: string;
    }>;
    timeline: Array<{
      date: number;
      count: number;
      averageRiskScore: number;
    }>;
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const history = await this.getDetectionHistory(1000);
      const relevantDetections = history.filter(d => d.timestamp >= startDate);

      // Generate summary
      const summary = {
        totalDetections: relevantDetections.length,
        highRiskDetections: relevantDetections.filter(d => d.riskScore >= 10).length,
        mediumRiskDetections: relevantDetections.filter(d => d.riskScore >= 5 && d.riskScore < 10).length,
        lowRiskDetections: relevantDetections.filter(d => d.riskScore < 5).length,
        averageRiskScore: relevantDetections.length > 0 
          ? relevantDetections.reduce((sum, d) => sum + d.riskScore, 0) / relevantDetections.length 
          : 0
      };

      // Generate top patterns
      const patternCounts = new Map<string, { count: number; severity: string }>();
      for (const detection of relevantDetections) {
        for (const pattern of detection.patterns) {
          const existing = patternCounts.get(pattern.name) || { count: 0, severity: pattern.severity };
          patternCounts.set(pattern.name, {
            count: existing.count + 1,
            severity: pattern.severity
          });
        }
      }

      const topPatterns = Array.from(patternCounts.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { count: number; totalRiskScore: number }>();
      for (const detection of relevantDetections) {
        const day = Math.floor(detection.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { count: 0, totalRiskScore: 0 };
        timelineMap.set(day, {
          count: existing.count + 1,
          totalRiskScore: existing.totalRiskScore + detection.riskScore
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          averageRiskScore: data.count > 0 ? data.totalRiskScore / data.count : 0
        }))
        .sort((a, b) => a.date - b.date);

      return {
        summary,
        topPatterns,
        timeline,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate XSS protection report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate XSS protection report');
    }
  }
} * XSS Protection for Ray Chrome Extension
 * Handles Cross-Site Scripting prevention and detection
 */

export interface XSSPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface XSSDetectionResult {
  isXSS: boolean;
  patterns: Array<{
    name: string;
    severity: 'low' | 'medium' | 'high';
    matches: string[];
  }>;
  sanitized: string;
  riskScore: number;
}

export interface XSSProtectionConfig {
  enableDetection: boolean;
  enablePrevention: boolean;
  sanitizeOutput: boolean;
  logDetections: boolean;
  customPatterns?: XSSPattern[];
}

export class XSSProtection {
  private static readonly DEFAULT_CONFIG: XSSProtectionConfig = {
    enableDetection: true,
    enablePrevention: true,
    sanitizeOutput: true,
    logDetections: true
  };

  private static readonly XSS_PATTERNS: XSSPattern[] = [
    {
      name: 'Script Tag Injection',
      pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      description: 'Detects script tag injection attempts',
      severity: 'high'
    },
    {
      name: 'JavaScript Protocol',
      pattern: /javascript:/gi,
      description: 'Detects javascript: protocol usage',
      severity: 'high'
    },
    {
      name: 'Event Handler Injection',
      pattern: /on\w+\s*=/gi,
      description: 'Detects event handler injection',
      severity: 'high'
    },
    {
      name: 'VBScript Protocol',
      pattern: /vbscript:/gi,
      description: 'Detects VBScript protocol usage',
      severity: 'high'
    },
    {
      name: 'Data URL Script',
      pattern: /data:text\/html/gi,
      description: 'Detects data URL script injection',
      severity: 'high'
    },
    {
      name: 'Expression Injection',
      pattern: /expression\s*\(/gi,
      description: 'Detects CSS expression injection',
      severity: 'medium'
    },
    {
      name: 'Import Injection',
      pattern: /@import/gi,
      description: 'Detects CSS import injection',
      severity: 'medium'
    },
    {
      name: 'Binding Injection',
      pattern: /binding\s*:/gi,
      description: 'Detects CSS binding injection',
      severity: 'medium'
    },
    {
      name: 'HTML Comment Injection',
      pattern: /<!--[\s\S]*?-->/g,
      description: 'Detects HTML comment injection',
      severity: 'low'
    },
    {
      name: 'CDATA Section',
      pattern: /<!\[CDATA\[[\s\S]*?\]\]>/g,
      description: 'Detects CDATA section injection',
      severity: 'medium'
    },
    {
      name: 'Meta Redirect',
      pattern: /<meta[^>]*http-equiv\s*=\s*["']?refresh/gi,
      description: 'Detects meta refresh redirect injection',
      severity: 'medium'
    },
    {
      name: 'Iframe Injection',
      pattern: /<iframe\b[^>]*>/gi,
      description: 'Detects iframe injection attempts',
      severity: 'high'
    },
    {
      name: 'Object Injection',
      pattern: /<object\b[^>]*>/gi,
      description: 'Detects object injection attempts',
      severity: 'high'
    },
    {
      name: 'Embed Injection',
      pattern: /<embed\b[^>]*>/gi,
      description: 'Detects embed injection attempts',
      severity: 'high'
    },
    {
      name: 'Form Action Injection',
      pattern: /<form[^>]*action\s*=\s*["']?javascript:/gi,
      description: 'Detects form action JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Link Href Injection',
      pattern: /<link[^>]*href\s*=\s*["']?javascript:/gi,
      description: 'Detects link href JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Img Src Injection',
      pattern: /<img[^>]*src\s*=\s*["']?javascript:/gi,
      description: 'Detects img src JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Background Injection',
      pattern: /background\s*:\s*["']?javascript:/gi,
      description: 'Detects background JavaScript injection',
      severity: 'high'
    },
    {
      name: 'Style Injection',
      pattern: /style\s*=\s*["'][^"']*expression/gi,
      description: 'Detects style expression injection',
      severity: 'high'
    }
  ];

  private static readonly LOG_KEY = 'xssDetections';

  /**
   * Detect XSS patterns in input
   * @param input The input to check for XSS
   * @param config Optional XSS protection configuration
   * @returns XSS detection result
   */
  static detectXSS(input: string, config?: Partial<XSSProtectionConfig>): XSSDetectionResult {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    if (!finalConfig.enableDetection) {
      return {
        isXSS: false,
        patterns: [],
        sanitized: input,
        riskScore: 0
      };
    }

    const patterns = [...this.XSS_PATTERNS, ...(finalConfig.customPatterns || [])];
    const detectedPatterns: XSSDetectionResult['patterns'] = [];
    let sanitized = input;
    let riskScore = 0;

    // Check each pattern
    for (const xssPattern of patterns) {
      const matches = input.match(xssPattern.pattern);
      if (matches) {
        detectedPatterns.push({
          name: xssPattern.name,
          severity: xssPattern.severity,
          matches: matches.slice(0, 5) // Limit matches to prevent huge arrays
        });

        // Calculate risk score based on severity
        switch (xssPattern.severity) {
          case 'high':
            riskScore += 10;
            break;
          case 'medium':
            riskScore += 5;
            break;
          case 'low':
            riskScore += 1;
            break;
        }

        // Remove dangerous content if prevention is enabled
        if (finalConfig.enablePrevention) {
          sanitized = sanitized.replace(xssPattern.pattern, '');
        }
      }
    }

    const isXSS = detectedPatterns.length > 0;

    // Log detection if enabled
    if (finalConfig.logDetections && isXSS) {
      this.logXSSDetection(input, detectedPatterns, riskScore);
    }

    // Additional sanitization if enabled
    if (finalConfig.sanitizeOutput) {
      sanitized = this.sanitizeForXSS(sanitized);
    }

    return {
      isXSS,
      patterns: detectedPatterns,
      sanitized,
      riskScore
    };
  }

  /**
   * Check if HTML content is safe from XSS
   * @param html The HTML content to check
   * @param config Optional XSS protection configuration
   * @returns True if safe, false otherwise
   */
  static isHTMLSafe(html: string, config?: Partial<XSSProtectionConfig>): boolean {
    const result = this.detectXSS(html, config);
    return !result.isXSS && result.riskScore < 5;
  }

  /**
   * Sanitize content specifically for XSS protection
   * @param input The input to sanitize
   * @returns Sanitized input
   */
  static sanitizeForXSS(input: string): string {
    let sanitized = input;

    // Remove dangerous content
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /on\w+\s*=/gi,
      /expression\s*\(/gi,
      /@import/gi,
      /binding\s*:/gi
    ];

    for (const pattern of dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove HTML tags if they contain dangerous attributes
    sanitized = sanitized.replace(/<[^>]*\bon\w+\s*=[^>]*>/gi, '');
    sanitized = sanitized.replace(/<[^>]*\bhref\s*=\s*["']?javascript:[^>]*>/gi, '');
    sanitized = sanitized.replace(/<[^>]*\bsrc\s*=\s*["']?javascript:[^>]*>/gi, '');

    // Encode dangerous characters
    sanitized = sanitized.replace(/</g, '<');
    sanitized = sanitized.replace(/>/g, '>');
    sanitized = sanitized.replace(/"/g, '"');
    sanitized = sanitized.replace(/'/g, '&#x27;');
    sanitized = sanitized.replace(/\//g, '&#x2F;');

    return sanitized;
  }

  /**
   * Create safe HTML element with XSS protection
   * @param tagName The tag name for the element
   * @param attributes Object of attributes to set
   * @param content Optional content for the element
   * @returns Safe HTML element
   */
  static createSafeElement(
    tagName: string,
    attributes: Record<string, string> = {},
    content?: string
  ): HTMLElement {
    const element = document.createElement(tagName);

    // Set attributes safely
    for (const [attr, value] of Object.entries(attributes)) {
      // Skip dangerous attributes
      if (this.isDangerousAttribute(attr)) {
        continue;
      }

      // Sanitize attribute values
      const sanitizedValue = this.sanitizeForXSS(value);
      element.setAttribute(attr, sanitizedValue);
    }

    // Set content safely
    if (content !== undefined) {
      // Use textContent to prevent script execution
      element.textContent = this.sanitizeForXSS(content);
    }

    return element;
  }

  /**
   * Check if an attribute is dangerous
   * @param attribute The attribute name to check
   * @returns True if dangerous
   */
  private static isDangerousAttribute(attribute: string): boolean {
    const dangerousAttributes = [
      'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur',
      'onchange', 'onsubmit', 'onreset', 'onselect', 'onunload',
      'onabort', 'oncanplay', 'oncanplaythrough', 'onchange', 'onclick',
      'oncontextmenu', 'ondblclick', 'ondrag', 'ondragend', 'ondragenter',
      'ondragleave', 'ondragover', 'ondragstart', 'ondrop', 'ondurationchange',
      'onemptied', 'onended', 'onerror', 'onfocus', 'onformchange', 'onforminput',
      'oninput', 'oninvalid', 'onkeydown', 'onkeypress', 'onkeyup', 'onload',
      'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onmousedown', 'onmousemove',
      'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel', 'onpause',
      'onplay', 'onplaying', 'onprogress', 'onratechange', 'onreadystatechange',
      'onreset', 'onscroll', 'onseeked', 'onseeking', 'onselect', 'onshow',
      'onstalled', 'onsubmit', 'onsuspend', 'ontimeupdate', 'onvolumechange',
      'onwaiting'
    ];

    return dangerousAttributes.includes(attribute.toLowerCase()) ||
           attribute.toLowerCase().startsWith('on');
  }

  /**
   * Log XSS detection for monitoring
   * @param input The original input
   * @param patterns Detected patterns
   * @param riskScore Calculated risk score
   */
  private static async logXSSDetection(
    input: string,
    patterns: XSSDetectionResult['patterns'],
    riskScore: number
  ): Promise<void> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const detections = result[this.LOG_KEY] || [];

      detections.push({
        timestamp: Date.now(),
        input: input.substring(0, 500), // Limit input size
        patterns: patterns.map(p => ({ name: p.name, severity: p.severity })),
        riskScore
      });

      // Keep only recent detections
      if (detections.length > 1000) {
        detections.splice(0, detections.length - 1000);
      }

      await chrome.storage.local.set({ [this.LOG_KEY]: detections });
    } catch (error) {
      console.error('Failed to log XSS detection:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get XSS detection history
   * @param limit Maximum number of detections to retrieve
   * @returns Promise that resolves with XSS detection history
   */
  static async getDetectionHistory(limit: number = 100): Promise<Array<{
    timestamp: number;
    input: string;
    patterns: Array<{ name: string; severity: string }>;
    riskScore: number;
  }>> {
    try {
      const result = await chrome.storage.local.get([this.LOG_KEY]);
      const detections = result[this.LOG_KEY] || [];

      // Return most recent detections
      return detections.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to get XSS detection history:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Clear XSS detection history
   * @returns Promise that resolves when history is cleared
   */
  static async clearDetectionHistory(): Promise<void> {
    try {
      await chrome.storage.local.remove([this.LOG_KEY]);
    } catch (error) {
      console.error('Failed to clear XSS detection history:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to clear XSS detection history');
    }
  }

  /**
   * Add custom XSS detection pattern
   * @param pattern The custom pattern to add
   */
  static addCustomPattern(pattern: XSSPattern): void {
    this.XSS_PATTERNS.push(pattern);
  }

  /**
   * Remove XSS detection pattern by name
   * @param name Name of the pattern to remove
   */
  static removePattern(name: string): void {
    const index = this.XSS_PATTERNS.findIndex(p => p.name === name);
    if (index !== -1) {
      this.XSS_PATTERNS.splice(index, 1);
    }
  }

  /**
   * Get all XSS detection patterns
   * @returns Array of XSS patterns
   */
  static getPatterns(): XSSPattern[] {
    return [...this.XSS_PATTERNS];
  }

  /**
   * Generate XSS protection report
   * @param daysToAnalyze Number of days to analyze
   * @returns Promise that resolves with XSS protection report
   */
  static async generateReport(daysToAnalyze: number = 7): Promise<{
    summary: {
      totalDetections: number;
      highRiskDetections: number;
      mediumRiskDetections: number;
      lowRiskDetections: number;
      averageRiskScore: number;
    };
    topPatterns: Array<{
      name: string;
      count: number;
      severity: string;
    }>;
    timeline: Array<{
      date: number;
      count: number;
      averageRiskScore: number;
    }>;
    generatedAt: number;
  }> {
    try {
      const now = Date.now();
      const startDate = now - (daysToAnalyze * 24 * 60 * 60 * 1000);
      
      const history = await this.getDetectionHistory(1000);
      const relevantDetections = history.filter(d => d.timestamp >= startDate);

      // Generate summary
      const summary = {
        totalDetections: relevantDetections.length,
        highRiskDetections: relevantDetections.filter(d => d.riskScore >= 10).length,
        mediumRiskDetections: relevantDetections.filter(d => d.riskScore >= 5 && d.riskScore < 10).length,
        lowRiskDetections: relevantDetections.filter(d => d.riskScore < 5).length,
        averageRiskScore: relevantDetections.length > 0 
          ? relevantDetections.reduce((sum, d) => sum + d.riskScore, 0) / relevantDetections.length 
          : 0
      };

      // Generate top patterns
      const patternCounts = new Map<string, { count: number; severity: string }>();
      for (const detection of relevantDetections) {
        for (const pattern of detection.patterns) {
          const existing = patternCounts.get(pattern.name) || { count: 0, severity: pattern.severity };
          patternCounts.set(pattern.name, {
            count: existing.count + 1,
            severity: pattern.severity
          });
        }
      }

      const topPatterns = Array.from(patternCounts.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Generate timeline
      const timelineMap = new Map<number, { count: number; totalRiskScore: number }>();
      for (const detection of relevantDetections) {
        const day = Math.floor(detection.timestamp / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        const existing = timelineMap.get(day) || { count: 0, totalRiskScore: 0 };
        timelineMap.set(day, {
          count: existing.count + 1,
          totalRiskScore: existing.totalRiskScore + detection.riskScore
        });
      }

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          averageRiskScore: data.count > 0 ? data.totalRiskScore / data.count : 0
        }))
        .sort((a, b) => a.date - b.date);

      return {
        summary,
        topPatterns,
        timeline,
        generatedAt: now
      };
    } catch (error) {
      console.error('Failed to generate XSS protection report:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to generate XSS protection report');
    }
  }
}
