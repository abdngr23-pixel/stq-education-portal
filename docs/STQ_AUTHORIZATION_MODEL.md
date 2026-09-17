# STQ AUTHORIZATION MODEL — SPECIFICATION & ENGINE CONTRACT
**Deterministic, Server-Side, Capability-and-Scope Based Authorization Architecture**  
**Document**: `docs/STQ_AUTHORIZATION_MODEL.md`  
**Status**: `PROPOSED — PENDING BUSINESS OWNER / CHATGPT REVIEW`

---

## 1. The Core Authorization Formula

In the canonical architecture, authorization decisions do not evaluate hardcoded names, usernames, or coarse roles directly. Every decision is computed through the **Canonical Authorization Pipeline**:

$$\text{Decision} = \mathcal{F}(\text{Session}, \text{Capability}, \text{ResourceContext})$$

Expanded:
$$\text{User/Session} \xrightarrow{\text{hydrate}} \text{Active Assignments} \xrightarrow{\text{derive}} \{\text{Positions}\} \xrightarrow{\text{expand}} \{\text{Capabilities}\} \times \{\text{Scopes}\} \xrightarrow{\text{evaluate against}} \text{Resource Context} \implies \text{ALLOW} \mid \text{DENY}$$

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Client Component
    participant SA as Server Action / Route Handler
    participant AE as Authorization Engine
    participant DB as Prisma Database (Fail-Closed)

    Client->>SA: Invoke Action (e.g. catatKesehatanAction)
    SA->>AE: authorize(session, 'health.case.create', { santriId })
    AE->>AE: 1. Verify Active Session (token valid, user active, not suspended)
    AE->>AE: 2. Hydrate Active Assignments (status=ACTIVE, validFrom <= now <= validUntil)
    AE->>AE: 3. Resolve Effective Capabilities from PositionCapability
    alt Capability Missing
        AE-->>SA: DENY (CAPABILITY_NOT_GRANTED)
        SA-->>Client: Error: "Akses Ditolak: Anda tidak memiliki kewenangan..."
    else Capability Present
        AE->>AE: 4. Evaluate Scope against Resource Context
        alt Resource Outside Permitted Scope
            AE-->>SA: DENY (SCOPE_MISMATCH / GENDER_COMPLEX_DENIED)
            SA-->>Client: Error: "Akses Ditolak: Data di luar lingkup penugasan Anda."
        else Scope Validated
            AE-->>SA: ALLOW (AssignmentContext)
            SA->>DB: Execute Mutation / Query
            SA->>DB: Record Audit Log (with Technical User, Human Executor, Assignment & Capability)
            SA-->>Client: Success Result
        end
    end
```

---

## 2. Authorization Engine Public Contract (TypeScript API)

```typescript
/**
 * Canonical Authorization Engine Interface & Types
 * Normalized exactly across all layers.
 */

export type ScopeType =
  | "GLOBAL"
  | "DOMAIN"
  | "UNIT"
  | "ASSIGNED_UNITS"
  | "HALAQOH"
  | "KAMAR"
  | "OWN_CHILD"
  | "SELF";

export interface ResourceContext {
  santriId?: string;
  halaqohId?: string;
  kamarId?: string;
  unitId?: string;
  domainId?: string;
  targetUserId?: string;
  gender?: "PUTRA" | "PUTRI";
  guardianLinkedSantriIds?: string[]; // Supports 1 guardian -> multiple enrolled children
  [key: string]: unknown;
}

export type AuthorizationResultCode =
  | "ALLOWED"
  | "UNAUTHENTICATED"
  | "IDENTITY_NOT_LINKED"
  | "IDENTITY_INACTIVE"
  | "CAPABILITY_NOT_GRANTED"
  | "INVALID_RESOURCE_CONTEXT"
  | "SCOPE_MISMATCH"
  | "ASSIGNMENT_INACTIVE"
  | "ASSIGNMENT_EXPIRED"
  | "GENDER_COMPLEX_DENIED"
  | "SYSTEM_FAIL_CLOSED";

export interface AuthorizationResult {
  allowed: boolean;
  code: AuthorizationResultCode;
  reason?: string;
  effectiveScope?: ScopeType;
  assignmentId?: string;
  positionCode?: string;
  unitId?: string;
}

export interface IAuthorizationEngine {
  /**
   * Full server-side authorization check (Capability + Scope vs Resource Context).
   */
  authorize(
    session: UserSession | null,
    capabilityCode: string,
    context?: ResourceContext
  ): Promise<AuthorizationResult>;

  /**
   * Coarse check if session holds capability regardless of scope (used for UI derivation).
   */
  hasCapability(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<boolean>;

  /**
   * Resolves list of all currently active assignments for a given session.
   */
  getActiveAssignments(
    session: UserSession | null
  ): Promise<Assignment[]>;

  /**
   * Resolves permitted scope type and concrete unit IDs for a capability.
   */
  resolveScopes(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<{ scopeType: ScopeType; unitIds: string[] }>;

  /**
   * Helper filter to construct Prisma WHERE clause filters from effective scope.
   */
  buildScopeFilter?(
    session: UserSession | null,
    capabilityCode: string
  ): Promise<Record<string, unknown>>;
}
```

---

## 3. Evaluation Rules & Guarantees

### Rule 1: Fail-Closed Default Deny
- If `session` is `null` or invalid $\implies$ `DENY (UNAUTHENTICATED)`.
- If the authenticated user has no linked identity profile $\implies$ `DENY (IDENTITY_NOT_LINKED)`.
- If the user account is suspended or inactive $\implies$ `DENY (IDENTITY_INACTIVE)`.
- If the requested capability is not granted by any active assignment $\implies$ `DENY (CAPABILITY_NOT_GRANTED)`.
- If the database query to verify assignments fails or times out $\implies$ `DENY (SYSTEM_FAIL_CLOSED)`. No synthetic fallback is permitted.

### Rule 2: Active Assignment Validity Window
An assignment is valid if and only if:
1. `Assignment.status === "ACTIVE"` (assignments in `DRAFT`, `SUSPENDED`, `EXPIRED`, or `REVOKED` grant zero authority).
2. `Assignment.validFrom <= now()`
3. `Assignment.validUntil === null || Assignment.validUntil >= now()`
4. `User.status === "AKTIF"` and linked `Staff`/`Santri` is active.

Expired assignments cease conferring authority immediately upon passing `validUntil`.

### Rule 3: Capability Precedence Over Scope & No Pseudo-Scopes
- **Capability is evaluated before scope**: Holding `GLOBAL` scope on one capability (e.g. `health.case.read + GLOBAL`) confers zero authority over unrelated capabilities (e.g. `tahfizh.reward.issue`). `GLOBAL` denotes institutional scope for the granted capability only.
- **No Pseudo-Scopes**: The architecture strictly forbids arbitrary concatenated string pseudo-scopes (such as appending domain or halaqoh names to scope types).
  - To express domain-wide supervision for Kabid Tahfizh:
    `scopeType = "DOMAIN"`, evaluated in unit `Unit: TAHFIZH` (domain: `TAHFIZH`).
  - To express own halaqoh setoran writing for Musyrif Tahfizh:
    `scopeType = "HALAQOH"`, evaluated against `Halaqoh.id === santri.halaqohId`.
  - When Ust. Razan holds both:
    - For `tahfizh.recap.read`: Evaluates against `PositionCapability` having `scopeType: "DOMAIN"` $\implies$ ALLOW (institutional halaqoh recap).
    - For `tahfizh.setoran.create`: Evaluates against `PositionCapability` having `scopeType: "HALAQOH"` $\implies$ Bounded strictly to his assigned halaqoh.

### Rule 4: Relational Multi-Child Guardian Evaluation (`OWN_CHILD`)
- `OWN_CHILD` is evaluated relationally:
  $$\text{Resource}.\text{santriId} \in \text{Guardian}.\text{linkedSantriIds}$$
- The engine does NOT assume a 1-to-1 guardian-to-child relationship. A guardian with multiple enrolled children (e.g. sibling santri) can access records for any of their relationally linked children without authorization redesign.

### Rule 5: Gender Complex Boundary Separation (`GENDER_COMPLEX_DENIED`)
- `SCOPE_MISMATCH` indicates a standard organizational unit boundary failure (e.g. Musyrif A attempting to edit Musyrif B's halaqoh).
- `GENDER_COMPLEX_DENIED` is a specialized, audited rejection that triggers when an actor attempts cross-gender boundary access (e.g. ikhwan personnel attempting to access akhwat dormitory or halaqoh records) without an explicit, approved cross-complex operational assignment.

---

## 4. Elimination of Legacy Anti-Patterns

| Legacy Anti-Pattern | Root Risk | Canonical Replacement |
| :--- | :--- | :--- |
| `if (session.username === 'musyrif.tahfizh')` | Couples security to account username; breaks if username changes or another staff is promoted. | `hasCapability(session, 'tahfizh.reward.issue')` originating from active `Position: KABID_TAHFIZH`. |
| `if (session.name.includes('Razan'))` | Plaintext name matching; vulnerable to typo or spoofing. | Strictly evaluate verified `userId`/`staffId` through active `Assignment`. |
| `Staff.isKepalaBidangTahfidz: Boolean` | Column proliferation; requires DB schema migration for every new organizational position. | Position: `KABID_TAHFIZH` assigned to User in Unit: `TAHFIZH`. |
| `User.isPetugasPresensiPutri: Boolean` | Column proliferation; creates arbitrary user-level exceptions. | Position: `PETUGAS_PRESENSI` assigned to User in Unit: `ASRAMA_PUTRI`. |
| `role === 'MT' ? ALL : BINAAN` | Conflates ordinary musyrif with supervisory management. | Ordinary MT holds `Position: MUSYRIF_TAHFIZH` (`Scope: HALAQOH`); Kabid holds `Position: KABID_TAHFIZH` (`Scope: DOMAIN`). |
| `Non-relational string arrays` | Free-form strings without FK integrity; risk of orphaned IDs. | Relational `AssignmentScopeUnit` table with strict foreign key constraints. |
| `PERMISSION_MATRIX[module][role]` (Coarse CRUD) | Cannot express "can create health record but cannot update clinical status". | Granular capabilities: `health.case.create` vs `health.status.update`. |
