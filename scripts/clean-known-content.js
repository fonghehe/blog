#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanKnownContent } from './lib/content-cleanup.mjs';

const write = process.argv.includes('--write');
if (process.argv.slice(2).some(arg => arg !== '--write')) throw new Error('Usage: node scripts/clean-known-content.js [--write]');
const changed = [];
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith('.md') && entry.name !== 'index.md') {
      const source = readFileSync(file, 'utf8');
      const cleaned = cleanKnownContent(source);
      if (source !== cleaned) {
        changed.push(file);
        if (write) writeFileSync(file, cleaned);
      }
    }
  }
}
for (const locale of ['', 'en', 'ja', 'zh-tw', 'zh-hk']) {
  for (const section of ['posts', 'archive']) visit(join('docs', locale, section));
}
console.log(`${write ? 'Cleaned' : 'Would clean'} ${changed.length} articles. Rules: exact recurring unsupported claim; unambiguous stylesheet fence labels.`);
if (changed.length && !write) console.log('Review the rules in scripts/lib/content-cleanup.mjs; use --write to apply.');
