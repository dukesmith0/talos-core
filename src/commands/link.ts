/**
 * link — Scan a file for entity names and add [[wikilinks]]
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { readFile, writeFile, addWikilinks } from '../lib/vault.js';
import { getEntityNames } from '../lib/registry.js';

interface LinkOptions {
  file: string;
}

export async function execute(options: LinkOptions): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  const filePath = resolve(options.file);
  if (!existsSync(filePath)) {
    console.error(chalk.red(`File not found: ${filePath}`));
    process.exitCode = 1;
    return;
  }

  const entities = getEntityNames(vaultPath);
  if (entities.length === 0) {
    console.log(chalk.yellow('No entities found in link index. Run "loci index" first.'));
    return;
  }

  const vaultFile = readFile(filePath);
  const original = vaultFile.content;
  const linked = addWikilinks(original, entities);

  if (linked === original) {
    console.log(chalk.dim('No new links to add.'));
    return;
  }

  writeFile(filePath, linked, vaultFile.data);

  // Show what was linked
  const originalLinks: string[] = original.match(/\[\[([^\]]+)\]\]/g) ?? [];
  const newLinks: string[] = linked.match(/\[\[([^\]]+)\]\]/g) ?? [];
  const added = newLinks.filter(l => !originalLinks.includes(l));

  console.log(chalk.green(`Added ${added.length} wikilink(s) to ${filePath}:`));
  for (const link of added) {
    console.log(chalk.dim(`  ${link}`));
  }
}
