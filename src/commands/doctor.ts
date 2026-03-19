/**
 * doctor — Auto-repair brain files and vault state
 */

import { existsSync, writeFileSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { checkBrainIntegrity } from '../lib/brain.js';
import { cleanStaleLocks } from '../lib/lock.js';
import { ensureDir } from '../lib/vault.js';

const OK = chalk.green('\u2713');
const FIX = chalk.yellow('\u2692');

export async function execute(): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);
  let fixes = 0;

  console.log(chalk.bold('\nTALOS Doctor\n'));

  // 1. Check and create missing brain files
  const integrity = checkBrainIntegrity(vaultPath);
  if (!integrity.ok) {
    for (const missing of integrity.missing) {
      const fullPath = join(vaultPath, missing);
      if (missing.endsWith('/')) {
        ensureDir(fullPath);
      } else {
        ensureDir(join(fullPath, '..'));
        const defaults: Record<string, string> = {
          '_brain/profile.md': '# Profile\n\n**Name:** \n**Description:** \n',
          '_brain/priorities.md': '# Priorities\n\n## Current Focus\n\n\n## Active Projects\n\n- \n',
          '_brain/schemas.yaml': 'fact:\n  required: [type, topic, confidence]\n  optional: [source]\n',
          '_brain/crash-buffer.md': '# Crash Buffer\n\nOpen threads from interrupted sessions.\n',
          '_brain/state.yaml': 'last_session: ""\nsession_count: 0\nvault_version: "1.0.0"\n',
        };
        writeFileSync(fullPath, defaults[missing] ?? '', 'utf-8');
      }
      console.log(`  ${FIX} Created ${missing}`);
      fixes++;
    }
  } else {
    console.log(`  ${OK} Brain integrity: all required files present`);
  }

  // 2. Create missing optional brain files
  const optionalFiles = ['gaps.txt', 'conflicts.md', 'access-log.txt', 'changelog.md', 'search-log.txt'];
  let optionalFixes = 0;
  for (const f of optionalFiles) {
    const p = join(vaultPath, '_brain', f);
    if (!existsSync(p)) {
      writeFileSync(p, '', 'utf-8');
      console.log(`  ${FIX} Created _brain/${f}`);
      optionalFixes++;
      fixes++;
    }
  }
  if (optionalFixes === 0) console.log(`  ${OK} All optional brain files present`);

  // 3. Ensure directories exist
  const dirs = ['_brain/pinned', '_templates', 'journal', 'projects', 'references', 'ideas', 'career/contacts', 'career/applications'];
  for (const d of dirs) {
    const p = join(vaultPath, d);
    if (!existsSync(p)) {
      ensureDir(p);
      console.log(`  ${FIX} Created ${d}/`);
      fixes++;
    }
  }

  // 4. Clean stale locks
  const staleCleaned = cleanStaleLocks();
  if (staleCleaned > 0) {
    console.log(`  ${FIX} Cleaned ${staleCleaned} stale lock(s)`);
    fixes++;
  } else {
    console.log(`  ${OK} No stale locks`);
  }

  // 5. Check .gitignore
  const gitignorePath = join(vaultPath, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `.obsidian/workspace.json\n.obsidian/workspace-mobile.json\n.trash/\n*.sqlite\n*.sqlite-journal\n.DS_Store\nThumbs.db\n`, 'utf-8');
    console.log(`  ${FIX} Created .gitignore`);
    fixes++;
  } else {
    console.log(`  ${OK} .gitignore present`);
  }

  // 6. Trim oversized logs
  for (const logFile of ['access-log.txt', 'search-log.txt']) {
    const p = join(vaultPath, '_brain', logFile);
    if (existsSync(p)) {
      const size = statSync(p).size;
      if (size > 1048576) { // > 1MB
        const lines = readFileSync(p, 'utf-8').split('\n');
        const trimmed = lines.slice(-1000).join('\n');
        writeFileSync(p, trimmed, 'utf-8');
        console.log(`  ${FIX} Trimmed ${logFile} (${Math.round(size / 1024)}KB → ${Math.round(trimmed.length / 1024)}KB)`);
        fixes++;
      }
    }
  }

  console.log(fixes > 0
    ? chalk.green(`\n${fixes} issue(s) fixed.`)
    : chalk.green('\nAll healthy. No fixes needed.')
  );
  console.log('');
}
