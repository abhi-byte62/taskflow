const { PrismaClient } = require('@prisma/client');

// Single Prisma instance shared across the app.
// In development, avoid exhausting connections by reusing one instance.
const prisma = new PrismaClient();

module.exports = prisma;