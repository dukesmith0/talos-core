import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readLinkIndex, writeLinkIndex,
  readWordFreq, writeWordFreq,
  logAccess, logSearch, logGap,
  checkBrainIntegrity, getFileFreshness,
  logChange,
} from '../../src/lib/brain.js';

const TEST_DIR = join(tmpdir(), 'talos-test-brain-' + Date.now());
const TEST_BRAIN = join(TEST_DIR, '_brain');

beforeEach(() => {
  mkdirSync(join(TEST_BRAIN, 'pinned'), { recursive: true });
});
afterEach(() => { rmSync(TEST_DIR, { recursive: true, force: true }); });

describe('linkIndex', () => {
  it('should return empty index when file missing', () => {
    const index = readLinkIndex(TEST_DIR);
    expect(index.files).toEqual({});
    expect(index.tags).toEqual({});
  });

  it('should write and read link index', () => {
    const index = {
      files: { 'notes/test.md': { links_to: ['Python'], linked_from: [], tags: ['test'] } },
      tags: { test: ['notes/test.md'] },
      updated: '',
    };
    writeLinkIndex(TEST_DIR, index);
    const read = readLinkIndex(TEST_DIR);
    expect(read.files['notes/test.md'].links_to).toEqual(['Python']);
    expect(read.updated).toBeTruthy();
  });
});

describe('wordFreq', () => {
  it('should return empty when file missing', () => {
    expect(readWordFreq(TEST_DIR)).toEqual([]);
  });

  it('should write and read word frequency', () => {
    const entries = [
      { word: 'python', doc_count: 5, total_count: 12 },
      { word: 'javascript', doc_count: 3, total_count: 8 },
    ];
    writeWordFreq(TEST_DIR, entries);
    const read = readWordFreq(TEST_DIR);
    expect(read.length).toBe(2);
    expect(read[0].word).toBe('python');
    expect(read[0].doc_count).toBe(5);
  });
});

describe('logging', () => {
  it('should append to access log', () => {
    logAccess(TEST_DIR, 'notes/test.md');
    logAccess(TEST_DIR, 'notes/other.md');
    const content = readFileSync(join(TEST_BRAIN, 'access-log.txt'), 'utf-8');
    expect(content).toContain('notes/test.md');
    expect(content).toContain('notes/other.md');
  });

  it('should append to search log', () => {
    logSearch(TEST_DIR, 'bm25', 'python tutorial', 5);
    const content = readFileSync(join(TEST_BRAIN, 'search-log.txt'), 'utf-8');
    expect(content).toContain('python tutorial');
    expect(content).toContain('5');
  });

  it('should append to gaps', () => {
    logGap(TEST_DIR, 'quantum computing basics');
    const content = readFileSync(join(TEST_BRAIN, 'gaps.txt'), 'utf-8');
    expect(content).toContain('quantum computing basics');
  });
});

describe('logChange', () => {
  it('should create changelog if missing', () => {
    logChange(TEST_DIR, 'Created test note');
    const content = readFileSync(join(TEST_BRAIN, 'changelog.md'), 'utf-8');
    expect(content).toContain('# Brain Changelog');
    expect(content).toContain('Created test note');
  });

  it('should append under existing date', () => {
    logChange(TEST_DIR, 'First change');
    logChange(TEST_DIR, 'Second change');
    const content = readFileSync(join(TEST_BRAIN, 'changelog.md'), 'utf-8');
    expect(content).toContain('First change');
    expect(content).toContain('Second change');
  });
});

describe('brainIntegrity', () => {
  it('should report missing files', () => {
    const result = checkBrainIntegrity(TEST_DIR);
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('should pass when all files present', () => {
    // Create required files
    writeFileSync(join(TEST_BRAIN, 'profile.md'), '', 'utf-8');
    writeFileSync(join(TEST_BRAIN, 'priorities.md'), '', 'utf-8');
    writeFileSync(join(TEST_BRAIN, 'schemas.yaml'), '', 'utf-8');
    writeFileSync(join(TEST_BRAIN, 'crash-buffer.md'), '', 'utf-8');
    writeFileSync(join(TEST_BRAIN, 'state.yaml'), '', 'utf-8');
    const result = checkBrainIntegrity(TEST_DIR);
    expect(result.ok).toBe(true);
  });
});

describe('fileFreshness', () => {
  it('should return exists: false for missing file', () => {
    const result = getFileFreshness(join(TEST_DIR, 'nope.md'));
    expect(result.exists).toBe(false);
    expect(result.ageMinutes).toBe(Infinity);
  });

  it('should return age for existing file', () => {
    const path = join(TEST_BRAIN, 'fresh.txt');
    writeFileSync(path, 'test', 'utf-8');
    const result = getFileFreshness(path);
    expect(result.exists).toBe(true);
    expect(result.ageMinutes).toBeLessThan(1);
  });
});
