import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Pastikan bila di lingkungan pengujian, PrismaClient selalu menggunakan TEST_DATABASE_URL terisolasi
const isTestEnv = process.env.NODE_ENV === "test" || process.env.IS_TEST_RUN === "true";

let testDbUrl: string | undefined = undefined;

if (isTestEnv) {
  const envTestDbUrl = process.env.TEST_DATABASE_URL;
  if (!envTestDbUrl || envTestDbUrl.trim() === "") {
    throw new Error(
      "FATAL: Dalam mode pengujian (NODE_ENV=test atau IS_TEST_RUN=true), TEST_DATABASE_URL wajib disediakan. Dilarang memakai DATABASE_URL sebagai fallback demi melindungi basis data utama/produksi!"
    );
  }

  const isProdUrl =
    envTestDbUrl.includes("accelerate.prisma-data.net") ||
    envTestDbUrl.includes("production") ||
    envTestDbUrl.includes("neon.tech") ||
    envTestDbUrl.includes("supabase.co") ||
    envTestDbUrl.includes("stq-education-portal-app");

  if (isProdUrl) {
    throw new Error("FATAL: Pengujian dilarang menggunakan database produksi!");
  }

  let parsed: URL;
  try {
    parsed = new URL(envTestDbUrl);
  } catch {
    throw new Error(`FATAL: Format TEST_DATABASE_URL tidak valid: ${envTestDbUrl}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `FATAL: Database pengujian harus menggunakan host loopback (127.0.0.1 atau localhost), terdeteksi: "${host}"!`
    );
  }

  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const schema = (parsed.searchParams.get("schema") || "").toLowerCase();
  const hasTestIdentifier = dbName.includes("test") || schema.includes("test");

  if (!hasTestIdentifier) {
    throw new Error(
      `FATAL: Nama database ("${dbName}") atau schema ("${schema}") wajib memiliki penanda pengujian (memuat kata "test")!`
    );
  }

  testDbUrl = envTestDbUrl;
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(testDbUrl ? { datasources: { db: { url: testDbUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

export const prisma: PrismaClient = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    const activeClient = globalForPrisma.prisma || target;
    const value = Reflect.get(activeClient, prop, receiver);
    if (typeof value === "function") {
      return value.bind(activeClient);
    }
    return value;
  },
});

export default prisma;
