-- ============================================================================
-- STQ EDUCATION PORTAL — STATE-PRESERVING SYSTEM_AUDIT_READ ROLLBACK PLAN
-- File: SYSTEM_AUDIT_READ_ROLLBACK_PLAN.sql
-- Status: PREPARE ONLY — DO NOT EXECUTE ON PRODUCTION WITHOUT OWNER AUTHORIZATION
-- Purpose: Complete, state-preserving rollback of capability 'system.audit.read' activation
-- Policy Authority: Owner Decision 2026-10-03 (STQ Launch Completion R1.1/R1.2)
--
-- Safety Invariants:
-- 1. Strictly transactional (atomic execution wrapped in DO $$ ... $$).
-- 2. State-preserving:
--    - IF PositionCapability did NOT exist prior to activation:
--      DELETE the inserted PositionCapability row.
--    - IF PositionCapability DID exist prior to activation:
--      RESTORE the exact prior scope_type and business_rule_state.
--    - IF Capability did NOT exist prior to activation and has zero other references:
--      DELETE the semantic capability definition.
--    - IF Capability DID exist prior to activation:
--      PRESERVE the semantic capability definition.
-- 3. Post-condition verification:
--    - Zero VERIFIED_PRODUCTION grants remain for system.audit.read.
--    - No unexpected mutations or state loss.
-- ============================================================================

DO $$
DECLARE
    v_mudir_pos_id TEXT;
    v_target_pc_id TEXT;
    v_remaining_prod_grants INTEGER;
    v_other_refs_count INTEGER;

    -- PRE-ACTIVATION CONTRACT PARAMETERS:
    -- Based on deterministic pre-activation snapshot (10_ACTIVATION_PRESTATE_CONTRACT.json):
    -- In production at baseline, capability was NOT present, and position_capability was NOT present.
    -- If running on a system where prior state existed, set these values accordingly:
    c_pc_existed_before CONSTANT BOOLEAN := false;
    c_prior_scope CONSTANT TEXT := NULL; -- Set to prior scope if existed
    c_prior_state CONSTANT TEXT := NULL; -- Set to prior state if existed (e.g. 'APPROVED_TARGET_PENDING_TECHNICAL')
    c_cap_existed_before CONSTANT BOOLEAN := false;
BEGIN
    RAISE NOTICE '=== STARTING STATE-PRESERVING SYSTEM.AUDIT.READ ROLLBACK PLAN ===';

    -- ------------------------------------------------------------------------
    -- STEP 1: Discover MUDIR position id
    -- ------------------------------------------------------------------------
    SELECT id INTO v_mudir_pos_id
    FROM positions
    WHERE code = 'MUDIR';

    IF v_mudir_pos_id IS NOT NULL THEN
        SELECT id INTO v_target_pc_id
        FROM position_capabilities
        WHERE position_id = v_mudir_pos_id
          AND capability_code = 'system.audit.read';

        IF v_target_pc_id IS NOT NULL THEN
            IF c_pc_existed_before IS TRUE THEN
                -- RESTORE exact prior state
                UPDATE position_capabilities
                SET scope_type = c_prior_scope::"ScopeType",
                    business_rule_state = c_prior_state::"BusinessRuleState"
                WHERE id = v_target_pc_id;
                RAISE NOTICE 'State preserved: Restored PositionCapability id = % to prior state (%) and scope (%).',
                    v_target_pc_id, c_prior_state, c_prior_scope;
            ELSE
                -- Row was inserted during activation: delete inserted row
                DELETE FROM position_capabilities
                WHERE id = v_target_pc_id;
                RAISE NOTICE 'Clean rollback: Deleted inserted PositionCapability id = % for MUDIR system.audit.read.', v_target_pc_id;
            END IF;
        ELSE
            RAISE NOTICE 'No PositionCapability found for MUDIR system.audit.read.';
        END IF;
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 2: Semantic Capability handling
    -- ------------------------------------------------------------------------
    IF c_cap_existed_before IS FALSE THEN
        -- Only delete if no foreign keys reference it
        SELECT COUNT(*) INTO v_other_refs_count
        FROM position_capabilities
        WHERE capability_code = 'system.audit.read';

        IF v_other_refs_count = 0 THEN
            DELETE FROM capabilities
            WHERE code = 'system.audit.read';
            RAISE NOTICE 'Clean rollback: Deleted semantic capability definition system.audit.read (zero references remaining).';
        ELSE
            RAISE NOTICE 'Capability system.audit.read preserved because % reference(s) still exist.', v_other_refs_count;
        END IF;
    ELSE
        RAISE NOTICE 'State preserved: Capability system.audit.read existed prior to activation and is preserved.';
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 3: Post-condition verification - zero runtime VERIFIED_PRODUCTION grants
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_remaining_prod_grants
    FROM position_capabilities
    WHERE capability_code = 'system.audit.read'
      AND business_rule_state = 'VERIFIED_PRODUCTION';

    IF v_remaining_prod_grants != 0 THEN
        RAISE EXCEPTION 'ROLLBACK FAILURE: Expected 0 VERIFIED_PRODUCTION grants remaining, found %.', v_remaining_prod_grants;
    END IF;

    RAISE NOTICE '=== ROLLBACK PLAN COMPLETED SUCCESSFULLY (0 RUNTIME VERIFIED_PRODUCTION GRANTS) ===';
END $$;
