/**
 * sync — Git sync vault (pull + push)
 */

import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { sync, isRepo } from '../lib/git.js';

export async function execute(): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  if (!isRepo(vaultPath)) {
    console.error(chalk.red('Vault is not a git repository. Run "loci setup" to initialize.'));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.dim('Syncing vault...'));

  try {
    const result = await sync(vaultPath, config.git.auto_pull, config.git.auto_push);

    if (result.pulled > 0) {
      console.log(chalk.green(`  Pulled ${result.pulled} change(s)`));
    } else {
      console.log(chalk.dim('  No changes pulled'));
    }

    if (result.pushed) {
      console.log(chalk.green('  Pushed local changes'));
    } else {
      console.log(chalk.dim('  Nothing to push'));
    }

    console.log(chalk.green('\nSync complete.'));
  } catch (err) {
    console.error(chalk.red(`Sync failed: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}
