-- ============================================================================
-- STQ EDUCATION PORTAL — SYSTEM_AUDIT_READ PRODUCTION ACTIVATION PLAN
-- File: SYSTEM_AUDIT_READ_PRODUCTION_ACTIVATION_PLAN.sql
-- Status: PREPARE ONLY — DO NOT EXECUTE ON PRODUCTION WITHOUT OWNER AUTHORIZATION
-- Purpose: Canonical activation of capability 'system.audit.read' for Position 'MUDIR'
-- Scope: GLOBAL
-- Target State: VERIFIED_PRODUCTION
-- Policy Authority: Owner Decision 2026-10-03 (STQ Launch Completion R1.1)
--
-- Safety Invariants:
-- 1. Strictly transactional (atomic execution wrapped in DO $$ ... $$).
-- 2. Dynamic ID discovery (no hardcoded UUID/cuid values).
-- 3. Fail-closed preconditions:
--    - Active MUDIR position must exist.
--    - Capability 'system.audit.read' must exist or be created under namespace 'SYSTEM'.
--    - No unexpected grant for 'system.audit.read' (no ADM grant, no YAY grant).
-- 4. Idempotency: UPSERT semantics on (position_id, capability_code).
-- 5. Exact post-condition verification: exactly 1 MUDIR / GLOBAL grant with VERIFIED_PRODUCTION.
-- ============================================================================

DO $$
DECLARE
    v_mudir_pos_id TEXT;
    v_pos_active BOOLEAN;
    v_unexpected_grants INTEGER;
    v_target_pc_id TEXT;
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
    -- STEP 2: PRECONDITION - Ensure Capability semantic definition exists
    -- ------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM capabilities WHERE code = 'system.audit.read') THEN
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
    ELSE
        RAISE NOTICE 'Precondition passed: Capability system.audit.read already exists.';
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
    -- STEP 4: CANONICAL ACTIVATION - Upsert PositionCapability for MUDIR
    -- ------------------------------------------------------------------------
    SELECT id INTO v_target_pc_id
    FROM position_capabilities
    WHERE position_id = v_mudir_pos_id
      AND capability_code = 'system.audit.read';

    IF v_target_pc_id IS NOT NULL THEN
        -- Existing grant row found: promote to VERIFIED_PRODUCTION & GLOBAL
        UPDATE position_capabilities
        SET scope_type = 'GLOBAL',
            business_rule_state = 'VERIFIED_PRODUCTION'
        WHERE id = v_target_pc_id;
        RAISE NOTICE 'Updated existing PositionCapability id = % to VERIFIED_PRODUCTION (GLOBAL)', v_target_pc_id;
    ELSE
        -- Insert new canonical grant row with generated cuid-like identifier
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
        RAISE EXCEPTION 'POST-CONDITION FAILURE: Target businessRuleState is %, expected VERIFIED_PRODUCTION.', v_final_state;
    END IF;

    IF v_final_scope != 'GLOBAL' THEN
        RAISE EXCEPTION 'POST-CONDITION FAILURE: Target scopeType is %, expected GLOBAL.', v_final_scope;
    END IF;

    RAISE NOTICE '=== ACTIVATION PLAN COMPLETED SUCCESSFULLY (EXACT 1 MUDIR GLOBAL GRANT VERIFIED) ===';
END $$;
