#!/usr/bin/env node
/**
 * Run main and zh-variants builds in parallel.
 * They output to different directories so there's no conflict.
 * This cuts total build time by ~40-50% compared to sequential.
 */

import { spawn } from "node:child_process";

// Match the per-process memory used by docs:build:main / docs:build:zh-variants
const MAX_MEM = process.env.MAX_OLD_SPACE_SIZE || "8192";

function runBuild(mode) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    console.log(`[${mode}] Starting build...`);

    const child = spawn("npx", ["vitepress", "build", "docs"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BUILD_MODE: mode,
        NODE_OPTIONS: `--max-old-space-size=${MAX_MEM}`,
      },
    });

    let stderr = "";
    child.stdout.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[${mode}] ${line}`);
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`[${mode}] ✓ Done in ${duration}s`);
        resolve();
      } else {
        console.error(`[${mode}] ✗ Failed (exit ${code}) after ${duration}s`);
        if (stderr) console.error(stderr.slice(-2000));
        reject(new Error(`${mode} build failed with code ${code}`));
      }
    });
  });
}

async function main() {
  const totalStart = Date.now();
  console.log("Building main and zh-variants in parallel...\n");

  try {
    await Promise.all([runBuild("main"), runBuild("zh-variants")]);
    const total = ((Date.now() - totalStart) / 1000).toFixed(1);
    console.log(`\n✓ Both builds complete in ${total}s`);
  } catch (err) {
    console.error(`\n✗ Build failed: ${err.message}`);
    process.exit(1);
  }
}

main();
