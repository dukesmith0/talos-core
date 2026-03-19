/**
 * TALOS Core CLI — 12 commands for brain service operations
 */

import { Command } from 'commander';
import { registerCleanup } from './lib/qmd.js';

const program = new Command();

program
  .name('talos')
  .description('TALOS — The Automaton for Local Operations and Search')
  .version('1.0.0');

// Register QMD cleanup on exit
registerCleanup();

// ── Brain Service Commands ────────────────────────────────────────

program
  .command('setup')
  .description('First-run onboarding: create vault, config, QMD index')
  .option('--force', 'Overwrite system files (never user data)')
  .action(async () => {
    const { execute } = await import('./commands/setup.js');
    await execute();
  });

program
  .command('health')
  .description('Check dependencies, vault integrity, brain status')
  .action(async () => {
    const { execute } = await import('./commands/health.js');
    await execute();
  });

program
  .command('update')
  .description('Reindex + embed + rebuild link-index + word-freq')
  .option('--background', 'Run in background (non-blocking)')
  .action(async (opts) => {
    const { execute } = await import('./commands/update.js');
    await execute(opts);
  });

program
  .command('sync')
  .description('Git pull + push vault')
  .action(async () => {
    const { execute } = await import('./commands/sync.js');
    await execute();
  });

program
  .command('vault')
  .description('Print vault path')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    const { execute } = await import('./commands/vault.js');
    await execute(opts);
  });

program
  .command('link <file>')
  .description('Scan file for entities, add [[wikilinks]]')
  .action(async (file) => {
    const { execute } = await import('./commands/link.js');
    await execute({ file });
  });

program
  .command('index')
  .description('Build link graph + tag index → _brain/link-index.yaml')
  .option('--full', 'Full rebuild (ignore incremental cache)')
  .action(async (options: { full?: boolean }) => {
    const { execute } = await import('./commands/index.js');
    await execute({ full: options.full });
  });

program
  .command('wordfreq')
  .description('Build term frequency → _brain/word-freq.txt')
  .action(async () => {
    const { execute } = await import('./commands/wordfreq.js');
    await execute();
  });

program
  .command('log <message>')
  .description('Append timestamped entry to today\'s daily note')
  .action(async (message) => {
    const { execute } = await import('./commands/log.js');
    await execute({ message });
  });

program
  .command('template [action] [name]')
  .description('Manage templates: list, show <name>, reset <name>')
  .action(async (action, name) => {
    const { execute } = await import('./commands/template.js');
    await execute({ subcommand: action ?? 'list', name });
  });

program
  .command('search <query>')
  .description('Search vault via QMD (modes: hybrid, lex, vec)')
  .option('-m, --mode <mode>', 'Search mode: hybrid (default), lex, vec')
  .option('-n, --limit <n>', 'Max results (default: 10)')
  .action(async (query, opts) => {
    const { execute } = await import('./commands/search.js');
    await execute({ query, mode: opts.mode, limit: opts.limit });
  });

program
  .command('doctor')
  .description('Auto-repair brain files, clean stale locks, trim logs')
  .action(async () => {
    const { execute } = await import('./commands/doctor.js');
    await execute();
  });

program.parse();
