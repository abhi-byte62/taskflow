const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../utils/schemas');
const { errors } = require('../errors');
const { success } = require('../utils/response');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ userId: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpires,
  });
}

// Public user shape — never leak the password hash.
function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt };
}

/**
 * POST /api/auth/register
 * Create an account from email + password.
 */
router.post('/register', validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { email, name, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw errors.conflict('An account with this email already exists');

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name, password: hashed } });

    success(res, { token: signToken(user), user: publicUser(user) }, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Authenticate email + password.
 */
router.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Same error for missing user / wrong password — avoids user enumeration.
    if (!user || !user.password) throw errors.unauthorized('Invalid email or password');
    if (!(await bcrypt.compare(password, user.password))) {
      throw errors.unauthorized('Invalid email or password');
    }

    success(res, { token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Refresh client session state on load.
 */
router.get('/me', authenticate, (req, res) => {
  success(res, { user: req.user });
});

/**
 * POST /api/auth/logout
 * Stateless JWT — client drops the token. Kept for API symmetry.
 */
router.post('/logout', authenticate, (req, res) => {
  success(res, { logout: true });
});

module.exports = router;