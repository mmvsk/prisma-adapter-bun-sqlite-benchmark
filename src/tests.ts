import type { PrismaClient } from "@/prisma-generated/client";

export interface BenchmarkTest {
	name: string;
	category: string;
	setup?: (prisma: PrismaClient) => Promise<void>;
	run: (prisma: PrismaClient) => Promise<void>;
	iterations?: number;
	validateResult?: (prisma: PrismaClient) => Promise<boolean>;
}

export const benchmarkTests: BenchmarkTest[] = [
	// ==================== CRUD Operations ====================
	{
		name: "Create single user",
		category: "CRUD",
		iterations: 100,
		run: async (prisma) => {
			await prisma.user.create({
				data: {
					email: `user_${Date.now()}_${Math.random()}@test.com`,
					name: "Test User",
					active: true,
				},
			});
		},
	},

	{
		name: "Create user with profile",
		category: "CRUD",
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.create({
				data: {
					email: `user_${Date.now()}_${Math.random()}@test.com`,
					name: "Test User",
					profile: {
						create: {
							bio: "Test bio",
						},
					},
				},
			});
		},
	},

	{
		name: "Bulk create users",
		category: "CRUD",
		iterations: 20,
		run: async (prisma) => {
			const users = Array.from({ length: 10 }, (_, i) => ({
				email: `bulk_${Date.now()}_${i}_${Math.random()}@test.com`,
				name: `User ${i}`,
				active: i % 2 === 0,
			}));
			await prisma.user.createMany({ data: users });
		},
	},

	{
		name: "Find all users",
		category: "CRUD",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 100 }, (_, i) => ({
					email: `setup_${i}@test.com`,
					name: `User ${i}`,
				})),
			});
		},
		iterations: 100,
		run: async (prisma) => {
			await prisma.user.findMany();
		},
	},

	{
		name: "Find user by ID",
		category: "CRUD",
		setup: async (prisma) => {
			await prisma.user.create({
				data: { email: "findme@test.com", name: "Find Me" },
			});
		},
		iterations: 200,
		run: async (prisma) => {
			await prisma.user.findUnique({ where: { id: 1 } });
		},
	},

	{
		name: "Update user",
		category: "CRUD",
		setup: async (prisma) => {
			// Create user for repeated updates
			await prisma.user.create({
				data: { email: "update@test.com", name: "Original" },
			});
		},
		iterations: 100,
		run: async (prisma) => {
			// Find and update the user (idempotent operation)
			const user = await prisma.user.findFirst({ where: { email: "update@test.com" } });
			if (user) {
				await prisma.user.update({
					where: { id: user.id },
					data: { name: "Updated" },
				});
			}
		},
	},

	{
		name: "Delete user",
		category: "CRUD",
		setup: async (prisma) => {
			// Create enough users for warmup + all iterations
			await prisma.user.createMany({
				data: Array.from({ length: 110 }, (_, i) => ({
					email: `delete_${i}@test.com`,
					name: `Delete User ${i}`,
				})),
			});
		},
		iterations: 100,
		run: async (prisma) => {
			// Delete any user (find first and delete)
			const user = await prisma.user.findFirst({ where: { email: { startsWith: "delete_" } } });
			if (user) {
				await prisma.user.delete({ where: { id: user.id } });
			}
		},
	},

	// ==================== Relations & JOINs ====================
	{
		name: "Find users with profiles (JOIN)",
		category: "Relations",
		setup: async (prisma) => {
			for (let i = 0; i < 20; i++) {
				await prisma.user.create({
					data: {
						email: `join_${i}@test.com`,
						name: `User ${i}`,
						profile: {
							create: { bio: `Bio ${i}` },
						},
					},
				});
			}
		},
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.findMany({
				include: { profile: true },
			});
		},
		validateResult: async (prisma) => {
			const users = await prisma.user.findMany({
				include: { profile: true },
			});
			return users.every((user) => user.id !== user.profile?.id);
		},
	},

	{
		name: "Find users with posts (1-to-many)",
		category: "Relations",
		setup: async (prisma) => {
			for (let i = 0; i < 10; i++) {
				await prisma.user.create({
					data: {
						email: `author_${i}@test.com`,
						name: `Author ${i}`,
						posts: {
							create: [
								{ title: "Post 1", content: "Content 1" },
								{ title: "Post 2", content: "Content 2" },
							],
						},
					},
				});
			}
		},
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.findMany({
				include: { posts: true },
			});
		},
	},

	{
		name: "Nested create (user + profile + posts)",
		category: "Relations",
		iterations: 20,
		run: async (prisma) => {
			await prisma.user.create({
				data: {
					email: `nested_${Date.now()}_${Math.random()}@test.com`,
					name: "Nested User",
					profile: {
						create: { bio: "Nested bio" },
					},
					posts: {
						create: [
							{ title: "Post 1", content: "Content 1" },
							{ title: "Post 2", content: "Content 2" },
						],
					},
				},
			});
		},
	},

	{
		name: "Cascade delete (user + profile + posts)",
		category: "Relations",
		setup: async (prisma) => {
			await prisma.user.create({
				data: {
					email: "cascade@test.com",
					name: "Cascade User",
					profile: {
						create: { bio: "Will be deleted" },
					},
					posts: {
						create: [{ title: "Post 1" }, { title: "Post 2" }],
					},
				},
			});
		},
		iterations: 10,
		run: async (prisma) => {
			await prisma.user.delete({ where: { email: "cascade@test.com" } });
			await prisma.user.create({
				data: {
					email: "cascade@test.com",
					name: "Cascade User",
					profile: {
						create: { bio: "Will be deleted" },
					},
					posts: {
						create: [{ title: "Post 1" }, { title: "Post 2" }],
					},
				},
			});
		},
	},

	// ==================== Filtering & Querying ====================
	{
		name: "Filter by boolean",
		category: "Filtering",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 100 }, (_, i) => ({
					email: `bool_${i}@test.com`,
					name: `User ${i}`,
					active: i % 2 === 0,
				})),
			});
		},
		iterations: 100,
		run: async (prisma) => {
			await prisma.user.findMany({
				where: { active: true },
			});
		},
	},

	{
		name: "Filter by date",
		category: "Filtering",
		setup: async (prisma) => {
			const now = new Date();
			await prisma.user.createMany({
				data: Array.from({ length: 50 }, (_, i) => ({
					email: `date_${i}@test.com`,
					name: `User ${i}`,
					createdAt: new Date(now.getTime() - i * 86400000),
				})),
			});
		},
		iterations: 50,
		run: async (prisma) => {
			const yesterday = new Date(Date.now() - 86400000);
			await prisma.user.findMany({
				where: {
					createdAt: { gt: yesterday },
				},
			});
		},
	},

	{
		name: "Order by and pagination",
		category: "Filtering",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 100 }, (_, i) => ({
					email: `page_${i}@test.com`,
					name: `User ${i}`,
				})),
			});
		},
		iterations: 100,
		run: async (prisma) => {
			await prisma.user.findMany({
				orderBy: { id: "desc" },
				take: 10,
				skip: 20,
			});
		},
	},

	{
		name: "Complex where clause",
		category: "Filtering",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 100 }, (_, i) => ({
					email: `complex_${i}@test.com`,
					name: i % 3 === 0 ? "Alice" : i % 3 === 1 ? "Bob" : "Charlie",
					active: i % 2 === 0,
				})),
			});
		},
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.findMany({
				where: {
					AND: [
						{ active: true },
						{
							OR: [{ name: { contains: "Ali" } }, { name: { contains: "Bob" } }],
						},
					],
				},
			});
		},
	},

	// ==================== Type Coercion ====================
	{
		name: "BigInt handling",
		category: "Types",
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.create({
				data: {
					email: `bigint_${Date.now()}_${Math.random()}@test.com`,
					name: "BigInt User",
					posts: {
						create: {
							title: "Post with views",
							views: BigInt("9007199254740991"),
						},
					},
				},
				include: { posts: true },
			});
		},
	},

	{
		name: "Decimal handling",
		category: "Types",
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.create({
				data: {
					email: `decimal_${Date.now()}_${Math.random()}@test.com`,
					name: "Decimal User",
					balance: 123.456789,
				},
			});
		},
	},

	{
		name: "Bytes handling (BLOB)",
		category: "Types",
		iterations: 30,
		run: async (prisma) => {
			const buffer = Buffer.from("Hello, World!", "utf-8");
			await prisma.user.create({
				data: {
					email: `bytes_${Date.now()}_${Math.random()}@test.com`,
					name: "Bytes User",
					profile: {
						create: {
							bio: "Has avatar",
							avatar: buffer,
						},
					},
				},
			});
		},
		validateResult: async (prisma) => {
			try {
				const user = await prisma.user.findFirst({
					where: { name: "Bytes User" },
					include: { profile: true },
				});
				return user?.profile?.avatar !== undefined;
			} catch {
				return false;
			}
		},
	},

	{
		name: "JSON handling",
		category: "Types",
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.create({
				data: {
					email: `json_${Date.now()}_${Math.random()}@test.com`,
					name: "JSON User",
					metadata: {
						theme: "dark",
						settings: { notifications: true },
						tags: ["test", "benchmark"],
					},
				},
			});
		},
	},

	// ==================== Transactions ====================
	{
		name: "Transaction commit",
		category: "Transactions",
		iterations: 20,
		run: async (prisma) => {
			await prisma.$transaction(async (tx) => {
				await tx.user.create({
					data: {
						email: `tx_${Date.now()}_${Math.random()}@test.com`,
						name: "TX User",
					},
				});
				await tx.user.create({
					data: {
						email: `tx2_${Date.now()}_${Math.random()}@test.com`,
						name: "TX User 2",
					},
				});
			});
		},
	},

	{
		name: "Transaction rollback",
		category: "Transactions",
		iterations: 20,
		run: async (prisma) => {
			try {
				await prisma.$transaction(async (tx) => {
					await tx.user.create({
						data: {
							email: `rollback_${Date.now()}_${Math.random()}@test.com`,
							name: "Rollback User",
						},
					});
					throw new Error("Intentional rollback");
				});
			} catch {
				// Expected to fail
			}
		},
	},

	// ==================== Aggregations ====================
	{
		name: "Count users",
		category: "Aggregations",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 100 }, (_, i) => ({
					email: `count_${i}@test.com`,
					name: `User ${i}`,
				})),
			});
		},
		iterations: 100,
		run: async (prisma) => {
			await prisma.user.count();
		},
	},

	{
		name: "Aggregate (avg, sum, min, max)",
		category: "Aggregations",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 50 }, (_, i) => ({
					email: `agg_${i}@test.com`,
					name: `User ${i}`,
					balance: i * 10.5,
				})),
			});
		},
		iterations: 50,
		run: async (prisma) => {
			await prisma.user.aggregate({
				_avg: { balance: true },
				_sum: { balance: true },
				_min: { balance: true },
				_max: { balance: true },
			});
		},
	},

	{
		name: "Group by",
		category: "Aggregations",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 100 }, (_, i) => ({
					email: `group_${i}@test.com`,
					name: i % 5 === 0 ? "Alice" : i % 5 === 1 ? "Bob" : "Charlie",
					active: i % 2 === 0,
				})),
			});
		},
		iterations: 30,
		run: async (prisma) => {
			await prisma.user.groupBy({
				by: ["name"],
				_count: { id: true },
			});
		},
	},

	// ==================== Raw Queries ====================
	{
		name: "$queryRaw SELECT",
		category: "Raw Queries",
		setup: async (prisma) => {
			await prisma.user.createMany({
				data: Array.from({ length: 50 }, (_, i) => ({
					email: `raw_${i}@test.com`,
					name: `User ${i}`,
				})),
			});
		},
		iterations: 100,
		run: async (prisma) => {
			await prisma.$queryRaw`SELECT * FROM User LIMIT 10`;
		},
	},

	{
		name: "$executeRaw UPDATE",
		category: "Raw Queries",
		setup: async (prisma) => {
			await prisma.user.create({
				data: {
					email: "execute_raw@test.com",
					name: "Execute Test",
					active: false,
				},
			});
		},
		iterations: 50,
		run: async (prisma) => {
			// Toggle active status (idempotent)
			await prisma.$executeRaw`UPDATE User SET active = CASE WHEN active = 0 THEN 1 ELSE 0 END WHERE email = 'execute_raw@test.com'`;
		},
	},
];

export function getTestsByCategory(category: string): BenchmarkTest[] {
	return benchmarkTests.filter((test) => test.category === category);
}

export function getAllCategories(): string[] {
	return Array.from(new Set(benchmarkTests.map((test) => test.category)));
}
