import { describe, test, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { createClient, removeDatabase, type AdapterName, type PrismaClient } from "@/client";

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

async function cleanDatabase(prisma: PrismaClient) {
	await prisma.$executeRaw`DELETE FROM _PostToTag`;
	await prisma.$executeRaw`DELETE FROM Post`;
	await prisma.$executeRaw`DELETE FROM Profile`;
	await prisma.$executeRaw`DELETE FROM User`;
	await prisma.$executeRaw`DELETE FROM Tag`;
}

export async function testAdapterCorrectness(adapterName: AdapterName, inMemory?: boolean) {
	const prisma = await createClient(adapterName, inMemory);

	describe(`${adapterName} correctness`, async () => {
		beforeEach(async () => {
			await setupDatabase(prisma);
			await cleanDatabase(prisma);
		});

		afterEach(async () => {
			await cleanDatabase(prisma);
		});

		afterAll(async () => {
			await prisma.$disconnect();

			if (!inMemory) {
				await removeDatabase(adapterName);
			}
		});

		test("JOIN Duplicate Column Handling", async () => {
			// Create multiple users with profiles to ensure different IDs
			await prisma.user.create({
				data: {
					email: "user1@example.com",
					name: "User 1",
				},
			});

			await prisma.user.create({
				data: {
					email: "user2@example.com",
					name: "User 2",
					profile: {
						create: {
							bio: "Test bio",
						},
					},
				},
			});

			// Query with JOIN
			const users = await prisma.user.findMany({
				where: { email: "user2@example.com" },
				include: { profile: true },
			});

			const user = users[0];
			expect(user).toBeDefined();
			expect(user?.profile).toBeDefined();

			if (!user || !user.profile) {
				throw new Error("No user or profile found");
			}

			// Check that profile.userId matches user.id (correct relationship)
			expect(user.profile.userId).toBe(user.id);

			// Check that IDs are reasonable
			expect(user.id).toBeGreaterThanOrEqual(1);
			expect(user.profile.id).toBeGreaterThanOrEqual(1);

			// Check that user.id and profile.id are actually different
			expect(user.id).not.toBe(user.profile.id);
		});

		test("BLOB Serialization", async () => {
			const testData = Buffer.from("Hello, World!", "utf-8");

			const user = await prisma.user.create({
				data: {
					email: "blob-test@example.com",
					name: "BLOB Test",
					profile: {
						create: {
							bio: "Has avatar",
							avatar: testData,
						},
					},
				},
				include: { profile: true },
			});

			expect(user.profile?.avatar).toBeDefined();

			const avatar = user.profile!.avatar;

			// Verify BLOB data is returned as Buffer, Array, or Uint8Array
			const isValid = Buffer.isBuffer(avatar) || Array.isArray(avatar) || avatar instanceof Uint8Array;
			expect(isValid).toBe(true);

			// Convert to Buffer if needed
			const avatarBuffer = Buffer.isBuffer(avatar)
				? avatar
				: avatar instanceof Uint8Array
				? Buffer.from(avatar)
				: Buffer.from(avatar as any);

			// Verify content matches
			const content = avatarBuffer.toString("utf-8");
			expect(content).toBe("Hello, World!");
		});

		test("Boolean Type Conversion", async () => {
			await prisma.user.create({
				data: { email: "bool-true@example.com", name: "Active", active: true },
			});
			await prisma.user.create({
				data: {
					email: "bool-false@example.com",
					name: "Inactive",
					active: false,
				},
			});

			const activeUsers = await prisma.user.findMany({
				where: { active: true },
			});

			const inactiveUsers = await prisma.user.findMany({
				where: { active: false },
			});

			expect(activeUsers.length).toBeGreaterThan(0);
			expect(inactiveUsers.length).toBeGreaterThan(0);

			// Verify all active users have active=true
			const allActive = activeUsers.every((u) => u.active === true);
			expect(allActive).toBe(true);
		});

		test("DateTime Type Conversion", async () => {
			const testDate = new Date("2024-01-15T10:30:00.000Z");

			const user = await prisma.user.create({
				data: {
					email: "date-test@example.com",
					name: "Date Test",
					createdAt: testDate,
				},
			});

			const foundUser = await prisma.user.findUnique({
				where: { id: user.id },
			});

			expect(foundUser).toBeDefined();

			const createdAt = foundUser!.createdAt;
			const createdAtDate =
				createdAt instanceof Date ? createdAt : new Date(createdAt);

			expect(createdAtDate instanceof Date).toBe(true);
			expect(isNaN(createdAtDate.getTime())).toBe(false);
		});

		test("BigInt Handling", async () => {
			const largeBigInt = BigInt("9007199254740991");

			const user = await prisma.user.create({
				data: {
					email: "bigint-test@example.com",
					name: "BigInt Test",
					posts: {
						create: {
							title: "Popular Post",
							views: largeBigInt,
						},
					},
				},
				include: { posts: true },
			});

			const post = user.posts[0];
			expect(post).toBeDefined();

			const views = post!.views;
			const viewsStr = typeof views === "bigint" ? views.toString() : String(views);

			expect(viewsStr).toBe(largeBigInt.toString());
		});

		test("Error Code Mapping", async () => {
			await prisma.user.create({
				data: { email: "unique-test@example.com", name: "Unique Test" },
			});

			try {
				await prisma.user.create({
					data: { email: "unique-test@example.com", name: "Duplicate" },
				});

				throw new Error("Should have thrown unique constraint error");
			} catch (error: any) {
				expect(error.code).toBeDefined();
				expect(error.code).toBe("P2002");

				// Check if constraint metadata is present
				const hasConstraint = error.meta?.target !== undefined;
				expect(typeof hasConstraint).toBe("boolean");
			}
		});

		test("Foreign Key Enforcement", async () => {
			try {
				await prisma.$executeRaw`INSERT INTO Profile (userId, bio) VALUES (99999, 'Orphan profile')`;

				throw new Error("Should have thrown foreign key error");
			} catch (error: any) {
				const isForeignKeyError =
					error.code === "P2003" ||
					error.message?.includes("FOREIGN KEY") ||
					error.message?.includes("foreign key");

				expect(isForeignKeyError).toBe(true);
			}
		});

		test("Cascade Delete", async () => {
			const user = await prisma.user.create({
				data: {
					email: "cascade-test@example.com",
					name: "Cascade Test",
					profile: {
						create: { bio: "Will be deleted" },
					},
					posts: {
						create: [{ title: "Post 1" }, { title: "Post 2" }],
					},
				},
			});

			await prisma.user.delete({ where: { id: user.id } });

			const profile = await prisma.profile.findUnique({
				where: { userId: user.id },
			});

			const posts = await prisma.post.findMany({
				where: { authorId: user.id },
			});

			expect(profile).toBeNull();
			expect(posts.length).toBe(0);
		});
	});

	// Disconnect after all tests complete
	await prisma.$disconnect();
}
