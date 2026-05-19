#!/usr/bin/env node
/**
 * Merges zh-variants build output (zh-tw + zh-hk) into the main dist.
 *
 * Build flow:
 *   1. BUILD_MODE=main → dist/ (zh + en + ja)
 *   2. BUILD_MODE=zh-variants → dist-zh-variants/ (zh + zh-tw + zh-hk)
 *   3. This script → copies zh-tw + zh-hk + unique assets + merged hashmap into dist/
 *
 * Final output: dist/ containing all 5 locales.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_MAIN = join(__dirname, "dist");
const DIST_VARIANTS = join(__dirname, "dist-zh-variants");

if (!existsSync(DIST_MAIN)) {
  console.error(`Error: ${DIST_MAIN} does not exist. Run main build first.`);
  process.exit(1);
}

if (!existsSync(DIST_VARIANTS)) {
  console.error(
    `Error: ${DIST_VARIANTS} does not exist. Run docs:build:zh-variants first.`,
  );
  process.exit(1);
}

function copyLocaleDir(srcDir, dstDir, locale) {
  if (existsSync(srcDir)) {
    console.log(`Copying ${locale}...`);
    cpSync(srcDir, dstDir, { recursive: true, force: true });
    console.log(`  ✓ ${locale} copied`);
  } else {
    console.warn(`  ⚠ ${locale} not found in ${srcDir}`);
  }
}

// Copy zh-tw and zh-hk locale dirs
copyLocaleDir(join(DIST_VARIANTS, "zh-tw"), join(DIST_MAIN, "zh-tw"), "zh-tw");
copyLocaleDir(join(DIST_VARIANTS, "zh-hk"), join(DIST_MAIN, "zh-hk"), "zh-hk");

// Recursively merge assets — copy any file from src not already in dst
// (preserves main build's app.js / vendor.js while adding zh-variants-specific chunks)
function mergeAssetsDir(src, dst) {
  if (!existsSync(src)) return 0;
  mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      count += mergeAssetsDir(srcPath, dstPath);
    } else if (!existsSync(dstPath)) {
      cpSync(srcPath, dstPath);
      count++;
    }
  }
  return count;
}

const assetsSrc = join(DIST_VARIANTS, "assets");
const assetsDst = join(DIST_MAIN, "assets");
const copied = mergeAssetsDir(assetsSrc, assetsDst);
if (copied > 0) console.log(`  ✓ ${copied} new asset files merged`);

// Merge hashmap.json — VitePress client router uses this to resolve pages.
// Without zh-tw/zh-hk entries, navigation to those pages returns 404.
const hashmapMain = join(DIST_MAIN, "hashmap.json");
const hashmapVariants = join(DIST_VARIANTS, "hashmap.json");
if (existsSync(hashmapMain) && existsSync(hashmapVariants)) {
  const main = JSON.parse(readFileSync(hashmapMain, "utf-8"));
  const variants = JSON.parse(readFileSync(hashmapVariants, "utf-8"));
  // Keep all main entries; add zh-tw and zh-hk entries from variants
  const merged = { ...main };
  for (const [key, val] of Object.entries(variants)) {
    if (key.startsWith("zh-tw_") || key.startsWith("zh-hk_")) {
      merged[key] = val;
    }
  }
  writeFileSync(hashmapMain, JSON.stringify(merged));
  const added = Object.keys(merged).length - Object.keys(main).length;
  console.log(`  ✓ hashmap.json merged (+${added} zh-tw/zh-hk entries)`);
}

console.log("\n✓ Merge complete!");
console.log(`  Final dist: ${DIST_MAIN}`);
