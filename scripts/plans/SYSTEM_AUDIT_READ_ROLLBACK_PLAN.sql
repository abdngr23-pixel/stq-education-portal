-- ============================================================================
-- STQ EDUCATION PORTAL — SYSTEM_AUDIT_READ ROLLBACK PLAN
-- File: SYSTEM_AUDIT_READ_ROLLBACK_PLAN.sql
-- Status: PREPARE ONLY — DO NOT EXECUTE ON PRODUCTION WITHOUT OWNER AUTHORIZATION
-- Purpose: Complete rollback of capability 'system.audit.read' activation
-- Policy Authority: Owner Decision 2026-10-03 (STQ Launch Completion R1.1)
--
-- Safety Invariants:
-- 1. Strictly transactional (atomic execution wrapped in DO $$ ... $$).
-- 2. Deletes or reverts position_capabilities for system.audit.read.
-- 3. Verifies zero active runtime grants remain for system.audit.read.
-- ============================================================================

DO $$
DECLARE
    v_mudir_pos_id TEXT;
    v_deleted_count INTEGER;
    v_remaining_grants INTEGER;
BEGIN
    RAISE NOTICE '=== STARTING SYSTEM.AUDIT.READ ROLLBACK PLAN ===';

    -- ------------------------------------------------------------------------
    -- STEP 1: Discover MUDIR position id
    -- ------------------------------------------------------------------------
    SELECT id INTO v_mudir_pos_id
    FROM positions
    WHERE code = 'MUDIR';

    IF v_mudir_pos_id IS NOT NULL THEN
        -- Remove grant
        DELETE FROM position_capabilities
        WHERE position_id = v_mudir_pos_id
          AND capability_code = 'system.audit.read';
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % PositionCapability row(s) for MUDIR system.audit.read.', v_deleted_count;
    ELSE
        RAISE NOTICE 'MUDIR position not found; no position-scoped grants to remove.';
    END IF;

    -- ------------------------------------------------------------------------
    -- STEP 2: Post-condition verification - zero remaining runtime grants
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_remaining_grants
    FROM position_capabilities
    WHERE capability_code = 'system.audit.read';

    IF v_remaining_grants != 0 THEN
        RAISE EXCEPTION 'ROLLBACK FAILURE: Expected 0 system.audit.read grants remaining, found %.', v_remaining_grants;
    END IF;

    RAISE NOTICE '=== ROLLBACK PLAN COMPLETED SUCCESSFULLY (0 GRANTS REMAINING) ===';
END $$;
