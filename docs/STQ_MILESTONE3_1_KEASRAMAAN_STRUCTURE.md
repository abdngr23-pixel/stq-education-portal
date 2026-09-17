# STQ ARCHITECTURE LOCK — MILESTONE 3.1
## KEASRAMAAN V2 STRUCTURE & PLACEMENT FOUNDATION

**Document**: `docs/STQ_MILESTONE3_1_KEASRAMAAN_STRUCTURE.md`  
**Status**: `CHECKPOINT_M3_1_AUDIT_READY`  
**Baseline Main**: `5031be9cc639312952f7f67c0ba44c6f96ecb6c1`  
**PR #8 Immutable**: `9068cae5587b7219c394c5c25bf0de07a15b0726`  
**Milestone 2**: `CLOSED / MERGED / INDEPENDENTLY VERIFIED`  
**Canonical Authorization Engine**: `MERGED, SHADOW ONLY` (`CANONICAL_AUTH_SHADOW_ENABLED=false`)  
**Legacy Authorization**: `100% AUTHORITATIVE`  
**Branch**: `architecture/milestone3-keasramaan-structure`

---

## 1. Starting Baseline & Safety Preconditions

- **Canonical Main Commit**: `5031be9cc639312952f7f67c0ba44c6f96ecb6c1`
- **PR #8 Commit SHA**: `9068cae5587b7219c394c5c25bf0de07a15b0726` (verified `OPEN`, `DRAFT`, `UNMERGED`)
- **Zero Production Mutation**:
  - Production database migrations: `0`
  - Production seed operations: `0`
  - Production backfills: `0`
  - Production writes: `0`
- **Shadow Mode Guarantee**: `CANONICAL_AUTH_SHADOW_ENABLED` is strictly disabled by default; legacy runtime authorization remains 100% authoritative.
- **Strict Checkpoint Boundary**: M3.1 implements **ONLY** the structural and placement foundation. Operational workflows (checklists, discipline logs, SP/bintang mutations, perizinan, Health V2 cases, and Sarpras dashboards) are strictly prohibited and deferred to subsequent M3 checkpoints.

---

## 2. Locked Keasramaan Organizational Hierarchy

The canonical institutional hierarchy governing Keasramaan V2 is locked:

```
                      ┌───────────────┐
                      │     Mudir     │
                      └───────┬───────┘
                              │
               ┌──────────────▼──────────────┐
               │     Musyrif Keasramaan      │
               │   (Kepala Keasramaan)       │
               └───────┬─────────────┬───────┘
                       │             │
        ┌──────────────▼──────┐      │
        │   Pembina Divisi    │      │
        │ (Direct supervision)│      │
        └──────────────┬──────┘      │
                       │             │
        ┌──────────────▼──────┐      ▼
        │      Mudabbir       │   ┌────────────────────────┐
        │  (Pembina Kamar)    │   │  OSDA & TKS Structure  │
        └──────────────┬──────┘   └───────────┬────────────┘
                       │                      │
        ┌──────────────▼──────┐   ┌───────────▼────────────┐
        │        Kamar        │   │ Operational Divisions, │
        │  (Dormitory Rooms)  │   │ Usroh & Service Units  │
        └──────────────┬──────┘   └───────────┬────────────┘
                       │                      │
                       ▼                      ▼
                ┌───────────────────────────────────┐
                │          Santri / Usroh           │
                └───────────────────────────────────┘
```

### Key Architectural Invariants
1. **Structural Equivalence**: `"Kepala Keasramaan"` and `"Musyrif Keasramaan"` designate the exact same structural authority. No duplicate or parallel leadership position exists below Kepala Keasramaan.
2. **Mudabbir Distinct from Musyrif**: Mudabbir functions as `Pembina Kamar` and is strictly distinct from `Musyrif Keasramaan`.
3. **Multi-Room Responsibility**: One Mudabbir may be assigned to more than one Kamar through relational multi-unit scoping (`AssignmentScopeUnit`).
4. **Audit & Takeover Invariant**: Musyrif Keasramaan holds domain-level authority (`ScopeType: DOMAIN`) to audit or intervene when a Mudabbir is negligent or on leave, while retaining the original Mudabbir PIC attribution in forensic audit logs.

---

## 3. OSDA Structure (Organisasi Santri Darul Ulum Cendekia)

OSDA is structured under `OrgDomain: KEASRAMAAN` and `OrgUnitType: ORGANIZATION`:

### 3.1. Pengurus Inti OSDA (`OrgUnitType: DIVISION`)
- **Ketua OSDA**: General leadership and institutional representation.
- **Sekretaris OSDA**: Administrative management, correspondence, and general supervision.
- **Bendahara OSDA**: Financial oversight of student body funds.
- **Bagian Multimedia**: Documentation, publication, and media production (formally belongs to Pengurus Inti, not an operational division).

### 3.2. Operational Divisions (`OrgUnitType: DIVISION`)
Exactly five functional divisions:
1. **Divisi Keamanan & Kedisiplinan**: Discipline enforcement, punctuality, and movement oversight.
2. **Divisi Pendidikan & Ibadah**: Daily prayers, congregational attendance, and study hours.
3. **Divisi Kebersihan & Kerapihan**: Cleanliness monitoring and direct supervision of **Usroh**.
4. **Divisi Kesehatan**: Basic healthcare assistance, Poskestren UKS desk operator.
5. **Divisi Sarana & Prasarana (Sarpras)**: Physical inventory, dorm maintenance, and equipment checks.

### 3.3. Usroh (`OrgUnitType: USROH`)
- Positioned structurally under **Divisi Kebersihan & Kerapihan**.
- Composed of small student taskforces executing daily operational cleaning and maintenance rotations.
- Cleanliness is supervised by Divisi Kebersihan; Ketua and Sekretaris OSDA participate in general institutional supervision.

---

## 4. Pembina Divisi Placement

- **Direct Subordination**: Pembina Divisi reports directly to **Musyrif Keasramaan**.
- **Non-Membership Invariant**: Pembina Divisi is **NOT** a member of OSDA. OSDA is composed of students; Pembina Divisi is staff/asatidz supervision.
- **Multi-Division Scoping**: A single Pembina Divisi may supervise one or multiple divisions (bound relationally via `AssignmentScopeUnit`).
- **Multi-Pembina Allowed**: One division may have more than one Pembina assigned.
- **Zero Global Enum Pollution**: In strict accordance with ADR-001 and ADR-005, there is **NO** global `Role` enum value named `PEMBINA_DIVISI`. Pembina Divisi is modeled strictly via `Position(code = "PEMBINA_DIVISI")` + `Assignment` + `OrgUnit` + `ScopeType: ASSIGNED_UNITS`.

---

## 5. TKS Definition & Exact Six Units

- **Exact Definition**: **TUGAS KHUSUS SANTRI** (Strictly forbidden: "Tenaga Kebersihan & Servis").
- **No Central Ketua**: There is **NO** central `Ketua TKS`. Each unit operates independently under assigned coordinators or operators.
- **Exact Six Units**:
  1. **Unit Dapur dan Gizi** (`OrgUnitType: SERVICE_UNIT`): Cooking, nutrition, food distribution. Allows `KETUA_UNIT` and `ANGGOTA_UNIT`.
  2. **Unit Masjid** (`OrgUnitType: SERVICE_UNIT`): Mosque maintenance, sound system, adhan coordination. Allows `KETUA_UNIT` and `ANGGOTA_UNIT`.
  3. **Unit Kantor Pendidikan** (`OrgUnitType: SERVICE_UNIT`): Educational administration assistance. Single active operator.
  4. **Unit Kantor Yayasan** (`OrgUnitType: SERVICE_UNIT`): Foundation administration assistance. Single active operator.
  5. **Unit Air Minum** (`OrgUnitType: SERVICE_UNIT`): Drinking water supply, refilling, and water filter maintenance. Single active operator.
  6. **Unit Air Sumur** (`OrgUnitType: SERVICE_UNIT`): Well water pump, filtration, and reservoir management. Single active operator.
- **Separation Invariant**: `Unit Air Minum` and `Unit Air Sumur` are strictly distinct operational service units and must never be combined.

---

## 6. Account Modalities: Personal vs. Unit Accounts

### 6.1. Personal Accounts (`AccountType.PERSONAL`)
- Musyrif Keasramaan, Mudabbir, Pembina Divisi, and asatidz.
- Individual credentials and session JWT.
- One Mudabbir personal account resolves **ALL** active assignments across multiple rooms (no separate accounts per responsibility).

### 6.2. Operational Unit Accounts (`AccountType.UNIT`)
- OSDA operational tablets, Poskestren UKS desk, and TKS workstations.
- **Single Placement Invariant**: Exactly ONE active `UnitAccountPlacement` (`userId` unique constraint).
- **Multi-Device Support**: Multiple physical devices may authenticate under the same operational unit account.
- **Non-Repudiation on Mutation**: Technical account $\neq$ human executor. Any mutating transaction strictly requires a verified active human executor (`verifyHumanExecutor`), verified against active `Staff` or `Santri` database records.

---

## 7. Authoritative Santri $\leftrightarrow$ Kamar Room Placement

Milestone 2 deliberately maintained Santri-targeted KAMAR authorization in a fail-closed state (`kamarId = undefined`) because no authoritative room placement table existed. Milestone 3.1 introduces the canonical, auditable relation:

### 7.1. Database Model (`SantriKamarPlacement`)
```prisma
model SantriKamarPlacement {
  id          String    @id @default(cuid())
  santriId    String    @map("santri_id")
  santri      Santri    @relation(fields: [santriId], references: [id], onDelete: Restrict)
  kamarId     String    @map("kamar_id")
  kamar       OrgUnit   @relation(fields: [kamarId], references: [id], onDelete: Restrict)
  isActive    Boolean   @default(true) @map("is_active")
  startDate   DateTime  @default(now()) @map("start_date")
  endDate     DateTime? @map("end_date")
  notes       String?
  createdById String?   @map("created_by_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@index([santriId, isActive])
  @@index([kamarId, isActive])
  @@map("santri_kamar_placements")
}
```

### 7.2. Invariants & Semantics
1. **At Most One Active Placement**: Enforced at the database level via PostgreSQL partial unique index:
   ```sql
   CREATE UNIQUE INDEX "unique_active_santri_kamar" ON "santri_kamar_placements"("santri_id") WHERE ("is_active" = true);
   ```
2. **Historical Preservation**: When a student changes rooms, the existing placement is deactivated (`isActive = false, endDate = now()`), and a new placement row is created. Historical records are preserved permanently (`onDelete: Restrict`).
3. **Deterministic Server-Side Resolution**: Placement is queried strictly from the database. No room assignment is inferred from student name, phone number, halaqoh, or legacy strings.
4. **Existing Data Safety**: Santri without room placement remain completely valid. Unassigned students fail closed on room-scoped operations with `INVALID_RESOURCE_CONTEXT`.

---

## 8. Authoritative Kamar Resource Hydration & Trust Boundary

In `lib/auth/canonical-evaluator.ts`, `createPrismaDataProvider.resolveResourceContext({ santriId })` authoritatively hydrates:
- `santriId`: Verified target student ID.
- `kamarId`: Authoritative active room ID from `SantriKamarPlacement`.
- `halaqohId`: Authoritative Quran halaqoh ID from `Santri.halaqohId`.
- `genderComplex`: Resolved as `PUTRA` for male students (`L`) and `PUTRI` for female students (`P`).
- `orgUnitIds`: Array containing `kamarId` and `halaqohId`.
- `orgDomain`: Hydrated as `TAHFIZH` or `KEASRAMAAN`.

### Attack Regression: Forged kamarId Ignored
If the real current room in database is `KAMAR-A`, and a malicious or misconfigured client submits:
```json
{ "santriId": "san-target", "kamarId": "KAMAR-B" }
```
The server-side resolver **STRICTLY IGNORES** the caller-supplied `kamarId`. The resolved context contains strictly:
```json
{ "kamarId": "KAMAR-A" }
```
Caller-supplied `kamarId` is accepted ONLY when `santriId` is omitted (standalone room inspection), and only after authoritative verification against `OrgUnit(type = 'KAMAR')`.

---

## 9. Mudabbir Room Scope Containment

Mudabbir authority is evaluated via `ScopeType: KAMAR`:
- **Single Room**: Mudabbir assigned to `KAMAR-1` is allowed to access `KAMAR-1` (`ALLOWED`) and strictly denied on any other room (`SCOPE_MISMATCH`).
- **Multiple Rooms**: Mudabbir assigned to `KAMAR-1` with scoped units `[KAMAR-1, KAMAR-2]` via `AssignmentScopeUnit` is allowed on both `KAMAR-1` and `KAMAR-2`, and denied on `KAMAR-3` (`SCOPE_MISMATCH`).
- **Gender Boundary**: Mudabbir assigned to male rooms attempting to access female room contexts is denied with `GENDER_COMPLEX_DENIED`.

---

## 10. Capability States & Fail-Closed Activation Triple

In strict compliance with the Architecture Lock:
- **Default State**: New Keasramaan capabilities default to `PositionCapability.businessRuleState = PROPOSED_TBD`.
- **Zero Authority**: Any capability or grant in `PROPOSED_TBD` or `APPROVED_TARGET_PENDING_TECHNICAL` confers **ZERO runtime authority**.
- **Activation Triple**: An action is canonically permitted if and ONLY IF:
  1. `Assignment.status === 'ACTIVE'`
  2. `PositionCapability.businessRuleState === 'VERIFIED_PRODUCTION'`
  3. `PositionCapability.scopeType` is explicit
  *Plus*: Target resource matches scope containment and gender boundaries.

---

## 11. Additive Database Migration & Safety Strategy

### 11.1. Migration File
- Location: `prisma/migrations/20260917220000_m3_1_keasramaan_structure/migration.sql`
- Actions: Creates table `santri_kamar_placements`, indexes, partial unique index, and foreign key constraints with `ON DELETE RESTRICT`.

### 11.2. Production Safety Invariants
- **ZERO Production Deployment**: Absolutely forbidden to execute `prisma migrate deploy`, `prisma db push`, seed scripts, or manual SQL on production.
- **Disposable Testing Only**: All migration tests are executed exclusively on isolated disposable embedded PostgreSQL instances (`runIsolatedM31MigrationVerification`).

---

## 12. Unresolved Rules & Deferred Items

The following items are intentionally **NOT** part of Checkpoint M3.1 and belong strictly to subsequent milestones:
1. **Keasramaan Checklists**: Morning, afternoon, and evening dormitory checklist workflows (deferred to M3.2).
2. **Discipline & Violation Workflows**: Points deduction, pelanggaran logging, and SP generation (deferred to M3.3).
3. **Perizinan Santri**: Leave requests, curfew tracking, and approval matrices (deferred to M3.4).
4. **Health V2**: Medical triage, Poskestren operational records, and referral flows (deferred to M3.5).
5. **Sarana & Prasarana**: Room asset inventory, damage reporting, and repair tickets (deferred to M3.6).
6. **Operational Dashboards**: UI screens, widgets, and live statistics (deferred to M3.7).
