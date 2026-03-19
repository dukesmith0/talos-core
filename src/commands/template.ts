/**
 * template — Manage vault templates (list, show, reset)
 */

import { join, dirname } from 'path';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { listTemplates, resolveTemplate } from '../lib/templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getCliTemplatesDir(): string {
  return join(__dirname, '..', '..', 'templates');
}

interface TemplateOptions {
  subcommand: string;
  name?: string;
}

export async function execute(options: TemplateOptions): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  switch (options.subcommand) {
    case 'list':
      listCmd(vaultPath);
      break;
    case 'show':
      showCmd(vaultPath, options.name);
      break;
    case 'reset':
      resetCmd(vaultPath, options.name);
      break;
    default:
      console.error(chalk.red(`Unknown sub-command: ${options.subcommand}`));
      console.log(chalk.dim('Usage: loci template <list|show|reset> [name]'));
      process.exitCode = 1;
  }
}

function listCmd(vaultPath: string): void {
  const templates = listTemplates(vaultPath);
  if (templates.length === 0) {
    console.log(chalk.yellow('No templates found.'));
    return;
  }

  console.log(chalk.bold('Available templates:\n'));
  for (const t of templates) {
    console.log(chalk.dim('  ') + t);
  }
  console.log('');
}

function showCmd(vaultPath: string, name?: string): void {
  if (!name) {
    console.error(chalk.red('Template name required. Usage: loci template show <name>'));
    process.exitCode = 1;
    return;
  }

  // Try to resolve with and without group prefix
  const parts = name.split('/');
  let content: string | null = null;

  if (parts.length >= 2) {
    content = resolveTemplate(vaultPath, parts[0], parts.slice(1).join('/'));
  }
  if (!content) {
    content = resolveTemplate(vaultPath, '', name);
  }

  if (!content) {
    console.error(chalk.red(`Template not found: ${name}`));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.bold(`Template: ${name}\n`));
  console.log(content);
}

function resetCmd(vaultPath: string, name?: string): void {
  if (!name) {
    console.error(chalk.red('Template name required. Usage: loci template reset <name>'));
    process.exitCode = 1;
    return;
  }

  const cliDir = getCliTemplatesDir();
  const cliPath = join(cliDir, name);
  if (!existsSync(cliPath)) {
    console.error(chalk.red(`No CLI default found for: ${name}`));
    process.exitCode = 1;
    return;
  }

  const vaultTemplatePath = join(vaultPath, '_templates', name);
  const dir = dirname(vaultTemplatePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  copyFileSync(cliPath, vaultTemplatePath);
  console.log(chalk.green(`Reset template: ${name}`));
}
