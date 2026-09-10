import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Pastikan bila di lingkungan pengujian, PrismaClient selalu menggunakan TEST_DATABASE_URL terisolasi
const isTestEnv = process.env.NODE_ENV === "test" || process.env.IS_TEST_RUN === "true";
const testDbUrl = isTestEnv ? (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL) : undefined;

if (isTestEnv && testDbUrl && (testDbUrl.includes("accelerate.prisma-data.net") || testDbUrl.includes("production"))) {
  throw new Error("FATAL: Pengujian dilarang menggunakan database produksi!");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(testDbUrl ? { datasources: { db: { url: testDbUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
