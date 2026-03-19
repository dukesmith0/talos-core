/**
 * update — Orchestrate full vault update: QMD + link index + word frequency
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { acquireLock, releaseLock, isLocked } from '../lib/lock.js';
import { updateIndex, embedPending, registerCleanup } from '../lib/qmd.js';
import { execute as runIndex } from './index.js';
import { execute as runWordfreq } from './wordfreq.js';

interface UpdateOptions {
  background?: boolean;
}

export async function execute(options: UpdateOptions = {}): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  if (options.background) {
    // Fork a detached child process that runs talos update (without --background)
    const cliPath = fileURLToPath(new URL('../cli.js', import.meta.url));
    const child = spawn(process.execPath, [cliPath, 'update'], {
      detached: true,
      stdio: 'ignore',
      cwd: vaultPath,
    });
    child.unref();
    console.log(chalk.dim(`Background update started (pid: ${child.pid})`));
    return;
  }

  // Check / acquire lock
  if (isLocked('embed')) {
    console.error(chalk.red('Another update is already running (embed.lock held).'));
    process.exitCode = 1;
    return;
  }

  const acquired = acquireLock('embed', 'updating');
  if (!acquired) {
    console.error(chalk.red('Could not acquire embed lock.'));
    process.exitCode = 1;
    return;
  }

  registerCleanup();

  try {
    console.log(chalk.bold('\nTALOS Update\n'));

    // Step 1: QMD update index
    console.log(chalk.dim('Updating QMD index...'));
    try {
      const updateResult = await updateIndex();
      console.log(chalk.green(`  QMD index updated: ${updateResult.indexed ?? 0} indexed, ${updateResult.updated ?? 0} updated, ${updateResult.removed ?? 0} removed`));
    } catch (err) {
      console.log(chalk.yellow(`  QMD index: ${(err as Error).message}`));
    }

    // Step 2: QMD embed pending
    console.log(chalk.dim('Embedding pending documents...'));
    try {
      const embedResult = await embedPending((progress) => {
        process.stdout.write(chalk.dim(`\r  Embedding: ${progress.chunksEmbedded ?? 0} chunks`));
      });
      console.log(chalk.green(`\n  Embedded: ${embedResult.chunksEmbedded ?? 0} chunks (${embedResult.docsProcessed ?? 0} docs)`));
    } catch (err) {
      console.log(chalk.yellow(`  Embedding: ${(err as Error).message}`));
    }

    // Step 3: Build link index
    await runIndex();

    // Step 4: Build word frequency
    await runWordfreq();

    console.log(chalk.green(chalk.bold('\nUpdate complete.\n')));
  } catch (err) {
    console.error(chalk.red(`Update failed: ${(err as Error).message}`));
    process.exitCode = 1;
  } finally {
    releaseLock('embed');
  }
}
