import { describe, it, expect } from 'vitest';
import {
  getInitials,
  formatDueDate,
  PRIORITY_CONFIG,
  PRESET_LABEL_COLORS,
} from '../utils/helpers.js';

describe('Client Helper Utilities', () => {
  it('should extract initials from names correctly', () => {
    expect(getInitials('Alice Smith')).toBe('AS');
    expect(getInitials('Bob')).toBe('B');
    expect(getInitials('John Michael Doe')).toBe('JM');
    expect(getInitials('')).toBe('?');
  });

  it('should format due date and flag overdue dates', () => {
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString();
    const result = formatDueDate(futureDate);
    expect(result).toBeDefined();
    expect(result.overdue).toBe(false);

    const pastDate = new Date(Date.now() - 86400000 * 5).toISOString();
    const pastResult = formatDueDate(pastDate);
    expect(pastResult.overdue).toBe(true);
  });

  it('should have standard priority configurations', () => {
    expect(PRIORITY_CONFIG.LOW.label).toBe('Low');
    expect(PRIORITY_CONFIG.URGENT.label).toBe('Urgent');
  });

  it('should export preset label colors', () => {
    expect(Array.isArray(PRESET_LABEL_COLORS)).toBe(true);
    expect(PRESET_LABEL_COLORS.length).toBeGreaterThan(0);
  });
});
