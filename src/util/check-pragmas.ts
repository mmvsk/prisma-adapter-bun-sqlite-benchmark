import { createClient, type AdapterName } from "@/client";
import { Prisma } from "@/prisma-generated/client";

const ADAPTERS: AdapterName[] = [
	"mmvsk-bun-sqlite",
	"prisma-libsql",
	"abcx3-bun-sql",
];

for (const adapter of ADAPTERS) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`📦 ${adapter}`);
	console.log("=".repeat(60));

	try {
		const prisma = await createClient(adapter);

		// Check key pragmas
		const pragmas = [
			"journal_mode",
			"synchronous",
			"foreign_keys",
			"busy_timeout",
			"cache_size",
			"temp_store",
		];

		for (const pragma of pragmas) {
			try {
				const result = await prisma.$queryRaw(
					Prisma.sql([`PRAGMA ${pragma}`])
				);
				console.log(`  ${pragma.padEnd(20)}: ${JSON.stringify(result)}`);
			} catch (error) {
				console.log(`  ${pragma.padEnd(20)}: ERROR`);
			}
		}

		await prisma.$disconnect();
	} catch (error) {
		console.log(`  ❌ Failed to create client: ${error}`);
	}
}
