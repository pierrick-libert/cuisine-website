# Spec-Driven Development (SDD) — How to Work on This Project

This project uses [Spec Kit](https://github.com/github/spec-kit) for **spec-driven development**:
instead of jumping straight to code, every feature goes through a short pipeline of documents —
*spec → plan → tasks → implementation* — each one reviewed before the next is generated. The goal
is that decisions get made and written down at the cheapest point to change them (a sentence in a
spec), not the most expensive one (a rewritten Lambda).

This file is your reference for using the workflow yourself, with or without an AI agent driving it.

## Why we're doing this

- A spec is quick to read and cheap to correct; code is not. SDD front-loads disagreement-finding
  into the document stage.
- The project constitution (`.specify/memory/constitution.md`) encodes decisions already made
  (cost-first, static-first, single backend surface, etc. — see that file for the full list) so
  every later plan gets checked against them automatically instead of re-litigated per feature.
- Each stage produces a durable artifact under `specs/`, so six months from now you (or an AI
  agent with no memory of this conversation) can read *why* a feature looks the way it does.

## The pipeline, at a glance

```text
/speckit-constitution   → .specify/memory/constitution.md      (project principles — rarely changes)
        │
/speckit-specify        → specs/NNN-feature-slug/spec.md        (what & why, no tech detail)
        │
  [/speckit-clarify]     → ...spec.md amended in place           (optional: de-risk ambiguity)
        │
/speckit-plan            → .../plan.md + design docs             (how: architecture, data model, etc.)
        │
  [/speckit-checklist]   → .../checklists/*.md                   (optional: requirement-quality gate)
        │
/speckit-tasks            → .../tasks.md                          (dependency-ordered task list)
        │
  [/speckit-analyze]     → report only, no file changes           (optional: cross-artifact consistency)
        │
/speckit-implement        → actual code, following tasks.md
        │
  [/speckit-converge]    → tasks.md gets any missed work appended (optional: after-the-fact audit)
```

Square-bracketed steps are optional quality gates — skip them for a small feature, use them when a
feature is ambiguous, high-risk, or you want a second pass before committing to code.

## The commands, one by one

Every command below is a **skill** installed at `.claude/skills/speckit-*` (not a classic slash
command — in Claude Code you invoke it the same way: type `/speckit-specify ...` and the harness
resolves it to the skill). Each one reads/writes specific files and nothing else — none of them
write application code except `/speckit-implement`.

### `/speckit-constitution`

**When**: once at project start, and again only when a *principle* changes (not a feature detail).
**Input**: principles/values, in plain language.
**Output**: `.specify/memory/constitution.md`, version-bumped per semver (MAJOR = principle
removed/redefined, MINOR = principle added, PATCH = wording only).
**This project's constitution is already ratified (v1.0.0)** — you only need this again if a core
decision changes (e.g. you decide cost no longer trumps everything, or you add a principle).

### `/speckit-specify`

**When**: starting any new feature or piece of work.
**Input**: a natural-language description of the feature — what it should do and why, not how.
**Output**: a new feature directory `specs/NNN-short-slug/` (auto-numbered) containing `spec.md`,
and a matching git branch `NNN-short-slug` is created/checked out.
**Write a spec like**: "Recipe publish flow: editor clicks one global 'Publish all pending changes'
button; it should render every draft recipe to static HTML and update the public site." Avoid
naming specific AWS services here — that's the plan's job, not the spec's.

### `/speckit-clarify` (optional)

**When**: right after `/speckit-specify`, before `/speckit-plan`, if the spec has any ambiguity you
can feel but haven't pinned down.
**What it does**: asks you up to 5 targeted questions and writes the answers back into `spec.md`.
**Skip it** for small, unambiguous features — don't use it as a formality.

### `/speckit-plan`

**When**: once the spec is solid.
**Input**: optional extra guidance; mostly reads `spec.md` + the constitution.
**Output**: `plan.md` and supporting design docs (data model, contracts, research notes — whatever
the feature needs) in the same `specs/NNN-.../` directory. This is where "DynamoDB single-table,
Step Functions pipeline, Eleventy templates" kind of detail belongs.
**Important**: this step is required to check the plan against the constitution — if a plan wants
to add a GSI, a second backend surface, or a non-free-tier service, it must justify that deviation
explicitly or be revised to comply.

### `/speckit-checklist` (optional)

**When**: after `/speckit-plan`, for a feature where requirement completeness/clarity is worth a
second look (e.g. something security- or money-sensitive).
**Output**: a generated checklist under `specs/NNN-.../checklists/`.

### `/speckit-tasks`

**When**: once the plan is approved.
**Output**: `tasks.md` — a dependency-ordered, actionable task list derived from the plan. This is
what `/speckit-implement` actually executes against.

### `/speckit-analyze` (optional, read-only)

**When**: after tasks are generated, before implementing, if you want a sanity check.
**What it does**: cross-checks `spec.md`, `plan.md`, and `tasks.md` for consistency and gaps.
Produces a report only — it never edits your files.

### `/speckit-implement`

**When**: tasks are ready.
**What it does**: executes `tasks.md` in order, writing the actual application code.
**Input**: optionally, guidance to filter to a subset of tasks (e.g. "just the backend tasks").

### `/speckit-converge` (optional)

**When**: after implementation, if you suspect some planned work didn't actually get built (or the
codebase drifted from the plan).
**What it does**: diffs the real codebase against spec/plan/tasks and appends any missing work as
new tasks, so `/speckit-implement` can finish the job.

### `/speckit-taskstoissues` (optional)

**When**: if you'd rather track tasks as GitHub issues than as a checklist in `tasks.md`.
**What it does**: converts `tasks.md` entries into GitHub issues. Requires `gh` (not currently
installed on this machine) and a GitHub remote.

## Directory and branch conventions

- All feature artifacts live under `specs/NNN-feature-slug/` — numbered sequentially
  (`001-...`, `002-...`), slug derived from your `/speckit-specify` description.
- `/speckit-specify` creates and checks out a matching branch `NNN-feature-slug`. Finish a
  feature's spec→plan→tasks→implement cycle on that branch, then merge it back, same as any other
  feature branch.
- The constitution lives once, at the project root (`.specify/memory/constitution.md`) — it is not
  per-feature.

## Doing it manually (without an AI agent driving)

Every one of these commands is just a Markdown file with instructions for an AI agent to follow —
there's no magic CLI subcommand for "plan" or "specify". If you ever want to do this by hand (or
have a different agent/human follow the same process):

1. Read the relevant skill file, e.g. `.claude/skills/speckit-plan/SKILL.md` — it's a step-by-step
   procedure, written to be followed literally.
2. The shared shell scripts it calls are in `.specify/scripts/bash/` (e.g.
   `create-new-feature.sh`, `setup-plan.sh`, `setup-tasks.sh`, `check-prerequisites.sh`) — these do
   the mechanical parts (branch creation, numbering, locating the current feature directory) and
   are safe to run directly if you want to see exactly what they do:

   ```bash
   .specify/scripts/bash/create-new-feature.sh --json "short feature description"
   ```

3. Template scaffolds for each artifact live in `.specify/templates/` (`spec-template.md`,
   `plan-template.md`, `tasks-template.md`, `checklist-template.md`) — the skills fill these in,
   but you can also copy one and fill it in yourself.
4. The `specify` CLI itself (via `uvx --from git+https://github.com/github/spec-kit.git specify ...`)
   only handles *setup* (`init`, `check`) — it does not run the spec/plan/tasks steps; those are
   always the skill files above, executed by whichever agent (or person) is following them.

## Quick cheat sheet

| Command | Required? | Reads | Writes |
| --- | --- | --- | --- |
| `/speckit-constitution` | once | existing constitution (if any) | `.specify/memory/constitution.md` |
| `/speckit-specify` | yes | your description | `specs/NNN-.../spec.md`, new branch |
| `/speckit-clarify` | optional | `spec.md` | `spec.md` (amended) |
| `/speckit-plan` | yes | `spec.md`, constitution | `plan.md` + design docs |
| `/speckit-checklist` | optional | `plan.md` | `checklists/*.md` |
| `/speckit-tasks` | yes | `plan.md` | `tasks.md` |
| `/speckit-analyze` | optional | spec/plan/tasks | report only |
| `/speckit-implement` | yes | `tasks.md` | application code |
| `/speckit-converge` | optional | codebase vs spec/plan/tasks | appends to `tasks.md` |
| `/speckit-taskstoissues` | optional | `tasks.md` | GitHub issues |

## This project's current state

- Constitution ratified: v1.0.0 (2026-10-07) — see `.specify/memory/constitution.md`.
- UI direction approved — see `mockups/` (published as a Claude Design canvas during brainstorming).
- No feature spec started yet. Next command is `/speckit-specify` for the first feature slice.
