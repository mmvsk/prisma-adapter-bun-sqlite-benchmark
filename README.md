# Prisma SQLite Adapters Benchmark

Performance benchmark comparing Prisma SQLite adapters for Bun runtime.

## Quick Start

```bash
git clone https://github.com/mmvsk/prisma-adapter-bun-sqlite-benchmark.git
cd prisma-adapter-bun-sqlite-benchmark
bun install
bun start --memory        # Run benchmarks (in-memory)
bun start --fs            # Run benchmarks (file-based, ./data/)
bun start --fs /tmp/bench # Run benchmarks (custom directory)
```

**Tip**: For best file-based performance, symlink `data/` to tmpfs:
```bash
rm -rf data && ln -s /tmp/bench-data data && mkdir -p /tmp/bench-data
```

## Adapters Tested

| Adapter | Description |
|---------|-------------|
| [`prisma-adapter-bun-sqlite`](https://github.com/mmvsk/prisma-adapter-bun-sqlite) | Native Bun SQLite adapter |
| [`@synapsenwerkstatt/prisma-bun-sqlite-adapter`](https://github.com/nicosommi/nogo) | Alternative Bun adapter |
| [`@prisma/adapter-libsql`](https://www.prisma.io/docs/orm/overview/databases/turso) | Official libSQL/Turso adapter |

## Benchmark Tests (26 total)

- **CRUD Operations** (7): Create, Read, Update, Delete
- **Relations** (4): JOINs, nested creates, cascade deletes
- **Filtering** (4): Boolean, date, pagination, complex queries
- **Types** (4): BigInt, Decimal, Bytes (BLOB), JSON
- **Transactions** (2): Commit, rollback
- **Aggregations** (3): Count, aggregate, group by
- **Raw Queries** (2): $queryRaw, $executeRaw

## Configuration Comparison

| Setting | prisma-adapter-bun-sqlite | nogo | @prisma/adapter-libsql |
|---------|---------------------------|------|------------------------|
| `foreign_keys` | ✅ ON | ✅ ON | ✅ ON |
| `busy_timeout` | 5000ms | 0ms | 0ms |
| `journal_mode` | DELETE | DELETE | DELETE |

## Project Structure

```
src/
├── client.ts    # Adapter factory
├── tests.ts     # Benchmark test definitions
└── index.ts     # Benchmark runner
```

## Related

- [`prisma-adapter-bun-sqlite`](https://github.com/mmvsk/prisma-adapter-bun-sqlite) - The adapter being benchmarked
- [Bun SQLite](https://bun.sh/docs/api/sqlite) - Bun's native SQLite API
- [Prisma Docs](https://www.prisma.io/docs) - Prisma ORM documentation

## License

MIT
