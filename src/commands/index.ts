/**
 * index — Build link index from vault .md files
 */

import { statSync } from 'fs';
import { join, relative } from 'path';
import { globSync } from 'glob';
import chalk from 'chalk';
import { resolveConfig, getVaultPath } from '../lib/config.js';
import { readFile, extractWikilinks, extractTags } from '../lib/vault.js';
import { readLinkIndex, writeLinkIndex, type LinkIndex, type LinkEntry } from '../lib/brain.js';

interface IndexOptions {
  full?: boolean;
}

const SKIP_DIRS = ['_brain', '_templates', '.git', 'node_modules'];

export async function execute(options: IndexOptions = {}): Promise<void> {
  const config = resolveConfig();
  const vaultPath = getVaultPath(config);

  console.log(chalk.dim('Building link index...'));

  const existing = options.full ? { files: {}, tags: {}, updated: '' } : readLinkIndex(vaultPath);
  const lastUpdated = existing.updated ? new Date(existing.updated).getTime() : 0;

  // Find all .md files, skip excluded dirs
  const pattern = '**/*.md';
  const ignore = SKIP_DIRS.map(d => `${d}/**`);
  const files = globSync(pattern, { cwd: vaultPath, ignore });

  const index: LinkIndex = {
    files: {},
    tags: {},
    updated: '',
  };

  let processed = 0;
  let skipped = 0;

  for (const relPath of files) {
    const absPath = join(vaultPath, relPath);
    const normalizedPath = relPath.replace(/\\/g, '/');

    // Incremental: skip files older than last index
    if (!options.full && lastUpdated > 0) {
      try {
        const mtime = statSync(absPath).mtimeMs;
        if (mtime < lastUpdated && existing.files[normalizedPath]) {
          // Keep existing entry
          index.files[normalizedPath] = existing.files[normalizedPath];
          skipped++;
          continue;
        }
      } catch {
        continue;
      }
    }

    try {
      const vaultFile = readFile(absPath);
      const links = extractWikilinks(vaultFile.content);
      const tags = extractTags(vaultFile.content, vaultFile.data);

      index.files[normalizedPath] = {
        links_to: links,
        linked_from: [],
        tags,
      };
      processed++;
    } catch {
      // Skip unreadable files
    }
  }

  // Build filename lookup map for O(1) link resolution
  const filenameLookup = new Map<string, string>();
  for (const key of Object.keys(index.files)) {
    const baseName = key.split('/').pop()?.replace('.md', '') ?? '';
    if (baseName) filenameLookup.set(baseName.toLowerCase(), key);
    // Also map the full relative path without .md
    filenameLookup.set(key.replace('.md', '').toLowerCase(), key);
  }

  // Build reverse links (linked_from)
  for (const [filePath, entry] of Object.entries(index.files)) {
    for (const link of entry.links_to) {
      const targetKey = filenameLookup.get(link.toLowerCase());
      if (targetKey && index.files[targetKey]) {
        if (!index.files[targetKey].linked_from.includes(filePath)) {
          index.files[targetKey].linked_from.push(filePath);
        }
      }
    }
  }

  // Build tag index
  const tagIndex: Record<string, string[]> = {};
  for (const [filePath, entry] of Object.entries(index.files)) {
    for (const tag of entry.tags) {
      if (!tagIndex[tag]) tagIndex[tag] = [];
      if (!tagIndex[tag].includes(filePath)) {
        tagIndex[tag].push(filePath);
      }
    }
  }
  index.tags = tagIndex;

  writeLinkIndex(vaultPath, index);

  const totalFiles = Object.keys(index.files).length;
  const totalTags = Object.keys(index.tags).length;

  console.log(chalk.green(`Index built: ${totalFiles} files, ${totalTags} tags`));
  console.log(chalk.dim(`  Processed: ${processed}, Skipped (unchanged): ${skipped}`));

  // Re-link pass: scan all processed files for linkable entities
  if (processed > 0) {
    const { writeFileSync, readFileSync } = await import('fs');
    const { getEntityNames, clearEntityCache } = await import('../lib/registry.js');
    clearEntityCache(); // Force fresh entity list after index rebuild
    const { addWikilinks } = await import('../lib/vault.js');
    const allEntities = getEntityNames(vaultPath);
    let linked = 0;

    if (allEntities.length > 0) {
      for (const relPath of files) {
        const absPath = join(vaultPath, relPath);
        const selfName = relPath.replace(/\\/g, '/').split('/').pop()?.replace('.md', '') ?? '';
        // Filter out self-links: don't link a file to its own name
        const entities = allEntities.filter(e => e.name.toLowerCase() !== selfName.toLowerCase());
        if (entities.length === 0) continue;

        try {
          // Read raw file content (preserve original frontmatter formatting)
          const raw = readFileSync(absPath, 'utf-8');
          let withLinks = addWikilinks(raw, entities);
          // Preserve original trailing newline state
          if (!raw.endsWith('\n') && withLinks.endsWith('\n')) {
            withLinks = withLinks.replace(/\n+$/, '');
          }
          if (withLinks !== raw) {
            writeFileSync(absPath, withLinks, 'utf-8');
            linked++;
          }
        } catch {
          // Skip unreadable files
        }
      }
      if (linked > 0) {
        console.log(chalk.green(`  Re-linked: ${linked} files updated with new wikilinks`));
      }
    }
  }
}
