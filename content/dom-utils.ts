/**
 * DOM manipulation utilities for browser automation
 * Provides robust element detection and interaction methods
 */

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClickOptions {
  button?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  force?: boolean;
}

export interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

export interface HighlightOptions {
  duration?: number;
  style?: Partial<CSSStyleDeclaration>;
}

export class DomUtils {
  private highlightedElements: Set<Element> = new Set();

  /**
   * Find an element using various selector strategies
   */
  findElement(selector: string, timeout: number = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        try {
          const element = this.querySelector(selector);
          if (element) {
            resolve(element);
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          setTimeout(checkElement, 100);
        } catch (error) {
          reject(new Error(`Invalid selector: ${selector}`));
        }
      };
      
      checkElement();
    });
  }

  /**
   * Query for an element using multiple selector strategies
   */
  querySelector(selector: string): Element | null {
    // Try CSS selector first
    let element = document.querySelector(selector);
    if (element) return element;
    
    // Try XPath
    try {
      const xpathResult = document.evaluate(
        selector,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      element = xpathResult.singleNodeValue as Element;
      if (element) return element;
    } catch (e) {
      // Not a valid XPath, continue
    }
    
    // Try text-based selector
    if (selector.startsWith('text=')) {
      const text = selector.substring(5);
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent?.includes(text)) {
          return node.parentElement;
        }
      }
    }
    
    // Try attribute-based selector
    if (selector.includes('=')) {
      const [attr, value] = selector.split('=');
      element = document.querySelector(`[${attr}="${value}"]`);
      if (element) return element;
    }
    
    return null;
  }

  /**
   * Click an element
   */
  async clickElement(selector: string, options: ClickOptions = {}): Promise<boolean> {
    try {
      const element = await this.findElement(selector);
      
      // Check if element is visible and clickable
      if (!this.isElementVisible(element) && !options.force) {
        throw new Error(`Element is not visible: ${selector}`);
      }
      
      // Scroll element into view
      this.scrollIntoView(element);
      
      // Wait a bit for scroll to complete
      await this.wait(100);
      
      // Create and dispatch click event
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        button: options.button || 0,
        ctrlKey: options.ctrlKey || false,
        shiftKey: options.shiftKey || false,
        altKey: options.altKey || false,
        metaKey: options.metaKey || false
      });
      
      element.dispatchEvent(clickEvent);
      
      // Also try direct click for better compatibility
      if (typeof (element as any).click === 'function') {
        (element as any).click();
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to click element: ${error.message}`);
    }
  }

  /**
   * Extract text from an element
   */
  async extractText(selector: string, attribute?: string): Promise<string> {
    try {
      const element = await this.findElement(selector);
      
      if (attribute) {
        return element.getAttribute(attribute) || '';
      }
      
      return element.textContent || '';
    } catch (error) {
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  /**
   * Wait for an element to appear
   */
  async waitForElement(
    selector: string, 
    timeout: number = 10000, 
    strategy: 'visible' | 'present' | 'clickable' = 'visible'
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const element = this.querySelector(selector);
        if (!element && strategy !== 'present') {
          await this.wait(100);
          continue;
        }
        
        if (strategy === 'present' && element) {
          return true;
        }
        
        if (strategy === 'visible' && element && this.isElementVisible(element)) {
          return true;
        }
        
        if (strategy === 'clickable' && element && this.isElementClickable(element)) {
          return true;
        }
        
        await this.wait(100);
      } catch (error) {
        await this.wait(100);
      }
    }
    
    throw new Error(`Element did not become ${strategy} within timeout: ${selector}`);
  }

  /**
   * Scroll the page or an element
   */
  async scroll(
    direction: 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom',
    amount?: number,
    selector?: string
  ): Promise<boolean> {
    try {
      let element: Element | Window = window;
      
      if (selector) {
        element = await this.findElement(selector) || window;
      }
      
      let scrollOptions: ScrollToOptions = { behavior: 'smooth' };
      
      switch (direction) {
        case 'up':
          scrollOptions.top = -(amount || 300);
          break;
        case 'down':
          scrollOptions.top = amount || 300;
          break;
        case 'left':
          scrollOptions.left = -(amount || 300);
          break;
        case 'right':
          scrollOptions.left = amount || 300;
          break;
        case 'top':
          scrollOptions.top = 0;
          scrollOptions.left = 0;
          break;
        case 'bottom':
          if (element === window) {
            scrollOptions.top = document.documentElement.scrollHeight;
          } else {
            scrollOptions.top = (element as Element).scrollHeight;
          }
          break;
      }
      
      if (element === window) {
        window.scrollBy(scrollOptions);
      } else {
        (element as Element).scrollBy(scrollOptions);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to scroll: ${error.message}`);
    }
  }

  /**
   * Check if an element exists
   */
  elementExists(selector: string): boolean {
    return this.querySelector(selector) !== null;
  }

  /**
   * Get element attributes
   */
  async getElementAttributes(selector: string): Promise<Record<string, string>> {
    try {
      const element = await this.findElement(selector);
      const attributes: Record<string, string> = {};
      
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attributes[attr.name] = attr.value;
      }
      
      return attributes;
    } catch (error) {
      throw new Error(`Failed to get element attributes: ${error.message}`);
    }
  }

  /**
   * Get element position
   */
  async getElementPosition(selector: string): Promise<ElementPosition> {
    try {
      const element = await this.findElement(selector);
      const rect = element.getBoundingClientRect();
      
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    } catch (error) {
      throw new Error(`Failed to get element position: ${error.message}`);
    }
  }

  /**
   * Highlight an element (for debugging)
   */
  async highlightElement(
    selector: string, 
    duration: number = 2000, 
    style: Partial<CSSStyleDeclaration> = {}
  ): Promise<boolean> {
    try {
      const element = await this.findElement(selector);
      
      // Store original styles
      const originalStyles: Record<string, string> = {};
      const defaultStyle = {
        border: '2px solid red',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        boxShadow: '0 0 10px rgba(255, 0, 0, 0.5)'
      };
      
      const highlightStyle = { ...defaultStyle, ...style };
      
      Object.keys(highlightStyle).forEach(key => {
        originalStyles[key] = (element.style as any)[key];
        (element.style as any)[key] = highlightStyle[key as keyof CSSStyleDeclaration];
      });
      
      this.highlightedElements.add(element);
      
      // Remove highlight after duration
      setTimeout(() => {
        this.removeHighlight(selector);
      }, duration);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to highlight element: ${error.message}`);
    }
  }

  /**
   * Remove highlight from an element
   */
  async removeHighlight(selector: string): Promise<boolean> {
    try {
      const element = this.querySelector(selector);
      if (element && this.highlightedElements.has(element)) {
        // Restore original styles would require storing them
        // For now, just remove the highlight styles
        element.style.border = '';
        element.style.backgroundColor = '';
        element.style.boxShadow = '';
        
        this.highlightedElements.delete(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to remove highlight: ${error.message}`);
    }
  }

  /**
   * Generate a unique selector for an element
   */
  generateSelector(element: Element): string {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Try unique class combination
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const selector = '.' + classes.join('.');
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }
    
    // Generate path-based selector
    const path = [];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = current.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += '.' + classes[0];
        }
      }
      
      // Add nth-child if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = parent;
    }
    
    return path.join(' > ');
  }

  /**
   * Check if an element is visible
   */
  isElementVisible(element: Element): boolean {
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
   * Check if an element is clickable
   */
  isElementClickable(element: Element): boolean {
    if (!this.isElementVisible(element)) {
      return false;
    }
    
    // Check if element is disabled
    if ((element as HTMLInputElement).disabled) {
      return false;
    }
    
    // Check if element is obscured by another element
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    return elementAtPoint === element || element.contains(elementAtPoint);
  }

  /**
   * Scroll element into view
   */
  scrollIntoView(element: Element, options: ScrollOptions = {}): void {
    const scrollOptions: ScrollIntoViewOptions = {
      behavior: options.behavior || 'smooth',
      block: options.block || 'center',
      inline: options.inline || 'nearest'
    };
    
    element.scrollIntoView(scrollOptions);
  }

  /**
   * Wait for a specified duration
   */
  wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Remove all highlights
    this.highlightedElements.forEach(element => {
      element.style.border = '';
      element.style.backgroundColor = '';
      element.style.boxShadow = '';
    });
    this.highlightedElements.clear();
  }
} * DOM manipulation utilities for browser automation
 * Provides robust element detection and interaction methods
 */

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClickOptions {
  button?: number;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  force?: boolean;
}

export interface ScrollOptions {
  behavior?: 'auto' | 'smooth';
  block?: 'start' | 'center' | 'end' | 'nearest';
  inline?: 'start' | 'center' | 'end' | 'nearest';
}

export interface HighlightOptions {
  duration?: number;
  style?: Partial<CSSStyleDeclaration>;
}

export class DomUtils {
  private highlightedElements: Set<Element> = new Set();

  /**
   * Find an element using various selector strategies
   */
  findElement(selector: string, timeout: number = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        try {
          const element = this.querySelector(selector);
          if (element) {
            resolve(element);
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Element not found: ${selector}`));
            return;
          }
          
          setTimeout(checkElement, 100);
        } catch (error) {
          reject(new Error(`Invalid selector: ${selector}`));
        }
      };
      
      checkElement();
    });
  }

  /**
   * Query for an element using multiple selector strategies
   */
  querySelector(selector: string): Element | null {
    // Try CSS selector first
    let element = document.querySelector(selector);
    if (element) return element;
    
    // Try XPath
    try {
      const xpathResult = document.evaluate(
        selector,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      element = xpathResult.singleNodeValue as Element;
      if (element) return element;
    } catch (e) {
      // Not a valid XPath, continue
    }
    
    // Try text-based selector
    if (selector.startsWith('text=')) {
      const text = selector.substring(5);
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent?.includes(text)) {
          return node.parentElement;
        }
      }
    }
    
    // Try attribute-based selector
    if (selector.includes('=')) {
      const [attr, value] = selector.split('=');
      element = document.querySelector(`[${attr}="${value}"]`);
      if (element) return element;
    }
    
    return null;
  }

  /**
   * Click an element
   */
  async clickElement(selector: string, options: ClickOptions = {}): Promise<boolean> {
    try {
      const element = await this.findElement(selector);
      
      // Check if element is visible and clickable
      if (!this.isElementVisible(element) && !options.force) {
        throw new Error(`Element is not visible: ${selector}`);
      }
      
      // Scroll element into view
      this.scrollIntoView(element);
      
      // Wait a bit for scroll to complete
      await this.wait(100);
      
      // Create and dispatch click event
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        button: options.button || 0,
        ctrlKey: options.ctrlKey || false,
        shiftKey: options.shiftKey || false,
        altKey: options.altKey || false,
        metaKey: options.metaKey || false
      });
      
      element.dispatchEvent(clickEvent);
      
      // Also try direct click for better compatibility
      if (typeof (element as any).click === 'function') {
        (element as any).click();
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to click element: ${error.message}`);
    }
  }

  /**
   * Extract text from an element
   */
  async extractText(selector: string, attribute?: string): Promise<string> {
    try {
      const element = await this.findElement(selector);
      
      if (attribute) {
        return element.getAttribute(attribute) || '';
      }
      
      return element.textContent || '';
    } catch (error) {
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  /**
   * Wait for an element to appear
   */
  async waitForElement(
    selector: string, 
    timeout: number = 10000, 
    strategy: 'visible' | 'present' | 'clickable' = 'visible'
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const element = this.querySelector(selector);
        if (!element && strategy !== 'present') {
          await this.wait(100);
          continue;
        }
        
        if (strategy === 'present' && element) {
          return true;
        }
        
        if (strategy === 'visible' && element && this.isElementVisible(element)) {
          return true;
        }
        
        if (strategy === 'clickable' && element && this.isElementClickable(element)) {
          return true;
        }
        
        await this.wait(100);
      } catch (error) {
        await this.wait(100);
      }
    }
    
    throw new Error(`Element did not become ${strategy} within timeout: ${selector}`);
  }

  /**
   * Scroll the page or an element
   */
  async scroll(
    direction: 'up' | 'down' | 'left' | 'right' | 'top' | 'bottom',
    amount?: number,
    selector?: string
  ): Promise<boolean> {
    try {
      let element: Element | Window = window;
      
      if (selector) {
        element = await this.findElement(selector) || window;
      }
      
      let scrollOptions: ScrollToOptions = { behavior: 'smooth' };
      
      switch (direction) {
        case 'up':
          scrollOptions.top = -(amount || 300);
          break;
        case 'down':
          scrollOptions.top = amount || 300;
          break;
        case 'left':
          scrollOptions.left = -(amount || 300);
          break;
        case 'right':
          scrollOptions.left = amount || 300;
          break;
        case 'top':
          scrollOptions.top = 0;
          scrollOptions.left = 0;
          break;
        case 'bottom':
          if (element === window) {
            scrollOptions.top = document.documentElement.scrollHeight;
          } else {
            scrollOptions.top = (element as Element).scrollHeight;
          }
          break;
      }
      
      if (element === window) {
        window.scrollBy(scrollOptions);
      } else {
        (element as Element).scrollBy(scrollOptions);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to scroll: ${error.message}`);
    }
  }

  /**
   * Check if an element exists
   */
  elementExists(selector: string): boolean {
    return this.querySelector(selector) !== null;
  }

  /**
   * Get element attributes
   */
  async getElementAttributes(selector: string): Promise<Record<string, string>> {
    try {
      const element = await this.findElement(selector);
      const attributes: Record<string, string> = {};
      
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attributes[attr.name] = attr.value;
      }
      
      return attributes;
    } catch (error) {
      throw new Error(`Failed to get element attributes: ${error.message}`);
    }
  }

  /**
   * Get element position
   */
  async getElementPosition(selector: string): Promise<ElementPosition> {
    try {
      const element = await this.findElement(selector);
      const rect = element.getBoundingClientRect();
      
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    } catch (error) {
      throw new Error(`Failed to get element position: ${error.message}`);
    }
  }

  /**
   * Highlight an element (for debugging)
   */
  async highlightElement(
    selector: string, 
    duration: number = 2000, 
    style: Partial<CSSStyleDeclaration> = {}
  ): Promise<boolean> {
    try {
      const element = await this.findElement(selector);
      
      // Store original styles
      const originalStyles: Record<string, string> = {};
      const defaultStyle = {
        border: '2px solid red',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        boxShadow: '0 0 10px rgba(255, 0, 0, 0.5)'
      };
      
      const highlightStyle = { ...defaultStyle, ...style };
      
      Object.keys(highlightStyle).forEach(key => {
        originalStyles[key] = (element.style as any)[key];
        (element.style as any)[key] = highlightStyle[key as keyof CSSStyleDeclaration];
      });
      
      this.highlightedElements.add(element);
      
      // Remove highlight after duration
      setTimeout(() => {
        this.removeHighlight(selector);
      }, duration);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to highlight element: ${error.message}`);
    }
  }

  /**
   * Remove highlight from an element
   */
  async removeHighlight(selector: string): Promise<boolean> {
    try {
      const element = this.querySelector(selector);
      if (element && this.highlightedElements.has(element)) {
        // Restore original styles would require storing them
        // For now, just remove the highlight styles
        element.style.border = '';
        element.style.backgroundColor = '';
        element.style.boxShadow = '';
        
        this.highlightedElements.delete(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to remove highlight: ${error.message}`);
    }
  }

  /**
   * Generate a unique selector for an element
   */
  generateSelector(element: Element): string {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Try unique class combination
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const selector = '.' + classes.join('.');
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }
    }
    
    // Generate path-based selector
    const path = [];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = current.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += '.' + classes[0];
        }
      }
      
      // Add nth-child if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = parent;
    }
    
    return path.join(' > ');
  }

  /**
   * Check if an element is visible
   */
  isElementVisible(element: Element): boolean {
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
   * Check if an element is clickable
   */
  isElementClickable(element: Element): boolean {
    if (!this.isElementVisible(element)) {
      return false;
    }
    
    // Check if element is disabled
    if ((element as HTMLInputElement).disabled) {
      return false;
    }
    
    // Check if element is obscured by another element
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    return elementAtPoint === element || element.contains(elementAtPoint);
  }

  /**
   * Scroll element into view
   */
  scrollIntoView(element: Element, options: ScrollOptions = {}): void {
    const scrollOptions: ScrollIntoViewOptions = {
      behavior: options.behavior || 'smooth',
      block: options.block || 'center',
      inline: options.inline || 'nearest'
    };
    
    element.scrollIntoView(scrollOptions);
  }

  /**
   * Wait for a specified duration
   */
  wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Remove all highlights
    this.highlightedElements.forEach(element => {
      element.style.border = '';
      element.style.backgroundColor = '';
      element.style.boxShadow = '';
    });
    this.highlightedElements.clear();
  }
}
