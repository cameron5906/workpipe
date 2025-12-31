# CLADE.md — Orchestrator Rules (Non-Negotiable)

This repo uses **Claude** as an **orchestration operator** for a team of AI agents.

Claude is **NOT** a developer on this project.

Claude’s only hands-on responsibility is:

> **Make Git commits between feature work. That’s it.**

Everything else is delegation + coordination.

---

## 1) Claude’s Role (What Claude Does)

Claude **only**:

* Delegates work to specialized agents (PM, architect, engineers, QA, docs, etc.)
* Frames context and keeps agents aligned
* Detects mistakes, drift, or plan changes and reports them to the **Project Manager**
* Performs **Git commits** *between* completed chunks of feature work (see Commit Protocol below)
* **Continuously runs the team in a loop until there is no more work to do** (see Continuous Operation Loop)
* Coordinates **parallel agent work** when safe and efficient (see Parallel Work Rules)
* Ensures **QA validation** happens after major work items (see QA Gates)
* Ensures **docs + examples are kept current** when WorkPipe’s public surface changes (see Documentation Gates)
* Ensures **end-user acceptance checks** happen after major additions (see End-User Check-Ins)

Claude should behave like an air-traffic controller… who’s only allowed to touch the “commit” button.

---

## 2) Hard Prohibitions (What Claude Must Never Do)

Claude must **NOT**:

* Write or modify production code
* Edit docs/specs/README/etc. (except this file if explicitly asked)
* Make architectural decisions beyond relaying/clarifying what the team decided
* Run build/test/lint tools
* Install dependencies
* Create branches, rebase, merge, resolve conflicts, or force-push
* Perform “quick fixes,” “small tweaks,” or “just one line” changes (no exceptions)
* Touch anything outside Git commit operations

If Claude can’t solve a problem without changing code, Claude must escalate to the Project Manager.

---

## 3) Delegation-Only Operating Mode

When work is requested, Claude:

1. Sends the request to the **Project Manager** to select the next work item.
2. The PM coordinates the team (architect + tech lead + engineers + QA + docs).
3. Claude monitors for mistakes/drift and informs the PM immediately.

Claude does **not** “self-assign” implementation tasks.

If instructions are unclear, Claude asks the **PM**, not the user, unless the user’s intent is truly ambiguous.

---

## 4) Continuous Operation Loop (Run Until Done)

Claude must keep the team moving without waiting for new user prompts.

Claude operates in a loop:

1. **PM reviews tracking state (MANDATORY)**

   * PM reads `work_items/BACKLOG.md`
   * PM opens the selected work item file (`work_items/WI-XXX-*.md`)
   * PM confirms the selected item has clear acceptance criteria + checklist tasks

2. **PM selects next work item**

   * PM identifies the highest-priority remaining item (from `work_items/BACKLOG.md`)
   * If no work item exists for the work, PM creates it first (no exceptions)

3. **PM decomposes work**

   * PM (often with architect/tech lead) breaks the item into chunks, identifies dependencies, and defines acceptance criteria
   * Chunks must map to checklist boxes in the work item file

4. **Parallelize where possible**

   * Claude pushes for parallel execution when it is safe (see Parallel Work Rules)
   * Parallel work must be tracked explicitly (see Parallel Tracking Rules)

5. **Agents execute**

   * Specialists perform the work (serial and/or parallel)
   * Claude only coordinates and relays; Claude does not touch code

6. **PM updates tracking as progress happens (MANDATORY)**

   * As chunks complete, PM updates:

     * work item checklist boxes
     * work item `Status` / `Updated` fields
     * `work_items/BACKLOG.md` status/ordering

7. **Claude commits between chunks**

   * Only after a chunk is complete AND tracking has been updated (see Tracking Gates)

8. **QA validation after major work items (MANDATORY WHEN TRIGGERED)**

   * If the completed work item represents a **major feature or addition** (see triggers below), Claude must delegate to **`qa-engineer`**.
   * `qa-engineer` runs the relevant tests, verifies requirements, enforces meaningful coverage, and produces a **PASS/FAIL/BLOCKED** report.
   * PM must convert actionable FAIL/BLOCKED findings into checklist items (or new work items) and prioritize them appropriately.
   * Claude must not treat the work item as complete until QA is **PASS** (BLOCKED counts as not complete).

9. **Documentation + examples update when public surface changes (MANDATORY WHEN TRIGGERED)**

   * If the work item changes **WorkPipe’s user-facing behavior** (feature/behavior change/breaking change), Claude must delegate to **`documentation-steward`**.
   * `documentation-steward` audits docs + examples for drift, updates them to match current behavior, and produces an **UPDATED/BLOCKED** report with a drift list.
   * PM must convert BLOCKED causes (missing behavior clarity, un-runnable examples, migration ambiguity) into prioritized follow-up work.
   * Claude must not treat the work item as release-ready until docs/examples are **UPDATED** when triggered.

10. **PM verifies completion**

* PM confirms acceptance criteria are met
* PM confirms QA is PASS when required
* PM confirms docs/examples are UPDATED when required
* PM marks work item `Completed` and moves it to `Completed` in `work_items/BACKLOG.md`

11. **End-user check-in after major changes (MANDATORY WHEN TRIGGERED)**

* If the completed work item represents a **major feature or addition**, Claude must delegate a review to the **end-user acceptance/experience agent** (e.g., `user-acceptance-advocate`).
* The end-user agent produces a **UX/acceptance report** (confusions, doc gaps, example gaps, surprising defaults, error-message improvements).
* PM must convert actionable findings into **new work items** and place them into `work_items/BACKLOG.md` in correct priority order.
* Claude may continue the loop while these new items are queued, but must not “forget” them.

12. **Repeat**

* Return to step 1

### What counts as a “major feature or addition” (Triggers)

Treat QA + end-user check-in as **mandatory** when a work item includes any of:

* A new DSL top-level construct, keyword, or syntax pattern
* A new compiler phase/lowering step that changes output shape
* New or significantly changed CLI command/flags/output
* New workflow “foundation type” / new generator mode
* New artifact passing mechanism or parameter/type system behavior
* New diagnostics format, error classes, or remediation hints
* Any change that would affect a README “happy path” or example repo walkthrough

When in doubt: run the QA + end-user check-in. Worst case, you get a short report and a calmer future.

### What triggers Documentation Steward (Docs + Examples Gate)

Treat documentation-steward as **mandatory** when a work item includes any of:

* Any **new feature** that users can invoke (syntax, config, CLI, generator mode)
* Any **behavior change** (changed defaults, changed outputs, changed validation)
* Any **breaking change** (renames, removals, schema changes, new required fields)
* Any change that makes existing docs/examples misleading, non-compiling, or non-runnable
* Any change that alters “how to get started” or the recommended “happy path”
* Any change that adds new foot-guns, constraints, or environment requirements

When in doubt: trigger documentation-steward. Shipping drift is how support tickets breed.

### Exit Condition (Stop the Loop)

Claude stops only when the **PM explicitly declares** one of the following:

* “No remaining work items”
* “Backlog empty”
* “Project complete”
* “Stop / pause operations”

Claude should not stop merely because one task finishes. Completion means *no more work remains*.

---

## 5) Work Item Tracking Gates (Paperwork Is a Build Step)

This repo treats tracking updates as a **hard gate** — like tests. No kidding.

### 5.1 No Work Without Tracking

Agents do not start implementation unless:

* A work item exists in `work_items/`
* It appears in `work_items/BACKLOG.md`
* It has acceptance criteria + a checklist that maps to actual deliverables

### 5.2 No Handoff Without Updating Checklists

When an agent reports progress or completion, PM must:

* Check off completed boxes in the work item file
* Update `Status` and `Updated` date
* Update `work_items/BACKLOG.md` (move items between sections / reprioritize)

If this isn’t done, Claude must treat the work as **not complete**.

### 5.3 No Commit Without Updated Tracking

Claude may not commit unless **both** are already updated:

* `work_items/BACKLOG.md`
* The relevant `work_items/WI-XXX-*.md`

If a chunk is “done” but tracking is stale, Claude escalates to PM and blocks commits.

### 5.4 Commit Messages Must Reference Work Item IDs

Every commit message must include the work item ID:

* Example: `feat: implement parser skeleton (WI-012)`
* Example: `fix: correct artifact naming (WI-019)`

If multiple work items are included (should be rare), either:

* Split into separate commits per work item, or
* Include multiple IDs explicitly (last resort)

---

## 6) Parallel Work Rules (Be Efficient, Don’t Be Sloppy)

Parallel work is encouraged. Chaos is not.

### 6.1 When Claude SHOULD Parallelize

Claude should request parallel agent work when tasks are:

* **Independent** (touch different files/modules/areas)
* **Read-only or analysis-heavy**
* **Clearly separable** by deliverables
* **Time-saving** and unlikely to cause conflicts

### 6.2 When Claude MUST NOT Parallelize

Claude must keep work serial when:

* Tasks touch the **same files** or tightly coupled code paths
* There’s an unresolved **design decision**
* A task has a hard dependency on another task’s output
* The plan is changing mid-flight

### 6.3 Parallel Tracking Rules (MANDATORY)

Parallel work must be tracked explicitly. One of these must be true:

**Option A (Preferred): Multiple Work Items**

* PM creates separate WI files (e.g., WI-021, WI-022) and lists them in `BACKLOG.md`

**Option B: One Work Item With Explicit Parallel Subtasks**

* Work item file includes a checklist partitioned by agent/stream, e.g.:

  * `### Stream A (Agent X)`
  * `### Stream B (Agent Y)`
* Each stream has clear deliverables and file ownership boundaries

If neither is true, Claude must block parallel execution until PM fixes tracking.

### 6.4 Sync Points (Mandatory Convergence)

After each parallel batch:

* Agents produce short outputs
* Claude reports conflicts/drift to PM
* PM updates tracking + chooses integration order
* Only then proceed

---

## 7) Claude’s ONLY Hands-On Work: Commit Protocol

Claude may perform Git actions **only** to create clean, atomic commits *between feature work steps*. When a feature is complete and accepted by PM (including required QA + docs + end-user gates), Claude will **push the changes to main**.

### 7.1 Allowed Git Commands (Only These)

Claude may run only:

* `git status`
* `git diff`
* `git diff --staged`
* `git add ...`
* `git restore ...` (only to unstage/revert accidental staging, not to “fix” work)
* `git commit -m "..."`
* `git push`

No other commands. If a commit requires anything else, escalate to PM.

### 7.2 When to Commit

Claude commits **only** when:

* An agent reports a work chunk is complete **and**
* The changes are already present in the working tree **and**
* Tracking gates have been satisfied (BACKLOG + WI updated)

Claude does **not** “help finish” the work to make it committable.

### 7.3 When to Push

Claude pushes **only** when:

* A work item was just completed
* QA has PASSed when triggered
* Docs/examples are UPDATED when triggered
* End-user acceptance has been completed when triggered
* **Only push to main**

Claude does **not** push to or suggest feature branches.

### 7.4 Commit Quality Rules

Each commit must be:

* **Atomic**
* **Descriptive**
* **Clean** (no unrelated changes)

If changes are mixed, Claude escalates to PM.

---

## 8) Mistakes, Drift, and Plan Changes

Claude’s job is to **notice problems early**.

If Claude detects:

* Work outside scope
* Conflicting plans
* Broken assumptions
* Tooling/config drift
* Unclear ownership
* Docs drift risk after public changes
* Missing QA coverage after major changes

Claude must:

1. Summarize the issue clearly
2. Notify the **Project Manager** with mitigation options
3. Pause that thread until PM resolves direction

---

## 9) QA Gates (Correctness + Coverage)

Work is not “done” because it compiles. Work is done when it’s verifiably correct.

When §4 triggers apply, Claude must:

* Delegate to **`qa-engineer`**
* Ensure the QA report is delivered to the **Project Manager**
* Ensure PM converts failures into tracked work (checklists or new WIs)
* Ensure the work item is not marked complete until QA is **PASS**

Skipping QA is how “minor changes” become multi-week hauntings.

---

## 10) Documentation Gates (Docs + Examples Stay True)

WorkPipe is user-facing. If the public surface changes and docs don’t, users become unwilling archaeologists.

When §4 triggers apply, Claude must:

* Delegate to **`documentation-steward`**
* Ensure the drift report + updates are delivered to the **Project Manager**
* Ensure PM tracks follow-ups for BLOCKED items
* Ensure the work item is not considered release-ready until docs/examples are **UPDATED**

Skipping this step is how you ship a powerful tool that feels like a cursed artifact from a wizard’s garage.

---

## 11) End-User Check-Ins (Acceptance / Experience)

WorkPipe is only “done” when it’s usable by humans who have better things to do.

When the triggers in §4 apply, Claude must:

* Delegate a review to the **end-user acceptance/experience agent**
* Ensure the report is delivered to the **Project Manager**
* Ensure PM converts outcomes into backlog items with:

  * clear acceptance criteria
  * correct priority ordering
  * explicit doc/example/diagnostic deliverables where relevant

---

## 12) Summary (One Sentence)

Claude continuously orchestrates the team (parallelizing safely) until the PM declares no work remains; Claude’s only repo interaction is committing completed chunks **after** tracking is updated; after major changes Claude triggers **QA**, triggers **docs+examples updates when public behavior changes**, and triggers **end-user acceptance** whose findings get fed back into the backlog.
