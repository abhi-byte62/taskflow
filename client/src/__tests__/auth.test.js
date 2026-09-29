import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Client Auth & API Interceptors', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => {
        mockStorage[key] = value.toString();
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        mockStorage = {};
      }),
    };
  });

  it('should attach Authorization Bearer header when token is stored', async () => {
    const api = (await import('../services/api.js')).default;
    global.localStorage.setItem('token', 'mock-jwt-token');

    const config = { headers: {} };
    const interceptedConfig = api.interceptors.request.handlers[0].fulfilled(config);

    expect(interceptedConfig.headers.Authorization).toBe('Bearer mock-jwt-token');
  });

  it('should not attach Authorization header when token is absent', async () => {
    const api = (await import('../services/api.js')).default;
    const config = { headers: {} };
    const interceptedConfig = api.interceptors.request.handlers[0].fulfilled(config);

    expect(interceptedConfig.headers.Authorization).toBeUndefined();
  });
});
