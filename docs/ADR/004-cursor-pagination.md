# ADR-004: Why Cursor Pagination over Offset?

## Status
Accepted

## Context
Task lists and activity feeds can grow large. Need efficient pagination.

## Decision
Use **cursor-based pagination** (keyset pagination) for all list endpoints.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Cursor (keyset)** | O(log N + K), stable, no skipped/duplicate rows | Can't jump to arbitrary page |
| Offset/Limit | Simple, jump to page N | O(N + K), skipped rows on concurrent writes, unstable |

## Consequences

**Positive:**
- Consistent performance regardless of page depth
- No skipped/duplicate rows when data changes between pages
- Natural fit for infinite scroll (client just passes last item's cursor)

**Negative:**
- Can't jump to "page 50" directly (not needed for Kanban/infinite scroll)

## Implementation

**API:**
```
GET /tasks/board/:boardId?cursor=task_abc&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [...],
    "nextCursor": "task_xyz",
    "hasMore": true
  }
}
```

**Server (Prisma):**
```javascript
const where = { boardId };
if (cursor) {
  const cursorTask = await prisma.task.findUnique({ where: { id: cursor }, select: { position: true } });
  if (cursorTask) where.position = { gt: cursorTask.position };
}

const tasks = await prisma.task.findMany({
  where,
  orderBy: { position: 'asc' },
  take: limit + 1,
});
```

**Why position as cursor?** Tasks ordered by position in column. Cursor = position of last item. Index on `(columnId, position)` makes this an index seek + limit.

## When NOT to Use Cursor
- User-facing page numbers (e.g., admin tables with "Page 1, 2, 3...")
- Small, static datasets where offset is negligible

## References
- `server/src/utils/schemas.js` (cursorQuerySchema)
- `server/src/routes/activity.js`
- `docs/DATABASE.md` (EXPLAIN ANALYZE examples)