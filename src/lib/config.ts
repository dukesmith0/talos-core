/**
 * Config Resolution — split config model
 *
 * Bootstrap: ~/.loci/config.yaml contains only `vault_path`
 * Full config: $VAULT/_brain/config.yaml contains machine_id, git, projects, etc.
 * Resolution: read bootstrap -> read vault config -> merge (vault config is primary)
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import yaml from 'js-yaml';

export interface GitConfig {
  vault_remote: string;
  auto_pull: boolean;
  auto_push: boolean;
}

export interface ProjectEntry {
  path: string;
  vault_entry?: string;
}

export interface TalosConfig {
  vault_path: string;
  machine_id: string;
  default_mode: string;
  git: GitConfig;
  projects: Record<string, ProjectEntry>;
}

/** Bootstrap config — only vault_path */
interface BootstrapConfig {
  vault_path: string;
}

const BOOTSTRAP_DIR = join(homedir(), '.loci');
const BOOTSTRAP_PATH = join(BOOTSTRAP_DIR, 'config.yaml');

const DEFAULTS: TalosConfig = {
  vault_path: '',
  machine_id: '',
  default_mode: 'default',
  git: { vault_remote: '', auto_pull: true, auto_push: true },
  projects: {},
};

/** Read the bootstrap file (~/.loci/config.yaml) to get vault_path */
function loadBootstrap(): BootstrapConfig | null {
  if (!existsSync(BOOTSTRAP_PATH)) return null;
  const raw = readFileSync(BOOTSTRAP_PATH, 'utf-8');
  const parsed = yaml.load(raw) as Partial<BootstrapConfig> | null;
  if (!parsed?.vault_path) return null;
  return { vault_path: parsed.vault_path };
}

/** Read the vault config ($VAULT/_brain/config.yaml) */
function loadVaultConfig(vaultPath: string): Partial<TalosConfig> | null {
  const vaultConfigPath = join(vaultPath, '_brain', 'config.yaml');
  if (!existsSync(vaultConfigPath)) return null;
  const raw = readFileSync(vaultConfigPath, 'utf-8');
  return (yaml.load(raw) as Partial<TalosConfig>) ?? null;
}

/**
 * Load merged config: bootstrap vault_path + vault _brain/config.yaml
 * Falls back to legacy single-file config for backward compatibility.
 */
export function loadConfig(): TalosConfig | null {
  const bootstrap = loadBootstrap();
  if (!bootstrap) return null;

  const vaultConfig = loadVaultConfig(bootstrap.vault_path);

  // Merge: vault_path from bootstrap, everything else from vault config (with defaults)
  const merged = vaultConfig ?? {};
  return {
    ...DEFAULTS,
    ...merged,
    vault_path: bootstrap.vault_path,
    git: { ...DEFAULTS.git, ...(merged.git ?? {}) },
    projects: merged.projects ?? {},
  };
}

export function resolveConfig(): TalosConfig {
  const config = loadConfig();
  if (!config) throw new Error('No LOCI configuration found. Run "loci setup" to get started.');
  return config;
}

export function getVaultPath(config?: TalosConfig): string {
  const cfg = config ?? resolveConfig();
  if (!cfg.vault_path) throw new Error('vault_path not configured. Run "loci setup".');
  return cfg.vault_path;
}

/**
 * Save split config:
 * - ~/.loci/config.yaml: only vault_path (bootstrap pointer)
 * - $VAULT/_brain/config.yaml: everything else (machine_id, git, projects, etc.)
 */
export function saveConfig(config: TalosConfig): void {
  // Save bootstrap pointer
  if (!existsSync(BOOTSTRAP_DIR)) mkdirSync(BOOTSTRAP_DIR, { recursive: true });
  const bootstrapData = { vault_path: config.vault_path };
  writeFileSync(BOOTSTRAP_PATH, yaml.dump(bootstrapData, { lineWidth: 120, noRefs: true }), 'utf-8');

  // Save vault config (everything except vault_path)
  if (config.vault_path) {
    const brainDir = join(config.vault_path, '_brain');
    if (!existsSync(brainDir)) mkdirSync(brainDir, { recursive: true });
    const vaultConfigPath = join(brainDir, 'config.yaml');
    const { vault_path: _, ...vaultData } = config;
    writeFileSync(vaultConfigPath, yaml.dump(vaultData, { lineWidth: 120, noRefs: true }), 'utf-8');
  }
}

export function hasConfig(): boolean {
  return existsSync(BOOTSTRAP_PATH);
}

export function getConfigDir(): string { return BOOTSTRAP_DIR; }
export function getConfigPath(): string { return BOOTSTRAP_PATH; }

/** Path to the vault config file */
export function getVaultConfigPath(vaultPath: string): string {
  return join(vaultPath, '_brain', 'config.yaml');
}
