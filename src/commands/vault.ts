/**
 * vault — Print vault path
 */

import { resolveConfig } from '../lib/config.js';
import chalk from 'chalk';

interface VaultOptions {
  json?: boolean;
}

export async function execute(options: VaultOptions = {}): Promise<void> {
  const config = resolveConfig();
  const vaultPath = config.vault_path;

  if (!vaultPath) {
    console.error(chalk.red('No vault path configured. Run "loci setup" first.'));
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ vault_path: vaultPath }));
  } else {
    console.log(chalk.bold('Vault path:'), vaultPath);
  }
}
