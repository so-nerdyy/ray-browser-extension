# Agent Dakota: Browser Automation Engine

## Agent Overview
**Name**: Dakota  
**Focus**: Browser automation using native Chrome Extension APIs, content script injection, and DOM manipulation  
**Timeline**: Days 4-7 (Automation Implementation phase)

## Primary Responsibilities
Dakota will implement the browser automation engine that executes the parsed commands from Casey. This includes navigation, form filling, clicking, scrolling, and multi-tab workflows using native Chrome Extension APIs (NOT Playwright/Puppeteer).

## Detailed Tasks

### Task 1: Chrome Extension API Automation Layer
**Files to Create** (spec.md lines 99, 144-165):
- `lib/browser-automation.ts` - Core automation functions
- `lib/chrome-api-wrappers.ts` - Chrome API abstraction layer
- `lib/automation-types.ts` - Automation command types

**Critical Requirement** (spec.md lines 284-285):
- Use native Chrome Extension APIs (chrome.tabs, chrome.scripting, chrome.storage)
- DO NOT use Playwright or Puppeteer (designed for testing, not runtime automation)

**Chrome API Patterns** (spec.md lines 144-165):
```typescript
// Execute script in active tab
async function executeScript(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: func,
    args: args
  });
  return results[0]?.result;
}

// Navigate to URL
async function navigateToUrl(tabId, url) {
  await chrome.tabs.update(tabId, { url: url });
}

// Query tabs
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
```

### Task 2: Content Script Injection System
**Files to Create** (spec.md lines 96, 173-198):
- `content/automator.ts` - Main content script for DOM manipulation
- `content/dom-utils.ts` - DOM manipulation utilities
- `content/form-handler.ts` - Form filling and interaction
- `content/message-handler.ts` - Communication with background

**Content Script Requirements**:
- DOM manipulation and form interactions
- Element detection and interaction
- Robust selector strategies
- Error handling for missing elements
- Cross-site compatibility

**Communication Pattern** (spec.md lines 177-192):
```typescript
// In content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillForm') {
    const success = fillFormField(request.selector, request.value);
    sendResponse({ success: success });
  }
  return true; // Keep message channel open for async response
});

// In background service worker
async function sendToContentScript(tabId, action, data) {
  const response = await chrome.tabs.sendMessage(tabId, { action, ...data });
  return response;
}
```

### Task 3: DOM Manipulation & Form Interaction
**Files to Create**:
- `lib/dom-selectors.ts` - Robust selector strategies
- `lib/element-interaction.ts` - Click, type, scroll utilities
- `lib/form-automation.ts` - Form filling and submission
- `lib/wait-strategies.ts` - Element waiting and timeout handling

**Automation Capabilities** (spec.md lines 245-248):
- Navigation to websites
- Form filling and input interaction
- Click detection and element interaction
- Scrolling and page navigation
- Multi-step workflow execution

**Edge Case Handling** (spec.md lines 270-279):
- Missing DOM Elements - Retry with timeout, report specific errors
- Multi-Tab Workflows - Handle simultaneous tab interactions
- Unexpected Page Changes - Robust selectors, fallback strategies
- Cross-Origin Restrictions - Work within Chrome Extension permission model

### Task 4: Multi-Step Workflow Execution
**Files to Create**:
- `lib/workflow-executor.ts` - Multi-step automation coordination
- `lib/tab-manager.ts` - Multi-tab workflow support
- `lib/state-tracker.ts` - Workflow state management
- `lib/error-recovery.ts` - Automation failure recovery

**Workflow Requirements** (spec.md lines 250-253):
- Execute sequences of actions across multiple websites
- Maintain workflow state and context
- Handle step dependencies and sequencing
- Report progress and completion status
- Support workflow cancellation and interruption

**Example Workflow** (spec.md line 408):
- Flight search → calendar add → email draft
- Navigate to flight search site
- Fill search form and submit
- Extract results and navigate to calendar
- Add calendar event
- Draft email with flight details

### Task 5: Error Handling & Recovery
**Files to Create**:
- `lib/automation-errors.ts` - Error categorization and handling
- `lib/retry-logic.ts` - Retry strategies for failed actions
- `lib/timeout-handlers.ts` - Timeout and wait strategies
- `lib/progress-reporting.ts` - Status reporting to Casey

**Error Handling Requirements** (spec.md lines 266-268):
- Clear error messages for automation failures
- Specific error reporting (API errors, navigation failures, element not found)
- Actionable feedback for users
- Graceful degradation when automation fails

### Task 6: Performance & Optimization
**Files to Create**:
- `lib/automation-optimization.ts` - Performance monitoring
- `lib/memory-management.ts` - Memory usage optimization
- `lib/selector-caching.ts` - Element selector caching
- `lib/batch-operations.ts` - Batch automation operations

**Performance Requirements** (spec.md lines 479-487):
- Content Script Load < 200ms
- Memory Usage < 50MB for extension
- Efficient DOM manipulation
- Smooth animations and transitions
- Optimized selector strategies

## Dependencies & Coordination
**Dependencies**:
- **Alex**: Needs Chrome API wrappers and content script injection setup
- **Casey**: Receives parsed automation commands, reports execution status
- **Blake**: Displays automation progress and results to user
- **Ellis**: Requires permission validation and security checks

**Coordination Points**:
- Use Alex's Chrome API wrapper utilities
- Receive structured commands from Casey
- Send status updates to Blake through Casey
- Implement Ellis's security validations
- Work with Alex's content script injection system

## Technical Requirements (spec.md lines 283-304)
### Chrome Extension API Compliance
- Use chrome.scripting.executeScript() instead of deprecated tabs.executeScript()
- Always handle tab existence checks before operations
- Use async/await for all Chrome API calls
- Handle permission errors gracefully
- Follow Manifest V3 service worker patterns

### Security & Permission Model
- Request activeTab permission initially (user grants per use)
- Consider requesting <all_urls> only after user explicitly enables advanced features
- Document why each permission is needed
- Follow principle of least privilege

### Browser Automation Standards
- Robust element detection and interaction
- Fallback strategies for failed selectors
- Wait strategies for dynamic content
- Cross-browser compatibility within Chrome ecosystem
- Handle website anti-automation measures

## Files Dakota Will Create
```
content/
├── automator.ts           # Main content script
├── dom-utils.ts           # DOM manipulation utilities
├── form-handler.ts        # Form interaction logic
└── message-handler.ts     # Background communication

lib/
├── browser-automation.ts  # Core automation functions
├── chrome-api-wrappers.ts # Chrome API abstraction
├── automation-types.ts    # Type definitions
├── dom-selectors.ts       # Selector strategies
├── element-interaction.ts # Click, type, scroll
├── form-automation.ts     # Form filling logic
├── wait-strategies.ts     # Element waiting
├── workflow-executor.ts  # Multi-step coordination
├── tab-manager.ts        # Multi-tab workflows
├── state-tracker.ts      # Workflow state
├── error-recovery.ts     # Failure handling
├── automation-errors.ts   # Error categorization
├── retry-logic.ts       # Retry strategies
├── timeout-handlers.ts   # Timeout management
├── progress-reporting.ts # Status updates
├── automation-optimization.ts # Performance
├── memory-management.ts    # Memory optimization
├── selector-caching.ts   # Selector caching
└── batch-operations.ts   # Batch operations
```

## Success Criteria
- [ ] Browser automation executes at least one action (navigation, click, or form fill)
- [ ] Multi-step workflow completes (navigate → interact → report result)
- [ ] Content scripts successfully communicate with background service worker
- [ ] Error messages display clearly when failures occur
- [ ] System handles missing DOM elements gracefully
- [ ] Multi-tab workflows execute correctly
- [ ] Extension works without console errors in Chrome's extension page
- [ ] Performance benchmarks met (content script load < 200ms)
- [ ] No Playwright or Puppeteer dependencies used

## Notes for Dakota
1. **Critical**: DO NOT use Playwright or Puppeteer (spec.md lines 284-297)
2. **APIs**: Use chrome.scripting instead of deprecated tabs.executeScript
3. **Selectors**: Implement robust selector strategies for dynamic content
4. **Communication**: Use chrome.runtime.onMessage for content script communication
5. **Security**: Follow permission model, request minimum necessary permissions
6. **Performance**: Optimize for extension sandbox constraints
7. **Testing**: Test with multiple websites to ensure robustness

## Files Dakota Should Not Touch
- `manifest.json` (Alex's responsibility)
- `popup/` directory (Blake's responsibility)
- `background/service-worker.ts` (Casey's responsibility)
- `lib/openrouter-client.*` (Casey's responsibility)
- `lib/command-parser.*` (Casey's responsibility)
- UI styling and themes (Blake's responsibility)
- Security implementation details (Ellis's responsibility)
- Test files (Finley's responsibility)

## Integration Points
- **With Casey**: Receive parsed automation commands, report execution status
- **With Blake**: Display automation progress through Casey's feedback system
- **With Alex**: Use Chrome API wrappers, content script injection
- **With Ellis**: Implement permission validations, security checks
## Agent Overview
**Name**: Dakota  
**Focus**: Browser automation using native Chrome Extension APIs, content script injection, and DOM manipulation  
**Timeline**: Days 4-7 (Automation Implementation phase)

## Primary Responsibilities
Dakota will implement the browser automation engine that executes the parsed commands from Casey. This includes navigation, form filling, clicking, scrolling, and multi-tab workflows using native Chrome Extension APIs (NOT Playwright/Puppeteer).

## Detailed Tasks

### Task 1: Chrome Extension API Automation Layer
**Files to Create** (spec.md lines 99, 144-165):
- `lib/browser-automation.ts` - Core automation functions
- `lib/chrome-api-wrappers.ts` - Chrome API abstraction layer
- `lib/automation-types.ts` - Automation command types

**Critical Requirement** (spec.md lines 284-285):
- Use native Chrome Extension APIs (chrome.tabs, chrome.scripting, chrome.storage)
- DO NOT use Playwright or Puppeteer (designed for testing, not runtime automation)

**Chrome API Patterns** (spec.md lines 144-165):
```typescript
// Execute script in active tab
async function executeScript(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: func,
    args: args
  });
  return results[0]?.result;
}

// Navigate to URL
async function navigateToUrl(tabId, url) {
  await chrome.tabs.update(tabId, { url: url });
}

// Query tabs
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
```

### Task 2: Content Script Injection System
**Files to Create** (spec.md lines 96, 173-198):
- `content/automator.ts` - Main content script for DOM manipulation
- `content/dom-utils.ts` - DOM manipulation utilities
- `content/form-handler.ts` - Form filling and interaction
- `content/message-handler.ts` - Communication with background

**Content Script Requirements**:
- DOM manipulation and form interactions
- Element detection and interaction
- Robust selector strategies
- Error handling for missing elements
- Cross-site compatibility

**Communication Pattern** (spec.md lines 177-192):
```typescript
// In content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillForm') {
    const success = fillFormField(request.selector, request.value);
    sendResponse({ success: success });
  }
  return true; // Keep message channel open for async response
});

// In background service worker
async function sendToContentScript(tabId, action, data) {
  const response = await chrome.tabs.sendMessage(tabId, { action, ...data });
  return response;
}
```

### Task 3: DOM Manipulation & Form Interaction
**Files to Create**:
- `lib/dom-selectors.ts` - Robust selector strategies
- `lib/element-interaction.ts` - Click, type, scroll utilities
- `lib/form-automation.ts` - Form filling and submission
- `lib/wait-strategies.ts` - Element waiting and timeout handling

**Automation Capabilities** (spec.md lines 245-248):
- Navigation to websites
- Form filling and input interaction
- Click detection and element interaction
- Scrolling and page navigation
- Multi-step workflow execution

**Edge Case Handling** (spec.md lines 270-279):
- Missing DOM Elements - Retry with timeout, report specific errors
- Multi-Tab Workflows - Handle simultaneous tab interactions
- Unexpected Page Changes - Robust selectors, fallback strategies
- Cross-Origin Restrictions - Work within Chrome Extension permission model

### Task 4: Multi-Step Workflow Execution
**Files to Create**:
- `lib/workflow-executor.ts` - Multi-step automation coordination
- `lib/tab-manager.ts` - Multi-tab workflow support
- `lib/state-tracker.ts` - Workflow state management
- `lib/error-recovery.ts` - Automation failure recovery

**Workflow Requirements** (spec.md lines 250-253):
- Execute sequences of actions across multiple websites
- Maintain workflow state and context
- Handle step dependencies and sequencing
- Report progress and completion status
- Support workflow cancellation and interruption

**Example Workflow** (spec.md line 408):
- Flight search → calendar add → email draft
- Navigate to flight search site
- Fill search form and submit
- Extract results and navigate to calendar
- Add calendar event
- Draft email with flight details

### Task 5: Error Handling & Recovery
**Files to Create**:
- `lib/automation-errors.ts` - Error categorization and handling
- `lib/retry-logic.ts` - Retry strategies for failed actions
- `lib/timeout-handlers.ts` - Timeout and wait strategies
- `lib/progress-reporting.ts` - Status reporting to Casey

**Error Handling Requirements** (spec.md lines 266-268):
- Clear error messages for automation failures
- Specific error reporting (API errors, navigation failures, element not found)
- Actionable feedback for users
- Graceful degradation when automation fails

### Task 6: Performance & Optimization
**Files to Create**:
- `lib/automation-optimization.ts` - Performance monitoring
- `lib/memory-management.ts` - Memory usage optimization
- `lib/selector-caching.ts` - Element selector caching
- `lib/batch-operations.ts` - Batch automation operations

**Performance Requirements** (spec.md lines 479-487):
- Content Script Load < 200ms
- Memory Usage < 50MB for extension
- Efficient DOM manipulation
- Smooth animations and transitions
- Optimized selector strategies

## Dependencies & Coordination
**Dependencies**:
- **Alex**: Needs Chrome API wrappers and content script injection setup
- **Casey**: Receives parsed automation commands, reports execution status
- **Blake**: Displays automation progress and results to user
- **Ellis**: Requires permission validation and security checks

**Coordination Points**:
- Use Alex's Chrome API wrapper utilities
- Receive structured commands from Casey
- Send status updates to Blake through Casey
- Implement Ellis's security validations
- Work with Alex's content script injection system

## Technical Requirements (spec.md lines 283-304)
### Chrome Extension API Compliance
- Use chrome.scripting.executeScript() instead of deprecated tabs.executeScript()
- Always handle tab existence checks before operations
- Use async/await for all Chrome API calls
- Handle permission errors gracefully
- Follow Manifest V3 service worker patterns

### Security & Permission Model
- Request activeTab permission initially (user grants per use)
- Consider requesting <all_urls> only after user explicitly enables advanced features
- Document why each permission is needed
- Follow principle of least privilege

### Browser Automation Standards
- Robust element detection and interaction
- Fallback strategies for failed selectors
- Wait strategies for dynamic content
- Cross-browser compatibility within Chrome ecosystem
- Handle website anti-automation measures

## Files Dakota Will Create
```
content/
├── automator.ts           # Main content script
├── dom-utils.ts           # DOM manipulation utilities
├── form-handler.ts        # Form interaction logic
└── message-handler.ts     # Background communication

lib/
├── browser-automation.ts  # Core automation functions
├── chrome-api-wrappers.ts # Chrome API abstraction
├── automation-types.ts    # Type definitions
├── dom-selectors.ts       # Selector strategies
├── element-interaction.ts # Click, type, scroll
├── form-automation.ts     # Form filling logic
├── wait-strategies.ts     # Element waiting
├── workflow-executor.ts  # Multi-step coordination
├── tab-manager.ts        # Multi-tab workflows
├── state-tracker.ts      # Workflow state
├── error-recovery.ts     # Failure handling
├── automation-errors.ts   # Error categorization
├── retry-logic.ts       # Retry strategies
├── timeout-handlers.ts   # Timeout management
├── progress-reporting.ts # Status updates
├── automation-optimization.ts # Performance
├── memory-management.ts    # Memory optimization
├── selector-caching.ts   # Selector caching
└── batch-operations.ts   # Batch operations
```

## Success Criteria
- [ ] Browser automation executes at least one action (navigation, click, or form fill)
- [ ] Multi-step workflow completes (navigate → interact → report result)
- [ ] Content scripts successfully communicate with background service worker
- [ ] Error messages display clearly when failures occur
- [ ] System handles missing DOM elements gracefully
- [ ] Multi-tab workflows execute correctly
- [ ] Extension works without console errors in Chrome's extension page
- [ ] Performance benchmarks met (content script load < 200ms)
- [ ] No Playwright or Puppeteer dependencies used

## Notes for Dakota
1. **Critical**: DO NOT use Playwright or Puppeteer (spec.md lines 284-297)
2. **APIs**: Use chrome.scripting instead of deprecated tabs.executeScript
3. **Selectors**: Implement robust selector strategies for dynamic content
4. **Communication**: Use chrome.runtime.onMessage for content script communication
5. **Security**: Follow permission model, request minimum necessary permissions
6. **Performance**: Optimize for extension sandbox constraints
7. **Testing**: Test with multiple websites to ensure robustness

## Files Dakota Should Not Touch
- `manifest.json` (Alex's responsibility)
- `popup/` directory (Blake's responsibility)
- `background/service-worker.ts` (Casey's responsibility)
- `lib/openrouter-client.*` (Casey's responsibility)
- `lib/command-parser.*` (Casey's responsibility)
- UI styling and themes (Blake's responsibility)
- Security implementation details (Ellis's responsibility)
- Test files (Finley's responsibility)

## Integration Points
- **With Casey**: Receive parsed automation commands, report execution status
- **With Blake**: Display automation progress through Casey's feedback system
- **With Alex**: Use Chrome API wrappers, content script injection
- **With Ellis**: Implement permission validations, security checks
