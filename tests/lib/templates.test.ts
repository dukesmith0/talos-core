import { describe, it, expect } from 'vitest';
import { fillTemplate } from '../../src/lib/templates.js';

describe('fillTemplate', () => {
  it('should replace single variable', () => {
    expect(fillTemplate('Hello {{NAME}}', { NAME: 'Craig' })).toBe('Hello Craig');
  });

  it('should replace multiple variables', () => {
    const result = fillTemplate('{{PROJECT}} by {{AUTHOR}}', { PROJECT: 'TALOS', AUTHOR: 'Duke' });
    expect(result).toBe('TALOS by Duke');
  });

  it('should replace all occurrences of same variable', () => {
    expect(fillTemplate('{{X}} and {{X}}', { X: 'yes' })).toBe('yes and yes');
  });

  it('should leave unknown variables unchanged', () => {
    expect(fillTemplate('{{KNOWN}} and {{UNKNOWN}}', { KNOWN: 'hi' })).toBe('hi and {{UNKNOWN}}');
  });

  it('should handle empty template', () => {
    expect(fillTemplate('', { X: 'val' })).toBe('');
  });
});
