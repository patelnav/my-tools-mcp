const ERROR_MESSAGES = {
    SERVER_START_TIMEOUT: 'Server failed to start within the timeout period',
    EXTENSION_NOT_FOUND: 'Extension not found',
    WEBVIEW_NOT_FOUND: 'WebView panel not found'
} as const;

const TIMEOUTS = {
    SERVER_START: 10000,  // 10 seconds
    TOOL_DISCOVERY: 5000, // 5 seconds
    COMMAND_EXECUTION: 30000 // 30 seconds
} as const;

module.exports = {
    ERROR_MESSAGES,
    TIMEOUTS
}; 