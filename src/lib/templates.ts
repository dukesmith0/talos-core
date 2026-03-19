/**
 * Template Resolution — vault _templates/ overrides CLI defaults
 */

import { readFileSync, existsSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { ensureDir } from './vault.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Get CLI templates directory (relative to package root). */
function getCliTemplatesDir(): string {
  // dist/lib/templates.js -> ../../templates/
  return join(__dirname, '..', '..', 'templates');
}

export interface TemplateEntry {
  template: string;
  destination: string;
}

export interface TemplateGroup {
  description: string;
  files: TemplateEntry[];
}

/** Read template index from vault (user overrides) or CLI defaults. */
export function readTemplateIndex(vaultPath: string): Record<string, TemplateGroup> {
  const vaultIndex = join(vaultPath, '_templates', 'index.yaml');
  if (existsSync(vaultIndex)) {
    return yaml.load(readFileSync(vaultIndex, 'utf-8')) as Record<string, TemplateGroup>;
  }
  const cliIndex = join(getCliTemplatesDir(), 'index.yaml');
  if (existsSync(cliIndex)) {
    return yaml.load(readFileSync(cliIndex, 'utf-8')) as Record<string, TemplateGroup>;
  }
  return {};
}

/** Resolve a template file: vault override > CLI default. */
export function resolveTemplate(vaultPath: string, groupName: string, templateName: string): string | null {
  // Check vault _templates/ first
  const vaultTemplate = join(vaultPath, '_templates', groupName, templateName);
  if (existsSync(vaultTemplate)) return readFileSync(vaultTemplate, 'utf-8');

  // Fall back to CLI templates/
  const cliTemplate = join(getCliTemplatesDir(), groupName, templateName);
  if (existsSync(cliTemplate)) return readFileSync(cliTemplate, 'utf-8');

  // Try without group
  const vaultFlat = join(vaultPath, '_templates', templateName);
  if (existsSync(vaultFlat)) return readFileSync(vaultFlat, 'utf-8');

  const cliFlat = join(getCliTemplatesDir(), templateName);
  if (existsSync(cliFlat)) return readFileSync(cliFlat, 'utf-8');

  return null;
}

/** Fill template variables: {{VAR}} -> value. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/** List available templates from both vault and CLI. */
export function listTemplates(vaultPath: string): string[] {
  const templates = new Set<string>();

  // Vault templates
  const vaultDir = join(vaultPath, '_templates');
  if (existsSync(vaultDir)) {
    for (const f of readdirSync(vaultDir, { recursive: true }) as string[]) {
      if (typeof f === 'string' && f.endsWith('.md')) templates.add(f);
    }
  }

  // CLI templates
  const cliDir = getCliTemplatesDir();
  if (existsSync(cliDir)) {
    for (const f of readdirSync(cliDir, { recursive: true }) as string[]) {
      if (typeof f === 'string' && f.endsWith('.md')) templates.add(f);
    }
  }

  return [...templates].sort();
}

/** Copy CLI default templates to vault _templates/ (skip existing). */
export function installDefaultTemplates(vaultPath: string): number {
  const cliDir = getCliTemplatesDir();
  const vaultDir = join(vaultPath, '_templates');
  let copied = 0;

  if (!existsSync(cliDir)) return 0;
  ensureDir(vaultDir);

  const files = readdirSync(cliDir, { recursive: true }) as string[];
  for (const f of files) {
    if (typeof f !== 'string') continue;
    if (f.startsWith('vault-init')) continue; // vault-init/ is for setup, not user templates
    const src = join(cliDir, f);
    if (statSync(src).isDirectory()) continue;
    const dest = join(vaultDir, f);
    if (!existsSync(dest)) {
      ensureDir(dirname(dest));
      copyFileSync(src, dest);
      copied++;
    }
  }

  return copied;
}
