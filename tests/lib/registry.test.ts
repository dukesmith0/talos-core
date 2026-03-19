import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeLinkIndex } from '../../src/lib/brain.js';
import { getEntities, findEntity, getEntityNames } from '../../src/lib/registry.js';

const TEST_DIR = join(tmpdir(), 'talos-test-registry-' + Date.now());

beforeEach(() => { mkdirSync(join(TEST_DIR, '_brain'), { recursive: true }); });
afterEach(() => { rmSync(TEST_DIR, { recursive: true, force: true }); });

describe('registry', () => {
  it('should return entities linked from 2+ files', () => {
    writeLinkIndex(TEST_DIR, {
      files: {
        'notes/python.md': { links_to: [], linked_from: ['a.md', 'b.md', 'c.md'], tags: [] },
        'notes/obscure.md': { links_to: [], linked_from: ['a.md'], tags: [] },
        'notes/popular.md': { links_to: [], linked_from: ['a.md', 'b.md'], tags: [] },
      },
      tags: {},
      updated: '',
    });

    const entities = getEntities(TEST_DIR);
    expect(entities.length).toBe(2);
    expect(entities.map(e => e.name)).toContain('python');
    expect(entities.map(e => e.name)).toContain('popular');
    expect(entities.map(e => e.name)).not.toContain('obscure');
  });

  it('should find entity by name case-insensitively', () => {
    writeLinkIndex(TEST_DIR, {
      files: {
        'notes/Python.md': { links_to: [], linked_from: ['a.md', 'b.md'], tags: [] },
      },
      tags: {},
      updated: '',
    });

    expect(findEntity('python', TEST_DIR)).not.toBeNull();
    expect(findEntity('PYTHON', TEST_DIR)).not.toBeNull();
    expect(findEntity('nonexistent', TEST_DIR)).toBeNull();
  });

  it('should return entity names for wikilink scanning', () => {
    writeLinkIndex(TEST_DIR, {
      files: {
        'notes/React.md': { links_to: [], linked_from: ['a.md', 'b.md'], tags: [] },
      },
      tags: {},
      updated: '',
    });

    const names = getEntityNames(TEST_DIR);
    expect(names.length).toBe(1);
    expect(names[0].name).toBe('React');
  });
});
