# ADR-001: Why PostgreSQL?

## Status
Accepted

## Context
We need a primary datastore for a collaborative task management application with:
- Relational data (users, workspaces, boards, tasks, assignments)
- Complex queries (joins, aggregations, pagination)
- ACID guarantees for multi-step operations
- Audit trail with referential integrity
- Production-grade reliability

## Decision
Use **PostgreSQL 17** as the primary database.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **PostgreSQL** | Mature, ACID, rich types, JSONB, FTS, extensions, battle-tested | Operational overhead vs managed |
| MySQL | Similar, wide adoption | Weaker JSON, no native arrays, less advanced indexing |
| MongoDB | Flexible schema, horizontal scaling | No ACID transactions (pre-4.0), no joins, eventual consistency |
| SQLite | Zero config, embedded | No concurrency, no network, not for production |
| DynamoDB | Managed, infinite scale | No joins, no transactions (limited), vendor lock-in, cost |

## Consequences

**Positive:**
- Relational model maps naturally to domain (workspaces → boards → columns → tasks)
- Prisma ORM provides type-safe access with migrations
- JSONB for flexible metadata without schema changes
- Full-text search without Elasticsearch (until proven necessary)
- Read replicas, connection pooling (PgBouncer) for scale
- Industry standard — interviewers recognize it

**Negative:**
- Operational overhead (backups, vacuum, monitoring)
- Vertical write scaling limit (mitigated by read replicas → sharding)
- Schema migrations require care

## Mitigations
- Docker Compose for local dev parity
- Prisma migrations for versioned schema changes
- `docs/DATABASE.md` documents indexes and `EXPLAIN ANALYZE` patterns
- `docs/SCALABILITY.md` documents path to 1M users

## References
- `server/prisma/schema.prisma`
- `docs/DATABASE.md`
- `docs/SCALABILITY.md`