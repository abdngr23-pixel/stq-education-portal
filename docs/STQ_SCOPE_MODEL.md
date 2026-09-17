# STQ SCOPE MODEL — SPECIFICATION & CONTEXT BINDING
**Resource Scoping, Context Validation, and Boundary Isolation Rules**  
**Document**: `docs/STQ_SCOPE_MODEL.md`  
**Status**: `ARCHITECTURE_LOCKED`  
**Approved Baseline Date**: `2026-09-17`

---

## 1. Canonical Scope Taxonomy

A capability is never evaluated in a vacuum; it is always bound to an explicit **Scope Type**. The STQ Portal defines 8 canonical scope types:

```mermaid
graph TD
    subgraph Global & Domain Scopes
        G[GLOBAL<br/>Institutional breadth for the specific capability held]
        D[DOMAIN<br/>All units within a strategic domain: Tahfizh or Keasramaan]
    end

    subgraph Operational Unit Scopes
        AU[ASSIGNED_UNITS<br/>Relationally bound set of units via AssignmentScopeUnit]
        U[UNIT<br/>Single designated work unit or division]
        H[HALAQOH<br/>Single Qur'an study circle]
        K[KAMAR<br/>Single dormitory room]
    end

    subgraph Individual Scopes
        OC[OWN_CHILD<br/>Relationally bound to guardian's linked santri children]
        S[SELF<br/>Student or staff strictly bound to their personal record]
    end
```

### Detailed Semantics

| Scope Type | Evaluation Predicate | Scope Meaning & Typical Usage |
| :--- | :--- | :--- |
| `GLOBAL` | $\text{Resource} \in \text{Institution}$ | Institutional scope for the **specific granted capability** (Mudir, Admin TU). Does NOT imply unrestricted application access. |
| `DOMAIN` | $\text{Resource}.\text{domainId} == \text{Assignment}.\text{unit}.\text{domainId}$ | Breadth across an entire domain (e.g. Kabid Tahfizh across all halaqoh for supervision). |
| `ASSIGNED_UNITS` | $\text{Resource}.\text{unitId} \in \text{AssignmentScopeUnit}.\text{unitIds}$ | Relationally bound multi-unit supervision (Mudabbir managing multiple Kamar). |
| `HALAQOH` | $\text{Resource}.\text{halaqohId} == \text{Assignment}.\text{unitId}$ | Ordinary Musyrif Tahfizh (`MT`) / Pembina Halaqoh (`PH`). |
| `KAMAR` | $\text{Resource}.\text{kamarId} == \text{Assignment}.\text{unitId}$ | Mudabbir assigned to a single room. |
| `OWN_CHILD` | $\text{Resource}.\text{santriId} \in \text{Guardian}.\text{linkedSantriIds}$ | Wali Santri (`WS`) accessing relationally linked children. Supports 1 guardian $\to$ multiple children. |
| `SELF` | $\text{Resource}.\text{santriId} == \text{Session}.\text{santriId}$ | Santri (`ST`) accessing own records. |

> [!IMPORTANT]
> **Single Source of Truth for Scope**:
> Scope is explicitly configured per capability on `PositionCapability.scopeType`. The `Assignment` record stores anchor `unitId` and lifecycle state, but **NO** `scopeType`. When `scopeType` is `ASSIGNED_UNITS`, `AssignmentScopeUnit` supplies the relational multi-unit bindings.

> [!IMPORTANT]
> **Capability Precedence Rule**:
> Capability evaluation strictly precedes scope evaluation. A subject holding `GLOBAL` scope on `health.case.read_aggregate` gains institutional aggregate read access to health records, but zero authority over `tahfizh.reward.issue` or `keasramaan.permission.approve`.

---

## 2. Resource Context Trust Boundaries & Server-Side Resolution

The architecture enforces a strict trust boundary separating caller-submitted parameters from server-resolved authoritative boundaries:

1. **`RequestedResourceContext` (Untrusted Caller Parameters)**:
   - Callers supply target resource identifiers only: `santriId`, `targetUserId`, `resourceId`.
   - Callers can **NEVER** supply or influence permitted child IDs or authorized boundaries.
2. **`ResolvedResourceContext` (Server-Hydrated Authoritative Attributes)**:
   - The engine queries authoritative database tables to hydrate:
     - `santriId`
     - `halaqohId` (authoritative current halaqoh)
     - `kamarId` (authoritative room; Santri schema currently lacks authoritative room relation, so Santri-targeted kamarId is undefined until Milestone 3 adds room placement)
     - `orgUnitIds` (all enclosing organizational units)
     - `guardianLinkedSantriIds` (server-side join with `Guardian` relation for `OWN_CHILD` resolution)
     - `genderComplex` (`PUTRA` | `PUTRI` | `CAMPUR`)
     - `orgDomain` (`INSTITUTIONAL` | `TAHFIZH` | `KEASRAMAAN` | `AKADEMIK` | `MANAJEMEN`)

```typescript
// Example: Validating Setoran Creation Scope Fail-Closed with Multi-Grant Evaluation
async function evaluateSetoranScope(session: UserSession, requestedContext: RequestedResourceContext): Promise<boolean> {
  if (!requestedContext.santriId) return false;

  // 1. Hydrate authoritative structural boundaries from database
  const santri = await prisma.santri.findUnique({
    where: { id: requestedContext.santriId },
    select: { id: true, halaqohId: true },
  });
  if (!santri || !santri.halaqohId) return false; // Fail-closed

  // 2. Resolve caller's effective capability grants
  const grants = await authEngine.resolveScopes(session, "tahfizh.setoran.create");

  // 3. Multi-grant evaluation: ALLOW if at least one grant matches
  return grants.some(grant => {
    if (grant.scopeType === "GLOBAL" || grant.scopeType === "DOMAIN") return true;
    if (grant.scopeType === "HALAQOH" || grant.scopeType === "UNIT") {
      return grant.anchorUnitId === santri.halaqohId;
    }
    if (grant.scopeType === "ASSIGNED_UNITS") {
      return grant.unitIds.includes(santri.halaqohId);
    }
    return false;
  });
}
```

If a client alters `santriId` to point to a student outside their permitted units, the check evaluates to `false` and is rejected with `SCOPE_MISMATCH`.

---

## 3. Gender & Campus Boundary Isolation (`GENDER_COMPLEX_DENIED`)

Pesantren Darul Ulum Cendekia enforces strict physical and administrative segregation between the Male Complex (Putra) and Female Complex (Putri):

1. **Structural Separation**:
   - Female halaqoh (e.g. illustrative: `Halaqoh Putri A`) are categorized under `OrgUnitType: HALAQOH` with `genderComplex = 'PUTRI'`.
   - Female dorm rooms (e.g. illustrative: `Kamar Asrama Putri 1`) are categorized under `OrgUnitType: KAMAR` with `genderComplex = 'PUTRI'`.
2. **Specialized Rejection (`GENDER_COMPLEX_DENIED`)**:
   - Standard `SCOPE_MISMATCH` indicates a generic organizational mismatch within the same campus partition (e.g. Musyrif A editing Musyrif B's halaqoh).
   - `GENDER_COMPLEX_DENIED` explicitly signals a violation of the physical/sharia gender segregation boundary (e.g. an ikhwan personnel attempting to access akhwat dormitory or halaqoh records without an approved cross-complex operational assignment).
3. **Data Protection for Guardian Phone Numbers**:
   - In accordance with privacy rules, guardian contact numbers (`noHpWali`) are redacted at the service layer unless the requester holds `Scope: GLOBAL` (Mudir/Admin), is the assigned musyrif of that specific halaqoh (`Scope: HALAQOH`), or is the guardian themselves (`Scope: OWN_CHILD`).

---

## 4. Fail-Closed Boundary Guarantees

1. **Unassigned Student**: If a student is not yet assigned to any halaqoh (`halaqohId == null`), musyrif with `Scope: HALAQOH` cannot create setoran or view reports for that student. Only managerial staff with `Scope: DOMAIN` (Kabid) or `GLOBAL` (Mudir/Admin) may inspect unassigned students.
2. **Ambiguous Context**: If a request fails to supply sufficient contextual identifiers (e.g., missing `santriId` on a scoped action), the engine defaults to `DENY` with code `INVALID_RESOURCE_CONTEXT`.
