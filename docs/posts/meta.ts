// ─── Types ───────────────────────────────────────────────────────────────────

export interface Post {
  title: string;
  url: string;
  date: string;
  tags: string[];
  description: string;
  readingTime: number; // minutes
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** CJK 300 chars/min, Latin 200 words/min */
export function estimateReadingTime(content: string): number {
  // Extract code block content for separate rate calculation
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const codeChars = codeBlocks.join("").replace(/```\w*\n?/g, "").length;

  const stripped = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/[#*`>\-|[\]()!]/g, "")
    .trim();
  const cjk = (
    stripped.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []
  ).length;
  const words = stripped
    .replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  // CJK prose: 300 chars/min, Latin prose: 200 words/min, code: 3000 chars/min
  return Math.max(1, Math.round(cjk / 300 + words / 200 + codeChars / 3000));
}

/** Extract description from frontmatter or first paragraph */
export function extractDescription(
  frontmatter: Record<string, unknown>,
  rawContent: string,
): string {
  if (
    typeof frontmatter.description === "string" &&
    frontmatter.description.trim()
  ) {
    return frontmatter.description.trim();
  }
  const lines = rawContent
    .replace(/^---[\s\S]*?---/m, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("#") &&
        !l.startsWith("```") &&
        !l.startsWith("|") &&
        !l.startsWith("-") &&
        !l.startsWith("!"),
    );
  return (lines[0] || "").slice(0, 160);
}

/** Normalize tag to canonical form */
export function normalizeTag(tag: string): string {
  const t = tag.trim();
  const canonical: Record<string, string> = {
    vue: "Vue",
    vuex: "Vuex",
    pinia: "Pinia",
    "nuxt.js": "Nuxt.js",
    nuxt: "Nuxt.js",
    react: "React",
    "next.js": "Next.js",
    nextjs: "Next.js",
    angular: "Angular",
    rxjs: "RxJS",
    ngrx: "NgRx",
    javascript: "JavaScript",
    es6: "ES6",
    typescript: "TypeScript",
    css: "CSS",
    tailwindcss: "TailwindCSS",
    sass: "Sass",
    less: "Less",
    "node.js": "Node.js",
    node: "Node.js",
    express: "Express",
    koa: "Koa",
    webpack: "Webpack",
    vite: "Vite",
    rollup: "Rollup",
    esbuild: "ESBuild",
    babel: "Babel",
    jest: "Jest",
    vitest: "Vitest",
    playwright: "Playwright",
    xss: "XSS",
    csp: "CSP",
    csrf: "CSRF",
  };
  return canonical[t.toLowerCase()] || t;
}
