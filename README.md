# Prisma SQLite Adapters Benchmark

Comprehensive benchmark comparing Prisma SQLite adapter implementations under Bun runtime with Prisma 7.0.0.

## Quick Start

```bash
# Run benchmarks for all adapters
bun start

# Run correctness tests
bun test

# Type check
bun run tsc --noEmit
```

## Project Structure

```
.
├── src/
│   ├── client.ts          # Adapter factory (createClient)
│   ├── tests.ts           # Benchmark test definitions
│   ├── index.ts           # Benchmark runner (bun start)
│   └── ORIGNAL_TO_DELETE/ # Old code (to be deleted)
├── tests/
│   └── adapters.test.ts   # Correctness tests (bun test)
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── generated/         # Generated Prisma Client
├── package.json
└── tsconfig.json
```

## Adapters Tested

1. **mmvsk-bun-sqlite** (`prisma-adapter-bun-sqlite`)
   - Your implementation
   - Best compatibility and correctness
   - Native Bun SQLite support

2. **abcx3-bun-sql** (`@abcx3/prisma-bun-adapter`)
   - Competing Bun implementation
   - Has critical bugs (connection reservation, error codes, foreign keys)

3. **prisma-libsql** (`@prisma/adapter-libsql`)
   - Official libSQL/Turso adapter
   - Designed for remote databases (limited `:memory:` support)

## Benchmark Tests (26 total)

### Categories

- **CRUD Operations** (7 tests): Create, Read, Update, Delete
- **Relations** (4 tests): JOINs, nested creates, cascade deletes
- **Filtering** (4 tests): Boolean, date, pagination, complex queries
- **Types** (4 tests): BigInt, Decimal, Bytes (BLOB), JSON
- **Transactions** (2 tests): Commit, rollback
- **Aggregations** (3 tests): Count, aggregate, group by
- **Raw Queries** (2 tests): $queryRaw, $executeRaw

## Correctness Tests (8 total)

1. **JOIN Duplicate Column Handling** - Ensures no data corruption
2. **BLOB Serialization** - Bytes/BLOB round-trip
3. **Boolean Type Conversion** - 1/0 conversion
4. **DateTime Type Conversion** - ISO8601 handling
5. **BigInt Handling** - Large integer preservation
6. **Error Code Mapping** - Proper Prisma error codes (P2002, P2003, etc.)
7. **Foreign Key Enforcement** - Referential integrity
8. **Cascade Delete** - ON DELETE CASCADE behavior

## Benchmark Results (Real Disk - SSD)

**Test Environment:**
- **Hardware**: SSD (real disk, not tmpfs)
- **Bun**: 1.3.2
- **Prisma**: 7.0.0
- **Date**: November 2025

### Performance Summary - All Tests (26 tests)

| Adapter | Tests Passed | Tests Failed | Pass Rate | Avg Ops/Sec |
|---------|--------------|--------------|-----------|-------------|
| **mmvsk-bun-sqlite** | **26/26** ✅ | 0 | **100%** | 287 |
| **prisma-libsql** | 26/26 ✅ | 0 | 100% | 139 |
| **abcx3-bun-sql** | 7/26 ❌ | 19 | 27% | 322* |

\* *Note: abcx3 average is misleading - calculated across all 26 tests including 19 failures*

### Fair Comparison - Common Passing Tests (7 tests)

Only comparing tests that **ALL adapters can pass**:

| Adapter | Avg Ops/Sec | Winner |
|---------|-------------|--------|
| **mmvsk-bun-sqlite** | **242** | **🏆 2.1x faster** |
| prisma-libsql | 115 | - |
| abcx3-bun-sql | 111 | - |

**Conclusion**: When comparing the same tests, **mmvsk-bun-sqlite is 2.1x faster** than both competitors.

### Correctness Analysis

#### mmvsk-bun-sqlite ✅ **RECOMMENDED**
- ✅ **100% test pass rate** (26/26 performance tests)
- ✅ All CRUD operations work correctly
- ✅ All relations and JOINs work
- ✅ All type conversions (BigInt, Decimal, BLOB, JSON, DateTime)
- ✅ Transactions (commit & rollback) work correctly
- ✅ **Foreign key constraints enforced** (referential integrity)
- ✅ Proper Prisma error codes (P2002, P2003, etc.)
- ✅ WAL mode enabled for better concurrency
- ✅ Busy timeout configured (handles database locking)
- **Production-ready** ✨

#### prisma-libsql ⚠️ **ACCEPTABLE**
- ✅ 100% test pass rate (26/26 tests)
- ✅ Foreign keys enforced
- ✅ Proper error handling
- ⚠️ **2.1x slower** than mmvsk-bun-sqlite
- ⚠️ Designed for remote databases (libsql/Turso)
- ⚠️ Uses rollback journal mode (less concurrency than WAL)
- Best for Turso cloud databases, not local SQLite

#### abcx3-bun-sql ❌ **NOT RECOMMENDED**
- ❌ **73% test failure rate** (only 7/26 tests pass)
- ❌ **Foreign keys DISABLED** (`foreign_keys = OFF`) - **DATA CORRUPTION RISK**
- ❌ Connection reservation not supported (fails on most Prisma features)
- ❌ Returns raw SQLite error codes instead of Prisma codes
- ❌ Most relation queries fail
- ❌ Most transactions fail
- ❌ Aggregations fail
- ❌ Raw queries ($queryRaw) fail
- **DO NOT USE IN PRODUCTION** ⚠️

### Key Findings

1. **mmvsk-bun-sqlite is the clear winner**: 2.1x faster with 100% correctness
2. **prisma-libsql is reliable but slower**: Good for Turso, not optimal for local SQLite
3. **abcx3-bun-sql is fundamentally broken**: 73% failure rate, no foreign key enforcement

### SQLite Configuration Comparison

| Setting | mmvsk-bun-sqlite | prisma-libsql | abcx3-bun-sql |
|---------|------------------|---------------|---------------|
| **journal_mode** | WAL (better concurrency) | DELETE (rollback) | DELETE (rollback) |
| **foreign_keys** | ✅ ON | ✅ ON | ❌ **OFF** |
| **busy_timeout** | 5000ms | 0ms | 0ms |
| **synchronous** | Default | FULL | FULL |

## Development

### Adding New Tests

**Benchmark tests**: Add to `src/tests.ts` in the `benchmarkTests` array.

**Correctness tests**: Add to `tests/adapters.test.ts` as a new `test()` block.

### Testing Individual Adapters

Edit `src/index.ts` or `tests/adapters.test.ts` and modify the `ADAPTERS` array to test specific adapters only.

## Configuration

### Client Factory

The `createClient()` function in `src/client.ts` handles adapter initialization:

```typescript
import { createClient } from "@/client";

const prisma = await createClient("mmvsk-bun-sqlite", ":memory:");
```

### Database Schema

Defined in `prisma/schema.prisma`. After changes:

```bash
bunx prisma generate
```

## Environment

- **Bun**: 1.3.2+
- **Prisma**: 7.0.0
- **Platform**: Linux/macOS
- **Database**: SQLite (:memory: or file-based)

## Notes

### Database Storage

- Benchmarks use file-based databases stored in `data/` directory
- All tests use file-based databases (not `:memory:`) because prisma-libsql doesn't support `:memory:` properly
- Each test gets a clean database for isolation

### tmpfs Testing (Optional)

For rapid development/testing, you can symlink `data/` to tmpfs to reduce SSD wear:
```bash
ln -s /tmp/bench-data data
```

**Note**: Benchmark results on tmpfs will differ from real disk results due to:
- tmpfs eliminates physical disk I/O, making file operation count the bottleneck
- WAL mode (used by mmvsk-bun-sqlite) requires more file operations but provides better concurrency and safety
- On real disks, WAL mode is faster; on tmpfs, simpler journal modes appear faster
- **Published results above are from real disk (SSD)** for production-realistic benchmarks

### Other Notes

- Type checking ensures all code is type-safe
- Tests run with Prisma 7.0.0 on Bun 1.3.2+

## License

MIT

## Links

- [prisma-adapter-bun-sqlite](https://github.com/mmvsk/prisma-adapter-bun-sqlite)
- [Prisma Docs](https://www.prisma.io/docs)
- [Bun Docs](https://bun.sh/docs)
