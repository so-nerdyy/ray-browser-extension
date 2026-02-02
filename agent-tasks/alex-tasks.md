# Agent Alex: Chrome Extension Foundation & Manifest Setup

## Agent Overview
**Name**: Alex  
**Focus**: Core Chrome Extension infrastructure, manifest configuration, and project scaffolding  
**Timeline**: Days 1-3 (Foundation phase)

## Primary Responsibilities
Alex will establish the foundational Chrome Extension architecture that all other agents will build upon. This includes creating the manifest.json, setting up the build system, and establishing the core extension structure.

## Detailed Tasks

### Task 1: Project Structure & Manifest Creation
**Files to Create**:
- `manifest.json` - Chrome Extension manifest with Manifest V3
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Git ignore rules
- `README.md` - Project documentation

**Manifest Requirements** (from spec.md lines 79-85):
```json
{
  "manifest_version": 3,
  "name": "Ray - AI Browser Automation",
  "version": "1.0.0",
  "description": "AI-powered browser automation assistant",
  "permissions": ["tabs", "scripting", "storage", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_title": "Ray"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/automator.js"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Task 2: Framework Selection & Setup
**Decision Required**: Choose between Plasmo, WXT, or Vanilla+Vite (spec.md lines 44-46)
- **Recommended**: Plasmo for React development OR WXT for TypeScript-first
- **Setup**: Initialize chosen framework with proper configuration
- **Build Scripts**: Configure development and production builds

### Task 3: Directory Structure Creation
**Create directories** (spec.md lines 52-61):
```
ray-browser-extension/
├── manifest.json
├── popup/
│   ├── index.html
│   ├── styles.css
│   └── app.ts
├── background/
│   └── service-worker.ts
├── content/
│   └── automator.ts
├── lib/
│   ├── types/
│   └── utils/
├── icons/
└── _metadata/ (framework-specific)
```

### Task 4: Development Environment Setup
**Scripts to Configure** (spec.md lines 349-363):
- `npm run dev` - Development build with hot reload
- `npm run build` - Production build
- `npm run lint` - Code quality checks
- Environment configuration for development

### Task 5: Chrome Extension API Foundation
**Core API Wrappers** (spec.md lines 144-165):
- Tab management utilities (`chrome.tabs.*`)
- Script execution utilities (`chrome.scripting.*`)
- Storage management utilities (`chrome.storage.*`)
- Permission handling utilities

## Dependencies & Coordination
**Dependencies**:
- Must complete before other agents can start
- Provides foundation for Blake (UI), Casey (AI), Dakota (Automation), Ellis (Security), Finley (Testing)

**Coordination Points**:
- Share manifest.json structure with all agents
- Provide Chrome API wrapper utilities
- Establish build system for other agents to use

## Security Requirements (spec.md lines 330-343)
- Ensure proper permission model (least privilege)
- Configure Content Security Policy in manifest
- Set up secure API key storage structure
- Validate all Chrome Extension API usage

## Success Criteria
- [ ] Extension loads in Chrome without manifest errors
- [ ] Build system works for development and production
- [ ] All Chrome APIs are properly wrapped and functional
- [ ] Project structure follows Chrome Extension best practices
- [ ] Framework is properly configured and ready for development
- [ ] Environment setup supports parallel development workflows

## Notes for Alex
1. **Critical**: Do NOT use Playwright or Puppeteer (spec.md lines 284-297)
2. **Security**: Never hardcode API keys (spec.md lines 295-296)
3. **Manifest V3**: Ensure full compliance with Manifest V3 requirements
4. **Framework Choice**: Make decision early and communicate to other agents
5. **Chrome APIs**: Use chrome.scripting instead of deprecated tabs.executeScript

## Files Alex Should Not Touch
- `popup/` directory (Blake's responsibility)
- `lib/openrouter-client.*` (Casey's responsibility)
- `lib/command-parser.*` (Casey's responsibility)
- `lib/browser-automation.*` (Dakota's responsibility)
- Security implementation (Ellis's responsibility)
- Test files (Finley's responsibility)
## Agent Overview
**Name**: Alex  
**Focus**: Core Chrome Extension infrastructure, manifest configuration, and project scaffolding  
**Timeline**: Days 1-3 (Foundation phase)

## Primary Responsibilities
Alex will establish the foundational Chrome Extension architecture that all other agents will build upon. This includes creating the manifest.json, setting up the build system, and establishing the core extension structure.

## Detailed Tasks

### Task 1: Project Structure & Manifest Creation
**Files to Create**:
- `manifest.json` - Chrome Extension manifest with Manifest V3
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Git ignore rules
- `README.md` - Project documentation

**Manifest Requirements** (from spec.md lines 79-85):
```json
{
  "manifest_version": 3,
  "name": "Ray - AI Browser Automation",
  "version": "1.0.0",
  "description": "AI-powered browser automation assistant",
  "permissions": ["tabs", "scripting", "storage", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_title": "Ray"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/automator.js"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Task 2: Framework Selection & Setup
**Decision Required**: Choose between Plasmo, WXT, or Vanilla+Vite (spec.md lines 44-46)
- **Recommended**: Plasmo for React development OR WXT for TypeScript-first
- **Setup**: Initialize chosen framework with proper configuration
- **Build Scripts**: Configure development and production builds

### Task 3: Directory Structure Creation
**Create directories** (spec.md lines 52-61):
```
ray-browser-extension/
├── manifest.json
├── popup/
│   ├── index.html
│   ├── styles.css
│   └── app.ts
├── background/
│   └── service-worker.ts
├── content/
│   └── automator.ts
├── lib/
│   ├── types/
│   └── utils/
├── icons/
└── _metadata/ (framework-specific)
```

### Task 4: Development Environment Setup
**Scripts to Configure** (spec.md lines 349-363):
- `npm run dev` - Development build with hot reload
- `npm run build` - Production build
- `npm run lint` - Code quality checks
- Environment configuration for development

### Task 5: Chrome Extension API Foundation
**Core API Wrappers** (spec.md lines 144-165):
- Tab management utilities (`chrome.tabs.*`)
- Script execution utilities (`chrome.scripting.*`)
- Storage management utilities (`chrome.storage.*`)
- Permission handling utilities

## Dependencies & Coordination
**Dependencies**:
- Must complete before other agents can start
- Provides foundation for Blake (UI), Casey (AI), Dakota (Automation), Ellis (Security), Finley (Testing)

**Coordination Points**:
- Share manifest.json structure with all agents
- Provide Chrome API wrapper utilities
- Establish build system for other agents to use

## Security Requirements (spec.md lines 330-343)
- Ensure proper permission model (least privilege)
- Configure Content Security Policy in manifest
- Set up secure API key storage structure
- Validate all Chrome Extension API usage

## Success Criteria
- [ ] Extension loads in Chrome without manifest errors
- [ ] Build system works for development and production
- [ ] All Chrome APIs are properly wrapped and functional
- [ ] Project structure follows Chrome Extension best practices
- [ ] Framework is properly configured and ready for development
- [ ] Environment setup supports parallel development workflows

## Notes for Alex
1. **Critical**: Do NOT use Playwright or Puppeteer (spec.md lines 284-297)
2. **Security**: Never hardcode API keys (spec.md lines 295-296)
3. **Manifest V3**: Ensure full compliance with Manifest V3 requirements
4. **Framework Choice**: Make decision early and communicate to other agents
5. **Chrome APIs**: Use chrome.scripting instead of deprecated tabs.executeScript

## Files Alex Should Not Touch
- `popup/` directory (Blake's responsibility)
- `lib/openrouter-client.*` (Casey's responsibility)
- `lib/command-parser.*` (Casey's responsibility)
- `lib/browser-automation.*` (Dakota's responsibility)
- Security implementation (Ellis's responsibility)
- Test files (Finley's responsibility)
