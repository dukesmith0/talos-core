import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { extractWikilinks, extractTags, addWikilinks, getDailyNotePath, writeFile, readFile } from '../../src/lib/vault.js';

const TEST_DIR = join(tmpdir(), 'talos-test-vault-' + Date.now());

beforeEach(() => { mkdirSync(TEST_DIR, { recursive: true }); });
afterEach(() => { rmSync(TEST_DIR, { recursive: true, force: true }); });

describe('extractWikilinks', () => {
  it('should extract simple wikilinks', () => {
    expect(extractWikilinks('See [[Python]] and [[JavaScript]]')).toEqual(['Python', 'JavaScript']);
  });

  it('should extract aliased wikilinks', () => {
    expect(extractWikilinks('See [[Python|py]]')).toEqual(['Python']);
  });

  it('should return empty for no links', () => {
    expect(extractWikilinks('No links here')).toEqual([]);
  });

  it('should deduplicate', () => {
    expect(extractWikilinks('[[A]] and [[A]] again')).toEqual(['A']);
  });
});

describe('extractTags', () => {
  it('should extract inline tags', () => {
    const tags = extractTags('This is #python and #javascript');
    expect(tags).toContain('python');
    expect(tags).toContain('javascript');
  });

  it('should extract frontmatter tags', () => {
    const tags = extractTags('content', { tags: ['Python', 'ML'] });
    expect(tags).toContain('python');
    expect(tags).toContain('ml');
  });

  it('should skip tags inside code blocks', () => {
    const tags = extractTags('real #tag\n```\n#notag\n```');
    expect(tags).toContain('tag');
    expect(tags).not.toContain('notag');
  });
});

describe('addWikilinks', () => {
  const entities = [
    { name: 'Python', aliases: ['py'] },
    { name: 'JavaScript', aliases: ['JS'] },
  ];

  it('should link first occurrence of entity', () => {
    const result = addWikilinks('I use Python daily. Python is great.', entities);
    expect(result).toContain('[[Python|Python]]');
    // Second occurrence should NOT be linked
    const matches = result.match(/\[\[Python/g);
    expect(matches?.length).toBe(1);
  });

  it('should not link inside existing wikilinks', () => {
    const result = addWikilinks('I use [[Python]] already', entities);
    expect(result).toBe('I use [[Python]] already');
  });

  it('should skip frontmatter', () => {
    const text = '---\ntitle: Python Guide\n---\nPython is great';
    const result = addWikilinks(text, entities);
    // Frontmatter should not have link
    expect(result).toContain('title: Python Guide');
    // Body should have link
    expect(result).toContain('[[Python|Python]]');
  });

  it('should skip code blocks', () => {
    const text = 'Use Python here\n```\nimport Python\n```\nMore text';
    const result = addWikilinks(text, entities);
    // Code block should not have link
    expect(result).toContain('import Python');
    expect(result).not.toContain('import [[Python');
  });
});

describe('getDailyNotePath', () => {
  it('should format path correctly', () => {
    const date = new Date(2026, 2, 18); // March 18, 2026
    const path = getDailyNotePath('/vault', date);
    expect(path).toContain('2026');
    expect(path).toContain('03');
    expect(path).toContain('2026-03-18.md');
  });
});

describe('writeFile / readFile', () => {
  it('should write and read with frontmatter', () => {
    const path = join(TEST_DIR, 'test.md');
    writeFile(path, 'Hello world', { type: 'fact', topic: 'test' });
    const result = readFile(path);
    expect(result.data.type).toBe('fact');
    expect(result.content.trim()).toBe('Hello world');
  });

  it('should write without frontmatter', () => {
    const path = join(TEST_DIR, 'plain.md');
    writeFile(path, '# Just markdown');
    const raw = readFileSync(path, 'utf-8');
    expect(raw).toBe('# Just markdown');
  });

  it('should create parent directories', () => {
    const path = join(TEST_DIR, 'a', 'b', 'c', 'deep.md');
    writeFile(path, 'deep');
    const result = readFile(path);
    expect(result.content.trim()).toBe('deep');
  });
});
