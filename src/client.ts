import { PrismaClient } from "@/prisma-generated/client";
import { resolve } from "node:path";


export type { PrismaClient };

export type AdapterName = (
	| "mmvsk-bun-sqlite"
	| "prisma-libsql"
	| "abcx3-bun-sql"
);

export async function createClient(name: AdapterName, inMemory?: boolean) {
	const url = getUrl(name, inMemory);

	if (name === "mmvsk-bun-sqlite") {
		const { PrismaBunSqlite } = await import("prisma-adapter-bun-sqlite");
		const adapter = new PrismaBunSqlite({ url });
		return new PrismaClient({ adapter, log: [] });
	}

	if (name === "prisma-libsql") {
		const { PrismaLibSql } = await import("@prisma/adapter-libsql");
		const adapter = new PrismaLibSql({ url });
		return new PrismaClient({ adapter, log: [] });
	}

	if (name === "abcx3-bun-sql") {
		const { BunSQLiteAdapter } = await import("@abcx3/prisma-bun-adapter");
		const adapter = new BunSQLiteAdapter(url);
		return new PrismaClient({ adapter, log: [] });
	}

	throw new Error(`Unknown adapter: ${name}`);
}

export async function removeDatabase(name: AdapterName) {
	const url = getUrl(name, false);
	const dbPath = Bun.fileURLToPath(url);
	await Bun.$`rm '${dbPath}'`;
}

export function getDataDir() {
	const rootDir = resolve(import.meta.dir, "..");
	const dataDir = resolve(rootDir, "data");
	return dataDir;
}

export function getPath(name: AdapterName) {
	const dbPath = resolve(getDataDir(), `db-${name}.sqlite`);
	return dbPath;
}

function getUrl(name: AdapterName, inMemory?: boolean) {
	if (inMemory) {
		if (name === "prisma-libsql") {
			throw new Error("Adapter prisma-libsql won't work in :memory:");
		}

		return ":memory:" as const;
	}

	return Bun.pathToFileURL(getPath(name)).toString();
}
