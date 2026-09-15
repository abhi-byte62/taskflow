# Security

## Threat Model

| Asset | Threat | Mitigation |
|-------|--------|------------|
| User credentials | Theft, brute force | bcrypt(10), rate limit (100/15min), JWT short expiry |
| Session tokens | Hijacking, replay | HTTPS only, HttpOnly cookies (prod), short JWT expiry |
| Database | SQL injection | Prisma parameterized queries |
| API | Unauthorized access | Server-side RBAC on every mutating endpoint |
| Client | XSS | React auto-escaping, no `dangerouslySetInnerHTML` |
| Network | MITM | HTTPS in production, HSTS |
| Requests | CSRF | JWT in Authorization header (not cookies) |
| Mutations | Duplicate execution | Idempotency keys on POST `/tasks` |
| Audit | Unaccounted changes | ActivityLog on every mutation |

## Defense in Depth

### 1. Authentication
- **Password hashing:** bcrypt with cost factor 10 (≈100ms on modern CPU)
- **JWT:** HS256, 7-day expiry, payload: `{ userId }` only
- **No refresh tokens yet** — short expiry mitigates; add if needed
- **Google OAuth stub** — ready for production integration

### 2. Authorization (RBAC)
**Every mutating endpoint enforces authorization server-side.**

```javascript
// Middleware chain on protected routes:
authenticate()          // JWT → req.user
  ↓
authorizeBoard('task.update')  // Load board → check membership → check role
  ↓
Controller
```

Roles: `OWNER > ADMIN > MEMBER > VIEWER`

### 3. Input Validation
All endpoints use Zod schemas at the API boundary:

```javascript
router.post('/tasks', validate({ body: createTaskSchema }), handler);
```

Invalid input → 400 with field-level errors: `{ field: "message" }`

### 4. Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth (login/register) | 100 req | 15 min |
| General API | 1000 req | 15 min |
| Backend | Redis-backed (prod) / in-memory (dev) |

### 5. Headers (Helmet)
```
Content-Security-Policy: default-src 'self'...
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: no-referrer
Permissions-Policy: ...
```

### 6. Idempotency
POST `/tasks` accepts `Idempotency-Key` header:
- First request → execute, store response
- Retry with same key → replay stored response
- Prevents duplicate tasks on network timeout

### 7. Audit Trail
Every mutation writes to `ActivityLog` in the same transaction:
```javascript
await prisma.$transaction(async (tx) => {
  await tx.task.create({ ... });
  await tx.activityLog.create({ 
    actorId: userId,
    action: 'task.created',
    entityType: 'task',
    entityId: task.id,
    detail: `Created "${task.title}"`,
  });
});
```

### 8. CORS
Restricted to frontend origin only:
```javascript
cors({ origin: config.clientUrl, credentials: true })
```

## Security Checklist (Production)

- [ ] HTTPS everywhere (TLS 1.2+)
- [ ] HttpOnly, Secure, SameSite=Strict cookies for JWT (or keep in header)
- [ ] Rotate JWT_SECRET periodically
- [ ] Shorten JWT expiry (15min) + add refresh tokens
- [ ] WAF / API Gateway in front
- [ ] Database encryption at rest
- [ ] Regular dependency scans (`npm audit`, Snyk)
- [ ] Penetration testing before launch
- [ ] Incident response plan
- [ ] Security headers verified via securityheaders.com