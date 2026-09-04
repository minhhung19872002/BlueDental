# BlueDental Codex Instructions

This file is the Codex project rule derived from `CLAUDE.md`. `CLAUDE.md` remains
the detailed canonical engineering guide: read it completely before substantial
work, and follow it together with this file. If this summary omits a detail,
`CLAUDE.md` still applies.

## Reference application: strictly read-only

BlueDental is a clean-room implementation based on authorized, read-only
observation of `https://app.nfcdental.com`.

Before interacting with the reference application, read and follow:

- `.claude/rules/00-reference-readonly.md`
- `.claude/rules/01-production-data.md`
- `.claude/rules/02-clone-methodology.md`

Production safety has higher priority than discovery, parity, testing, and task
completion. Never mutate the reference system or intentionally issue `POST`,
`PUT`, `PATCH`, or `DELETE` requests. Do not create, edit, save, submit, delete,
approve, reject, cancel, upload, import, send, assign, change status, change
permissions, or change configuration. Do not type into production forms. Treat
an unknown control as unsafe and do not click it when it may persist state.

Safe production observation is limited to existing pages and records,
screenshots, accessibility/DOM/CSS inspection, visible text, existing GET
traffic and responses, routes, static assets, and console messages. Do not replay
captured requests or bypass these restrictions with browser evaluation, scripts,
curl, fetch, axios, or automation.

Record unsafe or unobservable behavior in `docs/clone/unknowns.md` as
`UNKNOWN_REFERENCE_BEHAVIOR`, including page, control, reason, and
`Action taken: NONE`. Never silently invent reference behavior.

Never copy production patient data, credentials, cookies, tokens,
Authorization headers, or other PHI/PII into source control or documentation.
Document API structures with placeholders and use synthetic local data.
Sensitive reference captures must stay in uncommitted `reference-private/`.

The local BlueDental clone is fully controllable for implementation and testing.
All destructive testing belongs only on local or explicitly designated
non-production environments.

## Feature workflow and documentation

Work feature by feature:

1. Observe the reference safely.
2. Record facts and separate them from assumptions.
3. Define API contracts first.
4. Implement backend domain, tests, AppService, and persistence.
5. Implement frontend types, TanStack Query API hooks, UI, and tests.
6. Run the real local application and compare reference/local screenshots.
7. Fix mismatches, simplify, run a security review when staging-bound, and
   record unresolved behavior.

Maintain `docs/clone/routes.md`, `components.md`, `api.md`, `states.md`, and
`unknowns.md`; put page discoveries in `docs/clone/pages/`. Maintain the testing
registry under `docs/testing/` as specified in `CLAUDE.md`.

Do not claim visual parity from subjective inspection. Compare reference and
local screenshots and check dimensions, spacing, typography, borders, radii,
colors, icons, control heights, alignment, empty states, and responsive layout.

## Current stack and architecture

Backend: .NET 9, ABP Framework 9, PostgreSQL 15, Redis 7, Clean Architecture,
DDD, and ABP AppServices. Do not replace the AppService pattern with plain
MediatR/CQRS. Use Organization Units for branch hierarchy, not ABP
multi-tenancy. Branch-scoped entities use `ClinicBranchId`; enforce scope and
permissions on the server.

Frontend: React 19, TypeScript, Vite 8, Ant Design 6, TanStack Query 5, Zustand
5, React Hook Form with Zod, React Router 7, Recharts 3, SignalR, and ABP
Localization. Styling uses manual feature CSS and `--bd-*` tokens synchronized
with `src/theme/index.ts`.

Do not add or use Tailwind. The Tailwind wording in
`.claude/rules/02-clone-methodology.md` is legacy and is superseded by the newer,
explicit stack and CSS rules in `CLAUDE.md`. Preserve the production read-only
requirements from that rule.

Frontend feature folders are independent. Do not import across features; move
shared code to `src/components/` or `src/hooks/`. API calls must stay in the
feature `api/` layer and be consumed via TanStack Query hooks. Pages and
components work with adapted ViewModels rather than raw DTOs.

Use container/presenter separation, small composable components, focused custom
hooks, adapters at API boundaries, strategy maps for conditional behavior,
composable Zod schemas, and repository-style API modules. Prefer composition to
boolean configuration. Keep page containers thin and split components that grow
beyond roughly 150 lines.

Follow dependency direction: pages may use components, APIs, and hooks;
components never import pages; APIs never import components/pages; hooks may use
APIs but not components. Hoist static configuration. Use early returns instead
of nested ternaries. Name prop callbacks `onAction` and implementations
`handleAction`.

TypeScript must not use `any` or unsafe assertions. Prefer explicit types,
`unknown` plus guards at untyped boundaries, interfaces for component props,
types for unions, and discriminated unions for state machines. All visible text
must go through localization; do not hard-code UI strings.

Use feature-scoped CSS files imported by the page container. Reserve
`src/styles/index.css` for tokens, resets, shell layout, Ant Design overrides,
and truly shared styles. Avoid inline style objects; use classes and `--bd-*`
tokens. Dynamic CSS may use a typed custom property only when a class cannot
express it. Supported breakpoints are 1280, 1100, and 640.

Server state belongs in TanStack Query and client-only state in narrow,
single-concern Zustand stores. Do not store derived state. Use Ant Design `Spin`
for consistent loading. Any API action button must be disabled and show a
loading indicator while pending; show success/error feedback only after the
response.

Use `src/components/CurrencyInput.tsx` for new money/large-number fields unless
the documented exceptions in `CLAUDE.md` apply. Do not rebuild the completed
`/taxonomy` feature; read its clone and regression documentation and run its
required production-build regression tests before touching it.

## Backend domain rules

Business invariants belong in aggregates and value objects, not AppServices.
AppServices orchestrate aggregate methods. Prefer static aggregate factories,
guard clauses, domain events, stateless domain services for multi-aggregate
logic, specifications for complex reusable queries, strategies for varying
business rules, template base AppServices for shared catalog flows, and custom
repository methods for complex data access.

Preserve the workflows defined in `CLAUDE.md` for appointments, treatment plans,
invoices, and insurance claims. Do not bypass state transitions. Never put SQL or
business invariants in AppServices.

## Security, privacy, and files

Validate on the server; frontend validation is only UX. Enforce authentication,
authorization, branch isolation, CSRF protection for mutations, secure session
cookies, audit logging, password policy, TLS, and XSS-safe rendering. Do not log
PHI. Treat medical history, allergies, and treatment records as PII Level 3.
Never commit secrets or connection strings.

Store files in MinIO. Validate Excel before insertion. Use ClosedXML/MiniExcel
for Excel and QuestPDF for PDF. Store X-ray image references only; never store
DICOM binaries in PostgreSQL.

## Testing and completion evidence

Acceptance evidence must exercise the real path: React UI, real HTTP, ASP.NET
Core pipeline, real authentication/authorization, application layer, EF Core,
and real PostgreSQL. Do not create new unit or mocked frontend suites unless the
user explicitly asks. Existing isolated tests may supplement but never replace
runtime acceptance.

Real frontend acceptance tests must log in through the UI and must not intercept
BlueDental APIs, inject tokens/localStorage, fake permissions or branch context,
or return hard-coded business responses. Backend acceptance uses real HTTP and
PostgreSQL/Testcontainers, not EF InMemory, and verifies persistence,
validation, permissions, branch scope, workflows, duplicates, side effects,
concurrency, and follow-up reads as applicable.

Use impact-based retesting from `CLAUDE.md`: Level 1 for purely visual changes,
Level 2 for a feature, Level 3 for shared dependencies, and Level 4 only for
release/major architecture/authentication changes. Only mark a feature
`VERIFIED` after real runtime acceptance. Completion reports must include the
feature/status, verified commit, backend/API result, real-browser result,
persistence, permissions, branch isolation, workflow, retest level, affected
features, and remaining blockers.

