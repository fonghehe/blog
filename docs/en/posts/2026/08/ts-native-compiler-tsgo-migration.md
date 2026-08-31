---
title: "Migrating to tsgo: A Real-World Monorepo Migration from tsc to the Native Go Compiler"
date: 2026-08-11 09:47:12
tags:
  - TypeScript
readingTime: 6
description: "A complete record of migrating a mid-sized monorepo from tsc to the native Go compiler tsgo: what actually got faster, breaking changes in configuration and API surfaces, CI pipeline adjustments, rollback strategies, and a reusable migration checklist."
wordCount: 1088
---

After the TypeScript 7.x series shipped, the community's hottest topic wasn't new type system features — it was tsgo, the native compiler rewritten in Go. Microsoft officially offered tsgo as an optional compiler backend in TypeScript 7.0, aiming to improve type-checking speed on large projects by an order of magnitude. I completed a migration from tsc to tsgo on one of our team's mid-sized monorepos (~400K lines of TS/TSX, 12 packages). This article documents the real-world wins, blockers, and trade-offs we encountered along the way.

## What Got Faster and What Didn't

Bottom line first: tsgo's type checking is genuinely fast, but it isn't a silver bullet for every scenario.

| Operation | tsc Time | tsgo Time | Speedup |
|-----------|----------|-----------|---------|
| Full type check (`--noEmit`) | 48s | 6.2s | ~7.7x |
| Incremental type check (single file change) | 3.8s | 0.4s | ~9.5x |
| Full emit (.js + .d.ts generation) | 52s | 48s | ~1.1x |
| IDE initial project load | 12s | 2.1s | ~5.7x |
| IDE edit-time diagnostic latency | 800ms | 90ms | ~8.9x |

The improvements in type checking and editor experience are significant — exactly where tsgo focuses its design. The Go implementation leverages parallel type checking and more efficient memory layouts, with particularly pronounced advantages on large codebases.

But the emit (code generation) phase barely improved. tsgo currently only replaces the type-checking pipeline; emit still runs through the original TypeScript compiler logic. If your bottleneck is build output generation rather than type checking, tsgo won't help much. Our production builds use esbuild/Rolldown for emit, with tsc/tsgo used solely for type verification, so this limitation didn't affect us significantly.

## Breaking Changes in Configuration and API Surfaces

Migration isn't just about swapping a CLI flag. tsgo has differences in its support for certain tsconfig options and the Compiler API.

### Module Resolution Edge Cases

Our project has an internal package reference chain using a combination of `paths` + `baseUrl` + `exports` triple-layer mapping. tsc resolves it correctly, but tsgo behaves differently in the following scenario:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": {
      "@app/shared/*": ["packages/shared/src/*"],
      "@app/utils": ["packages/utils/src/index.ts"] // exact mapping
    }
  }
}
```

The issue lies in the priority between exact path mappings (without wildcards) and the `exports` field. tsc matches exact entries in `paths` first, then falls back to package.json `exports`; tsgo sometimes prioritizes `exports` resolution, pointing to compiled `.d.ts` files instead of source code.

The fix is to explicitly specify `customConditions` in tsconfig to ensure tsgo takes the correct resolution branch:

```jsonc
{
  "compilerOptions": {
    "customConditions": ["source"],
    "paths": {
      "@app/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

And add the corresponding condition in the referenced package.json:

```json
{
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

### Transformer Plugin Incompatibility

This was the biggest blocker during migration. We previously used two custom transformers:

1. `typescript-transform-paths`: rewrites absolute paths to relative paths at compile time
2. `ts-nameof`: extracts variable names at compile time for logging

tsgo does not support the `createProgram` + custom transformers interface from the TypeScript Compiler API. It has its own Program API, but the surface area is minimal and doesn't allow injecting custom transformation steps.

For `typescript-transform-paths`, we moved the solution to the build tool layer — Rolldown/esbuild can handle path aliases natively without compiler involvement.

For `ts-nameof`, we replaced it with manual string constants before migration. It's a trade-off: we lost the convenience of compile-time auto-extraction but eliminated the dependency on non-standard compiler extensions.

### Program API Limitations

If you have custom tools built on `ts.createProgram` (such as code generators or documentation extractors), be aware that tsgo's Program API is a reduced subset. The following APIs are unavailable or behave differently in tsgo:

- `program.getTypeChecker()` — available, but the returned TypeChecker lacks some advanced methods (e.g., `getSymbolAtLocation` doesn't work on certain node types)
- `program.getSourceFiles()` — available
- `typeChecker.getWidenedLiteralType()` — unavailable
- Custom `CompilerHost` — unsupported

Our internal API documentation generator relied on these APIs. After migration, we switched it to use `ts-morph` (which still binds to tsc), running independently without sharing a process with tsgo.

## CI Pipeline Overhaul

Before migration, our CI typecheck step looked like this:

```yaml
# Old config
- name: Type Check
  run: npx tsc --noEmit -p tsconfig.json
  timeout-minutes: 5
```

After migration:

```yaml
# New config
- name: Install tsgo
  run: npm install -g @typescript/native-tsgo

- name: Type Check (tsgo)
  run: tsgo --noEmit -p tsconfig.json
  timeout-minutes: 2

- name: Type Check (tsc fallback)
  if: failure()
  run: npx tsc --noEmit -p tsconfig.json
  timeout-minutes: 5
```

The key change is keeping tsc as a fallback. During the first three months of migration, tsgo occasionally produced false positives on certain edge-case syntax. When that happens, CI automatically falls back to tsc verification to avoid blocking merges. We also file those false positive cases to the TypeScript team's issue tracker.

Real-world result: the average CI typecheck step dropped from 48 seconds to 7 seconds (including ~1 second for tsgo installation). For a team averaging 30+ PRs per day, that saves roughly 20 minutes of daily CI wait time.

We also added a dual-run comparison phase, running both tsc and tsgo simultaneously during early migration to verify their diagnostic outputs matched:

```bash
#!/bin/bash
# scripts/typecheck-compare.sh
tsgo --noEmit 2>&1 | sort > /tmp/tsgo-out.txt
tsc --noEmit 2>&1 | sort > /tmp/tsc-out.txt
diff /tmp/tsgo-out.txt /tmp/tsc-out.txt > /tmp/diff.txt
if [ -s /tmp/diff.txt ]; then
  echo "Diagnosis mismatch detected:"
  cat /tmp/diff.txt
  exit 1
fi
echo "Both compilers agree."
```

This script ran as a mandatory CI step during the first month of migration. Once we confirmed stable consistency between both outputs, it was downgraded to an optional manual trigger.

## Rollback Strategy

Migrating to tsgo is reversible, but you need to plan the rollback path upfront:

1. **Keep the tsc dependency**: don't remove the typescript package from devDependencies. tsgo is installed separately, and both can coexist
2. **tsconfig compatibility**: maintain a `tsconfig.tsc.json` as a tsc-specific config, using `-p tsconfig.tsc.json` when you need to fall back
3. **CI toggle**: control which compiler to use via environment variables rather than hardcoding

```yaml
- name: Type Check
  run: |
    if [ "$USE_TSGO" = "true" ]; then
      tsgo --noEmit -p tsconfig.json
    else
      npx tsc --noEmit -p tsconfig.tsc.json
    fi
  env:
    USE_TSGO: ${{ vars.USE_TSGO || 'true' }}
```

4. **IDE configuration**: VS Code's TypeScript extension supports selecting a compiler version. Specify it in `.vscode/settings.json`:

```json
{
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.tsdk": "./node_modules/@typescript/native-tsgo/lib"
}
```

To roll back, simply change it back to `"./node_modules/typescript/lib"`.

## Which Projects Should Wait

Not every project is ready to migrate now. Based on my experience, I'd recommend holding off in these cases:

**Wait if:**
- Your project uses custom transformer plugins with no viable alternative
- Your monorepo relies on `ts.createProgram` API for internal tooling
- Your tsconfig heavily combines `paths` + `rootDirs` + `composite` in complex configurations
- You're an early adopter of the latest TypeScript syntax features (tsgo typically lags behind tsc by 1-2 minor versions for new syntax support)

**Safe to migrate if:**
- You primarily use TypeScript for type checking (`--noEmit`), with emit handled by other tools
- Standard ESM/CJS module resolution without complex path mapping
- Pure business code projects with no compiler extension dependencies
- Large monorepos where type-checking time has become a developer experience bottleneck

## Migration Checklist

Here's a directly reusable migration checklist I put together:

```markdown
## tsgo Migration Checklist

### Pre-flight Checks
- [ ] Confirm no custom transformers are in use (or alternatives exist)
- [ ] Confirm no dependency on tsc-only Compiler APIs
- [ ] Back up current tsconfig.json
- [ ] Create tsconfig.tsc.json as fallback configuration

### Installation & Configuration
- [ ] Install @typescript/native-tsgo
- [ ] Verify tsgo --version outputs correctly
- [ ] Run tsgo --noEmit to check for false positives
- [ ] Fix module resolution discrepancies (if any)
- [ ] Configure IDE to use tsgo

### CI Integration
- [ ] Add tsgo installation step
- [ ] Replace typecheck command
- [ ] Add tsc fallback logic
- [ ] Run dual-comparison script (for at least two weeks)
- [ ] Remove dual-run after confirming consistent diagnostic output

### Verification & Monitoring
- [ ] Compare CI typecheck duration before and after migration
- [ ] Collect team feedback on IDE experience
- [ ] Track tsgo fixes in TypeScript release notes
- [ ] Evaluate full switchover after one month
```

## Looking Ahead

tsgo represents an important direction in TypeScript engineering: pushing the most frequent developer operations (type checking, editor responsiveness) to peak performance while maintaining ecosystem compatibility. Current limitations (emit not accelerated, incomplete API surface) are temporary — the TypeScript team has already outlined the roadmap ahead.

For most frontend teams, now is a reasonable migration window — provided you understand where your project will benefit and where it might hit issues. Don't migrate just to chase novelty, and don't let conservatism cause you to miss real efficiency gains. Start with the checklist to evaluate, then let data drive the decision.
