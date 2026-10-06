/**
 * STQ EDUCATION PORTAL — V3.1 PREDEPLOY SCHEMA VERIFICATION & GUARDED MIGRATION
 * Target: ORR-075 (Explicit Sima'an Criteria Columns: is_bil_ghaib, is_satu_duduk)
 *
 * SAFETY CONTRACT:
 * - Defaults strictly to READ-ONLY / PREFLIGHT MODE.
 * - ZERO production writes unless all explicit guards are present.
 * - Required CLI flags for execution: --execute --approved-scope=V3.1-ORR075
 * - Required ENV for execution: PRODUCTION_MUTATION_APPROVED=V3.1-ORR075
 * - Halts immediately if any migration other than the expected one is pending.
 * - Never prints DATABASE_URL, passwords, tokens, or secrets.
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export interface SchemaPreflightReport {
  diagnosticDbMatchesProduction: boolean;
  tableTasmiSimaanExists: boolean;
  isBilGhaibColumn: "PRESENT" | "ABSENT";
  isSatuDudukColumn: "PRESENT" | "ABSENT";
  expectedMigrationName: string;
  expectedMigrationState: "APPLIED" | "NOT_APPLIED";
  totalMigrationsOnDisk: number;
  totalMigrationsInDatabase: number;
  otherPendingMigrationsCount: number;
  allPreconditionsPass: boolean;
  validationErrors: string[];
}

export interface ExecutionGuards {
  hasExecuteFlag: boolean;
  hasApprovedScopeFlag: boolean;
  hasEnvApproval: boolean;
  isExecuteApproved: boolean;
  guardReasons: string[];
}

export function parseSchemaGuards(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
): ExecutionGuards {
  const hasExecuteFlag = argv.includes("--execute");

  let hasApprovedScopeFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--approved-scope=V3.1-ORR075") {
      hasApprovedScopeFlag = true;
    } else if (arg === "--approved-scope" && argv[i + 1] === "V3.1-ORR075") {
      hasApprovedScopeFlag = true;
    }
  }

  const hasEnvApproval = env.PRODUCTION_MUTATION_APPROVED === "V3.1-ORR075";

  const guardReasons: string[] = [];
  if (!hasExecuteFlag) guardReasons.push("Missing required CLI flag: --execute");
  if (!hasApprovedScopeFlag) guardReasons.push("Missing required CLI flag: --approved-scope=V3.1-ORR075");
  if (!hasEnvApproval) guardReasons.push("Missing required ENV variable: PRODUCTION_MUTATION_APPROVED=V3.1-ORR075");

  const isExecuteApproved = hasExecuteFlag && hasApprovedScopeFlag && hasEnvApproval;

  return {
    hasExecuteFlag,
    hasApprovedScopeFlag,
    hasEnvApproval,
    isExecuteApproved,
    guardReasons,
  };
}

export async function runSchemaPreflight(prisma: PrismaClient): Promise<SchemaPreflightReport> {
  const validationErrors: string[] = [];
  const expectedMigrationName = "20261005140000_v3_1_simaan_explicit_criteria";

  // 1. Diagnostic DB check: verify core production anchors
  let diagnosticDbMatchesProduction = false;
  let tableTasmiSimaanExists = false;

  try {
    const tableCheck: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tasmi_simaan'
    `);
    tableTasmiSimaanExists = tableCheck.length === 1;

    const userMudirCount = await prisma.user.count({
      where: { username: "mudir" },
    });
    const unitRootCount = await prisma.orgUnit.count({
      where: { code: "OU-STQ-ROOT" },
    });

    diagnosticDbMatchesProduction = tableTasmiSimaanExists && userMudirCount >= 1 && unitRootCount >= 1;
  } catch (err) {
    validationErrors.push(`Diagnostic DB check failed: ${(err as Error).message}`);
  }

  if (!diagnosticDbMatchesProduction) {
    validationErrors.push("Precondition failed: Target database does not match STQ Production profile.");
  }

  // 2. Check existing columns on tasmi_simaan
  let isBilGhaibColumn: "PRESENT" | "ABSENT" = "ABSENT";
  let isSatuDudukColumn: "PRESENT" | "ABSENT" = "ABSENT";

  try {
    const cols: Array<{ column_name: string }> = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasmi_simaan' AND column_name IN ('is_bil_ghaib', 'is_satu_duduk')
    `);

    for (const c of cols) {
      if (c.column_name === "is_bil_ghaib") isBilGhaibColumn = "PRESENT";
      if (c.column_name === "is_satu_duduk") isSatuDudukColumn = "PRESENT";
    }
  } catch (err) {
    validationErrors.push(`Column inspection failed: ${(err as Error).message}`);
  }

  // 3. Inspect migrations table & disk migrations
  let totalMigrationsOnDisk = 0;
  let totalMigrationsInDatabase = 0;
  let expectedMigrationState: "APPLIED" | "NOT_APPLIED" = "NOT_APPLIED";
  let otherPendingMigrationsCount = 0;

  const migrationsDir = path.resolve(process.cwd(), "prisma/migrations");
  if (fs.existsSync(migrationsDir)) {
    const diskDirs = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    totalMigrationsOnDisk = diskDirs.length;

    try {
      const dbMigrations: Array<{ migration_name: string; finished_at: Date | null }> =
        await prisma.$queryRawUnsafe(`
          SELECT migration_name, finished_at 
          FROM "_prisma_migrations" 
          ORDER BY started_at ASC
        `);

      totalMigrationsInDatabase = dbMigrations.length;
      const appliedSet = new Set(
        dbMigrations.filter((m) => m.finished_at !== null).map((m) => m.migration_name)
      );

      if (appliedSet.has(expectedMigrationName)) {
        expectedMigrationState = "APPLIED";
      }

      // Check for any unexpected pending migrations on disk
      for (const mName of diskDirs) {
        if (!appliedSet.has(mName) && mName !== expectedMigrationName) {
          otherPendingMigrationsCount++;
          validationErrors.push(`UNEXPECTED_PENDING_MIGRATION: Disk contains migration '${mName}' not yet applied in production.`);
        }
      }
    } catch (err) {
      validationErrors.push(`Migration table query failed: ${(err as Error).message}`);
    }
  } else {
    validationErrors.push("Migrations directory prisma/migrations not found on disk.");
  }

  const allPreconditionsPass = validationErrors.length === 0;

  return {
    diagnosticDbMatchesProduction,
    tableTasmiSimaanExists,
    isBilGhaibColumn,
    isSatuDudukColumn,
    expectedMigrationName,
    expectedMigrationState,
    totalMigrationsOnDisk,
    totalMigrationsInDatabase,
    otherPendingMigrationsCount,
    allPreconditionsPass,
    validationErrors,
  };
}

export async function main() {
  const guards = parseSchemaGuards();
  const prisma = new PrismaClient();

  console.log("==================================================");
  console.log("STQ EDUCATION PORTAL — V3.1 SCHEMA PREDEPLOY TOOL");
  console.log("==================================================");
  console.log(`MODE: ${guards.isExecuteApproved ? "EXECUTE (APPROVED)" : "READ ONLY (DEFAULT)"}`);

  try {
    const preflight = await runSchemaPreflight(prisma);

    console.log("\n[PREFLIGHT REPORT]");
    console.log(`- DIAGNOSTIC_DB_MATCHES_PRODUCTION: ${preflight.diagnosticDbMatchesProduction ? "YES" : "NO"}`);
    console.log(`- TABLE_TASMI_SIMAAN_EXISTS       : ${preflight.tableTasmiSimaanExists ? "YES" : "NO"}`);
    console.log(`- IS_BIL_GHAIB_COLUMN             : ${preflight.isBilGhaibColumn}`);
    console.log(`- IS_SATU_DUDUK_COLUMN            : ${preflight.isSatuDudukColumn}`);
    console.log(`- EXPECTED_MIGRATION              : ${preflight.expectedMigrationName}`);
    console.log(`- EXPECTED_MIGRATION_STATE        : ${preflight.expectedMigrationState}`);
    console.log(`- TOTAL_MIGRATIONS_ON_DISK        : ${preflight.totalMigrationsOnDisk}`);
    console.log(`- TOTAL_MIGRATIONS_IN_DB          : ${preflight.totalMigrationsInDatabase}`);
    console.log(`- OTHER_PENDING_MIGRATIONS        : ${preflight.otherPendingMigrationsCount}`);
    console.log(`- ALL_PRECONDITIONS_PASS          : ${preflight.allPreconditionsPass ? "YES" : "NO"}`);

    if (preflight.validationErrors.length > 0) {
      console.error("\n[PREFLIGHT VALIDATION ERRORS]");
      for (const err of preflight.validationErrors) {
        console.error(`  * ${err}`);
      }
    }

    if (!guards.isExecuteApproved) {
      console.log("\n[EXECUTION GUARDS]");
      console.log("Execution not requested or required guards missing:");
      for (const r of guards.guardReasons) {
        console.log(`  * ${r}`);
      }
      console.log("\n>>> Zero writes performed. Preflight completed in READ-ONLY mode. <<<");
      return;
    }

    // Execution path: guarded and approved
    if (!preflight.allPreconditionsPass) {
      console.error("\nFATAL: Execution aborted due to preflight precondition failures.");
      process.exit(1);
    }

    if (preflight.otherPendingMigrationsCount > 0) {
      console.error(`\nFATAL: ${preflight.otherPendingMigrationsCount} other migration(s) are pending. Halting execution.`);
      process.exit(1);
    }

    if (preflight.expectedMigrationState === "APPLIED") {
      console.log("\nExpected migration is already applied in database. No action necessary.");
      return;
    }

    console.log("\n[EXECUTING CANONICAL PRISMA MIGRATION]");
    console.log("Running: npx prisma migrate deploy");
    execSync("npx prisma migrate deploy", { stdio: "inherit" });

    // Post-migration verification
    console.log("\n[POST-MIGRATION VERIFICATION]");
    const postCols: Array<{ column_name: string; is_nullable: string; column_default: string | null }> =
      await prisma.$queryRawUnsafe(`
        SELECT column_name, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'tasmi_simaan' AND column_name IN ('is_bil_ghaib', 'is_satu_duduk')
        ORDER BY column_name ASC
      `);

    for (const c of postCols) {
      console.log(`Column ${c.column_name}: nullable=${c.is_nullable}, default=${c.column_default ?? "NONE"}`);
      if (c.is_nullable !== "YES") throw new Error(`Column ${c.column_name} is not nullable.`);
      if (c.column_default !== null) throw new Error(`Column ${c.column_name} has unexpected default.`);
    }

    console.log("\n>>> V3.1 Schema migration executed and verified successfully. Zero app code deployed yet. <<<");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("FATAL ERROR in predeploy-v3-1-schema:", err);
    process.exit(1);
  });
}
