import { describe, it, expect } from 'vitest';
import { getTestMonorepoPath } from '@test/shared/workspace';
import { scanWorkspaceTools } from '@utils/workspace';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logHeader, logStep, logSuccess } from '@utils/logging';

describe('Tool Discovery', () => {
  it('should discover tools in workspace bin directory', async () => {
    logHeader('Testing workspace bin directory tool discovery');
    const tools = await scanWorkspaceTools(getTestMonorepoPath());
    
    logStep('Verifying workspace bin tools');
    const binTools = Array.from(tools.values()).filter(t => t.type === 'workspace-bin');
    expect(binTools.length).toBeGreaterThan(0);
    expect(binTools[0].location).toContain('bin/');
    logSuccess('Found workspace bin tools');
  });

  it('should discover tools in node_modules/.bin', async () => {
    logHeader('Testing node_modules/.bin tool discovery');
    const tools = await scanWorkspaceTools(getTestMonorepoPath());
    
    logStep('Checking all discovered tools');
    const allTools = Array.from(tools.entries()).map(([name, tool]) => ({
      name,
      type: tool.type,
      location: tool.location
    }));
    console.log('All discovered tools:', allTools);
    
    logStep('Verifying package binaries');
    const pkgBins = Array.from(tools.values()).filter(t => t.type === 'package-bin');
    console.log('Package binaries:', pkgBins);
    
    expect(pkgBins.length).toBeGreaterThan(0);
    expect(pkgBins.some(t => t.name === 'vite')).toBe(true);
    expect(pkgBins.some(t => t.name === 'vitest')).toBe(true);
    logSuccess('Found expected package binaries');
  });

  it('should discover npm scripts from package.json', async () => {
    logHeader('Testing package.json script discovery');
    const tools = await scanWorkspaceTools(getTestMonorepoPath());
    
    logStep('Verifying npm scripts');
    const npmScripts = Array.from(tools.values()).filter(t => t.type === 'npm-script');
    expect(npmScripts.length).toBeGreaterThan(0);
    expect(npmScripts.some(t => t.name === 'npm:build')).toBe(true);
    expect(npmScripts.some(t => t.name === 'npm:test')).toBe(true);
    expect(npmScripts.some(t => t.name === 'npm:start')).toBe(true);
    logSuccess('Found expected npm scripts');
  });

  it('should handle invalid workspace path', async () => {
    logHeader('Testing invalid workspace path handling');
    const invalidPath = path.join(os.tmpdir(), 'nonexistent-workspace');
    await expect(async () => {
      await scanWorkspaceTools(invalidPath);
    }).rejects.toThrow('Invalid workspace path');
    logSuccess('Invalid path handled correctly');
  });

  it('should handle empty workspace', async () => {
    logHeader('Testing empty workspace handling');
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-workspace-'));
    try {
      logStep('Scanning empty workspace');
      const tools = await scanWorkspaceTools(emptyDir);
      
      logStep('Verifying global tools');
      const globalTools = Array.from(tools.values()).filter(t => t.type === 'global-bin');
      expect(globalTools.length).toBe(5);
      expect(globalTools.some(t => t.name === 'git')).toBe(true);
      expect(globalTools.some(t => t.name === 'node')).toBe(true);
      expect(globalTools.some(t => t.name === 'npm')).toBe(true);
      expect(globalTools.some(t => t.name === 'yarn')).toBe(true);
      expect(globalTools.some(t => t.name === 'pnpm')).toBe(true);
      logSuccess('Found expected global tools');
    } finally {
      await fs.rm(emptyDir, { recursive: true });
    }
  });

  it('should discover global tools', async () => {
    logHeader('Testing global tool discovery');
    const tools = await scanWorkspaceTools(getTestMonorepoPath());
    
    logStep('Verifying global tools');
    const globalTools = Array.from(tools.values()).filter(t => t.type === 'global-bin');
    expect(globalTools.length).toBe(3);
    expect(globalTools.some(t => t.name === 'npm')).toBe(true);
    expect(globalTools.some(t => t.name === 'yarn')).toBe(true);
    expect(globalTools.some(t => t.name === 'pnpm')).toBe(true);
    logSuccess('Found expected global tools');
  });
}); 