---
title: "Node.js in Frontend Engineering"
date: 2018-10-13 15:20:33
tags:
  - JavaScript
readingTime: 1
description: "There are many things in a frontend project that can be automated with Node.js scripts: code generation, file processing, build utilities, and more."
---

There are many things in a frontend project that can be automated with Node.js scripts: code generation, file processing, build utilities, and more.

## Filesystem Operations

```javascript
const fs = require("fs");
const path = require("path");

// Read a file
const content = fs.readFileSync("src/config.json", "utf-8");
const config = JSON.parse(content);

// Write a file
fs.writeFileSync("dist/config.json", JSON.stringify(config, null, 2));

// Recursively create directories
fs.mkdirSync("dist/assets/images", { recursive: true });

// Async version (recommended in scripts: fs/promises)
const { readFile, writeFile } = require("fs/promises");

async function processConfig() {
  const raw = await readFile("config.json", "utf-8");
  const config = JSON.parse(raw);
  config.buildTime = new Date().toISOString();
  await writeFile("dist/config.json", JSON.stringify(config, null, 2));
}
```

## Directory Traversal

```javascript
const fs = require("fs");
const path = require("path");

// Recursively collect all files with a given extension
function getAllFiles(dir, ext) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

// Usage: find all Vue files
const vueFiles = getAllFiles("src", ".vue");
console.log(`Found ${vueFiles.length} Vue files`);
```

## Code Generation Script

Automatically generate routes and APIs from configuration:

```javascript
// scripts/generate-routes.js
const fs = require("fs");
const pages = require("../src/pages.config.json");

const routeCode = `
// Auto-generated — do not edit manually
export const routes = [
${pages
  .map(
    (page) => `  {
    path: '${page.path}',
    name: '${page.name}',
    component: () => import(/* webpackChunkName: "${page.name}" */ '${page.component}'),
    meta: ${JSON.stringify(page.meta)}
  }`,
  )
  .join(",\n")}
]
`;

fs.writeFileSync("src/router/routes.js", routeCode);
console.log("Route file generated successfully");
```

## Batch Rename

```javascript
// Rename all .js files to .ts
const fs = require("fs");
const path = require("path");

function renameJsToTs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      renameJsToTs(fullPath);
    } else if (entry.name.endsWith(".js")) {
      const newPath = fullPath.replace(/\.js$/, ".ts");
      fs.renameSync(fullPath, newPath);
      console.log(
        `Renamed: ${entry.name} → ${entry.name.replace(".js", ".ts")}`,
      );
    }
  }
}

renameJsToTs("src");
```

## Environment Check Script

```javascript
// scripts/check-env.js
const required = ["VUE_APP_API_URL", "VUE_APP_OSS_BUCKET"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("Missing required environment variables:");
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1); // Non-zero exit code causes CI to fail
}

console.log("✓ Environment variable check passed");
```

```json
// package.json
{
  "scripts": {
    "build": "node scripts/check-env.js && vue-cli-service build"
  }
}
```

## Summary

- `fs` module: file read/write, directory operations
- `path` module: path handling (cross-platform)
- Code generation: auto-generate repetitive boilerplate from configuration
- Environment checks: validate required variables before building — failing in CI is far better than failing at runtime
- Node.js scripts are an essential part of frontend engineering
