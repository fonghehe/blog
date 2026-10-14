---
title: "ESLint v9 Flat Config: structure and migration checks"
date: 2023-09-08 15:28:03
updated: 2026-10-24
version: "ESLint 9.x (historical migration)"
tags:
  - ESLint
readingTime: 2
wordCount: 296
description: "A historical guide to ESLint v9 configuration arrays, file matching, ignore patterns and migration checks, with publication and revision dates kept separate."
---

> Revision note: the original archive date and URL are preserved. This article was rewritten on 2026-10-24. ESLint v9 was released on 2024-04-05; this is a later migration guide, not a claim that v9 was stable in 2023. ESLint v9 has reached end of life. Consult the official support table for new projects.

Flat Config exports an array from a JavaScript module. Configuration objects that match a file are combined in order; later rule settings override earlier ones. The `files` property scopes each object.

## A configuration array

This teaching example targets the historical ESLint 9 and `@eslint/js` 9 pair. It makes no claim about production deployment or measured performance.

```javascript
// eslint.config.mjs — historical ESLint 9 example
import js from '@eslint/js'

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: { 'no-unused-vars': 'warn' },
  },
]
```

`js.configs.recommended` supplies recommended rules, while the last object customizes JavaScript files. An object containing only `ignores` defines global ignores. Browser or Node.js globals, TypeScript parsers, Vue SFC parsers and framework plugins require project-specific configuration; this JavaScript example is not a complete setup for every project.

## Migration checks

1. Pin ESLint and plugin versions, and confirm compatibility with Flat Config and the ESLint major version.
2. Map old `env`, `parserOptions` and `globals` settings to the new format instead of merely renaming the file.
3. Move ignore patterns into the configuration. Flat Config does not automatically preserve `.eslintignore` behavior; recheck path matching.
4. Run `npx eslint --print-config src/example.js` for a real target file and inspect the effective rules and language options.
5. Check files that should pass, fail and be ignored before running the full project lint. A passing lint result does not establish application correctness.

## Version context

This article preserves the v9 migration context. For a current project, follow the documentation for its actual version. The example is not presented as a production case study.

## References

- [ESLint v9.0.0 release — 2024-04-05](https://eslint.org/blog/2024/04/eslint-v9.0.0-released/)
- [ESLint v9 configuration migration guide](https://eslint.org/docs/v9.x/use/configure/migration-guide)
- [ESLint version support](https://eslint.org/version-support/)
