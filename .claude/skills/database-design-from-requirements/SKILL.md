# Skill: database-design-from-requirements

Runs the full BlueDental database design pipeline — from raw requirements through to a red-team-verified PostgreSQL schema with Critical=0, High=0.

Invoke with: `/database-design-from-requirements`

---

## What this skill does

It coordinates six specialized agents in sequence, passing the output of each step as the input to the next. The pipeline is designed to be resumable — each step checks whether its output already exists before doing work, so you can re-invoke the skill after a partial run and it will continue from where it stopped.

The pipeline ends only when the schema-red-team agent confirms Critical=0, High=0. If it finds issues, it fixes them and runs again.

---

## Before you start

Read these to understand current state:

```
docs/00-index.md               — which docs exist and at what version
docs/03-database-schema.sql    — current schema (if it exists)
docs/14-database-review-report.md — current readiness state (if it exists)
```

Then determine the starting step using the decision table below.

---

## Pipeline Steps

### STEP 0 — Determine starting point

| Condition | Start at step |
|-----------|--------------|
| `docs/01-functional-requirements.md` is missing or contains `[CẦN XÁC NHẬN]` items that need resolution | Step 1 |
| `docs/02-domain-model.md` or `docs/04-state-machines.md` is missing | Step 2 |
| `docs/03-database-schema.sql` is missing or is a stub | Step 3 |
| Schema exists but `docs/11` or `docs/12` are missing | Step 4 (parallel) |
| Everything exists but no red-team pass has run | Step 5 |
| Red-team ran but Critical > 0 or High > 0 | Step 5 (re-run) |
| Red-team confirmed Critical=0, High=0 | Step 6 |

---

### STEP 1 — Requirements Analyst

**When to run:** `docs/01-functional-requirements.md` is missing, incomplete, or the source documents have changed.

**Spawn:** `requirements-analyst` agent

**Input:** All source documents in the workspace

**Output:** `docs/01-functional-requirements.md`

**Gate to proceed:** The document exists, has a summary table, every STT has a ràng buộc section, and there are no unresolved `[CẦN XÁC NHẬN]` items that would affect database design.

---

### STEP 2 — Domain Modeler

**When to run:** `docs/02-domain-model.md` or `docs/04-state-machines.md` is missing or does not cover all STTs in docs/01.

**Spawn:** `domain-modeler` agent

**Input:** `docs/01-functional-requirements.md`

**Output:** `docs/02-domain-model.md`, `docs/04-state-machines.md`

**Gate to proceed:** Both documents exist. Every bounded context in CLAUDE.md §3.2 appears in docs/02. Every entity with a status field has a state machine in docs/04.

---

### STEP 3 — Database Architect

**When to run:** `docs/03-database-schema.sql` is missing or is a stub.

**Spawn:** `database-architect` agent

**Input:** `docs/01`, `docs/02`, `docs/04`, `docs/05`, `docs/07`

**Output:** `docs/03-database-schema.sql`, `docs/09`, `docs/10`, `docs/15`

**Gate to proceed:** The schema file exists and covers all bounded contexts.

---

### STEP 4 — Authorization Reviewer + Workflow Reviewer (parallel)

**When to run:** `docs/11` or `docs/12` are missing.

**Spawn both agents in parallel:**

**Agent A:** `authorization-reviewer` → `docs/11-database-security-and-data-scope.md`

**Agent B:** `workflow-reviewer` → `docs/12-database-history-and-audit-strategy.md`

**Gate to proceed:** Both output documents exist.

---

### STEP 5 — Schema Red Team (repeat until Critical=0, High=0)

**When to run:** Always run this step. Never skip it.

**Spawn:** `schema-red-team` agent

**Critical instruction:**
> Do NOT read Section 10 of docs/14 before completing independent analysis.

**Output:** Fixes applied to `docs/03-database-schema.sql`, findings in `docs/14`

**Repeat logic:**
```
repeat:
  run schema-red-team
  read Critical=N, High=N from docs/14
  if Critical > 0 or High > 0:
    run schema-red-team again
  else:
    break
```

---

### STEP 6 — Finalize and commit

1. Update `docs/00-index.md` version
2. Update `docs/14` Section 10: "READY — Critical=0, High=0"
3. Produce `docs/08-database-requirement-traceability.md`
4. Produce `docs/13-database-integration-strategy.md` (insurance API integration)
5. Git commit: `git add docs/ && git commit -m "docs: database schema vX.Y"`

---

## Completion criteria

- [ ] `docs/01` through `docs/15` all exist
- [ ] `docs/03` has a revision log with current version
- [ ] `docs/14` Section 10 reads: "READY — Critical=0, High=0"
- [ ] `docs/00-index.md` version reflects current schema version
- [ ] A git commit captures all documentation changes
