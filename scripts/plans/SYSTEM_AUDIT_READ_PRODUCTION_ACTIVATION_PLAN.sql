-- ============================================================================
-- STQ EDUCATION PORTAL — CORRECTED SYSTEM_AUDIT_READ PRODUCTION ACTIVATION PLAN
-- File: SYSTEM_AUDIT_READ_PRODUCTION_ACTIVATION_PLAN.sql
-- Status: PREPARE ONLY — DO NOT EXECUTE ON PRODUCTION WITHOUT OWNER AUTHORIZATION
-- Purpose: Canonical activation of capability 'system.audit.read' for Position 'MUDIR'
-- Scope: GLOBAL
-- Target State: VERIFIED_PRODUCTION
-- Policy Authority: Owner Decision 2026-10-03 (STQ Launch Completion R1.1/R1.2)
--
-- Safety Invariants:
-- 1. Strictly transactional (atomic execution wrapped in DO $$ ... $$).
-- 2. Dynamic ID discovery (no hardcoded UUID/cuid values).
-- 3. Fail-closed preconditions:
--    - Active MUDIR position must exist.
--    - No unexpected grant for 'system.audit.read' (no ADM grant, no YAY grant).
-- 4. State-preserving audit capture: records whether capability or grant existed prior.
-- 5. Exact post-condition verification: exactly 1 MUDIR / GLOBAL grant with VERIFIED_PRODUCTION.
-- ============================================================================

DO $$
DECLARE
    v_mudir_pos_id TEXT;
    v_pos_active BOOLEAN;
    v_unexpected_grants INTEGER;
    v_target_pc_id TEXT;
    v_cap_existed_before BOOLEAN := false;
    v_pc_existed_before BOOLEAN := false;
    v_prior_scope TEXT := NULL;
    v_prior_state TEXT := NULL;
    v_final_count INTEGER;
    v_final_state TEXT;
    v_final_scope TEXT;
BEGIN
    RAISE NOTICE '=== STARTING SYSTEM.AUDIT.READ CANONICAL ACTIVATION PLAN ===';

    -- ------------------------------------------------------------------------
    -- STEP 1: PRECONDITION - Discover and verify active MUDIR position
    -- ------------------------------------------------------------------------
    SELECT id, is_active INTO v_mudir_pos_id, v_pos_active
    FROM positions
    WHERE code = 'MUDIR';

    IF v_mudir_pos_id IS NULL THEN
        RAISE EXCEPTION 'PRECONDITION FAILURE: Canonical Position MUDIR not found in positions table.';
    END IF;

    IF v_pos_active IS NOT TRUE THEN
        RAISE EXCEPTION 'PRECONDITION FAILURE: Canonical Position MUDIR exists but is inactive (is_active != true).';
    END IF;

    RAISE NOTICE 'Precondition passed: Discovered active MUDIR position id = %', v_mudir_pos_id;

    -- ------------------------------------------------------------------------
    -- STEP 2: PRE-STATE AUDIT - Capture existence of capability
    -- ------------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM capabilities WHERE code = 'system.audit.read') THEN
        v_cap_existed_before := true;
        RAISE NOTICE 'Pre-state: Capability system.audit.read already existed.';
    ELSE
        v_cap_existed_before := false;
        INSERT INTO capabilities (code, namespace, name, description, is_dangerous, created_at)
        VALUES (
            'system.audit.read',
            'SYSTEM',
            'Audit Log Read',
            'Memeriksa rekam jejak forensic Audit Log (Owner Approved for MUDIR GLOBAL)',
            false,
            NOW()
        );
        RAISE NOTICE 'Created semantic capability definition: system.audit.read';
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 3: PRECONDITION - Verify no unauthorized grants exist (ADM / YAY / Others)
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_unexpected_grants
    FROM position_capabilities pc
    JOIN positions p ON p.id = pc.position_id
    WHERE pc.capability_code = 'system.audit.read'
      AND p.code != 'MUDIR';

    IF v_unexpected_grants > 0 THEN
        RAISE EXCEPTION 'SECURITY INVARIANT VIOLATION: Found % unexpected system.audit.read grant(s) for non-MUDIR positions.', v_unexpected_grants;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 4: PRE-STATE AUDIT & CANONICAL ACTIVATION FOR MUDIR
    -- ------------------------------------------------------------------------
    SELECT id, scope_type::text, business_rule_state::text
    INTO v_target_pc_id, v_prior_scope, v_prior_state
    FROM position_capabilities
    WHERE position_id = v_mudir_pos_id
      AND capability_code = 'system.audit.read';

    IF v_target_pc_id IS NOT NULL THEN
        v_pc_existed_before := true;
        RAISE NOTICE 'Pre-state: PositionCapability existed with id = %, prior scope = %, prior state = %', v_target_pc_id, v_prior_scope, v_prior_state;

        UPDATE position_capabilities
        SET scope_type = 'GLOBAL',
            business_rule_state = 'VERIFIED_PRODUCTION'
        WHERE id = v_target_pc_id;
        RAISE NOTICE 'Updated existing PositionCapability id = % to VERIFIED_PRODUCTION (GLOBAL)', v_target_pc_id;
    ELSE
        v_pc_existed_before := false;
        RAISE NOTICE 'Pre-state: PositionCapability did NOT exist prior to activation.';

        v_target_pc_id := 'pc_mudir_audit_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);
        INSERT INTO position_capabilities (id, position_id, capability_code, scope_type, business_rule_state)
        VALUES (
            v_target_pc_id,
            v_mudir_pos_id,
            'system.audit.read',
            'GLOBAL',
            'VERIFIED_PRODUCTION'
        );
        RAISE NOTICE 'Inserted canonical PositionCapability id = % for MUDIR (GLOBAL, VERIFIED_PRODUCTION)', v_target_pc_id;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 5: POST-CONDITION VALIDATION - Strict exact row counts & state checks
    -- ------------------------------------------------------------------------
    SELECT COUNT(*), MAX(business_rule_state::text), MAX(scope_type::text)
    INTO v_final_count, v_final_state, v_final_scope
    FROM position_capabilities
    WHERE capability_code = 'system.audit.read';

    IF v_final_count != 1 THEN
        RAISE EXCEPTION 'POST-CONDITION FAILURE: Expected exactly 1 system.audit.read grant, found %.', v_final_count;
    END IF;

    IF v_final_state != 'VERIFIED_PRODUCTION' THEN
        RAISE EXCEPTION 'POST-CONDITION FAILURE: Expected businessRuleState VERIFIED_PRODUCTION, found %.', v_final_state;
    END IF;

    IF v_final_scope != 'GLOBAL' THEN
        RAISE EXCEPTION 'POST-CONDITION FAILURE: Expected scopeType GLOBAL, found %.', v_final_scope;
    END IF;

    RAISE NOTICE '=== ACTIVATION PLAN COMPLETED SUCCESSFULLY (EXACTLY 1 MUDIR / GLOBAL / VERIFIED_PRODUCTION GRANT) ===';
END $$;
