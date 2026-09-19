<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# STQ Education Portal — mandatory project context

Before ANY implementation, refactor, architecture decision, business-rule change, authorization work, migration work, database operation, production action, or release decision:

1. Read `STQ_PROJECT_CONTEXT.md`.
2. Read `docs/STQ_OWNER_DIRECTIVES.md`.
3. Read `docs/STQ_CURRENT_STATE.md`.
4. Read `types/architecture-lock.ts`.
5. Read `docs/STQ_ARCHITECTURE_LOCK.md`.
6. Read the relevant domain/milestone specification referenced by those files.
7. Inspect the actual current code/diff/database evidence relevant to the task.

## Hard rules

- Repository owner directives, not conversational agent memory, are the persistent business-requirement source of truth.
- `STQ_PROJECT_CONTEXT.md` is the mandatory project bootstrap/index.
- `docs/STQ_CURRENT_STATE.md` is the current release/production checkpoint.
- `README.md` is NOT authoritative business policy.
- Legacy `Role`, names, usernames, UI visibility, and stale docs do NOT prove authorization.
- Never infer a missing business rule.
- `PROPOSED_TBD` grants zero authority.
- `APPROVED_TARGET_PENDING_TECHNICAL` grants zero runtime authority until deliberate activation/promotion.
- Server authorization is authoritative; UI hiding is not authorization.
- Production default is READ ONLY.
- Never run production migration, seed, backfill, provisioning, capability promotion, feature-flag activation, `db push`, `migrate resolve`, or other production writes without explicit Business Owner authorization for that exact action.
- PR #8 is a protected historical special case. Read `docs/STQ_CURRENT_STATE.md` before touching its migration history or related Prisma schema.
- Do not silently “repair” production or migration history to make tooling green.
- Do not convert query/read failures into fake healthy values, fake `[]`, or fake `0`.
- When documents conflict, follow the authority precedence in `STQ_PROJECT_CONTEXT.md`.
- A newer explicit Business Owner decision supersedes older policy; update canonical documentation when implementing that change.

## Required trust model

Antigravity/agent implementation reports are not proof of PASS.

Before merge/release, verify independently where applicable:

- actual main HEAD;
- actual PR HEAD;
- changed files/diff;
- CI on exact HEAD;
- deployment status;
- migration/schema implications;
- authorization/business-rule boundaries;
- protected PR #8 integrity;
- production-write risk.

Do not merge unless explicitly authorized.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, load the antislop skill for the task:
- Core filter, always on: `antislop`
- UI / visual: `antislop-ui`
- Copy & text: `antislop-copywriting`
- Mobile / responsive: `antislop-layoutmobile`
- Code comments: `antislop-code`
Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->
