#!/usr/bin/env node
/**
 * Run main and zh-variants builds sequentially.
 *
 * NOTE: These cannot run in parallel because VitePress hardcodes
 * tempDir as resolve(root, ".temp") — both builds would share
 * docs/.vitepress/.temp, causing "Invalid route component: undefined"
 * and "ENOTEMPTY: directory not empty" errors from cross-build file
 * corruption.
 *
 * Each build cleans .temp on its own, but we also wipe it between
 * runs to be safe.
 */

import { spawn } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = join(__dirname, "..", "docs", ".vitepress", ".temp");
const MAX_MEM = process.env.MAX_OLD_SPACE_SIZE || "8192";

function cleanTemp() {
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log("  ✓ Cleaned .temp directory");
  }
}

function runBuild(mode) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    console.log(`\n[${mode}] Starting build...`);

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
  console.log("Building main and zh-variants sequentially...");

  // Clean stale .temp from any previous run (e.g., interrupted build)
  cleanTemp();

  try {
    // Build main first
    await runBuild("main");

    // Wipe .temp between builds — main build's page modules would confuse
    // the zh-variants build's router (different page sets)
    cleanTemp();

    // Then build zh-variants
    await runBuild("zh-variants");

    const total = ((Date.now() - totalStart) / 1000).toFixed(1);
    console.log(`\n✓ Both builds complete in ${total}s`);
  } catch (err) {
    console.error(`\n✗ Build failed: ${err.message}`);
    process.exit(1);
  }
}

main();
