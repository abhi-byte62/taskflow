# Authentication & Authorization

## Authentication Flow

```
┌─────────────┐     POST /api/auth/login      ┌─────────────┐
│   Client    │ ───────────────────────────► │   Express   │
│  (React)    │                               │  (Node)     │
└─────────────┘                               └──────┬──────┘
                                                     │
                    { token, user } ◄────────────────┘
```

## JWT Design

**Payload:**
```json
{
  "userId": "cmtx439i900006x839h2tu83u",
  "iat": 1726070400,
  "exp": 1726675200
}
```

- **Algorithm:** HS256
- **Expiry:** 7 days (configurable via `JWT_EXPIRES`)
- **Secret:** `JWT_SECRET` (64+ chars, rotated in production)
- **No sensitive data** — only `userId`

## Token Handling

### Client (React)
```javascript
// Stored in localStorage (simple, works for SPA)
// Production: HttpOnly cookie preferred
localStorage.setItem('token', token);

// Axios interceptor attaches to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → auto-logout
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
```

### Server (Express)
```javascript
// middleware/auth.js
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw errors.unauthorized();

  const token = header.split(' ')[1];
  const decoded = jwt.verify(token, config.jwtSecret);

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  if (!user) throw errors.unauthorized('User no longer exists');

  req.user = user;
  next();
}
```

## Password Security

- **Hash:** bcrypt with cost factor 10 (~100ms)
- **Policy:** Minimum 8 characters (enforced at API boundary)
- **Never logged:** Password never appears in logs, errors, or responses

## Google OAuth (Stub)

```javascript
// Ready for production integration
// 1. Redirect to Google: /api/auth/google
// 2. Callback: /api/auth/google/callback
// 3. Create/find user by googleId
// 4. Issue JWT
```

## Authorization (RBAC)

Every mutating endpoint uses server-side authorization:

```javascript
// Middleware chain
router.post('/tasks/board/:boardId',
  authenticate,                    // 1. JWT → req.user
  authorizeBoard('task.create'),   // 2. Load board → check membership → check role
  validate({ body: createTaskSchema }),  // 3. Zod validation
  idempotency,                     // 4. Idempotency key
  handler
);
```

**Role Hierarchy:**
```
OWNER > ADMIN > MEMBER > VIEWER
```

**Permission Matrix:**
| Action | OWNER | ADMIN | MEMBER | VIEWER |
|--------|-------|-------|--------|--------|
| workspace.view | ✅ | ✅ | ✅ | ✅ |
| workspace.update | ✅ | ❌ | ❌ | ❌ |
| workspace.manageMembers | ✅ | ✅ | ❌ | ❌ |
| board.view | ✅ | ✅ | ✅ | ✅ |
| board.manageColumns | ✅ | ✅ | ✅ | ❌ |
| task.create | ✅ | ✅ | ✅ | ❌ |
| task.update | ✅ | ✅ | ✅ | ❌ |
| task.move | ✅ | ✅ | ✅ | ❌ |
| task.delete | ✅ | ✅ | ✅ | ❌ |

## Security Headers (Helmet)

```
Content-Security-Policy: default-src 'self'...
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth (login/register) | 100 req | 15 min |
| General API | 1000 req | 15 min |

Redis-backed in production, in-memory in dev.

## CORS

```javascript
cors({
  origin: config.clientUrl,  // http://localhost:5173
  credentials: true
})
```

## Production Checklist

- [ ] HTTPS everywhere (TLS 1.2+)
- [ ] JWT in HttpOnly, Secure, SameSite=Strict cookie
- [ ] Shorten JWT expiry (15min) + add refresh tokens
- [ ] Rotate JWT_SECRET periodically
- [ ] WAF / API Gateway
- [ ] Database encryption at rest
- [ ] Dependency scanning (`npm audit`, Snyk)
- [ ] Penetration testing