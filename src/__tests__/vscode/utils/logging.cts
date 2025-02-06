/**
 * Log a header message
 */
function logHeader(message: string): void {
    console.log(`\n=== ${message} ===\n`);
}

/**
 * Log a step message
 */
function logStep(message: string): void {
    console.log(`  → ${message}`);
}

/**
 * Log a success message
 */
function logSuccess(message: string): void {
    console.log(`  ✓ ${message}`);
}

/**
 * Log a warning message
 */
function logWarning(message: string): void {
    console.warn(`  ⚠ ${message}`);
}

/**
 * Log an error message
 */
function logError(message: string): void {
    console.error(`  ✕ ${message}`);
}

module.exports = {
    logHeader,
    logStep,
    logSuccess,
    logWarning,
    logError
}; 