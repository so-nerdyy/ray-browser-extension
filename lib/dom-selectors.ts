/**
 * DOM selector strategies for robust element detection
 * Provides multiple fallback strategies for finding elements
 */

import { ElementSelector, SelectorStrategy } from './automation-types';

export class DomSelectors {
  private selectorCache: Map<string, Element[]> = new Map();
  private cacheTimeout = 5000; // 5 seconds cache timeout

  /**
   * Find elements using multiple strategies
   */
  async findElements(selector: ElementSelector, context: Element | Document = document): Promise<Element[]> {
    const cacheKey = this.generateCacheKey(selector, context);
    
    // Check cache first
    if (this.selectorCache.has(cacheKey)) {
      return this.selectorCache.get(cacheKey)!;
    }
    
    let elements: Element[] = [];
    
    try {
      switch (selector.strategy) {
        case 'css':
          elements = this.findByCssSelector(selector.value, context);
          break;
          
        case 'xpath':
          elements = await this.findByXPath(selector.value, context);
          break;
          
        case 'text':
          elements = await this.findByText(selector.value, context);
          break;
          
        case 'attribute':
          elements = this.findByAttribute(selector.attribute!, selector.value, context);
          break;
          
        case 'index':
          elements = this.findByIndex(selector.value, selector.index!, context);
          break;
          
        default:
          throw new Error(`Unknown selector strategy: ${selector.strategy}`);
      }
      
      // Cache the results
      this.selectorCache.set(cacheKey, elements);
      
      // Clear cache after timeout
      setTimeout(() => {
        this.selectorCache.delete(cacheKey);
      }, this.cacheTimeout);
      
      return elements;
    } catch (error) {
      throw new Error(`Failed to find elements: ${error.message}`);
    }
  }

  /**
   * Find a single element using multiple strategies
   */
  async findElement(selector: ElementSelector, context: Element | Document = document): Promise<Element | null> {
    const elements = await this.findElements(selector, context);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Find elements by CSS selector
   */
  private findByCssSelector(selector: string, context: Element | Document): Element[] {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      throw new Error(`Invalid CSS selector: ${selector}`);
    }
  }

  /**
   * Find elements by XPath
   */
  private async findByXPath(xpath: string, context: Element | Document): Promise<Element[]> {
    try {
      const result = document.evaluate(
        xpath,
        context,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      
      const elements: Element[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          elements.push(node as Element);
        }
      }
      
      return elements;
    } catch (error) {
      throw new Error(`Invalid XPath: ${xpath}`);
    }
  }

  /**
   * Find elements by text content
   */
  private async findByText(text: string, context: Element | Document): Promise<Element[]> {
    const elements: Element[] = [];
    const walker = document.createTreeWalker(
      context,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent && node.textContent.includes(text)) {
        const parent = node.parentElement;
        if (parent && !elements.includes(parent)) {
          elements.push(parent);
        }
      }
    }
    
    return elements;
  }

  /**
   * Find elements by attribute
   */
  private findByAttribute(attribute: string, value: string, context: Element | Document): Element[] {
    try {
      return Array.from(context.querySelectorAll(`[${attribute}="${value}"]`));
    } catch (error) {
      throw new Error(`Invalid attribute selector: ${attribute}="${value}"`);
    }
  }

  /**
   * Find elements by index
   */
  private findByIndex(tagName: string, index: number, context: Element | Document): Element[] {
    try {
      const elements = Array.from(context.querySelectorAll(tagName));
      if (index >= 0 && index < elements.length) {
        return [elements[index]];
      }
      return [];
    } catch (error) {
      throw new Error(`Invalid index selector: ${tagName}[${index}]`);
    }
  }

  /**
   * Generate a robust selector for an element
   */
  generateSelector(element: Element): ElementSelector[] {
    const selectors: ElementSelector[] = [];
    
    // Try ID first (most reliable)
    if (element.id) {
      selectors.push({
        strategy: 'css',
        value: `#${element.id}`
      });
    }
    
    // Try unique class combination
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const classSelector = '.' + classes.join('.');
        if (document.querySelectorAll(classSelector).length === 1) {
          selectors.push({
            strategy: 'css',
            value: classSelector
          });
        }
      }
    }
    
    // Try data attributes (common in modern frameworks)
    const dataAttributes = ['data-testid', 'data-cy', 'data-test', 'data-automation-id'];
    for (const attr of dataAttributes) {
      if (element.hasAttribute(attr)) {
        selectors.push({
          strategy: 'attribute',
          attribute: attr,
          value: element.getAttribute(attr)!
        });
      }
    }
    
    // Try name attribute (for form elements)
    if (element.hasAttribute('name')) {
      const nameSelector = `[name="${element.getAttribute('name')}"]`;
      if (document.querySelectorAll(nameSelector).length === 1) {
        selectors.push({
          strategy: 'attribute',
          attribute: 'name',
          value: element.getAttribute('name')!
        });
      }
    }
    
    // Generate XPath as fallback
    selectors.push({
      strategy: 'xpath',
      value: this.generateXPath(element)
    });
    
    // Generate text-based selector if element has text
    if (element.textContent && element.textContent.trim()) {
      selectors.push({
        strategy: 'text',
        value: element.textContent.trim()
      });
    }
    
    return selectors;
  }

  /**
   * Generate XPath for an element
   */
  private generateXPath(element: Element): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.documentElement) {
      let index = 0;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      const pathIndex = index > 0 ? `[${index + 1}]` : '';
      parts.unshift(`${tagName}${pathIndex}`);
      
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }

  /**
   * Generate cache key for selector
   */
  private generateCacheKey(selector: ElementSelector, context: Element | Document): string {
    const contextId = context === document ? 'document' : this.getElementId(context);
    return `${selector.strategy}:${selector.value}:${contextId}`;
  }

  /**
   * Get a unique identifier for an element
   */
  private getElementId(element: Element): string {
    if (element.id) {
      return element.id;
    }
    
    // Generate a unique identifier based on element properties
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const textContent = element.textContent?.substring(0, 50) || '';
    
    return `${tagName}:${className}:${textContent}`;
  }

  /**
   * Clear the selector cache
   */
  clearCache(): void {
    this.selectorCache.clear();
  }

  /**
   * Set cache timeout
   */
  setCacheTimeout(timeout: number): void {
    this.cacheTimeout = timeout;
  }

  /**
   * Try multiple selector strategies until one works
   */
  async tryMultipleSelectors(selectors: ElementSelector[], context: Element | Document = document): Promise<Element | null> {
    for (const selector of selectors) {
      try {
        const element = await this.findElement(selector, context);
        if (element) {
          return element;
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    return null;
  }

  /**
   * Find elements with retry logic
   */
  async findElementsWithRetry(
    selector: ElementSelector, 
    maxRetries: number = 3, 
    retryDelay: number = 1000,
    context: Element | Document = document
  ): Promise<Element[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const elements = await this.findElements(selector, context);
        if (elements.length > 0) {
          return elements;
        }
      } catch (error) {
        lastError = error as Error;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw lastError || new Error(`No elements found after ${maxRetries} attempts`);
  }

  /**
   * Find visible elements only
   */
  async findVisibleElements(selector: ElementSelector, context: Element | Document = document): Promise<Element[]> {
    const elements = await this.findElements(selector, context);
    return elements.filter(element => this.isElementVisible(element));
  }

  /**
   * Check if an element is visible
   */
  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  /**
   * Find interactive elements (clickable, focusable, etc.)
   */
  async findInteractiveElements(context: Element | Document = document): Promise<Element[]> {
    const interactiveSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[role="button"]',
      '[role="link"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])'
    ];
    
    const elements: Element[] = [];
    
    for (const selector of interactiveSelectors) {
      try {
        const found = await this.findElements({ strategy: 'css', value: selector }, context);
        elements.push(...found);
      } catch (error) {
        // Skip invalid selectors
        continue;
      }
    }
    
    // Remove duplicates and return only visible elements
    return [...new Set(elements)].filter(element => this.isElementVisible(element));
  }

  /**
   * Find form elements
   */
  async findFormElements(context: Element | Document = document): Promise<Element[]> {
    const formSelectors = [
      'input',
      'select',
      'textarea',
      'button[type="submit"]',
      'button:not([type])'
    ];
    
    const elements: Element[] = [];
    
    for (const selector of formSelectors) {
      try {
        const found = await this.findElements({ strategy: 'css', value: selector }, context);
        elements.push(...found);
      } catch (error) {
        // Skip invalid selectors
        continue;
      }
    }
    
    return [...new Set(elements)];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearCache();
  }
}

// Export singleton instance for convenience
export const domSelectors = new DomSelectors(); * DOM selector strategies for robust element detection
 * Provides multiple fallback strategies for finding elements
 */

import { ElementSelector, SelectorStrategy } from './automation-types';

export class DomSelectors {
  private selectorCache: Map<string, Element[]> = new Map();
  private cacheTimeout = 5000; // 5 seconds cache timeout

  /**
   * Find elements using multiple strategies
   */
  async findElements(selector: ElementSelector, context: Element | Document = document): Promise<Element[]> {
    const cacheKey = this.generateCacheKey(selector, context);
    
    // Check cache first
    if (this.selectorCache.has(cacheKey)) {
      return this.selectorCache.get(cacheKey)!;
    }
    
    let elements: Element[] = [];
    
    try {
      switch (selector.strategy) {
        case 'css':
          elements = this.findByCssSelector(selector.value, context);
          break;
          
        case 'xpath':
          elements = await this.findByXPath(selector.value, context);
          break;
          
        case 'text':
          elements = await this.findByText(selector.value, context);
          break;
          
        case 'attribute':
          elements = this.findByAttribute(selector.attribute!, selector.value, context);
          break;
          
        case 'index':
          elements = this.findByIndex(selector.value, selector.index!, context);
          break;
          
        default:
          throw new Error(`Unknown selector strategy: ${selector.strategy}`);
      }
      
      // Cache the results
      this.selectorCache.set(cacheKey, elements);
      
      // Clear cache after timeout
      setTimeout(() => {
        this.selectorCache.delete(cacheKey);
      }, this.cacheTimeout);
      
      return elements;
    } catch (error) {
      throw new Error(`Failed to find elements: ${error.message}`);
    }
  }

  /**
   * Find a single element using multiple strategies
   */
  async findElement(selector: ElementSelector, context: Element | Document = document): Promise<Element | null> {
    const elements = await this.findElements(selector, context);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * Find elements by CSS selector
   */
  private findByCssSelector(selector: string, context: Element | Document): Element[] {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      throw new Error(`Invalid CSS selector: ${selector}`);
    }
  }

  /**
   * Find elements by XPath
   */
  private async findByXPath(xpath: string, context: Element | Document): Promise<Element[]> {
    try {
      const result = document.evaluate(
        xpath,
        context,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      
      const elements: Element[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          elements.push(node as Element);
        }
      }
      
      return elements;
    } catch (error) {
      throw new Error(`Invalid XPath: ${xpath}`);
    }
  }

  /**
   * Find elements by text content
   */
  private async findByText(text: string, context: Element | Document): Promise<Element[]> {
    const elements: Element[] = [];
    const walker = document.createTreeWalker(
      context,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent && node.textContent.includes(text)) {
        const parent = node.parentElement;
        if (parent && !elements.includes(parent)) {
          elements.push(parent);
        }
      }
    }
    
    return elements;
  }

  /**
   * Find elements by attribute
   */
  private findByAttribute(attribute: string, value: string, context: Element | Document): Element[] {
    try {
      return Array.from(context.querySelectorAll(`[${attribute}="${value}"]`));
    } catch (error) {
      throw new Error(`Invalid attribute selector: ${attribute}="${value}"`);
    }
  }

  /**
   * Find elements by index
   */
  private findByIndex(tagName: string, index: number, context: Element | Document): Element[] {
    try {
      const elements = Array.from(context.querySelectorAll(tagName));
      if (index >= 0 && index < elements.length) {
        return [elements[index]];
      }
      return [];
    } catch (error) {
      throw new Error(`Invalid index selector: ${tagName}[${index}]`);
    }
  }

  /**
   * Generate a robust selector for an element
   */
  generateSelector(element: Element): ElementSelector[] {
    const selectors: ElementSelector[] = [];
    
    // Try ID first (most reliable)
    if (element.id) {
      selectors.push({
        strategy: 'css',
        value: `#${element.id}`
      });
    }
    
    // Try unique class combination
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const classSelector = '.' + classes.join('.');
        if (document.querySelectorAll(classSelector).length === 1) {
          selectors.push({
            strategy: 'css',
            value: classSelector
          });
        }
      }
    }
    
    // Try data attributes (common in modern frameworks)
    const dataAttributes = ['data-testid', 'data-cy', 'data-test', 'data-automation-id'];
    for (const attr of dataAttributes) {
      if (element.hasAttribute(attr)) {
        selectors.push({
          strategy: 'attribute',
          attribute: attr,
          value: element.getAttribute(attr)!
        });
      }
    }
    
    // Try name attribute (for form elements)
    if (element.hasAttribute('name')) {
      const nameSelector = `[name="${element.getAttribute('name')}"]`;
      if (document.querySelectorAll(nameSelector).length === 1) {
        selectors.push({
          strategy: 'attribute',
          attribute: 'name',
          value: element.getAttribute('name')!
        });
      }
    }
    
    // Generate XPath as fallback
    selectors.push({
      strategy: 'xpath',
      value: this.generateXPath(element)
    });
    
    // Generate text-based selector if element has text
    if (element.textContent && element.textContent.trim()) {
      selectors.push({
        strategy: 'text',
        value: element.textContent.trim()
      });
    }
    
    return selectors;
  }

  /**
   * Generate XPath for an element
   */
  private generateXPath(element: Element): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.documentElement) {
      let index = 0;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      const pathIndex = index > 0 ? `[${index + 1}]` : '';
      parts.unshift(`${tagName}${pathIndex}`);
      
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }

  /**
   * Generate cache key for selector
   */
  private generateCacheKey(selector: ElementSelector, context: Element | Document): string {
    const contextId = context === document ? 'document' : this.getElementId(context);
    return `${selector.strategy}:${selector.value}:${contextId}`;
  }

  /**
   * Get a unique identifier for an element
   */
  private getElementId(element: Element): string {
    if (element.id) {
      return element.id;
    }
    
    // Generate a unique identifier based on element properties
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const textContent = element.textContent?.substring(0, 50) || '';
    
    return `${tagName}:${className}:${textContent}`;
  }

  /**
   * Clear the selector cache
   */
  clearCache(): void {
    this.selectorCache.clear();
  }

  /**
   * Set cache timeout
   */
  setCacheTimeout(timeout: number): void {
    this.cacheTimeout = timeout;
  }

  /**
   * Try multiple selector strategies until one works
   */
  async tryMultipleSelectors(selectors: ElementSelector[], context: Element | Document = document): Promise<Element | null> {
    for (const selector of selectors) {
      try {
        const element = await this.findElement(selector, context);
        if (element) {
          return element;
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    return null;
  }

  /**
   * Find elements with retry logic
   */
  async findElementsWithRetry(
    selector: ElementSelector, 
    maxRetries: number = 3, 
    retryDelay: number = 1000,
    context: Element | Document = document
  ): Promise<Element[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const elements = await this.findElements(selector, context);
        if (elements.length > 0) {
          return elements;
        }
      } catch (error) {
        lastError = error as Error;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw lastError || new Error(`No elements found after ${maxRetries} attempts`);
  }

  /**
   * Find visible elements only
   */
  async findVisibleElements(selector: ElementSelector, context: Element | Document = document): Promise<Element[]> {
    const elements = await this.findElements(selector, context);
    return elements.filter(element => this.isElementVisible(element));
  }

  /**
   * Check if an element is visible
   */
  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  /**
   * Find interactive elements (clickable, focusable, etc.)
   */
  async findInteractiveElements(context: Element | Document = document): Promise<Element[]> {
    const interactiveSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[role="button"]',
      '[role="link"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])'
    ];
    
    const elements: Element[] = [];
    
    for (const selector of interactiveSelectors) {
      try {
        const found = await this.findElements({ strategy: 'css', value: selector }, context);
        elements.push(...found);
      } catch (error) {
        // Skip invalid selectors
        continue;
      }
    }
    
    // Remove duplicates and return only visible elements
    return [...new Set(elements)].filter(element => this.isElementVisible(element));
  }

  /**
   * Find form elements
   */
  async findFormElements(context: Element | Document = document): Promise<Element[]> {
    const formSelectors = [
      'input',
      'select',
      'textarea',
      'button[type="submit"]',
      'button:not([type])'
    ];
    
    const elements: Element[] = [];
    
    for (const selector of formSelectors) {
      try {
        const found = await this.findElements({ strategy: 'css', value: selector }, context);
        elements.push(...found);
      } catch (error) {
        // Skip invalid selectors
        continue;
      }
    }
    
    return [...new Set(elements)];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearCache();
  }
}

// Export singleton instance for convenience
export const domSelectors = new DomSelectors();
