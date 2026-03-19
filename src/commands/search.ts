/**
 * search — Search vault via QMD from the command line
 */

import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { search, vsearch, query, registerCleanup } from '../lib/qmd.js';
import { logGap } from '../lib/brain.js';

interface SearchOptions {
  query: string;
  mode?: string;
  limit?: string;
}

export async function execute(options: SearchOptions): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);
  const limit = parseInt(options.limit ?? '10') || 10;
  const mode = options.mode ?? 'hybrid';

  registerCleanup();

  console.log(chalk.dim(`Searching vault (${mode})...\n`));

  try {
    let results: Array<{ path?: string; file?: string; score?: number; content?: string }>;

    switch (mode) {
      case 'lex':
      case 'bm25':
        results = await search(options.query, limit);
        break;
      case 'vec':
      case 'vector':
        results = await vsearch(options.query, limit);
        break;
      default:
        results = await query(options.query, limit);
        break;
    }

    if (results.length === 0) {
      console.log(chalk.yellow('No results found.'));
      console.log(chalk.dim('This query has been logged to _brain/gaps.txt'));
      logGap(vaultPath, options.query);
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const file = (r as Record<string, unknown>).filepath ?? (r as Record<string, unknown>).displayPath ?? (r as Record<string, unknown>).path ?? 'unknown';
      const score = (r as Record<string, unknown>).score;
      const scoreStr = typeof score === 'number' ? chalk.dim(` (${score.toFixed(3)})`) : '';
      console.log(`  ${chalk.bold(`${i + 1}.`)} ${file}${scoreStr}`);
    }

    console.log(chalk.dim(`\n${results.length} result(s)`));
  } catch (err) {
    console.error(chalk.red(`Search failed: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}
