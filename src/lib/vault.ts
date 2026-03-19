/**
 * Vault File Operations — read, write, frontmatter, wikilinks, daily notes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import matter from 'gray-matter';

export interface VaultFile {
  path: string;
  content: string;
  data: Record<string, unknown>;
}

export function readFile(filePath: string): VaultFile {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { path: filePath, content, data };
}

export function writeFile(filePath: string, content: string, frontmatter?: Record<string, unknown>): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (frontmatter && Object.keys(frontmatter).length > 0) {
    writeFileSync(filePath, matter.stringify(content, frontmatter), 'utf-8');
  } else {
    writeFileSync(filePath, content, 'utf-8');
  }
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/** Extract [[wikilinks]] from text, return unique names. */
export function extractWikilinks(text: string): string[] {
  const matches = text.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/, '$1')))];
}

/** Extract #tags from text (frontmatter tags + inline). */
export function extractTags(text: string, frontmatter?: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  // Frontmatter tags
  if (frontmatter?.tags && Array.isArray(frontmatter.tags)) {
    for (const t of frontmatter.tags) tags.add(String(t).toLowerCase());
  }
  // Inline #tags (not inside code blocks)
  const inCode = new Set<number>();
  const codeBlocks = text.matchAll(/```[\s\S]*?```/g);
  for (const m of codeBlocks) {
    for (let i = m.index!; i < m.index! + m[0].length; i++) inCode.add(i);
  }
  const tagMatches = text.matchAll(/#([a-zA-Z][a-zA-Z0-9_-]*)/g);
  for (const m of tagMatches) {
    if (!inCode.has(m.index!)) tags.add(m[1].toLowerCase());
  }
  return [...tags];
}

/** Add [[wikilinks]] for entity names found in text. Returns modified text. */
export function addWikilinks(text: string, entities: Array<{ name: string; aliases: string[] }>): string {
  // Split into zones: frontmatter, code blocks (skip), and normal text (link)
  const lines = text.split('\n');
  let inFrontmatter = false;
  let inCodeBlock = false;
  let frontmatterDone = false;
  const zones: Array<{ text: string; skip: boolean }> = [];
  let currentZone = '';
  let currentSkip = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLine = i === 0;

    // Frontmatter detection
    if (isFirstLine && line.trim() === '---') {
      inFrontmatter = true;
      if (currentZone) zones.push({ text: currentZone, skip: currentSkip });
      currentZone = line + '\n';
      currentSkip = true;
      continue;
    }
    if (inFrontmatter && line.trim() === '---') {
      currentZone += line + '\n';
      zones.push({ text: currentZone, skip: true });
      currentZone = '';
      currentSkip = false;
      inFrontmatter = false;
      frontmatterDone = true;
      continue;
    }

    // Code block detection
    if (!inFrontmatter && line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        // Entering code block
        if (currentZone) zones.push({ text: currentZone, skip: currentSkip });
        currentZone = line + '\n';
        currentSkip = true;
        inCodeBlock = true;
      } else {
        // Exiting code block
        currentZone += line + '\n';
        zones.push({ text: currentZone, skip: true });
        currentZone = '';
        currentSkip = false;
        inCodeBlock = false;
      }
      continue;
    }

    // Heading detection — skip lines starting with #
    if (!inFrontmatter && !inCodeBlock && /^#{1,6}\s/.test(line)) {
      if (currentZone) zones.push({ text: currentZone, skip: currentSkip });
      zones.push({ text: line + '\n', skip: true });
      currentZone = '';
      currentSkip = false;
      continue;
    }

    currentZone += line + '\n';
  }
  if (currentZone) zones.push({ text: currentZone, skip: currentSkip });

  // Apply wikilinks only to non-skip zones
  const result = zones.map(zone => {
    if (zone.skip) return zone.text;
    let modified = zone.text;
    for (const entity of entities) {
      const names = [entity.name, ...entity.aliases];
      for (const name of names) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match whole words only: not preceded/followed by [, ], or -
        const regex = new RegExp(`(?<![-\\[])\\b(${escaped})\\b(?![-\\]])`, 'i');
        modified = modified.replace(regex, `[[${entity.name}|$1]]`);
      }
    }
    return modified;
  }).join('');

  // Remove trailing newline that was added by split/join
  return result.endsWith('\n') && !text.endsWith('\n') ? result.slice(0, -1) : result;
}

/**
 * Write a vault file with automatic wikilink insertion.
 * Requires vaultPath to resolve entities — use this for vault content writes.
 * Falls back to regular writeFile if entity resolution fails.
 */
export async function writeFileLinked(
  filePath: string,
  content: string,
  vaultPath: string,
  frontmatter?: Record<string, unknown>
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency (registry → brain → vault)
    const { getEntityNames } = await import('./registry.js');
    const entities = getEntityNames(vaultPath);
    if (entities.length > 0) {
      content = addWikilinks(content, entities);
    }
  } catch {
    // If registry not available, write without linking
  }
  writeFile(filePath, content, frontmatter);
}

/** Get daily note path for a date. */
export function getDailyNotePath(vaultPath: string, date?: Date): string {
  const d = date ?? new Date();
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return join(vaultPath, 'journal', yyyy, mm, `${yyyy}-${mm}-${dd}.md`);
}

/** Append a timestamped entry to today's daily note auto-log section. */
export function appendAutoLog(message: string, vaultPath: string): void {
  const notePath = getDailyNotePath(vaultPath);
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const entry = `- ${hh}:${min} | ${message}\n`;

  if (!existsSync(notePath)) {
    const yyyy = now.getFullYear();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    writeFile(notePath, `\n## Auto-Log\n\n${entry}`, {
      type: 'episode',
      date: `${yyyy}-${mm}-${dd}`,
    });
    return;
  }

  let content = readFileSync(notePath, 'utf-8');
  const autoLogIndex = content.indexOf('## Auto-Log');
  if (autoLogIndex !== -1) {
    // Insert entry right after the "## Auto-Log\n" header line
    const insertPos = content.indexOf('\n', autoLogIndex) + 1;
    content = content.slice(0, insertPos) + entry + content.slice(insertPos);
  } else {
    content += `\n## Auto-Log\n\n${entry}`;
  }
  writeFileSync(notePath, content, 'utf-8');
}
