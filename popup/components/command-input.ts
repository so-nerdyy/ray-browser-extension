/**
 * Command Input Component
 * Handles user command input, validation, and keyboard shortcuts
 */

export interface CommandInputOptions {
  maxLength?: number;
  placeholder?: string;
  autoSave?: boolean;
  enableHistory?: boolean;
  enableSuggestions?: boolean;
}

export interface CommandInputEvents {
  execute: (command: string) => void;
  change: (command: string) => void;
  focus: () => void;
  blur: () => void;
}

export class CommandInput {
  private textarea: HTMLTextAreaElement;
  private charCount: HTMLSpanElement;
  private executeBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private options: Required<CommandInputOptions>;
  private events: Partial<CommandInputEvents>;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private autoSaveTimer: number | null = null;
  private suggestions: string[] = [
    'Navigate to Google and search for AI browser extensions',
    'Fill out the contact form with my information',
    'Take a screenshot of the current page',
    'Click the "Sign In" button and wait for the page to load',
    'Extract all links from this page',
    'Scroll to the bottom of the page',
    'Go back to the previous page',
    'Refresh the current page',
    'Find all images on this page',
    'Check if the page has any accessibility issues'
  ];

  constructor(
    textareaId: string,
    charCountId: string,
    executeBtnId: string,
    clearBtnId: string,
    options: CommandInputOptions = {},
    events: Partial<CommandInputEvents> = {}
  ) {
    // Get DOM elements
    this.textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    this.charCount = document.getElementById(charCountId) as HTMLSpanElement;
    this.executeBtn = document.getElementById(executeBtnId) as HTMLButtonElement;
    this.clearBtn = document.getElementById(clearBtnId) as HTMLButtonElement;

    if (!this.textarea || !this.charCount || !this.executeBtn || !this.clearBtn) {
      throw new Error('Required DOM elements not found');
    }

    // Set default options
    this.options = {
      maxLength: options.maxLength || 1000,
      placeholder: options.placeholder || 'What would you like Ray to do?',
      autoSave: options.autoSave !== false, // Default to true
      enableHistory: options.enableHistory !== false, // Default to true
      enableSuggestions: options.enableSuggestions !== false // Default to true
    };

    this.events = events;

    // Initialize the component
    this.init();
  }

  private init(): void {
    // Set textarea attributes
    this.textarea.maxLength = this.options.maxLength;
    this.textarea.placeholder = this.options.placeholder;

    // Load saved draft if auto-save is enabled
    if (this.options.autoSave) {
      this.loadDraft();
    }

    // Load command history if enabled
    if (this.options.enableHistory) {
      this.loadHistory();
    }

    // Set up event listeners
    this.setupEventListeners();

    // Initialize character count
    this.updateCharCount();
  }

  private setupEventListeners(): void {
    // Textarea events
    this.textarea.addEventListener('input', () => this.handleInput());
    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.addEventListener('focus', () => this.handleFocus());
    this.textarea.addEventListener('blur', () => this.handleBlur());

    // Button events
    this.executeBtn.addEventListener('click', () => this.execute());
    this.clearBtn.addEventListener('click', () => this.clear());

    // Auto-save on input if enabled
    if (this.options.autoSave) {
      this.textarea.addEventListener('input', () => this.scheduleAutoSave());
    }

    // Handle suggestions if enabled
    if (this.options.enableSuggestions) {
      this.setupSuggestions();
    }
  }

  private handleInput(): void {
    this.updateCharCount();
    this.resetHistoryIndex();
    this.events.change?.(this.textarea.value);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Ctrl+Enter to execute
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      this.execute();
      return;
    }

    // Escape to clear
    if (e.key === 'Escape') {
      this.clear();
      return;
    }

    // History navigation with up/down arrows
    if (this.options.enableHistory) {
      if (e.key === 'ArrowUp' && !e.shiftKey) {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown' && !e.shiftKey) {
        e.preventDefault();
        this.navigateHistory(1);
      }
    }

    // Tab for suggestions
    if (e.key === 'Tab' && this.options.enableSuggestions) {
      e.preventDefault();
      this.showSuggestion();
    }
  }

  private handleFocus(): void {
    this.events.focus?.();
  }

  private handleBlur(): void {
    // Auto-save when losing focus if enabled
    if (this.options.autoSave) {
      this.saveDraft();
    }
    this.events.blur?.();
  }

  private updateCharCount(): void {
    const length = this.textarea.value.length;
    const maxLength = this.options.maxLength;
    this.charCount.textContent = `${length}/${maxLength}`;

    // Update character count color based on length
    if (length > maxLength * 0.9) {
      this.charCount.style.color = 'var(--error-color)';
    } else if (length > maxLength * 0.7) {
      this.charCount.style.color = 'var(--warning-color)';
    } else {
      this.charCount.style.color = 'var(--text-tertiary)';
    }
  }

  private resetHistoryIndex(): void {
    this.historyIndex = -1;
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return;

    // Save current input if we're starting to navigate history
    if (this.historyIndex === -1 && direction === -1) {
      // Store current input in a temporary variable
      (this.textarea as any).tempInput = this.textarea.value;
    }

    // Calculate new index
    this.historyIndex += direction;

    // Handle boundaries
    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length - 1;
    }

    // Update textarea with history item
    if (this.historyIndex >= 0 && this.historyIndex < this.commandHistory.length) {
      this.textarea.value = this.commandHistory[this.historyIndex];
      this.updateCharCount();
    } else if (this.historyIndex === -1 && (this.textarea as any).tempInput) {
      // Restore temporary input
      this.textarea.value = (this.textarea as any).tempInput;
      this.updateCharCount();
    }
  }

  private setupSuggestions(): void {
    // Create suggestions container if it doesn't exist
    let suggestionsContainer = document.getElementById('suggestions-container');
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = 'suggestions-container';
      suggestionsContainer.className = 'suggestions-container';
      suggestionsContainer.style.position = 'absolute';
      suggestionsContainer.style.zIndex = '1000';
      suggestionsContainer.style.display = 'none';
      this.textarea.parentNode?.insertBefore(suggestionsContainer, this.textarea.nextSibling);
    }

    // Show suggestions on input
    this.textarea.addEventListener('input', () => {
      const value = this.textarea.value.trim();
      if (value.length > 0) {
        this.showSuggestionsForInput(value);
      } else {
        this.hideSuggestions();
      }
    });

    // Hide suggestions on blur
    this.textarea.addEventListener('blur', () => {
      setTimeout(() => this.hideSuggestions(), 200);
    });
  }

  private showSuggestionsForInput(input: string): void {
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (!suggestionsContainer) return;

    // Filter suggestions based on input
    const filteredSuggestions = this.suggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(input.toLowerCase())
    );

    if (filteredSuggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    // Clear and populate suggestions
    suggestionsContainer.innerHTML = '';
    filteredSuggestions.slice(0, 5).forEach(suggestion => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.textContent = suggestion;
      suggestionItem.style.padding = '8px 12px';
      suggestionItem.style.cursor = 'pointer';
      suggestionItem.style.borderBottom = '1px solid var(--border-color)';
      
      suggestionItem.addEventListener('click', () => {
        this.textarea.value = suggestion;
        this.updateCharCount();
        this.hideSuggestions();
        this.textarea.focus();
      });

      suggestionItem.addEventListener('mouseover', () => {
        suggestionItem.style.backgroundColor = 'var(--surface-color)';
      });

      suggestionItem.addEventListener('mouseout', () => {
        suggestionItem.style.backgroundColor = 'transparent';
      });

      suggestionsContainer.appendChild(suggestionItem);
    });

    // Position and show suggestions
    const rect = this.textarea.getBoundingClientRect();
    suggestionsContainer.style.top = `${rect.bottom}px`;
    suggestionsContainer.style.left = `${rect.left}px`;
    suggestionsContainer.style.width = `${rect.width}px`;
    suggestionsContainer.style.backgroundColor = 'var(--background-color)';
    suggestionsContainer.style.border = '1px solid var(--border-color)';
    suggestionsContainer.style.borderRadius = 'var(--radius-md)';
    suggestionsContainer.style.boxShadow = 'var(--shadow-lg)';
    suggestionsContainer.style.display = 'block';
  }

  private hideSuggestions(): void {
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  private showSuggestion(): void {
    const value = this.textarea.value.trim();
    if (value.length > 0) {
      this.showSuggestionsForInput(value);
    }
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = window.setTimeout(() => {
      this.saveDraft();
    }, 1000); // Save after 1 second of inactivity
  }

  private saveDraft(): void {
    if (!this.options.autoSave) return;
    
    const draft = this.textarea.value;
    chrome.storage.local.set({ commandDraft: draft });
  }

  private loadDraft(): void {
    if (!this.options.autoSave) return;
    
    chrome.storage.local.get(['commandDraft'], (result) => {
      if (result.commandDraft) {
        this.textarea.value = result.commandDraft;
        this.updateCharCount();
      }
    });
  }

  private loadHistory(): void {
    if (!this.options.enableHistory) return;
    
    chrome.storage.local.get(['commandHistory'], (result) => {
      if (result.commandHistory && Array.isArray(result.commandHistory)) {
        this.commandHistory = result.commandHistory;
      }
    });
  }

  private addToHistory(command: string): void {
    if (!this.options.enableHistory || !command.trim()) return;
    
    // Remove duplicate if exists
    this.commandHistory = this.commandHistory.filter(item => item !== command);
    
    // Add to beginning
    this.commandHistory.unshift(command);
    
    // Keep only last 20 commands
    this.commandHistory = this.commandHistory.slice(0, 20);
    
    // Save to storage
    chrome.storage.local.set({ commandHistory: this.commandHistory });
  }

  public execute(): void {
    const command = this.textarea.value.trim();
    if (!command) {
      this.textarea.focus();
      return;
    }

    // Add to history
    this.addToHistory(command);

    // Clear draft
    if (this.options.autoSave) {
      chrome.storage.local.remove(['commandDraft']);
    }

    // Trigger execute event
    this.events.execute?.(command);

    // Clear input
    this.clear();
  }

  public clear(): void {
    this.textarea.value = '';
    this.updateCharCount();
    this.resetHistoryIndex();
    this.hideSuggestions();
  }

  public getValue(): string {
    return this.textarea.value;
  }

  public setValue(value: string): void {
    this.textarea.value = value;
    this.updateCharCount();
    this.resetHistoryIndex();
  }

  public focus(): void {
    this.textarea.focus();
  }

  public blur(): void {
    this.textarea.blur();
  }

  public setEnabled(enabled: boolean): void {
    this.textarea.disabled = !enabled;
    this.executeBtn.disabled = !enabled;
    this.clearBtn.disabled = !enabled;
  }

  public destroy(): void {
    // Clean up event listeners
    this.textarea.removeEventListener('input', () => this.handleInput());
    this.textarea.removeEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.removeEventListener('focus', () => this.handleFocus());
    this.textarea.removeEventListener('blur', () => this.handleBlur());
    
    this.executeBtn.removeEventListener('click', () => this.execute());
    this.clearBtn.removeEventListener('click', () => this.clear());

    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Remove suggestions container
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
      suggestionsContainer.remove();
    }
  }
} * Command Input Component
 * Handles user command input, validation, and keyboard shortcuts
 */

export interface CommandInputOptions {
  maxLength?: number;
  placeholder?: string;
  autoSave?: boolean;
  enableHistory?: boolean;
  enableSuggestions?: boolean;
}

export interface CommandInputEvents {
  execute: (command: string) => void;
  change: (command: string) => void;
  focus: () => void;
  blur: () => void;
}

export class CommandInput {
  private textarea: HTMLTextAreaElement;
  private charCount: HTMLSpanElement;
  private executeBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private options: Required<CommandInputOptions>;
  private events: Partial<CommandInputEvents>;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private autoSaveTimer: number | null = null;
  private suggestions: string[] = [
    'Navigate to Google and search for AI browser extensions',
    'Fill out the contact form with my information',
    'Take a screenshot of the current page',
    'Click the "Sign In" button and wait for the page to load',
    'Extract all links from this page',
    'Scroll to the bottom of the page',
    'Go back to the previous page',
    'Refresh the current page',
    'Find all images on this page',
    'Check if the page has any accessibility issues'
  ];

  constructor(
    textareaId: string,
    charCountId: string,
    executeBtnId: string,
    clearBtnId: string,
    options: CommandInputOptions = {},
    events: Partial<CommandInputEvents> = {}
  ) {
    // Get DOM elements
    this.textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    this.charCount = document.getElementById(charCountId) as HTMLSpanElement;
    this.executeBtn = document.getElementById(executeBtnId) as HTMLButtonElement;
    this.clearBtn = document.getElementById(clearBtnId) as HTMLButtonElement;

    if (!this.textarea || !this.charCount || !this.executeBtn || !this.clearBtn) {
      throw new Error('Required DOM elements not found');
    }

    // Set default options
    this.options = {
      maxLength: options.maxLength || 1000,
      placeholder: options.placeholder || 'What would you like Ray to do?',
      autoSave: options.autoSave !== false, // Default to true
      enableHistory: options.enableHistory !== false, // Default to true
      enableSuggestions: options.enableSuggestions !== false // Default to true
    };

    this.events = events;

    // Initialize the component
    this.init();
  }

  private init(): void {
    // Set textarea attributes
    this.textarea.maxLength = this.options.maxLength;
    this.textarea.placeholder = this.options.placeholder;

    // Load saved draft if auto-save is enabled
    if (this.options.autoSave) {
      this.loadDraft();
    }

    // Load command history if enabled
    if (this.options.enableHistory) {
      this.loadHistory();
    }

    // Set up event listeners
    this.setupEventListeners();

    // Initialize character count
    this.updateCharCount();
  }

  private setupEventListeners(): void {
    // Textarea events
    this.textarea.addEventListener('input', () => this.handleInput());
    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.addEventListener('focus', () => this.handleFocus());
    this.textarea.addEventListener('blur', () => this.handleBlur());

    // Button events
    this.executeBtn.addEventListener('click', () => this.execute());
    this.clearBtn.addEventListener('click', () => this.clear());

    // Auto-save on input if enabled
    if (this.options.autoSave) {
      this.textarea.addEventListener('input', () => this.scheduleAutoSave());
    }

    // Handle suggestions if enabled
    if (this.options.enableSuggestions) {
      this.setupSuggestions();
    }
  }

  private handleInput(): void {
    this.updateCharCount();
    this.resetHistoryIndex();
    this.events.change?.(this.textarea.value);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Ctrl+Enter to execute
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      this.execute();
      return;
    }

    // Escape to clear
    if (e.key === 'Escape') {
      this.clear();
      return;
    }

    // History navigation with up/down arrows
    if (this.options.enableHistory) {
      if (e.key === 'ArrowUp' && !e.shiftKey) {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown' && !e.shiftKey) {
        e.preventDefault();
        this.navigateHistory(1);
      }
    }

    // Tab for suggestions
    if (e.key === 'Tab' && this.options.enableSuggestions) {
      e.preventDefault();
      this.showSuggestion();
    }
  }

  private handleFocus(): void {
    this.events.focus?.();
  }

  private handleBlur(): void {
    // Auto-save when losing focus if enabled
    if (this.options.autoSave) {
      this.saveDraft();
    }
    this.events.blur?.();
  }

  private updateCharCount(): void {
    const length = this.textarea.value.length;
    const maxLength = this.options.maxLength;
    this.charCount.textContent = `${length}/${maxLength}`;

    // Update character count color based on length
    if (length > maxLength * 0.9) {
      this.charCount.style.color = 'var(--error-color)';
    } else if (length > maxLength * 0.7) {
      this.charCount.style.color = 'var(--warning-color)';
    } else {
      this.charCount.style.color = 'var(--text-tertiary)';
    }
  }

  private resetHistoryIndex(): void {
    this.historyIndex = -1;
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return;

    // Save current input if we're starting to navigate history
    if (this.historyIndex === -1 && direction === -1) {
      // Store current input in a temporary variable
      (this.textarea as any).tempInput = this.textarea.value;
    }

    // Calculate new index
    this.historyIndex += direction;

    // Handle boundaries
    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length - 1;
    }

    // Update textarea with history item
    if (this.historyIndex >= 0 && this.historyIndex < this.commandHistory.length) {
      this.textarea.value = this.commandHistory[this.historyIndex];
      this.updateCharCount();
    } else if (this.historyIndex === -1 && (this.textarea as any).tempInput) {
      // Restore temporary input
      this.textarea.value = (this.textarea as any).tempInput;
      this.updateCharCount();
    }
  }

  private setupSuggestions(): void {
    // Create suggestions container if it doesn't exist
    let suggestionsContainer = document.getElementById('suggestions-container');
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = 'suggestions-container';
      suggestionsContainer.className = 'suggestions-container';
      suggestionsContainer.style.position = 'absolute';
      suggestionsContainer.style.zIndex = '1000';
      suggestionsContainer.style.display = 'none';
      this.textarea.parentNode?.insertBefore(suggestionsContainer, this.textarea.nextSibling);
    }

    // Show suggestions on input
    this.textarea.addEventListener('input', () => {
      const value = this.textarea.value.trim();
      if (value.length > 0) {
        this.showSuggestionsForInput(value);
      } else {
        this.hideSuggestions();
      }
    });

    // Hide suggestions on blur
    this.textarea.addEventListener('blur', () => {
      setTimeout(() => this.hideSuggestions(), 200);
    });
  }

  private showSuggestionsForInput(input: string): void {
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (!suggestionsContainer) return;

    // Filter suggestions based on input
    const filteredSuggestions = this.suggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(input.toLowerCase())
    );

    if (filteredSuggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    // Clear and populate suggestions
    suggestionsContainer.innerHTML = '';
    filteredSuggestions.slice(0, 5).forEach(suggestion => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.textContent = suggestion;
      suggestionItem.style.padding = '8px 12px';
      suggestionItem.style.cursor = 'pointer';
      suggestionItem.style.borderBottom = '1px solid var(--border-color)';
      
      suggestionItem.addEventListener('click', () => {
        this.textarea.value = suggestion;
        this.updateCharCount();
        this.hideSuggestions();
        this.textarea.focus();
      });

      suggestionItem.addEventListener('mouseover', () => {
        suggestionItem.style.backgroundColor = 'var(--surface-color)';
      });

      suggestionItem.addEventListener('mouseout', () => {
        suggestionItem.style.backgroundColor = 'transparent';
      });

      suggestionsContainer.appendChild(suggestionItem);
    });

    // Position and show suggestions
    const rect = this.textarea.getBoundingClientRect();
    suggestionsContainer.style.top = `${rect.bottom}px`;
    suggestionsContainer.style.left = `${rect.left}px`;
    suggestionsContainer.style.width = `${rect.width}px`;
    suggestionsContainer.style.backgroundColor = 'var(--background-color)';
    suggestionsContainer.style.border = '1px solid var(--border-color)';
    suggestionsContainer.style.borderRadius = 'var(--radius-md)';
    suggestionsContainer.style.boxShadow = 'var(--shadow-lg)';
    suggestionsContainer.style.display = 'block';
  }

  private hideSuggestions(): void {
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  private showSuggestion(): void {
    const value = this.textarea.value.trim();
    if (value.length > 0) {
      this.showSuggestionsForInput(value);
    }
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = window.setTimeout(() => {
      this.saveDraft();
    }, 1000); // Save after 1 second of inactivity
  }

  private saveDraft(): void {
    if (!this.options.autoSave) return;
    
    const draft = this.textarea.value;
    chrome.storage.local.set({ commandDraft: draft });
  }

  private loadDraft(): void {
    if (!this.options.autoSave) return;
    
    chrome.storage.local.get(['commandDraft'], (result) => {
      if (result.commandDraft) {
        this.textarea.value = result.commandDraft;
        this.updateCharCount();
      }
    });
  }

  private loadHistory(): void {
    if (!this.options.enableHistory) return;
    
    chrome.storage.local.get(['commandHistory'], (result) => {
      if (result.commandHistory && Array.isArray(result.commandHistory)) {
        this.commandHistory = result.commandHistory;
      }
    });
  }

  private addToHistory(command: string): void {
    if (!this.options.enableHistory || !command.trim()) return;
    
    // Remove duplicate if exists
    this.commandHistory = this.commandHistory.filter(item => item !== command);
    
    // Add to beginning
    this.commandHistory.unshift(command);
    
    // Keep only last 20 commands
    this.commandHistory = this.commandHistory.slice(0, 20);
    
    // Save to storage
    chrome.storage.local.set({ commandHistory: this.commandHistory });
  }

  public execute(): void {
    const command = this.textarea.value.trim();
    if (!command) {
      this.textarea.focus();
      return;
    }

    // Add to history
    this.addToHistory(command);

    // Clear draft
    if (this.options.autoSave) {
      chrome.storage.local.remove(['commandDraft']);
    }

    // Trigger execute event
    this.events.execute?.(command);

    // Clear input
    this.clear();
  }

  public clear(): void {
    this.textarea.value = '';
    this.updateCharCount();
    this.resetHistoryIndex();
    this.hideSuggestions();
  }

  public getValue(): string {
    return this.textarea.value;
  }

  public setValue(value: string): void {
    this.textarea.value = value;
    this.updateCharCount();
    this.resetHistoryIndex();
  }

  public focus(): void {
    this.textarea.focus();
  }

  public blur(): void {
    this.textarea.blur();
  }

  public setEnabled(enabled: boolean): void {
    this.textarea.disabled = !enabled;
    this.executeBtn.disabled = !enabled;
    this.clearBtn.disabled = !enabled;
  }

  public destroy(): void {
    // Clean up event listeners
    this.textarea.removeEventListener('input', () => this.handleInput());
    this.textarea.removeEventListener('keydown', (e) => this.handleKeyDown(e));
    this.textarea.removeEventListener('focus', () => this.handleFocus());
    this.textarea.removeEventListener('blur', () => this.handleBlur());
    
    this.executeBtn.removeEventListener('click', () => this.execute());
    this.clearBtn.removeEventListener('click', () => this.clear());

    // Clear auto-save timer
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    // Remove suggestions container
    const suggestionsContainer = document.getElementById('suggestions-container');
    if (suggestionsContainer) {
      suggestionsContainer.remove();
    }
  }
}
