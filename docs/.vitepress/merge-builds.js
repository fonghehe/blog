#!/usr/bin/env node
// The full-page locale boundary is intentional: each build has its own app.
// Preserve both sets of assets while sharing the sitemap and page hash lookup.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeBuilds } from '../../scripts/lib/publishing.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const result = mergeBuilds(join(directory, 'dist'), join(directory, 'dist-zh-variants'));
console.log(`Merged five locale outputs: ${result.sitemapUrls} sitemap URLs, ${result.hashEntries} page hashes.`);
