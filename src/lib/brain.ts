/**
 * Brain File Management — read/write _brain/ infrastructure files
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, statSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { ensureDir } from './vault.js';

// ── Link Index ────────────────────────────────────────────────────

export interface LinkEntry {
  links_to: string[];
  linked_from: string[];
  tags: string[];
}

export interface LinkIndex {
  files: Record<string, LinkEntry>;
  tags: Record<string, string[]>;
  updated: string;
}

export function readLinkIndex(vaultPath: string): LinkIndex {
  const path = join(vaultPath, '_brain', 'link-index.yaml');
  if (!existsSync(path)) return { files: {}, tags: {}, updated: '' };
  return yaml.load(readFileSync(path, 'utf-8')) as LinkIndex;
}

export function writeLinkIndex(vaultPath: string, index: LinkIndex): void {
  index.updated = new Date().toISOString();
  const path = join(vaultPath, '_brain', 'link-index.yaml');
  writeFileSync(path, yaml.dump(index, { lineWidth: 200, noRefs: true }), 'utf-8');
}

// ── Word Frequency ────────────────────────────────────────────────

export interface WordEntry {
  word: string;
  doc_count: number;
  total_count: number;
}

export function readWordFreq(vaultPath: string): WordEntry[] {
  const path = join(vaultPath, '_brain', 'word-freq.txt');
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(l => l && !l.startsWith('#'));
  return lines.map(l => {
    const [word, doc_count, total_count] = l.split('\t');
    return { word, doc_count: parseInt(doc_count) || 0, total_count: parseInt(total_count) || 0 };
  });
}

export function writeWordFreq(vaultPath: string, entries: WordEntry[]): void {
  const path = join(vaultPath, '_brain', 'word-freq.txt');
  const header = `# word\tdoc_count\ttotal_count\n# updated: ${new Date().toISOString()}\n`;
  const body = entries.map(e => `${e.word}\t${e.doc_count}\t${e.total_count}`).join('\n');
  writeFileSync(path, header + body + '\n', 'utf-8');
}

// ── Access Log ────────────────────────────────────────────────────

export function logAccess(vaultPath: string, filePath: string): void {
  const logPath = join(vaultPath, '_brain', 'access-log.txt');
  appendFileSync(logPath, `${new Date().toISOString()}\t${filePath}\n`, 'utf-8');
}

// ── Search Log ────────────────────────────────────────────────────

export function logSearch(vaultPath: string, mode: string, query: string, resultCount: number): void {
  const logPath = join(vaultPath, '_brain', 'search-log.txt');
  appendFileSync(logPath, `${new Date().toISOString()}\t${mode}\t${query}\t${resultCount}\n`, 'utf-8');
}

// ── Knowledge Gaps ────────────────────────────────────────────────

export function logGap(vaultPath: string, query: string): void {
  const gapPath = join(vaultPath, '_brain', 'gaps.txt');
  appendFileSync(gapPath, `${new Date().toISOString().slice(0, 10)}\t${query}\n`, 'utf-8');
}

// ── Conflicts ─────────────────────────────────────────────────────

export function readConflicts(vaultPath: string): string {
  const path = join(vaultPath, '_brain', 'conflicts.md');
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

export function appendConflict(vaultPath: string, entry: string): void {
  const path = join(vaultPath, '_brain', 'conflicts.md');
  const date = new Date().toISOString().slice(0, 10);
  appendFileSync(path, `\n### ${date}\n${entry}\n`, 'utf-8');
}

// ── Changelog ─────────────────────────────────────────────────────

export function logChange(vaultPath: string, entry: string): void {
  const path = join(vaultPath, '_brain', 'changelog.md');
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 16);

  if (!existsSync(path)) {
    writeFileSync(path, `# Brain Changelog\n\n## ${date}\n- ${time} ${entry}\n`, 'utf-8');
    return;
  }

  let content = readFileSync(path, 'utf-8');
  const dateSection = `## ${date}`;
  const dateSectionIndex = content.indexOf(dateSection);
  if (dateSectionIndex !== -1) {
    // Insert entry right after the date section header line
    const insertPos = content.indexOf('\n', dateSectionIndex) + 1;
    content = content.slice(0, insertPos) + `- ${time} ${entry}\n` + content.slice(insertPos);
  } else {
    // Add new date section after the first heading (# Brain Changelog)
    const headerIndex = content.indexOf('# Brain Changelog');
    if (headerIndex !== -1) {
      const insertPos = content.indexOf('\n', headerIndex) + 1;
      content = content.slice(0, insertPos) + `\n${dateSection}\n- ${time} ${entry}\n` + content.slice(insertPos);
    } else {
      // No header — just prepend
      content = `# Brain Changelog\n\n${dateSection}\n- ${time} ${entry}\n` + content;
    }
  }
  writeFileSync(path, content, 'utf-8');
}

// ── Brain Integrity ───────────────────────────────────────────────

const REQUIRED_FILES = [
  '_brain/profile.md',
  '_brain/priorities.md',
  '_brain/schemas.yaml',
  '_brain/crash-buffer.md',
  '_brain/state.yaml',
];

export function checkBrainIntegrity(vaultPath: string): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const f of REQUIRED_FILES) {
    if (!existsSync(join(vaultPath, f))) missing.push(f);
  }
  if (!existsSync(join(vaultPath, '_brain', 'pinned'))) missing.push('_brain/pinned/');
  return { ok: missing.length === 0, missing };
}

export function getFileFreshness(filePath: string): { exists: boolean; ageMinutes: number } {
  if (!existsSync(filePath)) return { exists: false, ageMinutes: Infinity };
  const stat = statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  return { exists: true, ageMinutes: Math.floor(ageMs / 60000) };
}
