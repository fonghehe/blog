---
title: "Building a Design System: From Component Library to Design Tokens"
date: 2025-03-15 13:29:06
tags:
  - Frontend
readingTime: 2
description: "Over the past year, our team built a design system from scratch — not just buying a UI component library and calling it done. Here's a summary of the process."
wordCount: 144
---

Over the past year, our team built a design system from scratch — not just buying a UI component library and calling it done. Here's a summary of the process.

## Why You Need a Design System

Symptoms:

- Inconsistent button styles across pages (border-radius: 4px, 6px, 8px all present)
- The same color written five different ways in code (`#3B82F6`, `blue-500`, `primary`, `brand`…)
- Changing a color in the design requires a global search-and-replace in code
- New team members don't know which component to use

The core problem a design system solves: **Single Source of Truth**.

## Step 1: Establish Design Tokens

```
Design Token = giving names to design decisions

Not: #3B82F6 (no semantics)
But: color.brand.primary = #3B82F6 (has semantics)
```

```json
// tokens/colors.json (using Style Dictionary format)
{
  "color": {
    "brand": {
      "primary": { "value": "#3B82F6" },
      "primary-dark": { "value": "#1D4ED8" },
      "primary-light": { "value": "#DBEAFE" }
    },
    "neutral": {
      "900": { "value": "#111827" },
      "700": { "value": "#374151" },
      "500": { "value": "#6B7280" },
      "300": { "value": "#D1D5DB" },
      "100": { "value": "#F3F4F6" }
    },
    "semantic": {
      "success": { "value": "{color.green.500}" },
      "error": { "value": "{color.red.500}" },
      "warning": { "value": "{color.amber.500}" }
    }
  },
  "spacing": {
    "1": { "value": "4px" },
    "2": { "value": "8px" },
    "4": { "value": "16px" },
    "6": { "value": "24px" },
    "8": { "value": "32px" }
  }
}
```

## Generating Code with Style Dictionary

```javascript
// style-dictionary.config.js
const StyleDictionary = require("style-dictionary");

module.exports = {
  source: ["tokens/**/*.json"],
  platforms: {
    // Generate CSS variables
    css: {
      transformGroup: "css",
      prefix: "ds",
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.css",
          format: "css/variables",
        },
      ],
    },
    // Generate JS object (for Tailwind)
    js: {
      transformGroup: "js",
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.js",
          format: "javascript/module",
        },
      ],
    },
    // Generate TypeScript types
    ts: {
      transformGroup: "js",
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.d.ts",
          format: "typescript/module-declarations",
        },
      ],
    },
  },
};
```

Generated CSS:

```css
:root {
  --ds-color-brand-primary: #3b82f6;
  --ds-color-brand-primary-dark: #1d4ed8;
  --ds-color-neutral-900: #111827;
  --ds-spacing-4: 16px;
}
```

## Figma Variable Sync

In 2024, Figma introduced the Variables API, enabling two-way sync with code tokens:

```javascript
// scripts/sync-figma-tokens.js
const { FigmaAPI } = require("@figma/rest-api-spec");

async function syncToFigma(tokens) {
  const api = new FigmaAPI({ personalAccessToken: process.env.FIGMA_TOKEN });

  // Read current Figma variables
  const { variables } = await api.getLocalVariables(FILE_KEY);

  // Compare differences and update
  for (const [name, value] of Object.entries(tokens)) {
    const existing = variables.find((v) => v.name === name);
    if (
      existing?.resolvedType === "COLOR" &&
      existing.valuesByMode["mode-id"] !== value
    ) {
      await api.updateVariable(FILE_KEY, existing.id, {
        valuesByMode: { "mode-id": value },
      });
    }
  }
}
```

The actual workflow: designer changes a color → run sync script → code updates automatically.

## Component Layer: A Different Approach than Third-Party Libraries

```tsx
// Our Button isn't a feature-complete general-purpose component
// It encapsulates our design decisions

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        // variant
        {
          "bg-[var(--ds-color-brand-primary)] text-white hover:bg-[var(--ds-color-brand-primary-dark)]":
            variant === "primary",
          "border border-[var(--ds-color-neutral-300)] bg-white hover:bg-[var(--ds-color-neutral-100)]":
            variant === "secondary",
        },
        // size
        {
          "h-8 px-3 text-sm": size === "sm",
          "h-10 px-4 text-sm": size === "md",
          "h-12 px-6": size === "lg",
        },
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
```
