/**
 * Test logging utilities for formatted console output
 */

export function logHeader(message: string): void {
    console.log(`\n=== ${message} ===\n`);
}

export function logStep(message: string): void {
    console.log(`  → ${message}`);
}

export function logSuccess(message: string): void {
    console.log(`  ✓ ${message}`);
}

export function logWarning(message: string): void {
    console.log(`  ⚠ ${message}`);
}

export function logError(message: string): void {
    console.error(`  ✗ ${message}`);
} 