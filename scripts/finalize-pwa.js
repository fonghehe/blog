#!/usr/bin/env node
// Run after merge-builds.js: cache versions must cover both language apps.
import { fileURLToPath } from 'node:url';
import { finalizePwa } from './lib/publishing.mjs';

const outDir = fileURLToPath(new URL('../docs/.vitepress/dist/', import.meta.url));
const result = finalizePwa(outDir);
console.log(`Finalized offline worker ${result.version}: ${result.precached} entry URLs, ${(result.precachedBytes / 1024 / 1024).toFixed(2)} MiB; visited pages cache on demand.`);
