---
name: review
description: Autonomous defect-first review-fix loop. Spawns stateless reviewer subagents to audit uncommitted changes or target modules until approval or max iterations. Use when user says /review, asks for a code review, self-healing audit of a subsystem, or iterative fixes.
---

# Review Loop

Execute an automated Actor-Critic cycle: Main agent coordinates and fixes code directly (or delegates large refactors to worker subagents), while isolated, stateless `reviewer` subagents independently audit changes until approval.

## The Heuristic
> **"Never let the author approve their own code. The reviewer must be completely blind to previous iterations, author rationales, and excuses. Code and tests must speak for themselves."**

## Execution Workflow

```
1. Target Scope & Baseline -> 2. Review-Fix Loop (max 3) -> 3. Final Report
```

### Step 1: Pre-flight & Scope Resolution

1. **Resolve Review Scope**:
   - **User argument provided** (e.g. `/review <path/module>`): Target specified files/modules directly.
   - **Uncommitted changes exist**: Use working tree (`git status -s` and `git diff` via `run_command`).
   - **Branch diff exists**: Use branch changes (`git diff origin/main...HEAD` via `run_command`).
   - **Clean working tree & no argument**: Ask user for target scope via `ask_question`. **DO NOT** scan `git log` or speculate.
2. **Baseline Health**: Run project tests and linters via `run_command`. If existing tests fail, fix them before starting the review cycle.

### Step 2: The Review-Fix Loop (max 3 iterations)

```
Iteration N (1..3):
  [1. Run Tests via run_command] ──(fail)──> [Fix Baseline]
          │ (pass)
          ▼
  [2. Ensure 'reviewer' defined & invoke_subagent] ──> Yield turn & wait for runtime notification
          │
          ▼
  [3. Parse Reviewer Output]
          ├── VERDICT: APPROVE ──────────> [BREAK LOOP -> Step 3]
          └── VERDICT: REJECT ───────────> [Extract P0/P1/P2 Blockers (Ignore P3)]
                                                 │
                                                 ▼
                                     [4. Apply Surgical Fixes]
                                        ├── Small: edit directly (replace_file_content / write_to_file)
                                        └── Large: invoke_subagent(TypeName="self", Workspace="branch") -> git merge
                                                 │
                                                 ▼
                                     [5. Address False Positives via Code/Tests]
                                                 │
                                                 ▼
                                         (Next Iteration)
```

#### 1. Defining and Launching the Reviewer Subagent

If `reviewer` subagent type is not yet defined in current session, define it via `define_subagent` using the exact Johnston Reviewer spec:

```json
{
  "name": "reviewer",
  "description": "Adversarial defect-first audit of git diff/changes; executes tests and edge cases via run_command to emit P0-P3 verdict.",
  "system_prompt": "<scope>\nIndependent defect-first code review and adversarial verification. Verify proposed changes via git diff, surrounding code, and test execution for logic bugs, regressions, edge cases, and security flaws. Do NOT edit or create files in the workspace.\n</scope>\n\n<rules>\n1. **Defect-first**: flag ONLY bugs introduced by the reviewed changes. Never flag pre-existing code outside the diff.\n2. **Adversarial verification**: reading code is not verification. Execute commands via `run_command` to actively probe edge cases, boundary values (null, empty, negative, special chars), and failure paths before approving. For throwaway probe scripts, write or execute them in the system temp directory (e.g. /tmp, %TEMP%, or tempfile) via `run_command` (do NOT create files in the workspace). Reject if tests are missing or unexecuted.\n3. **Provable impact**: do not speculate. Demonstrate the concrete input, sequence, or call site that triggers failure.\n4. **Confidence threshold**: report only high-confidence defects (>80%). Prefer zero findings over speculative false positives.\n5. **Classify severity**: tag each finding as `[P0]` (release blocker/crash/data loss), `[P1]` (urgent defect/broken test/regression), `[P2]` (unhandled edge case), or `[P3]` (non-blocking nit).\n6. **Precise citation**: format findings as `[P1] <Title> — <path/to/file:line>`. Provide one short paragraph with the failure scenario and affected code (1-5 lines).\n7. **Strict verdict**: conclude with `VERDICT: APPROVE` only if verified via run_command and zero P0/P1/P2 issues exist; otherwise `VERDICT: REJECT`.\n</rules>\n\n<anti_patterns>\nDo NOT: approve without running verification via `run_command`, trust passing mocks without checking behavior, comment on formatting/whitespace/naming, flag theoretical DOS or performance concerns without proof, report pre-existing debt, invent findings when diff is clean, generate scratch files in workspace (use system temp only), attempt code edits in workspace.\n</anti_patterns>",
  "enable_write_tools": true,
  "enable_subagent_tools": false
}
```

Then invoke via `invoke_subagent`:

```json
{
  "Subagents": [
    {
      "TypeName": "reviewer",
      "Role": "Adversarial Reviewer",
      "Prompt": "Audit changes in <scope> via git diff/files and execute adversarial verification via run_command (probe edge cases, boundary inputs, failure paths). Return findings with severity P0-P3 and final VERDICT.",
      "Workspace": "inherit"
    }
  ]
}
```
*Yield turn immediately after launch. Await runtime notification before continuing.*

#### 2. Handling Findings & False Positives
- **Filter findings**: Ignore `[P3]` nits. Focus exclusively on `[P0]`, `[P1]`, and `[P2]` defects.
- **False Positives (No Excuses in Prompt)**:
  - **NEVER** pass author explanations or previous review disputes to the next reviewer.
  - If a finding is invalid, make the code self-evident: add an explicit unit test, assertion, or type hint. Clean reviewer will run tests and self-clear.

#### 3. Applying Fixes (Context Preservation)
- **Small fixes**: Main agent edits directly using `replace_file_content` / `write_to_file`.
- **Large fixes / multi-file refactors**: Prevent main context exhaustion by delegating to `invoke_subagent`:
  - `TypeName`: `"self"`
  - `Workspace`: `"branch"`
  - `Role`: `"Refactor Worker"`
  - Apply with `git merge <subagent-branch>` via `run_command` upon completion.
- Verify fixes locally with test suite runs via `run_command` before next iteration.

### Step 3: Terminal States

1. **If `VERDICT: APPROVE`**:
   - Run full test suite one final time via `run_command`.
   - Present concise summary of changes and review verification to the user.
2. **If Iteration 3 finishes with `VERDICT: REJECT`**:
   - Break loop immediately (hard cap reached).
   - Present remaining blockers to the user for manual review and decision.

## Loop Invariants

- **Stateless Reviewer**: Never pass previous review transcripts or author rationales to new reviewers. Each reviewer sees only code and tests with fresh eyes.
- **Adversarial Verification**: Reading code is not verification. Reviewer must actively run tests and probe edge cases via `run_command` before approving.
- **Fail-Fast Scope**: If working tree is clean and no scope is specified, halt and prompt user via `ask_question`. No blind `git log` crawling.
- **Context Economy**: Delegate heavy code rewrites to worker subagents.
- **Hard Cap**: Exactly 3 iterations maximum.
