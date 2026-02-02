/**
 * Form automation utilities for browser automation
 * Provides high-level form interaction methods
 */

import { chromeApi } from './chrome-api-wrappers';
import { domSelectors } from './dom-selectors';

export interface FormField {
  selector: string;
  value: string;
  type?: string;
  options?: any;
}

export interface FormOptions {
  submit?: boolean;
  validate?: boolean;
  waitForNavigation?: boolean;
  navigationTimeout?: number;
}

export interface ValidationOptions {
  required?: string[];
  pattern?: Record<string, RegExp>;
  custom?: Record<string, (value: string) => boolean>;
}

export class FormAutomation {
  /**
   * Fill a form with multiple fields
   */
  async fillForm(
    formSelector: string, 
    fields: FormField[], 
    options: FormOptions = {},
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const fillFormFunction = (formSelector: string, fields: FormField[], opts: FormOptions) => {
      return new Promise(async (resolve, reject) => {
        try {
          // Find the form
          const form = document.querySelector(formSelector);
          if (!form) {
            reject(new Error(`Form not found: ${formSelector}`));
            return;
          }
          
          // Fill each field
          for (const field of fields) {
            try {
              const element = form.querySelector(field.selector) as HTMLInputElement;
              if (!element) {
                console.warn(`Field not found: ${field.selector}`);
                continue;
              }
              
              // Handle different field types
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
                  await this.fillTextInput(element, field.value, field.options);
                  break;
                  
                case 'textarea':
                  await this.fillTextArea(element as HTMLTextAreaElement, field.value, field.options);
                  break;
                  
                case 'select-one':
                  await this.selectOption(element as HTMLSelectElement, field.value, field.options);
                  break;
                  
                case 'select-multiple':
                  await this.selectMultipleOptions(element as HTMLSelectElement, field.value, field.options);
                  break;
                  
                case 'checkbox':
                  await this.setCheckbox(element as HTMLInputElement, field.value, field.options);
                  break;
                  
                case 'radio':
                  await this.setRadioButton(element as HTMLInputElement, field.value, field.options);
                  break;
                  
                case 'file':
                  // File inputs require special handling
                  console.warn(`File inputs cannot be filled programmatically: ${field.selector}`);
                  break;
                  
                default:
                  console.warn(`Unsupported field type: ${element.type}`);
              }
            } catch (error) {
              console.error(`Failed to fill field ${field.selector}:`, error);
            }
          }
          
          // Validate form if requested
          if (opts.validate) {
            const isValid = this.validateForm(form);
            if (!isValid) {
              reject(new Error('Form validation failed'));
              return;
            }
          }
          
          // Submit form if requested
          if (opts.submit) {
            await this.submitForm(form);
          }
          
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, fillFormFunction, [formSelector, fields, options]);
    } catch (error) {
      throw new Error(`Failed to fill form: ${error.message}`);
    }
  }

  /**
   * Get all form fields from a form
   */
  async getFormFields(formSelector: string, tabId?: number): Promise<FormField[]> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const getFieldsFunction = (formSelector: string) => {
      const form = document.querySelector(formSelector);
      if (!form) {
        throw new Error(`Form not found: ${formSelector}`);
      }
      
      const fields: FormField[] = [];
      const inputs = form.querySelectorAll('input, select, textarea');
      
      inputs.forEach(input => {
        const element = input as HTMLInputElement;
        let value = '';
        
        // Get value based on input type
        switch (element.type) {
          case 'checkbox':
          case 'radio':
            value = element.checked ? 'true' : 'false';
            break;
          case 'select-one':
          case 'select-multiple':
            const select = element as HTMLSelectElement;
            value = Array.from(select.selectedOptions).map(opt => opt.value).join(',');
            break;
          case 'file':
            value = ''; // File inputs don't expose file paths for security
            break;
          default:
            value = element.value || '';
        }
        
        fields.push({
          selector: this.generateSelector(element),
          value,
          type: element.type
        });
      });
      
      return fields;
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, getFieldsFunction, [formSelector]);
    } catch (error) {
      throw new Error(`Failed to get form fields: ${error.message}`);
    }
  }

  /**
   * Clear a form
   */
  async clearForm(formSelector: string, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const clearFormFunction = (formSelector: string) => {
      const form = document.querySelector(formSelector);
      if (!form) {
        throw new Error(`Form not found: ${formSelector}`);
      }
      
      const inputs = form.querySelectorAll('input, select, textarea');
      
      inputs.forEach(input => {
        const element = input as HTMLInputElement;
        
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
            break;
        }
        
        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
      });
      
      return true;
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, clearFormFunction, [formSelector]);
    } catch (error) {
      throw new Error(`Failed to clear form: ${error.message}`);
    }
  }

  /**
   * Validate a form
   */
  async validateForm(formSelector: string, options: ValidationOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const validateFormFunction = (formSelector: string, opts: ValidationOptions) => {
      const form = document.querySelector(formSelector);
      if (!form) {
        throw new Error(`Form not found: ${formSelector}`);
      }
      
      // Check HTML5 validation
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }
      
      // Check required fields
      if (opts.required) {
        for (const fieldSelector of opts.required) {
          const field = form.querySelector(fieldSelector) as HTMLInputElement;
          if (field && !field.value.trim()) {
            field.focus();
            field.classList.add('validation-error');
            return false;
          }
        }
      }
      
      // Check pattern validation
      if (opts.pattern) {
        for (const [fieldSelector, pattern] of Object.entries(opts.pattern)) {
          const field = form.querySelector(fieldSelector) as HTMLInputElement;
          if (field && field.value && !pattern.test(field.value)) {
            field.focus();
            field.classList.add('validation-error');
            return false;
          }
        }
      }
      
      // Check custom validation
      if (opts.custom) {
        for (const [fieldSelector, validator] of Object.entries(opts.custom)) {
          const field = form.querySelector(fieldSelector) as HTMLInputElement;
          if (field && !validator(field.value)) {
            field.focus();
            field.classList.add('validation-error');
            return false;
          }
        }
      }
      
      // Remove validation error classes
      form.querySelectorAll('.validation-error').forEach(element => {
        element.classList.remove('validation-error');
      });
      
      return true;
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, validateFormFunction, [formSelector, options]);
    } catch (error) {
      throw new Error(`Failed to validate form: ${error.message}`);
    }
  }

  /**
   * Submit a form
   */
  async submitForm(formSelector: string, options: FormOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const submitFormFunction = (formSelector: string, opts: FormOptions) => {
      return new Promise((resolve, reject) => {
        try {
          let form: HTMLFormElement;
          
          // Find the form
          const element = document.querySelector(formSelector);
          if (element && element.tagName === 'FORM') {
            form = element as HTMLFormElement;
          } else {
            // Find the closest form ancestor
            form = element?.closest('form') as HTMLFormElement;
          }
          
          if (!form) {
            reject(new Error(`Form not found: ${formSelector}`));
            return;
          }
          
          // Validate form if requested
          if (opts.validate && !form.checkValidity()) {
            form.reportValidity();
            reject(new Error('Form validation failed'));
            return;
          }
          
          // Submit the form
          form.submit();
          
          // Wait for navigation if requested
          if (opts.waitForNavigation) {
            const timeout = opts.navigationTimeout || 10000;
            let navigated = false;
            
            const checkNavigation = () => {
              if (navigated) {
                resolve(true);
                return;
              }
              
              if (Date.now() - startTime > timeout) {
                resolve(true); // Resolve anyway, navigation might have failed silently
                return;
              }
              
              setTimeout(checkNavigation, 100);
            };
            
            const startTime = Date.now();
            
            // Listen for navigation events
            const beforeUnloadHandler = () => {
              navigated = true;
            };
            
            window.addEventListener('beforeunload', beforeUnloadHandler);
            
            // Start checking
            setTimeout(checkNavigation, 500);
            
            // Clean up listener
            setTimeout(() => {
              window.removeEventListener('beforeunload', beforeUnloadHandler);
            }, timeout);
          } else {
            resolve(true);
          }
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, submitFormFunction, [formSelector, options]);
    } catch (error) {
      throw new Error(`Failed to submit form: ${error.message}`);
    }
  }

  /**
   * Fill a text input field
   */
  private async fillTextInput(element: HTMLInputElement, value: string, options?: any): Promise<void> {
    if (options?.clearFirst !== false) {
      element.value = '';
    }
    
    element.value = value;
    
    // Trigger events
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Fill a textarea
   */
  private async fillTextArea(element: HTMLTextAreaElement, value: string, options?: any): Promise<void> {
    if (options?.clearFirst !== false) {
      element.value = '';
    }
    
    element.value = value;
    
    // Trigger events
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Select an option from a dropdown
   */
  private async selectOption(element: HTMLSelectElement, value: string, options?: any): Promise<void> {
    // Find the option
    let option: HTMLOptionElement | null = null;
    
    // Try by value first
    option = element.querySelector(`option[value="${value}"]`);
    
    // Try by text if not found
    if (!option) {
      const options_ = Array.from(element.options);
      option = options_.find(opt => opt.textContent?.trim() === value) || null;
    }
    
    if (!option) {
      throw new Error(`Option not found: ${value}`);
    }
    
    // Select the option
    option.selected = true;
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  /**
   * Select multiple options from a dropdown
   */
  private async selectMultipleOptions(element: HTMLSelectElement, values: string, options?: any): Promise<void> {
    const valueArray = values.split(',');
    
    // Deselect all options first
    Array.from(element.options).forEach(opt => {
      opt.selected = false;
    });
    
    // Select the specified options
    valueArray.forEach(value => {
      let option: HTMLOptionElement | null = null;
      
      // Try by value first
      option = element.querySelector(`option[value="${value.trim()}"]`);
      
      // Try by text if not found
      if (!option) {
        const options_ = Array.from(element.options);
        option = options_.find(opt => opt.textContent?.trim() === value.trim()) || null;
      }
      
      if (option) {
        option.selected = true;
      }
    });
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  /**
   * Set checkbox state
   */
  private async setCheckbox(element: HTMLInputElement, value: string, options?: any): Promise<void> {
    const checked = value === 'true' || value === '1' || value === 'checked';
    element.checked = checked;
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  /**
   * Set radio button state
   */
  private async setRadioButton(element: HTMLInputElement, value: string, options?: any): Promise<void> {
    // Find all radio buttons with the same name
    const radioButtons = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
    
    // Find the radio button with the specified value
    const targetRadio = Array.from(radioButtons).find(rb => rb.value === value) as HTMLInputElement;
    
    if (!targetRadio) {
      throw new Error(`Radio button not found: ${value}`);
    }
    
    targetRadio.checked = true;
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    targetRadio.dispatchEvent(changeEvent);
  }

  /**
   * Generate a selector for an element
   */
  private generateSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }
    
    if (element.name) {
      return `[name="${element.name}"]`;
    }
    
    return element.tagName.toLowerCase();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for FormAutomation
  }
}

// Export singleton instance for convenience
export const formAutomation = new FormAutomation(); * Form automation utilities for browser automation
 * Provides high-level form interaction methods
 */

import { chromeApi } from './chrome-api-wrappers';
import { domSelectors } from './dom-selectors';

export interface FormField {
  selector: string;
  value: string;
  type?: string;
  options?: any;
}

export interface FormOptions {
  submit?: boolean;
  validate?: boolean;
  waitForNavigation?: boolean;
  navigationTimeout?: number;
}

export interface ValidationOptions {
  required?: string[];
  pattern?: Record<string, RegExp>;
  custom?: Record<string, (value: string) => boolean>;
}

export class FormAutomation {
  /**
   * Fill a form with multiple fields
   */
  async fillForm(
    formSelector: string, 
    fields: FormField[], 
    options: FormOptions = {},
    tabId?: number
  ): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const fillFormFunction = (formSelector: string, fields: FormField[], opts: FormOptions) => {
      return new Promise(async (resolve, reject) => {
        try {
          // Find the form
          const form = document.querySelector(formSelector);
          if (!form) {
            reject(new Error(`Form not found: ${formSelector}`));
            return;
          }
          
          // Fill each field
          for (const field of fields) {
            try {
              const element = form.querySelector(field.selector) as HTMLInputElement;
              if (!element) {
                console.warn(`Field not found: ${field.selector}`);
                continue;
              }
              
              // Handle different field types
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
                  await this.fillTextInput(element, field.value, field.options);
                  break;
                  
                case 'textarea':
                  await this.fillTextArea(element as HTMLTextAreaElement, field.value, field.options);
                  break;
                  
                case 'select-one':
                  await this.selectOption(element as HTMLSelectElement, field.value, field.options);
                  break;
                  
                case 'select-multiple':
                  await this.selectMultipleOptions(element as HTMLSelectElement, field.value, field.options);
                  break;
                  
                case 'checkbox':
                  await this.setCheckbox(element as HTMLInputElement, field.value, field.options);
                  break;
                  
                case 'radio':
                  await this.setRadioButton(element as HTMLInputElement, field.value, field.options);
                  break;
                  
                case 'file':
                  // File inputs require special handling
                  console.warn(`File inputs cannot be filled programmatically: ${field.selector}`);
                  break;
                  
                default:
                  console.warn(`Unsupported field type: ${element.type}`);
              }
            } catch (error) {
              console.error(`Failed to fill field ${field.selector}:`, error);
            }
          }
          
          // Validate form if requested
          if (opts.validate) {
            const isValid = this.validateForm(form);
            if (!isValid) {
              reject(new Error('Form validation failed'));
              return;
            }
          }
          
          // Submit form if requested
          if (opts.submit) {
            await this.submitForm(form);
          }
          
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, fillFormFunction, [formSelector, fields, options]);
    } catch (error) {
      throw new Error(`Failed to fill form: ${error.message}`);
    }
  }

  /**
   * Get all form fields from a form
   */
  async getFormFields(formSelector: string, tabId?: number): Promise<FormField[]> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const getFieldsFunction = (formSelector: string) => {
      const form = document.querySelector(formSelector);
      if (!form) {
        throw new Error(`Form not found: ${formSelector}`);
      }
      
      const fields: FormField[] = [];
      const inputs = form.querySelectorAll('input, select, textarea');
      
      inputs.forEach(input => {
        const element = input as HTMLInputElement;
        let value = '';
        
        // Get value based on input type
        switch (element.type) {
          case 'checkbox':
          case 'radio':
            value = element.checked ? 'true' : 'false';
            break;
          case 'select-one':
          case 'select-multiple':
            const select = element as HTMLSelectElement;
            value = Array.from(select.selectedOptions).map(opt => opt.value).join(',');
            break;
          case 'file':
            value = ''; // File inputs don't expose file paths for security
            break;
          default:
            value = element.value || '';
        }
        
        fields.push({
          selector: this.generateSelector(element),
          value,
          type: element.type
        });
      });
      
      return fields;
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, getFieldsFunction, [formSelector]);
    } catch (error) {
      throw new Error(`Failed to get form fields: ${error.message}`);
    }
  }

  /**
   * Clear a form
   */
  async clearForm(formSelector: string, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const clearFormFunction = (formSelector: string) => {
      const form = document.querySelector(formSelector);
      if (!form) {
        throw new Error(`Form not found: ${formSelector}`);
      }
      
      const inputs = form.querySelectorAll('input, select, textarea');
      
      inputs.forEach(input => {
        const element = input as HTMLInputElement;
        
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
            break;
        }
        
        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);
      });
      
      return true;
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, clearFormFunction, [formSelector]);
    } catch (error) {
      throw new Error(`Failed to clear form: ${error.message}`);
    }
  }

  /**
   * Validate a form
   */
  async validateForm(formSelector: string, options: ValidationOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const validateFormFunction = (formSelector: string, opts: ValidationOptions) => {
      const form = document.querySelector(formSelector);
      if (!form) {
        throw new Error(`Form not found: ${formSelector}`);
      }
      
      // Check HTML5 validation
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }
      
      // Check required fields
      if (opts.required) {
        for (const fieldSelector of opts.required) {
          const field = form.querySelector(fieldSelector) as HTMLInputElement;
          if (field && !field.value.trim()) {
            field.focus();
            field.classList.add('validation-error');
            return false;
          }
        }
      }
      
      // Check pattern validation
      if (opts.pattern) {
        for (const [fieldSelector, pattern] of Object.entries(opts.pattern)) {
          const field = form.querySelector(fieldSelector) as HTMLInputElement;
          if (field && field.value && !pattern.test(field.value)) {
            field.focus();
            field.classList.add('validation-error');
            return false;
          }
        }
      }
      
      // Check custom validation
      if (opts.custom) {
        for (const [fieldSelector, validator] of Object.entries(opts.custom)) {
          const field = form.querySelector(fieldSelector) as HTMLInputElement;
          if (field && !validator(field.value)) {
            field.focus();
            field.classList.add('validation-error');
            return false;
          }
        }
      }
      
      // Remove validation error classes
      form.querySelectorAll('.validation-error').forEach(element => {
        element.classList.remove('validation-error');
      });
      
      return true;
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, validateFormFunction, [formSelector, options]);
    } catch (error) {
      throw new Error(`Failed to validate form: ${error.message}`);
    }
  }

  /**
   * Submit a form
   */
  async submitForm(formSelector: string, options: FormOptions = {}, tabId?: number): Promise<boolean> {
    const targetTabId = tabId || (await chromeApi.getActiveTab()).id;
    
    const submitFormFunction = (formSelector: string, opts: FormOptions) => {
      return new Promise((resolve, reject) => {
        try {
          let form: HTMLFormElement;
          
          // Find the form
          const element = document.querySelector(formSelector);
          if (element && element.tagName === 'FORM') {
            form = element as HTMLFormElement;
          } else {
            // Find the closest form ancestor
            form = element?.closest('form') as HTMLFormElement;
          }
          
          if (!form) {
            reject(new Error(`Form not found: ${formSelector}`));
            return;
          }
          
          // Validate form if requested
          if (opts.validate && !form.checkValidity()) {
            form.reportValidity();
            reject(new Error('Form validation failed'));
            return;
          }
          
          // Submit the form
          form.submit();
          
          // Wait for navigation if requested
          if (opts.waitForNavigation) {
            const timeout = opts.navigationTimeout || 10000;
            let navigated = false;
            
            const checkNavigation = () => {
              if (navigated) {
                resolve(true);
                return;
              }
              
              if (Date.now() - startTime > timeout) {
                resolve(true); // Resolve anyway, navigation might have failed silently
                return;
              }
              
              setTimeout(checkNavigation, 100);
            };
            
            const startTime = Date.now();
            
            // Listen for navigation events
            const beforeUnloadHandler = () => {
              navigated = true;
            };
            
            window.addEventListener('beforeunload', beforeUnloadHandler);
            
            // Start checking
            setTimeout(checkNavigation, 500);
            
            // Clean up listener
            setTimeout(() => {
              window.removeEventListener('beforeunload', beforeUnloadHandler);
            }, timeout);
          } else {
            resolve(true);
          }
        } catch (error) {
          reject(error);
        }
      });
    };
    
    try {
      return await chromeApi.executeScript(targetTabId, submitFormFunction, [formSelector, options]);
    } catch (error) {
      throw new Error(`Failed to submit form: ${error.message}`);
    }
  }

  /**
   * Fill a text input field
   */
  private async fillTextInput(element: HTMLInputElement, value: string, options?: any): Promise<void> {
    if (options?.clearFirst !== false) {
      element.value = '';
    }
    
    element.value = value;
    
    // Trigger events
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Fill a textarea
   */
  private async fillTextArea(element: HTMLTextAreaElement, value: string, options?: any): Promise<void> {
    if (options?.clearFirst !== false) {
      element.value = '';
    }
    
    element.value = value;
    
    // Trigger events
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Select an option from a dropdown
   */
  private async selectOption(element: HTMLSelectElement, value: string, options?: any): Promise<void> {
    // Find the option
    let option: HTMLOptionElement | null = null;
    
    // Try by value first
    option = element.querySelector(`option[value="${value}"]`);
    
    // Try by text if not found
    if (!option) {
      const options_ = Array.from(element.options);
      option = options_.find(opt => opt.textContent?.trim() === value) || null;
    }
    
    if (!option) {
      throw new Error(`Option not found: ${value}`);
    }
    
    // Select the option
    option.selected = true;
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  /**
   * Select multiple options from a dropdown
   */
  private async selectMultipleOptions(element: HTMLSelectElement, values: string, options?: any): Promise<void> {
    const valueArray = values.split(',');
    
    // Deselect all options first
    Array.from(element.options).forEach(opt => {
      opt.selected = false;
    });
    
    // Select the specified options
    valueArray.forEach(value => {
      let option: HTMLOptionElement | null = null;
      
      // Try by value first
      option = element.querySelector(`option[value="${value.trim()}"]`);
      
      // Try by text if not found
      if (!option) {
        const options_ = Array.from(element.options);
        option = options_.find(opt => opt.textContent?.trim() === value.trim()) || null;
      }
      
      if (option) {
        option.selected = true;
      }
    });
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  /**
   * Set checkbox state
   */
  private async setCheckbox(element: HTMLInputElement, value: string, options?: any): Promise<void> {
    const checked = value === 'true' || value === '1' || value === 'checked';
    element.checked = checked;
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  /**
   * Set radio button state
   */
  private async setRadioButton(element: HTMLInputElement, value: string, options?: any): Promise<void> {
    // Find all radio buttons with the same name
    const radioButtons = document.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
    
    // Find the radio button with the specified value
    const targetRadio = Array.from(radioButtons).find(rb => rb.value === value) as HTMLInputElement;
    
    if (!targetRadio) {
      throw new Error(`Radio button not found: ${value}`);
    }
    
    targetRadio.checked = true;
    
    // Trigger events
    const changeEvent = new Event('change', { bubbles: true });
    targetRadio.dispatchEvent(changeEvent);
  }

  /**
   * Generate a selector for an element
   */
  private generateSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }
    
    if (element.name) {
      return `[name="${element.name}"]`;
    }
    
    return element.tagName.toLowerCase();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No specific cleanup needed for FormAutomation
  }
}

// Export singleton instance for convenience
export const formAutomation = new FormAutomation();
