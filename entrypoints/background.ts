[
	{
		"ray-initialized": true,
		"ray-settings": "JSON.stringify({\n          enabled: true",
		"debugMode": false,
		"autoConfirm": false,
		"maxRetries": 3,
		"defaultTimeout": 10000
	},
	{
		"storage": ", error);\n  }\n}\n\n/**\n * Get the current active tab\n */\nasync function getCurrentTab(): Promise<any> {\n  try {\n    const [tab] = await (chrome as any).tabs.query({ active: true, currentWindow: true });\n    return tab || null;\n  } catch (error) {\n    console.error('Failed to get current tab:",
		"message": "any",
		"sender": "any",
		"sendResponse": "response: any) => void\n): Promise<void> {\n  try {\n    const tabId = message.tabId || sender.tab?.id;\n    if (!tabId) {\n      sendResponse({ success: false",
		"error": "No tab ID available"
	},
	{
		"success": true,
		"data": "tab"
	},
	{
		"success": false,
		"error": "String(error)"
	},
	{
		"success": false,
		"error": "No tab ID available"
	},
	{
		"type": "EXECUTE_COMMAND",
		"payload": "command"
	},
	{
		"success": false,
		"error": "String(error)"
	},
	{
		"{}": "const settings = JSON.parse(settingsStr);\n    sendResponse({ success: true",
		"data": "settings"
	},
	{
		"success": false,
		"error": "String(error)"
	},
	{
		"{}": "const currentSettings = JSON.parse(settingsStr);\n    const updatedSettings = { ...currentSettings",
		"ray-settings": "JSON.stringify(updatedSettings)"
	},
	{
		"success": true,
		"data": "updatedSettings"
	},
	{
		"success": false,
		"error": "String(error)"
	},
	{
		"success": false,
		"message": "No API key provided"
	},
	{
		"headers": {
			"Authorization": "Bearer ${apiKey"
		},
		"Content-Type": "application/json"
	},
	{
		"success": true,
		"message": "API key is valid"
	},
	{
		"success": false,
		"message": "errorData.error || 'Invalid API key'"
	},
	{
		"success": false,
		"message": "String(error)"
	},
	{
		"Installed": ", details.reason);\n\n  if (details.reason === 'install') {\n    await initializeStorage();\n\n    // Open welcome page on first install\n    try {\n      const tab = await (chrome as any).tabs.create({\n        url: (chrome as any).runtime.getURL(",
		"active": true
	},
	{
		"tab": ", error);\n    }\n  } else if (details.reason ===",
		"version": ", (chrome as any).runtime.getManifest().version);\n  }\n});\n\n/**\n * Handle extension startup\n */\n(chrome as any).runtime.onStartup.addListener(async () => {\n  console.log(",
		"message": "any",
		"sender": "any",
		"sendResponse": "response: any) => void) => {\n    console.log('Ray Extension - Message received:'",
		"from:', sender.tab?.id);\n\n    try {\n      switch (message.type) {\n        case 'GET_TAB_INFO": "await handleGetTabInfo(message",
		"EXECUTE_AUTOMATION": "await handleExecuteAutomation(message",
		"GET_SETTINGS": "await handleGetSettings(message",
		"UPDATE_SETTINGS": "await handleUpdateSettings(message",
		"TEST_API_KEY": "await handleTestApiKey(message",
		"default": "console.warn('Ray Extension - Unknown message type:'",
		"success": false,
		"error": "Unknown message type"
	},
	{
		"error": ", error);\n      sendResponse({ success: false, error: String(error) });\n    }\n\n    // Return true to indicate async response\n    return true;\n  }\n);\n\n/**\n * Handle browser action click (extension icon)\n */\n(chrome as any).action.onClicked.addListener(async (tab: any) => {\n  console.log(",
		"tab": "any) => {\n  if (changeInfo.status === 'complete' && tab.url) {\n    console.log('Ray Extension - Tab updated:'",
		"tabId": "any",
		"changeInfo": "any",
		"type": "TAB_UPDATED",
		"payload": {
			"url": "tab.url",
			"title": "tab.title"
		}
	},
	{
		"script": ", error);\n    }\n  }\n});"
	}
]
