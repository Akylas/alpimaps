---
name: commit
description: MANDATORY skill for ALL commits. Must be used EVERY TIME before creating any git commit. No exceptions.
---

# Generating Commit Messages

## Mandatory Process

**BEFORE ANY git commit COMMAND:**

1. **ALWAYS** run `git diff --staged` first to see changes
2. **ALWAYS** analyze the staged changes thoroughly
3. **ALWAYS** split the code changes into atomic commits, one per coherent / cohesive change. A single feature spanning multiple files (module + view) is ONE cohesive change — do not split it by file. Only split when changes are truly unrelated (e.g. a bug fix + a new feature + a docs update)
4. **ALWAYS** run the checks relevant to the change before committing. **There is no test runner in this repo** — no vitest, no jest, no `yarn test`. Do not invent one. The only checks are:
    - Types/Svelte: `yarn svelte-check` when `.svelte`/`.ts` typing is affected (a real package.json script)
    - Lint: `./node_modules/.bin/eslint <changed files>`. Prefer the binary directly over `npx` — `npx` can trigger a dependency re-resolve under Yarn 4 and rewrite `yarn.lock` as a side effect. `yarn eslint`/`yarn prettier` fail on Yarn 4.
    - Never stage `yarn.lock` unless the dependency change is the point of the commit.
5. **ALWAYS** generate a commit message following the format below
6. **NEVER** commit automatically as a side effect of making code changes. Only commit when the user explicitly invokes the commit skill or says "commit".

## Confirmation Before Committing

**`--auto`** (caller runs autonomously): skip all approval/confirmation waits here (commit-plan gate below + fixup/rebase) — commit directly. Diff review, atomic splitting, checks, message format unchanged.

User trust requires seeing the plan before execution. Always present the full commit plan and wait for explicit approval before running any `git commit` command.

**For each commit (regular or fixup), present:**

- The commit message (header + body if applicable)
- The list of files included
- If splitting into multiple commits: the full split plan (which files go in which commit, in what order)
- If fixup: which commit SHA it targets and why

**Then ask the user to confirm.** Do not proceed until they approve. If they request changes to the message or grouping, adjust and re-present.

This applies equally to regular commits, fixups, and any commits triggered during the open-pr workflow.

## Auto-Fixup Detection

Before creating a new commit, check whether the staged changes should be fixup'd into a recent commit on the current branch.

**Process:**

1. Run `git log master..HEAD --oneline` to list all commits on the branch since diverging from master (this repo's default branch is `master`, not `main`)
2. For each staged file, check `git log master..HEAD -- <file>` to see if it was modified in a recent branch commit
3. If a staged change clearly amends or extends code from a previous commit (same file, nearby lines, related logic — e.g. fixing a typo introduced in a prior commit, adding a missing import for a recently added module), suggest fixup'ing into that commit
4. Present the suggestion: "This change to `<file>` looks like it should be fixup'd into `<sha> <message>`. Want me to fixup instead of creating a new commit?"

**When fixup is confirmed:**

1. Run `git commit --fixup=<sha>` (with user confirmation)
2. Then run `GIT_SEQUENCE_EDITOR=true git rebase --interactive --autosquash master` to squash immediately (with user confirmation before the rebase)

If the change doesn't clearly relate to a previous commit, proceed with a normal new commit.

## Required Commit Message Format

This repo follows Conventional Commits by convention. **Nothing enforces it** — there is no commitlint config and no lint/test CI (the only workflow is `release.yml`), so a malformed message will be accepted silently. Getting it right is on you. The format is:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory; **scope**, **body**, and **footer** are optional.

### Header

**Shape:** `<type>(<scope>): <subject>`

- `<type>` is one of: `chore` `docs` `feat` `fix` `perf` `refactor` `style` `build` `ci`. In this repo's history `chore` is by far the most used, then `fix` and `feat` — do not avoid `chore` for routine work.
- `<scope>` (optional) is the affected area. Scopes actually used here: `android`, `ios`, `map`, `navigation`, `settings`, `stores`, `claude`. Otherwise take it from the feature dir under `app/components/` (`bottomsheet`, `directions`, `search`, `items`, `layers`, `transit`, `compass`, `peaks`), a map module (`mapModules`), or a service. Platform-specific changes use the platform **as** the scope (`fix(android): …`) — this repo does not use the `android/<feature>` compound form.
- `<subject>`: imperative present tense ("change" not "changed"), lowercase first letter, no trailing period
- **No line may exceed 100 characters**

**Examples:**

```
docs(README): add build setup steps for submodules
fix(android): correct import of geojson/gpx files
refactor(map): extract the layer stack out of Map.svelte
```

### Body

ONLY add a body when the header alone isn't enough for a reviewer:

1. Use the imperative present tense, same as the subject
2. Explain WHAT changed only if the commit touches more than 3 files
3. Explain WHY — the motivation, contrasted with previous behavior
4. Keep every line under 100 characters

### Footer

- Reference the issue this commit closes: `Fixes #<issue>` / `Closes #<issue>`
- Breaking changes start with `BREAKING CHANGE:` followed by a description and migration path

### Revert

A commit that reverts another begins with `revert: ` followed by the reverted header. The body states `This reverts commit <hash>.`

## Co-Authored-By

Only add a `Co-Authored-By` trailer when Claude actually wrote the code being committed. If the user wrote the changes themselves (and Claude is just committing), do not add it.
