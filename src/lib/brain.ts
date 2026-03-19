/**
 * Brain File Management — read/write _brain/ infrastructure files
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, statSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { globSync } from 'glob';
import matter from 'gray-matter';
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
  tfidf?: number;
}

export function readWordFreq(vaultPath: string): WordEntry[] {
  const path = join(vaultPath, '_brain', 'word-freq.txt');
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf-8').split('\n').filter(l => l && !l.startsWith('#'));
  return lines.map(l => {
    const parts = l.split('\t');
    return {
      word: parts[0],
      doc_count: parseInt(parts[1]) || 0,
      total_count: parseInt(parts[2]) || 0,
      tfidf: parseFloat(parts[3]) || 0,
    };
  });
}

export function writeWordFreq(vaultPath: string, entries: WordEntry[]): void {
  const path = join(vaultPath, '_brain', 'word-freq.txt');
  const header = `# word\tdoc_count\ttotal_count\ttfidf\n# updated: ${new Date().toISOString()}\n`;
  const body = entries.map(e => `${e.word}\t${e.doc_count}\t${e.total_count}\t${(e.tfidf ?? 0).toFixed(3)}`).join('\n');
  writeFileSync(path, header + body + '\n', 'utf-8');
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

// ── Brain Integrity ───────────────────────────────────────────────

const REQUIRED_FILES = [
  '_brain/profile.md',
  '_brain/priorities.md',
  '_brain/schemas.yaml',
  '_brain/crash-buffer.md',
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

// ── Vault Stats (computed metrics) ─────────────────────────────────

export interface VaultStats {
  totalNotes: number;
  totalHubs: number;
  originCounts: { direct: number; inferred: number; generated: number; unset: number };
  hubHealth: Array<{ name: string; category: string; inlinks: number; typeCount: number; score: number }>;
  staleFacts: string[];
  tfidfTop: Array<{ word: string; tfidf: number }>;
}

export function computeVaultStats(vaultPath: string): VaultStats {

  const allFiles = globSync('**/*.md', { cwd: vaultPath, ignore: ['_brain/**', '_templates/**', '.git/**'] });
  const hubFiles = globSync('tags/**/*.md', { cwd: vaultPath });
  const index = readLinkIndex(vaultPath);

  // Origin distribution
  const originCounts = { direct: 0, inferred: 0, generated: 0, unset: 0 };
  const staleFacts: string[] = [];
  const now = Date.now();

  for (const f of allFiles) {
    try {
      const raw = readFileSync(join(vaultPath, f), 'utf-8');
      const { data } = matter(raw);
      const origin = String(data.origin || '');
      if (origin === 'direct') originCounts.direct++;
      else if (origin === 'inferred') originCounts.inferred++;
      else if (origin === 'generated') originCounts.generated++;
      else originCounts.unset++;

      // Stale fact detection: confidence=medium + no last_verified or >30 days
      if (data.confidence === 'medium' && data.type === 'fact') {
        const lv = data.last_verified ? new Date(data.last_verified as string).getTime() : 0;
        if (lv === 0 || (now - lv) > 30 * 86400000) {
          staleFacts.push(f);
        }
      }
    } catch { /* skip */ }
  }

  // Hub health
  const hubHealth: VaultStats['hubHealth'] = [];
  for (const hf of hubFiles) {
    const normalized = hf.replace(/\\/g, '/');
    const entry = index.files[normalized];
    const inlinks = entry?.linked_from?.length ?? 0;
    // Count distinct types of linked notes
    const linkedTypes = new Set<string>();
    if (entry?.linked_from) {
      for (const link of entry.linked_from) {
        try {
          const raw = readFileSync(join(vaultPath, link), 'utf-8');
          const { data } = matter(raw);
          if (data.type) linkedTypes.add(String(data.type));
        } catch { /* skip */ }
      }
    }
    const parts = normalized.split('/');
    const category = parts.length >= 2 ? parts[1] : 'unknown';
    const name = parts[parts.length - 1].replace('.md', '');
    // Score: (inlinks / max(1, totalNotes/10)) * (typeCount / 5) * 10, clamped 0-10
    const score = Math.min(10, Math.round(
      (Math.min(inlinks, 10) / 10 * 5) + (Math.min(linkedTypes.size, 5) / 5 * 5)
    ));
    hubHealth.push({ name, category, inlinks, typeCount: linkedTypes.size, score });
  }
  hubHealth.sort((a, b) => a.score - b.score);

  // TF-IDF top terms
  const wordFreq = readWordFreq(vaultPath);
  const tfidfTop = wordFreq
    .filter(w => (w.tfidf ?? 0) > 0)
    .sort((a, b) => (b.tfidf ?? 0) - (a.tfidf ?? 0))
    .slice(0, 10)
    .map(w => ({ word: w.word, tfidf: w.tfidf ?? 0 }));

  return {
    totalNotes: allFiles.length,
    totalHubs: hubFiles.length,
    originCounts,
    hubHealth,
    staleFacts,
    tfidfTop,
  };
}
