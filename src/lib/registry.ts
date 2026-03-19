/**
 * Entity Registry — reads entities from link-index.yaml + vault frontmatter
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { readLinkIndex } from './brain.js';

export interface Entity {
  name: string;
  file: string;
  aliases: string[];
  tags: string[];
}

// Cache to avoid re-reading vault files on repeated calls within same process
let _entityCache: { vaultPath: string; entities: Entity[] } | null = null;

/**
 * Extract ALL vault files as linkable entities.
 * Every .md file is linkable (threshold: 0).
 * Reads frontmatter `aliases` field for alternate names.
 */
export function getEntities(vaultPath: string): Entity[] {
  if (_entityCache?.vaultPath === vaultPath) return _entityCache.entities;

  const index = readLinkIndex(vaultPath);
  const entities: Entity[] = [];
  const seen = new Set<string>();

  // First: all files in the link-index
  for (const [filePath, entry] of Object.entries(index.files)) {
    const name = filePath.split('/').pop()?.replace('.md', '') ?? filePath;
    const aliases = readAliases(vaultPath, filePath);
    entities.push({ name, file: filePath, aliases, tags: entry.tags });
    seen.add(filePath);
  }

  // Second: scan vault for .md files NOT yet in index (new files)
  const vaultFiles = globSync('**/*.md', {
    cwd: vaultPath,
    ignore: ['_brain/**', '_templates/**', '.git/**', 'node_modules/**'],
  });

  for (const relPath of vaultFiles) {
    const normalized = relPath.replace(/\\/g, '/');
    if (seen.has(normalized)) continue;
    const name = normalized.split('/').pop()?.replace('.md', '') ?? normalized;
    const aliases = readAliases(vaultPath, normalized);
    entities.push({ name, file: normalized, aliases, tags: [] });
  }

  _entityCache = { vaultPath, entities };
  return entities;
}

/** Clear entity cache (call after index rebuild). */
export function clearEntityCache(): void {
  _entityCache = null;
}

/** Read aliases from a vault file's frontmatter. */
function readAliases(vaultPath: string, relPath: string): string[] {
  try {
    const absPath = join(vaultPath, relPath);
    if (!existsSync(absPath)) return [];
    const raw = readFileSync(absPath, 'utf-8');
    const { data } = matter(raw);
    if (Array.isArray(data.aliases)) return data.aliases.map(String);
    return [];
  } catch {
    return [];
  }
}

/** Find an entity by name (case-insensitive). */
export function findEntity(name: string, vaultPath: string): Entity | null {
  const entities = getEntities(vaultPath);
  const lower = name.toLowerCase();
  return entities.find(e =>
    e.name.toLowerCase() === lower ||
    e.aliases.some(a => a.toLowerCase() === lower)
  ) ?? null;
}

/**
 * Get all entity names and aliases for wikilink scanning.
 * Uses filenames + frontmatter aliases only (no tag-based linking to avoid false positives).
 */
export function getEntityNames(vaultPath: string): Array<{ name: string; aliases: string[] }> {
  return getEntities(vaultPath).map(e => ({ name: e.name, aliases: e.aliases }));
}
