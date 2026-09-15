# ADR-003: Why Optimistic Updates?

## Status
Accepted

## Context
User actions (drag-drop, edit, create) should feel instant. Waiting for server round-trip creates perceived lag.

## Decision
Use **optimistic updates** via TanStack Query (React Query) on the client, with server-side **optimistic concurrency control (OCC)** via `Task.version`.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Optimistic + OCC** | Instant UI, server validates, rollback on conflict | Complexity in client rollback |
| Pessimistic (wait for server) | Simple, consistent | Perceived lag, blocks user |
| No validation (last-write-wins) | Simple | Data loss, race conditions |

## Consequences

**Positive:**
- Drag-drop feels instant (local state updates immediately)
- Server validates with `version` column → 409 if stale
- Client rolls back on 409, refetches fresh state
- Real distributed-systems pattern demonstrated

**Negative:**
- Client mutation logic more complex (onMutate/onError/onSettled)
- TanStack Query cache manipulation required

## Implementation

**Server (OCC):**
```javascript
// Single atomic check + update
const updated = await tx.task.updateMany({
  where: { id: taskId, version },
  data: { ...data, version: version + 1 },
});
if (updated.count === 0) throw errors.conflict(...);
```

**Client (TanStack Query):**
```javascript
const moveTask = useMutation({
  mutationFn: ({ id, data }) => api.post(`/tasks/${id}/move`, data),
  onMutate: async ({ id, data }) => {
    await queryClient.cancelQueries({ queryKey: ['board', boardId] });
    const previousBoard = queryClient.getQueryData(['board', boardId]);
    queryClient.setQueryData(['board', boardId], (old) => ({
      ...old,
      columns: old.columns.map(col => ({
        ...col,
        tasks: col.tasks.map(t => 
          t.id === id ? { ...t, ...data, version: t.version + 1 } : t
        ),
      })),
    }));
    return { previousBoard };
  },
  onError: (err, _, context) => {
    queryClient.setQueryData(['board', boardId], context?.previousBoard);
    if (err.response?.status === 409) {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    }
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['board', boardId] }),
});
```

## References
- `server/src/services/taskService.js`
- `client/src/pages/Board.jsx`
- `docs/CONCURRENCY.md`