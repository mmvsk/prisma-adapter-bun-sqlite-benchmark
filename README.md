# Prisma SQLite Adapters Benchmark

Comprehensive performance and correctness benchmark comparing Prisma SQLite adapters for Bun runtime with Prisma 7.0.0.

This benchmark was created to evaluate **[prisma-adapter-bun-sqlite](https://github.com/mmvsk/prisma-adapter-bun-sqlite)** against competing SQLite adapters for Bun.

---

## 🏆 Benchmark Results (Real Disk - SSD)

**Test Environment:**
- **Hardware**: SSD (real disk, not tmpfs)
- **Bun**: 1.3.2
- **Prisma**: 7.0.0
- **Date**: November 2025

### Performance Summary - All Tests (26 tests)

| Adapter | Tests Passed | Tests Failed | Pass Rate | Avg Ops/Sec |
|---------|--------------|--------------|-----------|-------------|
| **prisma-adapter-bun-sqlite** | **26/26** ✅ | 0 | **100%** | 287 |
| **@prisma/adapter-libsql** | 26/26 ✅ | 0 | 100% | 139 |
| **@abcx3/prisma-bun-adapter** | 7/26 ❌ | 19 | 27% | 322* |

\* *Note: @abcx3/prisma-bun-adapter average is misleading - calculated across all 26 tests including 19 failures*

### Fair Comparison - Common Passing Tests (7 tests)

Only comparing tests that **ALL adapters can pass**:

| Adapter | Avg Ops/Sec | Winner |
|---------|-------------|--------|
| **prisma-adapter-bun-sqlite** | **242** | **🏆 2.1x faster** |
| @prisma/adapter-libsql | 115 | - |
| @abcx3/prisma-bun-adapter | 111 | - |

**Conclusion**: When comparing the same tests, **[prisma-adapter-bun-sqlite](https://github.com/mmvsk/prisma-adapter-bun-sqlite) is 2.1x faster** than both competitors.

### Correctness Analysis

#### ✅ prisma-adapter-bun-sqlite **RECOMMENDED**

**[`prisma-adapter-bun-sqlite`](https://github.com/mmvsk/prisma-adapter-bun-sqlite)** - Native Bun SQLite adapter

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

#### ⚠️ @prisma/adapter-libsql **ACCEPTABLE**

**[`@prisma/adapter-libsql`](https://www.prisma.io/docs/orm/overview/databases/turso)** - Official Prisma adapter for Turso

- ✅ 100% test pass rate (26/26 tests)
- ✅ Foreign keys enforced
- ✅ Proper error handling
- ⚠️ **2.1x slower** than prisma-adapter-bun-sqlite
- ⚠️ Designed for remote databases ([libsql/Turso](https://turso.tech))
- ⚠️ Uses rollback journal mode (less concurrency than WAL)
- ℹ️ **Note**: This is the only official Prisma adapter that works with Bun ([`@prisma/adapter-better-sqlite3`](https://www.prisma.io/docs/orm/overview/databases/sqlite) is Node.js-only). See [Bun's Prisma guide](https://bun.sh/docs/guides/ecosystem/prisma).
- Best for Turso cloud databases, acceptable for local SQLite

#### ❌ @abcx3/prisma-bun-adapter **NOT RECOMMENDED**

**[`@abcx3/prisma-bun-adapter`](https://github.com/FredrikBorgstrom/prisma-bun-adapter)** - Community Bun adapter

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

1. **[`prisma-adapter-bun-sqlite`](https://github.com/mmvsk/prisma-adapter-bun-sqlite) is the clear winner**: 2.1x faster with 100% correctness
2. **`@prisma/adapter-libsql` is reliable but slower**: Good for Turso, acceptable for local SQLite
3. **`@abcx3/prisma-bun-adapter` is fundamentally broken**: 73% failure rate, no foreign key enforcement

### SQLite Configuration Comparison

| Setting | prisma-adapter-bun-sqlite | @prisma/adapter-libsql | @abcx3/prisma-bun-adapter |
|---------|---------------------------|------------------------|---------------------------|
| **journal_mode** | WAL (better concurrency) | DELETE (rollback) | DELETE (rollback) |
| **foreign_keys** | ✅ ON | ✅ ON | ❌ **OFF** |
| **busy_timeout** | 5000ms | 0ms | 0ms |
| **synchronous** | Default | FULL | FULL |

---

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/mmvsk/prisma-adapter-bun-sqlite-benchmark.git
cd prisma-adapter-bun-sqlite-benchmark
bun install
```

### Run Benchmarks

```bash
# Run performance benchmarks for all adapters
bun start

# Run correctness tests
bun test

# Type check
bun run tsc --noEmit
```

---

## 📋 Test Coverage

### Adapters Tested

1. **[`prisma-adapter-bun-sqlite`](https://github.com/mmvsk/prisma-adapter-bun-sqlite)**
   - Native Bun SQLite implementation
   - 100% test compatibility
   - Production-ready with full feature support

2. **[`@prisma/adapter-libsql`](https://www.prisma.io/docs/orm/overview/databases/turso)**
   - Official Prisma adapter for libSQL/Turso
   - Designed for remote databases ([Turso](https://turso.tech))
   - The only official Prisma adapter that works with Bun ([`@prisma/adapter-better-sqlite3`](https://www.prisma.io/docs/orm/overview/databases/sqlite) is Node.js-only)
   - Documented in [Bun's Prisma guide](https://bun.sh/docs/guides/ecosystem/prisma)
   - Works but slower for local SQLite

3. **[`@abcx3/prisma-bun-adapter`](https://github.com/FredrikBorgstrom/prisma-bun-adapter)**
   - Community Bun SQLite implementation
   - Critical bugs: no connection reservation, disabled foreign keys
   - Not recommended for production use

### Performance Tests (26 total)

- **CRUD Operations** (7 tests): Create, Read, Update, Delete
- **Relations** (4 tests): JOINs, nested creates, cascade deletes
- **Filtering** (4 tests): Boolean, date, pagination, complex queries
- **Types** (4 tests): BigInt, Decimal, Bytes (BLOB), JSON
- **Transactions** (2 tests): Commit, rollback
- **Aggregations** (3 tests): Count, aggregate, group by
- **Raw Queries** (2 tests): $queryRaw, $executeRaw

### Correctness Tests (8 total)

1. **JOIN Duplicate Column Handling** - Ensures no data corruption
2. **BLOB Serialization** - Bytes/BLOB round-trip
3. **Boolean Type Conversion** - 1/0 conversion
4. **DateTime Type Conversion** - ISO8601 handling
5. **BigInt Handling** - Large integer preservation
6. **Error Code Mapping** - Proper Prisma error codes (P2002, P2003, etc.)
7. **Foreign Key Enforcement** - Referential integrity
8. **Cascade Delete** - ON DELETE CASCADE behavior

---

## 🛠️ Development

### Project Structure

```
.
├── src/
│   ├── client.ts          # Adapter factory (createClient)
│   ├── tests.ts           # Benchmark test definitions
│   └── index.ts           # Benchmark runner (bun start)
├── tests/
│   └── adapters.test.ts   # Correctness tests (bun test)
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── generated/         # Generated Prisma Client
├── package.json
└── tsconfig.json
```

### Adding New Tests

**Performance tests**: Add to `src/tests.ts` in the `benchmarkTests` array.

**Correctness tests**: Add to `tests/adapters.test.ts` as a new `test()` block.

### Testing Specific Adapters

Edit `src/index.ts` and modify the `AdapterNames` array to test specific adapters only:

```typescript
const AdapterNames: AdapterName[] = [
  "mmvsk-bun-sqlite",
  // "prisma-libsql",
  // "abcx3-bun-sql",
];
```

---

## 📝 Notes

### Database Storage

- Benchmarks use file-based databases stored in `data/` directory
- All tests use file-based databases (not `:memory:`) because `@prisma/adapter-libsql` doesn't support `:memory:` properly
- Each test gets a clean database for isolation

### tmpfs Testing (Optional)

For rapid development/testing, you can symlink `data/` to tmpfs to reduce SSD wear:

```bash
rm -rf data
ln -s /tmp/bench-data data
```

**Important**: Benchmark results on tmpfs will differ from real disk results:
- tmpfs eliminates physical disk I/O, making file operation count the bottleneck
- WAL mode (used by `prisma-adapter-bun-sqlite`) requires more file operations but provides better concurrency and safety
- On real disks, WAL mode is faster; on tmpfs, simpler journal modes appear faster
- **Published results above are from real disk (SSD)** for production-realistic benchmarks

---

## 📦 Related Projects

- **[`prisma-adapter-bun-sqlite`](https://github.com/mmvsk/prisma-adapter-bun-sqlite)** - The fastest Prisma SQLite adapter for Bun (this is what we're benchmarking!)
- [`@prisma/adapter-libsql`](https://www.prisma.io/docs/orm/overview/databases/turso) - Official Prisma adapter for libSQL/Turso
- [`@prisma/adapter-better-sqlite3`](https://www.prisma.io/docs/orm/overview/databases/sqlite) - Official Prisma adapter for better-sqlite3 (Node.js only, not compatible with Bun)
- [`@abcx3/prisma-bun-adapter`](https://github.com/FredrikBorgstrom/prisma-bun-adapter) - Community Bun adapter (not recommended)
- [Bun's Prisma Guide](https://bun.sh/docs/guides/ecosystem/prisma) - Official Bun documentation for using Prisma
- [Prisma Docs](https://www.prisma.io/docs) - Prisma ORM documentation
- [Bun Docs](https://bun.sh/docs) - Bun runtime documentation

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

This benchmark was created to evaluate **[prisma-adapter-bun-sqlite](https://github.com/mmvsk/prisma-adapter-bun-sqlite)** and ensure it provides the best performance and correctness for Bun + SQLite + Prisma users.
