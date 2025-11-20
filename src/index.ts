import { createClient, type AdapterName, type PrismaClient } from "@/client";
import { benchmarkTests, getAllCategories, type BenchmarkTest } from "@/tests";
import { getDataDir, getPath } from "@/client";

const AdapterNames: AdapterName[] = [
	"mmvsk-bun-sqlite",
	"prisma-libsql",
	"abcx3-bun-sql",
];

interface BenchmarkResult {
	adapter: string;
	test: string;
	category: string;
	iterations: number;
	totalTime: number;
	avgTime: number;
	opsPerSecond: number;
	passed: boolean;
	error?: string;
}

interface AdapterSummary {
	adapter: string;
	totalTests: number;
	passedTests: number;
	failedTests: number;
	totalTime: number;
	avgTimePerTest: number;
	totalOps: number;
	avgOpsPerSecond: number;
}

async function setupDatabase(prisma: PrismaClient) {
	await prisma.$executeRaw`
		CREATE TABLE IF NOT EXISTS User (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT UNIQUE NOT NULL,
			name TEXT,
			active INTEGER DEFAULT 1,
			balance REAL DEFAULT 0,
			createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
			metadata TEXT
		)
	`;

	await prisma.$executeRaw`
		CREATE TABLE IF NOT EXISTS Profile (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			userId INTEGER UNIQUE NOT NULL,
			bio TEXT,
			avatar BLOB,
			FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
		)
	`;

	await prisma.$executeRaw`
		CREATE TABLE IF NOT EXISTS Post (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			content TEXT,
			published INTEGER DEFAULT 0,
			views TEXT DEFAULT '0',
			authorId INTEGER NOT NULL,
			FOREIGN KEY (authorId) REFERENCES User(id) ON DELETE CASCADE
		)
	`;

	await prisma.$executeRaw`
		CREATE TABLE IF NOT EXISTS Tag (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL
		)
	`;

	await prisma.$executeRaw`
		CREATE TABLE IF NOT EXISTS _PostToTag (
			A INTEGER NOT NULL,
			B INTEGER NOT NULL,
			FOREIGN KEY (A) REFERENCES Post(id) ON DELETE CASCADE,
			FOREIGN KEY (B) REFERENCES Tag(id) ON DELETE CASCADE,
			UNIQUE(A, B)
		)
	`;
}

async function runBenchmark(
	prisma: PrismaClient,
	test: BenchmarkTest,
	adapterName: string
): Promise<BenchmarkResult> {
	const iterations = test.iterations || 10;

	try {
		// Clean database
		await prisma.$executeRaw`DELETE FROM _PostToTag`;
		await prisma.$executeRaw`DELETE FROM Post`;
		await prisma.$executeRaw`DELETE FROM Profile`;
		await prisma.$executeRaw`DELETE FROM User`;
		await prisma.$executeRaw`DELETE FROM Tag`;

		// Run setup if provided
		if (test.setup) {
			await test.setup(prisma);
		}

		// Warm-up run
		await test.run(prisma);

		// Benchmark runs
		const startTime = performance.now();

		for (let i = 0; i < iterations; i++) {
			await test.run(prisma);
		}

		const endTime = performance.now();
		const totalTime = endTime - startTime;
		const avgTime = totalTime / iterations;
		const opsPerSecond = (1000 / avgTime) * iterations;

		// Validate result if validation function provided
		let validationPassed = true;
		if (test.validateResult) {
			validationPassed = await test.validateResult(prisma);
		}

		return {
			adapter: adapterName,
			test: test.name,
			category: test.category,
			iterations,
			totalTime,
			avgTime,
			opsPerSecond: opsPerSecond / iterations,
			passed: validationPassed,
		};
	} catch (error) {
		return {
			adapter: adapterName,
			test: test.name,
			category: test.category,
			iterations,
			totalTime: 0,
			avgTime: 0,
			opsPerSecond: 0,
			passed: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function runAdapterBenchmarks(
	adapter: AdapterName
): Promise<BenchmarkResult[]> {
	console.log(`📦 ${adapter}`);

	const results: BenchmarkResult[] = [];
	let prisma: PrismaClient | undefined;

	try {
		prisma = await createClient(adapter);
		await setupDatabase(prisma);

		const categories = getAllCategories();

		for (const category of categories) {
			const categoryTests = benchmarkTests.filter(
				(t) => t.category === category
			);

			for (const test of categoryTests) {
				const result = await runBenchmark(prisma, test, adapter);
				results.push(result);

				const icon = result.passed ? "✓" : "✗";
				const speed = result.opsPerSecond > 0 ? `${result.opsPerSecond.toFixed(0)} ops/sec` : "failed";
				const status = result.error ? `(${result.error.split("\n")[0]!.substring(0, 60)}...)` : "";

				console.log(`  ${icon} ${test.name.padEnd(45)} ${speed.padStart(12)} ${status}`);
			}
		}

		return results;
	} catch (error) {
		console.log(`  ❌ Setup failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
		return results;
	} finally {
		if (prisma) {
			await prisma.$disconnect();
		}
	}
}

function calculateSummary(results: BenchmarkResult[]): AdapterSummary {
	const passed = results.filter((r) => r.passed && !r.error);
	const failed = results.filter((r) => !r.passed || r.error);

	const totalTime = results.reduce((sum, r) => sum + r.totalTime, 0);
	const totalOps = results.reduce((sum, r) => sum + r.iterations, 0);
	const totalOpsTime = results.reduce((sum, r) => sum + r.totalTime, 0);

	return {
		adapter: results[0]?.adapter || "Unknown",
		totalTests: results.length,
		passedTests: passed.length,
		failedTests: failed.length,
		totalTime,
		avgTimePerTest: totalTime / results.length,
		totalOps,
		avgOpsPerSecond: totalOps / (totalOpsTime / 1000),
	};
}

function printSummaryTable(summaries: AdapterSummary[], allResults: BenchmarkResult[][]) {
	console.log("\n" + "=".repeat(80));
	console.log("📊 Summary - All Tests");
	console.log("=".repeat(80));

	console.log(
		`\n${"Adapter".padEnd(25)} ${"Passed".padStart(8)} ${"Failed".padStart(8)} ${"Avg Ops/Sec".padStart(15)}`
	);
	console.log("-".repeat(80));

	for (const summary of summaries) {
		const passRate = ((summary.passedTests / summary.totalTests) * 100).toFixed(0);
		console.log(
			`${summary.adapter.padEnd(25)} ${String(summary.passedTests).padStart(8)} ${String(summary.failedTests).padStart(8)} ${summary.avgOpsPerSecond.toFixed(0).padStart(15)} (${passRate}%)`
		);
	}

	if (summaries.length === 0) {
		console.log("\n⚠️  No results");
		return;
	}

	// Find common passing tests (tests that ALL adapters passed)
	const commonPassingTests = findCommonPassingTests(allResults);

	if (commonPassingTests.size > 0) {
		console.log("\n" + "=".repeat(80));
		console.log(`📊 Fair Comparison - Common Passing Tests (${commonPassingTests.size}/${benchmarkTests.length})`);
		console.log("=".repeat(80));

		console.log(
			`\n${"Adapter".padEnd(25)} ${"Common Tests".padStart(14)} ${"Avg Ops/Sec".padStart(15)}`
		);
		console.log("-".repeat(80));

		const fairSummaries: Array<{adapter: string, avgOps: number, testCount: number}> = [];

		for (const results of allResults) {
			const commonResults = results.filter(r => commonPassingTests.has(r.test));
			const totalOps = commonResults.reduce((sum, r) => sum + r.iterations, 0);
			const totalTime = commonResults.reduce((sum, r) => sum + r.totalTime, 0);
			const avgOpsPerSec = totalOps / (totalTime / 1000);

			fairSummaries.push({
				adapter: results[0]?.adapter || "Unknown",
				avgOps: avgOpsPerSec,
				testCount: commonResults.length
			});
		}

		for (const summary of fairSummaries) {
			console.log(
				`${summary.adapter.padEnd(25)} ${String(summary.testCount).padStart(14)} ${summary.avgOps.toFixed(0).padStart(15)}`
			);
		}

		const fairFastest = fairSummaries.reduce((prev, curr) =>
			curr.avgOps > prev.avgOps ? curr : prev
		);

		console.log(`\n🏆 Fastest (fair comparison): ${fairFastest.adapter} (${fairFastest.avgOps.toFixed(0)} ops/sec)`);
	}
}

function findCommonPassingTests(allResults: BenchmarkResult[][]): Set<string> {
	if (allResults.length === 0) return new Set();

	// Get tests that passed for the first adapter
	const firstAdapterPassed = new Set(
		allResults[0]!.filter(r => r.passed && !r.error).map(r => r.test)
	);

	// Intersect with tests that passed for all other adapters
	for (let i = 1; i < allResults.length; i++) {
		const adapterPassed = new Set(
			allResults[i]!.filter(r => r.passed && !r.error).map(r => r.test)
		);

		// Keep only tests that are in both sets
		for (const test of firstAdapterPassed) {
			if (!adapterPassed.has(test)) {
				firstAdapterPassed.delete(test);
			}
		}
	}

	return firstAdapterPassed;
}

async function main() {
	const dataDir = getDataDir();

	console.log("🚀 Prisma SQLite Adapters Benchmark");
	console.log("=".repeat(80));
	console.log(`Bun: ${Bun.version} | Date: ${new Date().toISOString()}`);
	console.log(`\nTesting ${AdapterNames.length} adapters: ${AdapterNames.join(", ")}`);
	console.log();

	await Bun.$`test -d '${dataDir}' || exit 1`;

	// Run benchmarks for each adapter
	const allResults: BenchmarkResult[][] = [];

	for (const adapter of AdapterNames) {
		const results = await runAdapterBenchmarks(adapter);
		allResults.push(results);
	}

	for (const dbPath of AdapterNames.map(getPath)) {
		await Bun.$`rm '${dbPath}'`;
	}

	// Calculate and print summary
	const summaries = allResults.map(calculateSummary);
	printSummaryTable(summaries, allResults);

	console.log("\n✓ Benchmark complete\n");
}

if (import.meta.main) {
	await main();
}

export { runAdapterBenchmarks, calculateSummary };
