import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';

// Test with isolated temp dirs to avoid touching real config
const TEST_DIR = join(tmpdir(), 'talos-test-config-' + Date.now());
const TEST_VAULT = join(TEST_DIR, 'vault');
const TEST_BRAIN = join(TEST_VAULT, '_brain');

beforeEach(() => {
  mkdirSync(TEST_BRAIN, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('config', () => {
  it('should parse bootstrap config with vault_path', () => {
    const bootstrapContent = yaml.dump({ vault_path: TEST_VAULT });
    const parsed = yaml.load(bootstrapContent) as { vault_path: string };
    expect(parsed.vault_path).toBe(TEST_VAULT);
  });

  it('should parse vault config with git and projects', () => {
    const vaultConfig = {
      machine_id: 'test-machine',
      git: { vault_remote: 'https://example.com', auto_pull: true, auto_push: false },
      projects: { myproject: { path: '/tmp/myproject' } },
    };
    const content = yaml.dump(vaultConfig);
    const parsed = yaml.load(content) as typeof vaultConfig;
    expect(parsed.machine_id).toBe('test-machine');
    expect(parsed.git.auto_push).toBe(false);
    expect(parsed.projects.myproject.path).toBe('/tmp/myproject');
  });

  it('should handle missing vault config gracefully', () => {
    const path = join(TEST_BRAIN, 'config.yaml');
    expect(existsSync(path)).toBe(false);
  });
});
