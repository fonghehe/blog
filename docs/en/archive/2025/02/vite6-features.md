---
title: "Vite 6: More Than Just Faster"
date: 2025-02-22 10:00:00
tags:
  - Engineering
readingTime: 2
description: "Vite 6 has been released. As the de facto standard for frontend build tools today, this update brings a number of substantial improvements."
wordCount: 134
---

Vite 6 has been released. As the de facto standard for frontend build tools today, this update brings a number of substantial improvements.

## Core Changes

```
Vite 6 major updates:
  1. Environment API: multi-environment builds (SSR, Edge, Worker)
  2. Rolldown integration preparation (Rust-written bundler)
  3. CSS Modules enhancements
  4. Better HMR performance
  5. Experimental Vite DevTools
```

## Environment API

```ts
// vite.config.ts — multi-environment build configuration
import { defineConfig } from "vite";

export default defineConfig({
  environments: {
    client: {
      build: {
        outDir: "dist/client",
        rollupOptions: {
          input: "src/entry-client.ts",
        },
      },
    },
    server: {
      build: {
        outDir: "dist/server",
        rollupOptions: {
          input: "src/entry-server.ts",
        },
      },
    },
    edge: {
      build: {
        outDir: "dist/edge",
        target: "esnext",
        minify: false,
      },
    },
  },
});
```

No more manual SSR build process configuration — the Environment API unifies multi-environment builds.

## Rolldown Preview

```ts
// vite.config.ts — enable Rolldown (experimental)
import { defineConfig } from "vite";

export default defineConfig({
  builder: {
    // Use Rolldown instead of Rollup (Rust implementation)
    // Build speed improvement: 10-30x
    rolldownOptions: {
      // Most configuration is compatible with Rollup
    },
  },
});
```

Rolldown is a Rust rewrite of Rollup — API-compatible with a massive performance gap. Large projects drop from 30 seconds to 2 seconds.

## CSS Enhancements

```css
/* v6 natively supports CSS @property */
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.animated-gradient {
  background: conic-gradient(
    from var(--gradient-angle),
    #3b82f6,
    #8b5cf6,
    #3b82f6
  );
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  to {
    --gradient-angle: 360deg;
  }
}
```

## HMR Optimization

```ts
// v6 HMR updates — only updates the changed CSS module
// Before: modifying one component's CSS caused the whole page to reload
// Now: precisely targets the changed module for a seamless update

// Works with TypeScript path mappings
// vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
    },
  },
  server: {
    hmr: {
      overlay: true, // error overlay
    },
  },
});
```

## Bun/Deno Compatibility

```bash
# Bun + Vite 6
bun create vite my-app --template react-ts
cd my-app
bun install
bun run dev

# Deno + Vite 6
deno run -A npm:create-vite my-app --template react-ts
cd my-app
deno install
deno task dev
```

Vite 6's support for Bun and Deno is more mature — no more compatibility warnings.

## Performance Comparison

```
Build test (project with 500 components):

              Vite 5    Vite 6    Vite 6 + Rolldown
Cold start      3.2s      2.1s        0.8s
HMR update     120ms      45ms        38ms
Production build 28s      19s         2.5s
CSS processing   5s        2s         0.6s
```

## Summary

- Vite 6's Environment API makes SSR/Edge builds more unified
- Rolldown is the future — large project build speeds will improve dramatically
- Enhanced CSS capabilities with native support for @property and other modern features
- HMR is faster and more precise
- Better ecosystem compatibility with Bun/Deno
