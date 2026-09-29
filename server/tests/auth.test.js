import { describe, it, expect, vi } from 'vitest';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { registerSchema, loginSchema } = require('../src/utils/schemas.js');
const config = require('../src/config.js');

describe('Auth Validation & Security', () => {
  describe('registerSchema validation', () => {
    it('should validate valid user registration payload', () => {
      const valid = {
        email: 'dev@taskflow.dev',
        name: 'Developer',
        password: 'password123',
      };
      const parsed = registerSchema.parse(valid);
      expect(parsed.email).toBe('dev@taskflow.dev');
      expect(parsed.name).toBe('Developer');
    });

    it('should reject invalid email or short password', () => {
      expect(() =>
        registerSchema.parse({
          email: 'not-an-email',
          name: 'Dev',
          password: 'pass',
        })
      ).toThrow();
    });
  });

  describe('loginSchema validation', () => {
    it('should validate valid login payload', () => {
      const valid = { email: 'dev@taskflow.dev', password: 'password123' };
      const parsed = loginSchema.parse(valid);
      expect(parsed.email).toBe('dev@taskflow.dev');
    });

    it('should reject missing password', () => {
      expect(() => loginSchema.parse({ email: 'dev@taskflow.dev', password: '' })).toThrow();
    });
  });

  describe('Password Hashing & JWT Verification', () => {
    it('should hash and compare passwords correctly using bcrypt', async () => {
      const password = 'securePassword123!';
      const hash = await bcrypt.hash(password, 10);
      expect(hash).not.toBe(password);

      const isMatch = await bcrypt.compare(password, hash);
      expect(isMatch).toBe(true);

      const isWrong = await bcrypt.compare('wrongPassword', hash);
      expect(isWrong).toBe(false);
    });

    it('should sign and verify JWT tokens with user payload', () => {
      const payload = { userId: 'usr-123' };
      const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, config.jwtSecret);
      expect(decoded.userId).toBe('usr-123');
    });
  });
});
