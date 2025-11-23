import { PrismaClient } from "@/prisma-generated/client";
import { resolve } from "node:path";

export type { PrismaClient };

export type AdapterName = (typeof AdapterNames)[number];
export const AdapterNames = <const>[
	"mmvsk-bun-sqlite",
	"nogo-bun-sqlite",
	"prisma-libsql",
];

export async function createClient(name: AdapterName, dataDir?: string) {
	const url = dataDir ? getFileUrl(name, dataDir) : ":memory:";

	if (name === "mmvsk-bun-sqlite") {
		const { PrismaBunSqlite } = await import("prisma-adapter-bun-sqlite");
		const adapter = new PrismaBunSqlite({ url });
		return new PrismaClient({ adapter, log: [] });
	}

	if (name === "nogo-bun-sqlite") {
		const { PrismaBunSQLite } = await import(
			"@synapsenwerkstatt/prisma-bun-sqlite-adapter"
		);
		const adapter = new PrismaBunSQLite({ url });
		return new PrismaClient({ adapter, log: [] });
	}

	if (name === "prisma-libsql") {
		const { PrismaLibSql } = await import("@prisma/adapter-libsql");
		const adapter = new PrismaLibSql({ url });
		return new PrismaClient({ adapter, log: [] });
	}

	throw new Error(`Unknown adapter: ${name}`);
}

export function getFilePath(name: AdapterName, dataDir: string) {
	return resolve(dataDir, `db-${name}.sqlite`);
}

function getFileUrl(name: AdapterName, dataDir: string) {
	return Bun.pathToFileURL(getFilePath(name, dataDir)).toString();
}
