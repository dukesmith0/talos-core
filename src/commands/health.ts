/**
 * health — System health checks
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { resolveConfig, hasConfig } from '../lib/config.js';
import { checkBrainIntegrity, getFileFreshness } from '../lib/brain.js';
import { cleanStaleLocks, isLocked } from '../lib/lock.js';
import { isQmdAvailable, checkQmdAvailable, getStatus } from '../lib/qmd.js';
import { isRepo } from '../lib/git.js';

const OK = chalk.green('\u2713');
const WARN = chalk.yellow('\u26A0');
const FAIL = chalk.red('\u2717');

function check(label: string, ok: boolean, detail?: string): void {
  const icon = ok ? OK : FAIL;
  const msg = detail ? `${label} ${chalk.dim(`(${detail})`)}` : label;
  console.log(`  ${icon} ${msg}`);
}

function warn(label: string, detail?: string): void {
  const msg = detail ? `${label} ${chalk.dim(`(${detail})`)}` : label;
  console.log(`  ${WARN} ${msg}`);
}

export async function execute(): Promise<void> {
  console.log(chalk.bold('\nTALOS Health Check\n'));

  // Node.js
  const nodeVersion = process.version;
  check('Node.js', true, nodeVersion);

  // Git
  let gitOk = false;
  let gitVersion = '';
  try {
    gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
    gitOk = true;
  } catch { /* not found */ }
  check('Git', gitOk, gitOk ? gitVersion : 'not found');

  // QMD SDK
  const qmdAvail = await checkQmdAvailable();
  check('QMD SDK', qmdAvail, qmdAvail ? 'available' : 'not installed');

  // Config
  const configExists = hasConfig();
  check('Config', configExists, configExists ? 'found' : 'missing — run "talos setup"');
  if (!configExists) {
    console.log(chalk.red('\nCannot continue health checks without config.\n'));
    process.exitCode = 1;
    return;
  }

  const config = resolveConfig();
  const vaultPath = config.vault_path;

  // Vault path
  const vaultExists = vaultPath && existsSync(vaultPath);
  check('Vault path', !!vaultExists, vaultPath || 'not set');

  if (!vaultExists) {
    console.log(chalk.red('\nCannot continue health checks without vault.\n'));
    process.exitCode = 1;
    return;
  }

  // Git repo in vault
  const gitRepo = isRepo(vaultPath);
  check('Vault git repo', gitRepo, gitRepo ? 'initialized' : 'not a git repo');

  // _brain/ integrity
  const integrity = checkBrainIntegrity(vaultPath);
  if (integrity.ok) {
    check('Brain integrity', true, 'all required files present');
  } else {
    check('Brain integrity', false, `missing: ${integrity.missing.join(', ')}`);
  }

  // Link index freshness
  const linkIndexPath = join(vaultPath, '_brain', 'link-index.yaml');
  const linkFresh = getFileFreshness(linkIndexPath);
  if (linkFresh.exists) {
    const hours = Math.floor(linkFresh.ageMinutes / 60);
    if (linkFresh.ageMinutes > 1440) {
      warn('Link index', `${hours}h old — consider running "talos update"`);
    } else {
      check('Link index', true, `${linkFresh.ageMinutes < 60 ? linkFresh.ageMinutes + 'm' : hours + 'h'} old`);
    }
  } else {
    warn('Link index', 'not found — run "talos update"');
  }

  // Word freq freshness
  const wordFreqPath = join(vaultPath, '_brain', 'word-freq.txt');
  const wordFresh = getFileFreshness(wordFreqPath);
  if (wordFresh.exists) {
    const hours = Math.floor(wordFresh.ageMinutes / 60);
    if (wordFresh.ageMinutes > 1440) {
      warn('Word frequency', `${hours}h old — consider running "talos update"`);
    } else {
      check('Word frequency', true, `${wordFresh.ageMinutes < 60 ? wordFresh.ageMinutes + 'm' : hours + 'h'} old`);
    }
  } else {
    warn('Word frequency', 'not found — run "talos update"');
  }

  // QMD status
  if (qmdAvail) {
    try {
      const status = await getStatus();
      check('QMD index', true, `${status.totalDocs} docs, ${status.pendingEmbedding} pending embeddings`);
    } catch (err) {
      warn('QMD index', `error: ${(err as Error).message}`);
    }
  }

  // Stale locks
  const staleCleaned = cleanStaleLocks();
  if (staleCleaned > 0) {
    warn('Stale locks', `cleaned ${staleCleaned} stale lock(s)`);
  } else {
    const embedLocked = isLocked('embed');
    const sessionLocked = isLocked('session');
    if (embedLocked || sessionLocked) {
      warn('Locks', `active: ${[embedLocked && 'embed', sessionLocked && 'session'].filter(Boolean).join(', ')}`);
    } else {
      check('Locks', true, 'none active');
    }
  }

  // Conflicts
  const conflictsPath = join(vaultPath, '_brain', 'conflicts.md');
  if (existsSync(conflictsPath)) {
    const size = statSync(conflictsPath).size;
    if (size > 100) {
      warn('Conflicts', `${size} bytes — review _brain/conflicts.md`);
    } else {
      check('Conflicts', true, 'none');
    }
  } else {
    check('Conflicts', true, 'none');
  }

  // Knowledge gaps
  const gapsPath = join(vaultPath, '_brain', 'gaps.txt');
  if (existsSync(gapsPath)) {
    const lines = readFileSync(gapsPath, 'utf-8').split('\n').filter(l => l.trim());
    check('Knowledge gaps', true, `${lines.length} recorded`);
  } else {
    check('Knowledge gaps', true, 'none');
  }

  console.log('');
}
