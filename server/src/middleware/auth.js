const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { errors } = require('../errors');
const config = require('../config');

// Verify JWT and attach the authenticated user to req.user.
// Uses the AppError taxonomy so the central error handler keeps the
// response shape consistent.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw errors.unauthorized();
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) throw errors.unauthorized('User no longer exists');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(errors.unauthorized('Session expired, please log in again'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(errors.unauthorized('Invalid token'));
    }
    next(err);
  }
}

module.exports = { authenticate };