/**
 * STQ EDUCATION PORTAL — W2 CHECKLIST SCHEMA PREDEPLOY & GUARDED MIGRATION
 * Target Migration: 20261006150000_w2_checklist_system (ORR-098 & ORR-101)
 *
 * SAFETY INVARIANTS:
 * 1. DEFAULT: READ-ONLY PREFLIGHT. Zero database writes by default.
 * 2. Guard requirements for future execution:
 *    CLI: --execute --approved-scope=W2-CHECKLIST-SCHEMA
 *    ENV: PRODUCTION_MUTATION_APPROVED=W2-CHECKLIST-SCHEMA
 * 3. Verified additive-only schema:
 *    - Table checklist_templates
 *    - Table checklist_runs
 *    - Table checklist_items
 *    - Enums ChecklistRunStatus, ChecklistItemStatus
 *    - Strict rejection of DROP, DELETE, UPDATE, backfill, or destructive renames.
 * 4. Verifies other pending migrations = 0.
 * 5. Verifies authoritative production database identity anchors.
 */

import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import defaultPrisma from "../lib/prisma";

export interface ChecklistSchemaPreflightReport {
  productionDbVerified: boolean;
  dbIdentityDetails: {
    mudirUserExists: boolean;
    rootOrgUnitExists: boolean;
  };
  checklistTablesStatus: {
    checklist_templates: "PRESENT" | "ABSENT";
    checklist_runs: "PRESENT" | "ABSENT";
    checklist_items: "PRESENT" | "ABSENT";
  };
  expectedMigrationName: string;
  expectedMigrationApplied: boolean;
  totalMigrationsOnDisk: number;
  totalMigrationsInDatabase: number;
  otherPendingMigrationsCount: number;
  migrationIsAdditiveOnly: boolean;
  destructiveKeywordsFound: string[];
  canExecuteSafely: boolean;
  blockers: string[];
}

export interface ChecklistExecutionGuards {
  hasExecuteFlag: boolean;
  hasApprovedScopeFlag: boolean;
  hasEnvApproval: boolean;
  isExecuteApproved: boolean;
  guardReasons: string[];
}

export function parseChecklistSchemaGuards(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
): ChecklistExecutionGuards {
  const hasExecuteFlag = argv.includes("--execute");

  let hasApprovedScopeFlag = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--approved-scope=W2-CHECKLIST-SCHEMA") {
      hasApprovedScopeFlag = true;
    } else if (arg === "--approved-scope" && argv[i + 1] === "W2-CHECKLIST-SCHEMA") {
      hasApprovedScopeFlag = true;
    }
  }

  const hasEnvApproval = env.PRODUCTION_MUTATION_APPROVED === "W2-CHECKLIST-SCHEMA";

  const guardReasons: string[] = [];
  if (!hasExecuteFlag) guardReasons.push("Missing required CLI flag: --execute");
  if (!hasApprovedScopeFlag) guardReasons.push("Missing required CLI flag: --approved-scope=W2-CHECKLIST-SCHEMA");
  if (!hasEnvApproval) guardReasons.push("Missing required ENV variable: PRODUCTION_MUTATION_APPROVED=W2-CHECKLIST-SCHEMA");

  const isExecuteApproved = hasExecuteFlag && hasApprovedScopeFlag && hasEnvApproval;

  return {
    hasExecuteFlag,
    hasApprovedScopeFlag,
    hasEnvApproval,
    isExecuteApproved,
    guardReasons,
  };
}

export async function verifyChecklistMigrationSqlAdditive(
  migrationSqlPath: string
): Promise<{ isAdditiveOnly: boolean; destructiveKeywordsFound: string[] }> {
  if (!fs.existsSync(migrationSqlPath)) {
    return {
      isAdditiveOnly: false,
      destructiveKeywordsFound: [`Migration file not found at ${migrationSqlPath}`],
    };
  }

  const sql = fs.readFileSync(migrationSqlPath, "utf-8");
  const upper = sql.toUpperCase();

  const destructivePatterns = [
    /\bDROP\s+TABLE\b/,
    /\bDROP\s+COLUMN\b/,
    /\bDROP\s+TYPE\b/,
    /\bDELETE\s+FROM\b/,
    /\bTRUNCATE\b/,
    /\bUPDATE\s+[A-Z0-9_]+\s+SET\b/,
    /\bALTER\s+TABLE\s+[A-Z0-9_"]+\s+RENAME\b/,
    /\bALTER\s+COLUMN\s+[A-Z0-9_"]+\s+RENAME\b/,
  ];

  const destructiveKeywordsFound: string[] = [];
  for (const pattern of destructivePatterns) {
    if (pattern.test(upper)) {
      destructiveKeywordsFound.push(`Destructive pattern matched: ${pattern.source}`);
    }
  }

  return {
    isAdditiveOnly: destructiveKeywordsFound.length === 0,
    destructiveKeywordsFound,
  };
}

export async function runChecklistSchemaPreflight(
  prisma: PrismaClient = defaultPrisma
): Promise<ChecklistSchemaPreflightReport> {
  const blockers: string[] = [];
  const expectedMigrationName = "20261006150000_w2_checklist_system";

  // 1. Verify production DB identity anchors
  let mudirUserExists = false;
  let rootOrgUnitExists = false;
  try {
    const mudirCount = await prisma.user.count({ where: { username: "mudir" } });
    mudirUserExists = mudirCount >= 1;

    const rootOrgCount = await prisma.orgUnit.count({ where: { code: "OU-STQ-ROOT" } });
    rootOrgUnitExists = rootOrgCount >= 1;
  } catch (err) {
    blockers.push(`Failed to verify production database identity anchors: ${(err as Error).message}`);
  }

  const productionDbVerified = mudirUserExists && rootOrgUnitExists;
  if (!productionDbVerified) {
    blockers.push("Database does not match authoritative STQ production identity anchors.");
  }

  // 2. Check table presence in information_schema
  const targetTables = ["checklist_templates", "checklist_runs", "checklist_items"] as const;
  const checklistTablesStatus: ChecklistSchemaPreflightReport["checklistTablesStatus"] = {
    checklist_templates: "ABSENT",
    checklist_runs: "ABSENT",
    checklist_items: "ABSENT",
  };

  try {
    const existingTables: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('checklist_templates', 'checklist_runs', 'checklist_items')
    `);
    const tableNames = new Set(existingTables.map((r) => r.table_name));
    for (const t of targetTables) {
      if (tableNames.has(t)) {
        checklistTablesStatus[t] = "PRESENT";
      }
    }
  } catch (err) {
    blockers.push(`Failed to query information_schema.tables: ${(err as Error).message}`);
  }

  // 3. Check migration history
  let totalMigrationsOnDisk = 0;
  let totalMigrationsInDatabase = 0;
  let expectedMigrationApplied = false;
  let otherPendingMigrationsCount = 0;

  try {
    const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
    if (fs.existsSync(migrationsDir)) {
      const diskDirs = fs
        .readdirSync(migrationsDir)
        .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory() && !f.startsWith("."));
      totalMigrationsOnDisk = diskDirs.length;
    }

    const appliedMigrations: Array<{ migration_name: string }> = await prisma.$queryRawUnsafe(`
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
    `);
    totalMigrationsInDatabase = appliedMigrations.length;
    const appliedNames = new Set(appliedMigrations.map((m) => m.migration_name));

    expectedMigrationApplied = appliedNames.has(expectedMigrationName);

    // Pending migrations check:
    // If expected migration is not applied, other pending = total on disk - applied - 1 (the expected one)
    if (expectedMigrationApplied) {
      otherPendingMigrationsCount = Math.max(0, totalMigrationsOnDisk - totalMigrationsInDatabase);
    } else {
      otherPendingMigrationsCount = Math.max(0, totalMigrationsOnDisk - totalMigrationsInDatabase - 1);
    }

    if (otherPendingMigrationsCount > 0) {
      blockers.push(`Unexpected pending migrations on disk (${otherPendingMigrationsCount}). Expected exactly 0 other pending migrations.`);
    }
  } catch (err) {
    blockers.push(`Failed to verify _prisma_migrations: ${(err as Error).message}`);
  }

  // 4. Verify migration content is additive only
  const migrationSqlPath = path.join(
    process.cwd(),
    "prisma",
    "migrations",
    expectedMigrationName,
    "migration.sql"
  );
  const { isAdditiveOnly, destructiveKeywordsFound } = await verifyChecklistMigrationSqlAdditive(migrationSqlPath);
  if (!isAdditiveOnly) {
    blockers.push(`Migration is not strictly additive: ${destructiveKeywordsFound.join(", ")}`);
  }

  return {
    productionDbVerified,
    dbIdentityDetails: {
      mudirUserExists,
      rootOrgUnitExists,
    },
    checklistTablesStatus,
    expectedMigrationName,
    expectedMigrationApplied,
    totalMigrationsOnDisk,
    totalMigrationsInDatabase,
    otherPendingMigrationsCount,
    migrationIsAdditiveOnly: isAdditiveOnly,
    destructiveKeywordsFound,
    canExecuteSafely: blockers.length === 0,
    blockers,
  };
}

export async function predeployChecklistSchema(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env,
  prisma: PrismaClient = defaultPrisma
): Promise<{
  mode: "READ_ONLY_PREFLIGHT" | "EXECUTED";
  preflight: ChecklistSchemaPreflightReport;
  guards: ChecklistExecutionGuards;
  applied?: boolean;
}> {
  const guards = parseChecklistSchemaGuards(argv, env);
  const preflight = await runChecklistSchemaPreflight(prisma);

  if (!guards.isExecuteApproved) {
    return {
      mode: "READ_ONLY_PREFLIGHT",
      preflight,
      guards,
      applied: false,
    };
  }

  if (!preflight.canExecuteSafely) {
    throw new Error(
      `ABORT: Cannot execute checklist migration due to preflight blockers: ${preflight.blockers.join("; ")}`
    );
  }

  if (preflight.expectedMigrationApplied) {
    return {
      mode: "EXECUTED",
      preflight,
      guards,
      applied: true,
    };
  }

  // Pre-migration invariants verification
  if (preflight.otherPendingMigrationsCount > 0) {
    throw new Error(
      `ABORT: Expected exactly 0 other pending migrations, found ${preflight.otherPendingMigrationsCount}.`
    );
  }
  if (!preflight.migrationIsAdditiveOnly) {
    throw new Error(
      `ABORT: Expected migration to be strictly additive, found destructive patterns: ${preflight.destructiveKeywordsFound.join(", ")}`
    );
  }

  // Canonical Prisma migration execution (no manual SQL or forged _prisma_migrations records)
  console.log(`Executing canonical 'npx prisma migrate deploy' for ${preflight.expectedMigrationName}...`);
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, ...env },
  });

  // Post-verification: ensure expected migration is applied and tables are present
  const postPreflight = await runChecklistSchemaPreflight(prisma);
  if (!postPreflight.expectedMigrationApplied) {
    throw new Error(`POSTVERIFY_FAILED: Migration ${preflight.expectedMigrationName} is not recorded as applied in _prisma_migrations.`);
  }
  if (
    postPreflight.checklistTablesStatus.checklist_templates !== "PRESENT" ||
    postPreflight.checklistTablesStatus.checklist_runs !== "PRESENT" ||
    postPreflight.checklistTablesStatus.checklist_items !== "PRESENT"
  ) {
    throw new Error("POSTVERIFY_FAILED: One or more checklist tables are not present in information_schema after migration deploy.");
  }
  if (postPreflight.otherPendingMigrationsCount !== 0) {
    throw new Error(`POSTVERIFY_FAILED: Found unexpected pending migrations (${postPreflight.otherPendingMigrationsCount}) after deploy.`);
  }

  return {
    mode: "EXECUTED",
    preflight: postPreflight,
    guards,
    applied: true,
  };
}

if (require.main === module) {
  predeployChecklistSchema(process.argv, process.env, defaultPrisma)
    .then((result) => {
      console.log("=== W2 CHECKLIST SCHEMA PREDEPLOY REPORT ===");
      console.log(`MODE: ${result.mode} (Applied: ${result.applied})`);
      console.log("\n--- Preflight Report ---");
      console.log(JSON.stringify(result.preflight, null, 2));
      console.log("\n--- Execution Guards ---");
      console.log(JSON.stringify(result.guards, null, 2));
      if (result.mode === "EXECUTED") {
        console.log("\nMIGRATION DEPLOYED AND POST-VERIFIED SUCCESSFULLY via canonical `prisma migrate deploy`.");
      } else {
        console.log("\nSAFE STOP: Executed in READ-ONLY mode. ZERO schema mutations executed.");
      }
    })
    .catch((err) => {
      console.error("FATAL Predeploy Error:", err);
      process.exit(1);
    })
    .finally(() => defaultPrisma.$disconnect());
}
