#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { inspectContent, issueId, newIssues } from './lib/content.mjs';

const args = process.argv.slice(2);
if (args.some(arg => !['--baseline', '--report'].includes(arg))) throw new Error('Usage: node scripts/check-content.js [--baseline] [--report]');
const baselineFile = 'maintenance/content-baseline.json';
const result = await inspectContent('docs');
if (args.includes('--baseline')) {
  writeFileSync(baselineFile, JSON.stringify({
    note: 'Known content debt, not verified or approved content. New issues fail CI. Regenerate only after reviewing the report.',
    issues: result.issues.map(issueId).sort(),
  }, null, 2) + '\n');
}
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
const fresh = newIssues(result.issues, baseline.issues);
const groups = Map.groupBy(result.issues, issue => issue.rule);
console.log(`Checked ${result.files} pages, ${result.articles} articles: ${JSON.stringify(result.byLocale)}`);
for (const [rule, list] of groups) console.log(`  ${rule}: ${list.length}`);
console.log(`Known issues: ${result.issues.length - fresh.length}; new issues: ${fresh.length}`);
for (const issue of fresh.slice(0, 30)) console.error(`${issue.file}:${issue.line} [${issue.rule}] ${issue.detail.slice(0, 180)}`);
if (args.includes('--report')) {
  const lines = [
    '# Content quality report', '',
    `Scanned ${result.files} pages and ${result.articles} article translations.`, '',
    'These are review candidates found by mechanical checks, not a claim that all other content is correct.',
    'Existing issues are baselined transparently; CI rejects newly introduced issues. Fixing a repeated sentence does not validate the rest of an article.', '',
    '| Rule | Article/page findings |', '| --- | ---: |',
    ...[...groups].map(([rule, list]) => `| ${rule} | ${list.length} |`), '',
    '## Recommended review order', '',
    '1. Title/code mismatches and unsupported production claims.',
    '2. Chronology, source references and incomplete translations.',
    '3. Replace generic introductions with the specific problem and applicable version.', '',
    '## Examples by rule', '',
  ];
  for (const [rule, list] of groups) {
    lines.push(`### ${rule}`, '', ...list.slice(0, 8).map(issue => `- \`docs/${issue.file}:${issue.line}\` — ${issue.detail.replace(/\s+/g, ' ').slice(0, 160)}`), '');
  }
  lines.push('## Commands', '', '`pnpm content:check` checks for new regressions. `pnpm content:report` refreshes this summary.',
    'The baseline contains every known file/rule/detail fingerprint. Inspect a rule with `rg` and the cited files; do not regenerate the baseline to hide new failures.', '');
  writeFileSync('maintenance/content-quality-report.md', lines.join('\n'));
}
if (fresh.length) process.exitCode = 1;
