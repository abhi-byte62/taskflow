# Optimistic Concurrency Control (OCC)

## The Problem

Two users edit the same task simultaneously:

```
User A fetches Task #123 (version: 7)
User B fetches Task #123 (version: 7)
    │
    ▼
User A changes title → sends PATCH { title: "New title", version: 7 }
    │
    ▼
Server: UPDATE tasks SET title="New title", version=8 WHERE id=123 AND version=7
    │                    ✅ 1 row updated
    ▼
User B changes description → sends PATCH { description: "Updated", version: 7 }
    │
    ▼
Server: UPDATE tasks SET description="Updated", version=8 WHERE id=123 AND version=7
    │                    ❌ 0 rows updated (version is now 8)
    ▼
Server returns 409 CONFLICT
```

## Implementation

### Database Schema

```prisma
model Task {
  id        String  @id @default(cuid())
  version   Int     @default(1)  // Optimistic concurrency token
  // ...
}
```

### Service Layer (server/src/services/taskService.js)

```javascript
async function updateTask(taskId, userId, input) {
  const { version, ...data } = input;

  const [task] = await prisma.$transaction(async (tx) => {
    // Atomic: update + version bump in single WHERE clause
    const updated = await tx.task.updateMany({
      where: { id: taskId, version },
      data: { ...data, version: version + 1 },
    });

    if (updated.count === 0) throw errors.conflict(
      'Task was modified by someone else. Please refresh and try again.'
    );

    await activityLog.log(tx, { /* ... */ });

    return [await tx.task.findUnique({
      where: { id: taskId },
      include: { assignees: true, labels: true },
    })];
  });

  return task;
}
```

### Client Handling (TanStack Query)

```javascript
const updateTask = useMutation({
  mutationFn: ({ id, data }) => api.patch(`/tasks/${id}`, data),
  onMutate: async ({ id, data }) => {
    await queryClient.cancelQueries({ queryKey: ['board', boardId] });
    const previousBoard = queryClient.getQueryData(['board', boardId]);
    
    // Optimistic update
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
    // Rollback on 409 or other error
    queryClient.setQueryData(['board', boardId], context?.previousBoard);
    if (err.response?.status === 409) {
      toast.error('Task was modified by another user. Refreshing...');
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['board', boardId] });
  },
});
```

## Why Not Pessimistic Locking?

| Approach | Pros | Cons |
|----------|------|------|
| **Pessimistic (SELECT FOR UPDATE)** | Strong consistency | Locks rows, kills throughput, deadlocks |
| **Optimistic (version column)** | High throughput, no locks | Retry on conflict |

**Decision:** Optimistic. Task editing is low-contention; 409 is rare and user-friendly.

## Conflict Resolution UX

1. Server returns 409 with clear message
2. Client invalidates queries → refetches fresh state
3. Toast: "Task was modified by another user. Refreshing..."
4. User sees latest version, re-applies their change if needed

## Move Operations (Drag-Drop)

Same pattern — `moveTask` includes `version`:

```javascript
async function moveTask(taskId, userId, { columnId, position, beforeTaskId, version }) {
  const [task] = await prisma.$transaction(async (tx) => {
    const current = await tx.task.findUnique({ where: { id: taskId } });
    if (current.version !== version) {
      throw errors.conflict('Task was modified by someone else...');
    }
    // ... update columnId, position, version+1
  });
  return task;
}
```

## Testing Concurrency

```javascript
// Integration test: concurrent updates
test('concurrent update returns 409', async () => {
  const task = await createTask();
  
  // Simulate two users with same version
  const [result1, result2] = await Promise.all([
    updateTask(task.id, { title: 'User A', version: task.version }),
    updateTask(task.id, { title: 'User B', version: task.version }),
  ]);
  
  // One succeeds, one gets 409
  const statuses = [result1.status, result2.status].sort();
  expect(statuses).toEqual([200, 409]);
});
```

## When to Use OCC

| Use Case | OCC Suitable? |
|----------|---------------|
| Task title/description edits | ✅ Low contention |
| Drag-drop moves | ✅ Brief conflict window |
| High-frequency counters (likes, views) | ❌ Use Redis INCR |
| Financial transactions | ❌ Use serializable isolation |
| Inventory reservation | ❌ Use pessimistic locking |