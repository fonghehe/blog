---
title: "CSV Export Boundaries: Quoted Cells Can Still Become Formulas"
date: 2026-10-13 16:08:01
tags:
  - Security
  - Engineering
description: "Separate CSV syntax, spreadsheet interpretation, and column types before promising a faithful export."
readingTime: 3
wordCount: 612
---

A support agent exports contacts and discovers that a note became a formula while a long identifier turned into scientific notation. The server string is unchanged and the CSV parses correctly, yet the visible data has acquired a different meaning. Export design must account for both file grammar and spreadsheet interpretation.

The example uses contact IDs, names, and notes. Its policy rejects suspicious text from CSV and directs the user toward a format with explicit text cell types. That is a deliberate trade-off, not a claim that one escaping function protects every spreadsheet.

## Quoting protects row and column boundaries

CSV fields containing commas, line breaks, or quotes need appropriate encoding. Surrounding a field with quotes and doubling its internal quotes keeps a note from creating extra cells. CRLF is a common row delimiter, with accepted alternatives belonging to the reader contract. [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) describes the syntax.

However, a quoted `=1+1` can still be interpreted as a formula. CSV quotes delimit a field; they do not declare a text cell. [OWASP's formula-injection guidance](https://owasp.org/www-community/attacks/CSV_Injection) also warns that saving and reopening can affect common mitigations. Acceptance cannot stop after the first successful open.

## Specify column types and intended readers

Distinguish identifiers, amounts, free text, and controlled enums. An identifier consisting entirely of digits may require leading zeros. An amount needs business precision and a currency, and cannot inherit a text policy that rejects every leading minus sign. A contact-specific exporter has a clearer contract than an arbitrary-object-to-CSV utility.

Also distinguish human spreadsheet use from machine interchange. A machine may require exact original strings; a spreadsheet may need explicit text cell types. Prefixing an apostrophe can change data consumed by a later import. If one button serves both audiences, that transformation becomes hidden corruption. Explain the intended reader and format in the interface.

## Reject suspicious text rather than silently rewriting it

The example handles contact text columns only. It rejects common formula prefixes and leading control characters instead of modifying the value. Legitimate notes or names may be rejected too, so offer a workbook export whose cells are explicitly text. This detector is not exhaustive across applications, locales, or resaving behavior; test the actual supported readers.

```javascript
export function csvTextCell(value) {
  const text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) {
    throw new Error('text requires a typed spreadsheet export');
  }
  return '"' + text.replaceAll('"', '""') + '"';
}

export function exportContacts(rows) {
  const header = ['id', 'name', 'note'].map(csvTextCell).join(',');
  return [header, ...rows.map(row =>
    [row.id, row.name, row.note].map(csvTextCell).join(',')
  )].join('\r\n') + '\r\n';
}
```

Do not strip leading characters merely to make export succeed. A plus sign, line break, or negative-looking identifier may be real content. If a prefixing or allowlist policy changes representation, document that change and ensure reimport does not mistake the result for original user input. For typed workbooks, verify the library's written cell type rather than trusting a filename extension.

## Encoding and authorization remain part of the export path

A UTF-8 BOM can help some readers recognize encoding. It does not prevent formula interpretation or preserve every numeric identifier. Test Chinese and Japanese text, embedded quotes, and multiline values on supported software. Keep column names, enum translations, and date conventions stable so human and automated readers do not interpret the same report differently.

Recheck permissions and filters on the export endpoint. Having loaded part of a list is not authorization to export the full collection. For a long-running job, return job status and a controlled download location, retaining generation filters and the column-schema version. Diagnostic logs should not copy complete private notes just to explain a failure.

## Verify round trips and reopen behavior

Include ordinary text, commas, quotes, embedded newlines, leading-zero IDs, long digits, formula prefixes, and leading controls. Test syntactic round trips with a parser, rejection behavior in the application, and both opening and resaving in the target spreadsheet.

Keep a column contract stating type, permitted transformations, and intended reader. When someone adds a user-editable note column, that contract reveals the problem earlier than a generic escaping helper does.
