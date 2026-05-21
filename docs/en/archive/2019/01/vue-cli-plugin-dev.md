---
title: "Vue CLI 3 Plugin Development: Automating Project Initialization"
date: 2019-01-28 11:07:28
tags:
  - Vue
readingTime: 1
description: "With many team projects, manually configuring ESLint, Prettier, Git Hooks, and CI every time is tedious. A Vue CLI Plugin handles it all in one step."
wordCount: 43
---

With many team projects, manually configuring ESLint, Prettier, Git Hooks, and CI every time is tedious. A Vue CLI Plugin handles it all in one step.

## Plugin Basic Structure

```
vue-cli-plugin-company-preset/
├── generator/
│   ├── index.js         # file generation logic
│   └── template/        # template files
│       ├── .eslintrc.js
│       ├── .prettierrc
│       └── _gitignore
├── prompts.js           # interactive questions
├── index.js             # service extensions (dev/build commands)
└── package.json
```

## prompts.js: Asking the User What They Need

```javascript
// prompts.js
module.exports = [
  {
    type: "checkbox",
    name: "features",
    message: "Select the features you need",
    choices: [
      { name: "ESLint + Prettier", value: "linting", checked: true },
      {
        name: "Git Hooks (husky + lint-staged)",
        value: "gitHooks",
        checked: true,
      },
      { name: "CI/CD Configuration (GitLab)", value: "ci" },
      { name: "Unit Testing (Jest)", value: "testing" },
    ],
  },
  {
    type: "list",
    name: "cssPreprocessor",
    message: "CSS Preprocessor",
    choices: ["scss", "less", "none"],
    default: "scss",
  },
];
```

## generator/index.js: Generating Files

```javascript
// generator/index.js
module.exports = (api, options, rootOptions) => {
  const { features, cssPreprocessor } = options;

  // Extend package.json
  api.extendPackage({
    scripts: {
      lint: "eslint --ext .js,.vue src",
      "lint:fix": "eslint --ext .js,.vue src --fix",
    },
    devDependencies: {
      eslint: "^6.0.0",
      "eslint-plugin-vue": "^6.0.0",
      "@vue/eslint-config-standard": "^4.0.0",
    },
  });

  if (features.includes("gitHooks")) {
    api.extendPackage({
      devDependencies: {
        husky: "^3.0.0",
        "lint-staged": "^9.0.0",
      },
      husky: {
        hooks: {
          "pre-commit": "lint-staged",
        },
      },
      "lint-staged": {
        "*.{js,vue}": ["eslint --fix", "git add"],
      },
    });
  }

  // Render template files
  api.render("./template", {
    cssPreprocessor,
    hasCI: features.includes("ci"),
  });

  // Post-install message
  api.onCreateComplete(() => {
    console.log("✅ Project initialization complete!");
    console.log("Run npm run lint to check your code");
  });
};
```

## template Directory: EJS Templates

```javascript
// generator/template/.eslintrc.js
// This is an EJS template; <%= %> is replaced with variable values
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ["plugin:vue/recommended", "@vue/standard"],
  rules: {
    // Team-wide rules
    "vue/component-name-in-template-casing": ["error", "PascalCase"],
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
```
