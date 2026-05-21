---
title: "Frontend Engineering: Git Workflow Standards"
date: 2018-03-27 10:12:36
tags:
  - Engineering
readingTime: 2
description: "Git workflow is an often-overlooked piece of infrastructure in team collaboration, but when it breaks down the pain is real. Here's a standards guide suited for"
wordCount: 215
---

Git workflow is an often-overlooked piece of infrastructure in team collaboration, but when it breaks down the pain is real. Here's a standards guide suited for frontend teams.

## Git Flow Basics

The mainstream Git Flow uses these branches:

```
main          Production environment, always stable and releasable
develop       Development trunk, integrates all features
feature/*     Feature development branches
release/*     Release preparation branches
hotfix/*      Emergency fix branches
```

### Day-to-Day Development Flow

```bash
# 1. Cut a feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/user-profile

# 2. Develop and commit
git add .
git commit -m "feat: add user profile page"

# 3. Merge back to develop when done (via PR/MR is recommended)
git checkout develop
git merge --no-ff feature/user-profile  # --no-ff preserves merge history
git push origin develop

# 4. Delete the feature branch
git branch -d feature/user-profile
```

## Commit Message Standards

Consistent commit messages make `git log` immediately readable and can auto-generate changelogs.

**Format:**

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**type values:**

| type       | Meaning                            |
| ---------- | ---------------------------------- |
| `feat`     | New feature                        |
| `fix`      | Bug fix                            |
| `docs`     | Documentation update               |
| `style`    | Code formatting (no logic change)  |
| `refactor` | Refactoring (neither feat nor fix) |
| `perf`     | Performance optimization           |
| `test`     | Test-related                       |
| `chore`    | Build/tool/dependency updates      |
| `revert`   | Rollback                           |

**Good examples:**

```
feat(auth): add login with Google OAuth
fix(table): correct pagination when deleting last item on page
docs(readme): update deployment instructions
chore(deps): upgrade element-ui to 2.4.11
```

**Bad examples:**

```
update
fix bug
changes
wip
```

## commitlint + husky to Enforce Standards

Documentation-only conventions aren't enough — enforce them with tooling:

```bash
npm install --save-dev @commitlint/cli @commitlint/config-conventional husky
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
```

```json
// package.json
{
  "husky": {
    "hooks": {
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

When a commit doesn't follow the standard, husky rejects it:

```bash
$ git commit -m "update"
husky > commit-msg (node v10.15.0)
⧗   input: update
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   found 2 problems, 0 warnings
```

## lint-staged: Pre-Commit Code Checks

```bash
npm install --save-dev lint-staged
```

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "src/**/*.{js,vue}": ["eslint --fix", "git add"],
    "src/**/*.{css,scss}": ["stylelint --fix", "git add"]
  }
}
```

This only checks files in the current commit — fast and doesn't affect the rest of the project's lint.

## Version Number Management

Semantic Versioning: `MAJOR.MINOR.PATCH`

- `MAJOR`: incompatible API change (1.0.0 → 2.0.0)
- `MINOR`: backward-compatible new feature (1.0.0 → 1.1.0)
- `PATCH`: backward-compatible bug fix (1.0.0 → 1.0.1)

```bash
# Use npm version to automatically update the version
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0
```

## Useful Git Commands

```bash
# View graphical log
git log --oneline --graph --all

# Undo the last commit (keep file changes)
git reset --soft HEAD~1

# Revert changes to a specific file
git checkout -- src/components/Button.vue

# Stash current work
git stash save "WIP: user page changes"
git stash pop  # restore

# Cherry-pick a specific commit to the current branch
git cherry-pick abc1234

# Interactive rebase (clean up commit history)
git rebase -i HEAD~3
```

## .gitignore Template

```ini
# Dependencies
node_modules/

# Build output
dist/
build/

# Environment variables
.env.local
.env.*.local

# Editor
.DS_Store
.vscode/settings.json
*.swp
*.swo

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Test coverage
coverage/
```

## Summary

- Git Flow provides a clear branching strategy
- Commit message standards make history readable and enable auto-generated changelogs
- The `husky + commitlint + lint-staged` trio is a standard engineering setup
- Make small commits; each commit should do one thing
