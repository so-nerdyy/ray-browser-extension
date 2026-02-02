/**
 * Form handling utilities for browser automation
 * Provides robust form filling and input interaction methods
 */

import { DomUtils } from './dom-utils';

export interface FormFillOptions {
  clearFirst?: boolean;
  triggerEvents?: boolean;
  delay?: number;
  validate?: boolean;
}

export interface TypeOptions {
  clearFirst?: boolean;
  delay?: number;
  triggerEvents?: boolean;
  humanLike?: boolean;
}

export interface SelectOptions {
  value?: string;
  text?: string;
  index?: number;
  multiple?: boolean;
}

export interface CheckboxOptions {
  check?: boolean;
  toggle?: boolean;
}

export interface RadioOptions {
  value?: string;
  index?: number;
}

export interface FileInputOptions {
  files?: string[];
  clear?: boolean;
}

export class FormHandler {
  private domUtils: DomUtils;

  constructor() {
    this.domUtils = new DomUtils();
  }

  /**
   * Fill a form field with a value
   */
  async fillFormField(
    selector: string, 
    value: string, 
    options: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (!this.isFormElement(element)) {
        throw new Error(`Element is not a form element: ${selector}`);
      }
      
      // Handle different input types
      switch (element.type) {
        case 'text':
        case 'password':
        case 'email':
        case 'search':
        case 'tel':
        case 'url':
        case 'number':
        case 'date':
        case 'time':
        case 'datetime-local':
        case 'month':
        case 'week':
          return await this.fillTextInput(element, value, options);
          
        case 'textarea':
          return await this.fillTextArea(element as HTMLTextAreaElement, value, options);
          
        case 'select-one':
          return await this.selectOption(element as HTMLSelectElement, { value }, options);
          
        case 'select-multiple':
          return await this.selectOption(element as HTMLSelectElement, { value, multiple: true }, options);
          
        case 'checkbox':
          return await this.setCheckbox(element as HTMLInputElement, { check: value === 'true' || value === '1' }, options);
          
        case 'radio':
          return await this.setRadioButton(element, { value }, options);
          
        case 'file':
          // File inputs require special handling and can't be filled programmatically for security
          throw new Error(`File inputs cannot be filled programmatically: ${selector}`);
          
        default:
          throw new Error(`Unsupported input type: ${element.type}`);
      }
    } catch (error) {
      throw new Error(`Failed to fill form field: ${error.message}`);
    }
  }

  /**
   * Type text into an input field with human-like behavior
   */
  async typeText(
    selector: string, 
    text: string, 
    options: TypeOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (!this.isTextInput(element) && element.tagName !== 'TEXTAREA') {
        throw new Error(`Element is not a text input: ${selector}`);
      }
      
      // Clear first if requested
      if (options.clearFirst !== false) {
        element.value = '';
      }
      
      // Focus the element
      element.focus();
      
      // Type each character with optional delay
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (options.humanLike) {
          // Simulate human typing with variable delays
          const delay = options.delay || Math.random() * 100 + 50;
          await this.domUtils.wait(delay);
        }
        
        // Dispatch key events for each character
        this.dispatchKeyEvent(element, 'keydown', char);
        element.value += char;
        this.dispatchKeyEvent(element, 'input', char);
        this.dispatchKeyEvent(element, 'keyup', char);
      }
      
      // Trigger change event if requested
      if (options.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      // Blur the element to complete the interaction
      element.blur();
      
      return true;
    } catch (error) {
      throw new Error(`Failed to type text: ${error.message}`);
    }
  }

  /**
   * Select an option from a dropdown
   */
  async selectOption(
    selector: string, 
    options: SelectOptions, 
    formOptions: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLSelectElement;
      
      if (element.tagName !== 'SELECT') {
        throw new Error(`Element is not a select element: ${selector}`);
      }
      
      // Find the option to select
      let option: HTMLOptionElement | null = null;
      
      if (options.value !== undefined) {
        option = element.querySelector(`option[value="${options.value}"]`);
      } else if (options.text !== undefined) {
        const options_ = Array.from(element.options);
        option = options_.find(opt => opt.textContent?.trim() === options.text) || null;
      } else if (options.index !== undefined) {
        option = element.options[options.index] || null;
      }
      
      if (!option) {
        throw new Error(`Option not found: ${JSON.stringify(options)}`);
      }
      
      // Select the option
      option.selected = true;
      
      // For multi-select, don't deselect other options unless explicitly requested
      if (!options.multiple) {
        Array.from(element.options).forEach(opt => {
          if (opt !== option) {
            opt.selected = false;
          }
        });
      }
      
      // Trigger events if requested
      if (formOptions.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to select option: ${error.message}`);
    }
  }

  /**
   * Set checkbox state
   */
  async setCheckbox(
    selector: string, 
    options: CheckboxOptions, 
    formOptions: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (element.type !== 'checkbox') {
        throw new Error(`Element is not a checkbox: ${selector}`);
      }
      
      // Handle toggle option
      if (options.toggle) {
        element.checked = !element.checked;
      } else if (options.check !== undefined) {
        element.checked = options.check;
      }
      
      // Trigger events if requested
      if (formOptions.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to set checkbox: ${error.message}`);
    }
  }

  /**
   * Set radio button state
   */
  async setRadioButton(
    selector: string, 
    options: RadioOptions, 
    formOptions: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      let element: HTMLInputElement;
      
      if (options.value !== undefined) {
        // Find radio button by value within the same name group
        const name = (await this.domUtils.findElement(selector) as HTMLInputElement).name;
        const radioButtons = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        const radioButton = Array.from(radioButtons).find(rb => rb.value === options.value);
        
        if (!radioButton) {
          throw new Error(`Radio button with value "${options.value}" not found`);
        }
        
        element = radioButton as HTMLInputElement;
      } else if (options.index !== undefined) {
        // Find radio button by index within the same name group
        const name = (await this.domUtils.findElement(selector) as HTMLInputElement).name;
        const radioButtons = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        
        if (options.index >= radioButtons.length) {
          throw new Error(`Radio button index ${options.index} out of range`);
        }
        
        element = radioButtons[options.index] as HTMLInputElement;
      } else {
        // Use the provided selector directly
        element = await this.domUtils.findElement(selector) as HTMLInputElement;
      }
      
      if (element.type !== 'radio') {
        throw new Error(`Element is not a radio button: ${selector}`);
      }
      
      // Check the radio button
      element.checked = true;
      
      // Trigger events if requested
      if (formOptions.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to set radio button: ${error.message}`);
    }
  }

  /**
   * Submit a form
   */
  async submitForm(selector: string): Promise<boolean> {
    try {
      let formElement: HTMLFormElement;
      
      const element = await this.domUtils.findElement(selector);
      
      if (element.tagName === 'FORM') {
        formElement = element as HTMLFormElement;
      } else {
        // Find the closest form ancestor
        formElement = element.closest('form') as HTMLFormElement;
        
        if (!formElement) {
          throw new Error(`No form found for element: ${selector}`);
        }
      }
      
      // Trigger form validation
      if (!formElement.checkValidity()) {
        formElement.reportValidity();
        throw new Error(`Form validation failed`);
      }
      
      // Submit the form
      formElement.submit();
      
      return true;
    } catch (error) {
      throw new Error(`Failed to submit form: ${error.message}`);
    }
  }

  /**
   * Get form data
   */
  async getFormData(selector: string): Promise<Record<string, any>> {
    try {
      const formElement = await this.domUtils.findElement(selector) as HTMLFormElement;
      
      if (formElement.tagName !== 'FORM') {
        throw new Error(`Element is not a form: ${selector}`);
      }
      
      const formData = new FormData(formElement);
      const data: Record<string, any> = {};
      
      // Convert FormData to plain object
      formData.forEach((value, key) => {
        if (data[key]) {
          // Handle multiple values with the same key
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      });
      
      return data;
    } catch (error) {
      throw new Error(`Failed to get form data: ${error.message}`);
    }
  }

  /**
   * Clear a form field
   */
  async clearFormField(selector: string): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (!this.isFormElement(element)) {
        throw new Error(`Element is not a form element: ${selector}`);
      }
      
      switch (element.type) {
        case 'text':
        case 'password':
        case 'email':
        case 'search':
        case 'tel':
        case 'url':
        case 'number':
        case 'date':
        case 'time':
        case 'datetime-local':
        case 'month':
        case 'week':
          element.value = '';
          break;
          
        case 'textarea':
          (element as HTMLTextAreaElement).value = '';
          break;
          
        case 'select-one':
        case 'select-multiple':
          Array.from((element as HTMLSelectElement).options).forEach(option => {
            option.selected = false;
          });
          break;
          
        case 'checkbox':
        case 'radio':
          element.checked = false;
          break;
          
        case 'file':
          // File inputs can't be cleared programmatically
          throw new Error(`File inputs cannot be cleared programmatically`);
          
        default:
          throw new Error(`Unsupported input type: ${element.type}`);
      }
      
      // Trigger events
      this.triggerFormEvents(element);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to clear form field: ${error.message}`);
    }
  }

  /**
   * Fill a text input field
   */
  private async fillTextInput(
    element: HTMLInputElement, 
    value: string, 
    options: FormFillOptions
  ): Promise<boolean> {
    if (options.clearFirst) {
      element.value = '';
    }
    
    element.value = value;
    
    if (options.triggerEvents !== false) {
      this.triggerFormEvents(element);
    }
    
    return true;
  }

  /**
   * Fill a textarea
   */
  private async fillTextArea(
    element: HTMLTextAreaElement, 
    value: string, 
    options: FormFillOptions
  ): Promise<boolean> {
    if (options.clearFirst) {
      element.value = '';
    }
    
    element.value = value;
    
    if (options.triggerEvents !== false) {
      this.triggerFormEvents(element);
    }
    
    return true;
  }

  /**
   * Check if an element is a form element
   */
  private isFormElement(element: Element): boolean {
    const formTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
    return formTags.includes(element.tagName);
  }

  /**
   * Check if an element is a text input
   */
  private isTextInput(element: Element): boolean {
    if (element.tagName !== 'INPUT') {
      return false;
    }
    
    const textTypes = [
      'text', 'password', 'email', 'search', 'tel', 'url', 
      'number', 'date', 'time', 'datetime-local', 'month', 'week'
    ];
    
    return textTypes.includes((element as HTMLInputElement).type);
  }

  /**
   * Trigger form events on an element
   */
  private triggerFormEvents(element: HTMLElement): void {
    const events = ['input', 'change', 'blur'];
    
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Dispatch keyboard events
   */
  private dispatchKeyEvent(element: HTMLElement, type: string, key: string): void {
    const event = new KeyboardEvent(type, {
      key,
      code: key,
      bubbles: true,
      cancelable: true
    });
    
    element.dispatchEvent(event);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for FormHandler
  }
} * Form handling utilities for browser automation
 * Provides robust form filling and input interaction methods
 */

import { DomUtils } from './dom-utils';

export interface FormFillOptions {
  clearFirst?: boolean;
  triggerEvents?: boolean;
  delay?: number;
  validate?: boolean;
}

export interface TypeOptions {
  clearFirst?: boolean;
  delay?: number;
  triggerEvents?: boolean;
  humanLike?: boolean;
}

export interface SelectOptions {
  value?: string;
  text?: string;
  index?: number;
  multiple?: boolean;
}

export interface CheckboxOptions {
  check?: boolean;
  toggle?: boolean;
}

export interface RadioOptions {
  value?: string;
  index?: number;
}

export interface FileInputOptions {
  files?: string[];
  clear?: boolean;
}

export class FormHandler {
  private domUtils: DomUtils;

  constructor() {
    this.domUtils = new DomUtils();
  }

  /**
   * Fill a form field with a value
   */
  async fillFormField(
    selector: string, 
    value: string, 
    options: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (!this.isFormElement(element)) {
        throw new Error(`Element is not a form element: ${selector}`);
      }
      
      // Handle different input types
      switch (element.type) {
        case 'text':
        case 'password':
        case 'email':
        case 'search':
        case 'tel':
        case 'url':
        case 'number':
        case 'date':
        case 'time':
        case 'datetime-local':
        case 'month':
        case 'week':
          return await this.fillTextInput(element, value, options);
          
        case 'textarea':
          return await this.fillTextArea(element as HTMLTextAreaElement, value, options);
          
        case 'select-one':
          return await this.selectOption(element as HTMLSelectElement, { value }, options);
          
        case 'select-multiple':
          return await this.selectOption(element as HTMLSelectElement, { value, multiple: true }, options);
          
        case 'checkbox':
          return await this.setCheckbox(element as HTMLInputElement, { check: value === 'true' || value === '1' }, options);
          
        case 'radio':
          return await this.setRadioButton(element, { value }, options);
          
        case 'file':
          // File inputs require special handling and can't be filled programmatically for security
          throw new Error(`File inputs cannot be filled programmatically: ${selector}`);
          
        default:
          throw new Error(`Unsupported input type: ${element.type}`);
      }
    } catch (error) {
      throw new Error(`Failed to fill form field: ${error.message}`);
    }
  }

  /**
   * Type text into an input field with human-like behavior
   */
  async typeText(
    selector: string, 
    text: string, 
    options: TypeOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (!this.isTextInput(element) && element.tagName !== 'TEXTAREA') {
        throw new Error(`Element is not a text input: ${selector}`);
      }
      
      // Clear first if requested
      if (options.clearFirst !== false) {
        element.value = '';
      }
      
      // Focus the element
      element.focus();
      
      // Type each character with optional delay
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (options.humanLike) {
          // Simulate human typing with variable delays
          const delay = options.delay || Math.random() * 100 + 50;
          await this.domUtils.wait(delay);
        }
        
        // Dispatch key events for each character
        this.dispatchKeyEvent(element, 'keydown', char);
        element.value += char;
        this.dispatchKeyEvent(element, 'input', char);
        this.dispatchKeyEvent(element, 'keyup', char);
      }
      
      // Trigger change event if requested
      if (options.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      // Blur the element to complete the interaction
      element.blur();
      
      return true;
    } catch (error) {
      throw new Error(`Failed to type text: ${error.message}`);
    }
  }

  /**
   * Select an option from a dropdown
   */
  async selectOption(
    selector: string, 
    options: SelectOptions, 
    formOptions: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLSelectElement;
      
      if (element.tagName !== 'SELECT') {
        throw new Error(`Element is not a select element: ${selector}`);
      }
      
      // Find the option to select
      let option: HTMLOptionElement | null = null;
      
      if (options.value !== undefined) {
        option = element.querySelector(`option[value="${options.value}"]`);
      } else if (options.text !== undefined) {
        const options_ = Array.from(element.options);
        option = options_.find(opt => opt.textContent?.trim() === options.text) || null;
      } else if (options.index !== undefined) {
        option = element.options[options.index] || null;
      }
      
      if (!option) {
        throw new Error(`Option not found: ${JSON.stringify(options)}`);
      }
      
      // Select the option
      option.selected = true;
      
      // For multi-select, don't deselect other options unless explicitly requested
      if (!options.multiple) {
        Array.from(element.options).forEach(opt => {
          if (opt !== option) {
            opt.selected = false;
          }
        });
      }
      
      // Trigger events if requested
      if (formOptions.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to select option: ${error.message}`);
    }
  }

  /**
   * Set checkbox state
   */
  async setCheckbox(
    selector: string, 
    options: CheckboxOptions, 
    formOptions: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (element.type !== 'checkbox') {
        throw new Error(`Element is not a checkbox: ${selector}`);
      }
      
      // Handle toggle option
      if (options.toggle) {
        element.checked = !element.checked;
      } else if (options.check !== undefined) {
        element.checked = options.check;
      }
      
      // Trigger events if requested
      if (formOptions.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to set checkbox: ${error.message}`);
    }
  }

  /**
   * Set radio button state
   */
  async setRadioButton(
    selector: string, 
    options: RadioOptions, 
    formOptions: FormFillOptions = {}
  ): Promise<boolean> {
    try {
      let element: HTMLInputElement;
      
      if (options.value !== undefined) {
        // Find radio button by value within the same name group
        const name = (await this.domUtils.findElement(selector) as HTMLInputElement).name;
        const radioButtons = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        const radioButton = Array.from(radioButtons).find(rb => rb.value === options.value);
        
        if (!radioButton) {
          throw new Error(`Radio button with value "${options.value}" not found`);
        }
        
        element = radioButton as HTMLInputElement;
      } else if (options.index !== undefined) {
        // Find radio button by index within the same name group
        const name = (await this.domUtils.findElement(selector) as HTMLInputElement).name;
        const radioButtons = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        
        if (options.index >= radioButtons.length) {
          throw new Error(`Radio button index ${options.index} out of range`);
        }
        
        element = radioButtons[options.index] as HTMLInputElement;
      } else {
        // Use the provided selector directly
        element = await this.domUtils.findElement(selector) as HTMLInputElement;
      }
      
      if (element.type !== 'radio') {
        throw new Error(`Element is not a radio button: ${selector}`);
      }
      
      // Check the radio button
      element.checked = true;
      
      // Trigger events if requested
      if (formOptions.triggerEvents !== false) {
        this.triggerFormEvents(element);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to set radio button: ${error.message}`);
    }
  }

  /**
   * Submit a form
   */
  async submitForm(selector: string): Promise<boolean> {
    try {
      let formElement: HTMLFormElement;
      
      const element = await this.domUtils.findElement(selector);
      
      if (element.tagName === 'FORM') {
        formElement = element as HTMLFormElement;
      } else {
        // Find the closest form ancestor
        formElement = element.closest('form') as HTMLFormElement;
        
        if (!formElement) {
          throw new Error(`No form found for element: ${selector}`);
        }
      }
      
      // Trigger form validation
      if (!formElement.checkValidity()) {
        formElement.reportValidity();
        throw new Error(`Form validation failed`);
      }
      
      // Submit the form
      formElement.submit();
      
      return true;
    } catch (error) {
      throw new Error(`Failed to submit form: ${error.message}`);
    }
  }

  /**
   * Get form data
   */
  async getFormData(selector: string): Promise<Record<string, any>> {
    try {
      const formElement = await this.domUtils.findElement(selector) as HTMLFormElement;
      
      if (formElement.tagName !== 'FORM') {
        throw new Error(`Element is not a form: ${selector}`);
      }
      
      const formData = new FormData(formElement);
      const data: Record<string, any> = {};
      
      // Convert FormData to plain object
      formData.forEach((value, key) => {
        if (data[key]) {
          // Handle multiple values with the same key
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      });
      
      return data;
    } catch (error) {
      throw new Error(`Failed to get form data: ${error.message}`);
    }
  }

  /**
   * Clear a form field
   */
  async clearFormField(selector: string): Promise<boolean> {
    try {
      const element = await this.domUtils.findElement(selector) as HTMLInputElement;
      
      if (!this.isFormElement(element)) {
        throw new Error(`Element is not a form element: ${selector}`);
      }
      
      switch (element.type) {
        case 'text':
        case 'password':
        case 'email':
        case 'search':
        case 'tel':
        case 'url':
        case 'number':
        case 'date':
        case 'time':
        case 'datetime-local':
        case 'month':
        case 'week':
          element.value = '';
          break;
          
        case 'textarea':
          (element as HTMLTextAreaElement).value = '';
          break;
          
        case 'select-one':
        case 'select-multiple':
          Array.from((element as HTMLSelectElement).options).forEach(option => {
            option.selected = false;
          });
          break;
          
        case 'checkbox':
        case 'radio':
          element.checked = false;
          break;
          
        case 'file':
          // File inputs can't be cleared programmatically
          throw new Error(`File inputs cannot be cleared programmatically`);
          
        default:
          throw new Error(`Unsupported input type: ${element.type}`);
      }
      
      // Trigger events
      this.triggerFormEvents(element);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to clear form field: ${error.message}`);
    }
  }

  /**
   * Fill a text input field
   */
  private async fillTextInput(
    element: HTMLInputElement, 
    value: string, 
    options: FormFillOptions
  ): Promise<boolean> {
    if (options.clearFirst) {
      element.value = '';
    }
    
    element.value = value;
    
    if (options.triggerEvents !== false) {
      this.triggerFormEvents(element);
    }
    
    return true;
  }

  /**
   * Fill a textarea
   */
  private async fillTextArea(
    element: HTMLTextAreaElement, 
    value: string, 
    options: FormFillOptions
  ): Promise<boolean> {
    if (options.clearFirst) {
      element.value = '';
    }
    
    element.value = value;
    
    if (options.triggerEvents !== false) {
      this.triggerFormEvents(element);
    }
    
    return true;
  }

  /**
   * Check if an element is a form element
   */
  private isFormElement(element: Element): boolean {
    const formTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'];
    return formTags.includes(element.tagName);
  }

  /**
   * Check if an element is a text input
   */
  private isTextInput(element: Element): boolean {
    if (element.tagName !== 'INPUT') {
      return false;
    }
    
    const textTypes = [
      'text', 'password', 'email', 'search', 'tel', 'url', 
      'number', 'date', 'time', 'datetime-local', 'month', 'week'
    ];
    
    return textTypes.includes((element as HTMLInputElement).type);
  }

  /**
   * Trigger form events on an element
   */
  private triggerFormEvents(element: HTMLElement): void {
    const events = ['input', 'change', 'blur'];
    
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Dispatch keyboard events
   */
  private dispatchKeyEvent(element: HTMLElement, type: string, key: string): void {
    const event = new KeyboardEvent(type, {
      key,
      code: key,
      bubbles: true,
      cancelable: true
    });
    
    element.dispatchEvent(event);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for FormHandler
  }
}
