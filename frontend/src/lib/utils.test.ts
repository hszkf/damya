import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'active', false && 'inactive');
    expect(result).toBe('base active');
  });

  it('should merge tailwind classes correctly', () => {
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });

  it('should handle undefined and null values', () => {
    const result = cn('base', undefined, null, 'end');
    expect(result).toBe('base end');
  });
});
