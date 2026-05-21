---
title: "Vue CLI 3 Plugin Development"
date: 2018-12-17 16:18:19
tags:
  - Vue
readingTime: 2
description: "After Vue CLI 3 launched, project scaffolding became far more flexible. CLI plugins can add features and modify webpack configuration. I recently wrote an inter"
wordCount: 103
---

After Vue CLI 3 launched, project scaffolding became far more flexible. CLI plugins can add features and modify webpack configuration. I recently wrote an internal tooling plugin for my team — here's how it works.

## CLI Plugin Structure

```
vue-cli-plugin-xxx/
├── index.js         # Service plugin (modify webpack, register commands)
├── generator.js     # Generator (modify project files, install dependencies)
├── prompts.js       # Interactive prompts (options during project creation)
├── preset.json      # Preset configuration
└── package.json
```

## generator.js: Modifying Project Files

```javascript
// generator.js
module.exports = (api, options, rootOptions) => {
  // Install dependencies
  api.extendPackage({
    dependencies: {
      axios: "^0.19.0",
    },
    scripts: {
      generate: "node scripts/generate.js",
    },
  });

  // Render template files into the project directory
  api.render("./template", {
    // Variables passed to the template
    baseUrl: options.baseUrl || "/api",
  });

  // Add imports to main.js
  api.injectImports(api.entryFile, `import './plugins/axios'`);

  // Message after setup is complete
  api.onCreateComplete(() => {
    console.log("axios plugin installed!");
    console.log("Please configure VUE_APP_API_URL in .env");
  });
};
```

## Template Directory (EJS Templates)

```javascript
// template/src/plugins/axios.js
import axios from "axios";
import Vue from "vue";

const service = axios.create({
  baseURL: process.env.VUE_APP_API_URL || "<%= baseUrl %>",
  timeout: 15000,
});

service.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

Vue.prototype.$http = service;
export default service;
```

## index.js: Modifying Webpack Configuration

```javascript
// index.js (Service plugin)
module.exports = (api, projectOptions) => {
  // Modify webpack config
  api.chainWebpack((config) => {
    // Add an alias
    config.resolve.alias.set("@utils", api.resolve("src/utils"));

    // Analyze the bundle in production builds
    if (process.env.ANALYZE) {
      config
        .plugin("bundle-analyzer")
        .use(require("webpack-bundle-analyzer").BundleAnalyzerPlugin);
    }
  });

  // Register a custom command
  api.registerCommand(
    "generate",
    {
      description: "Code generation",
      usage: "vue-cli-service generate [type]",
    },
    async (args) => {
      const type = args._[0];
      if (type === "api") {
        await generateApi();
      } else if (type === "component") {
        await generateComponent(args);
      } else {
        console.error("Unknown generation type:", type);
      }
    },
  );
};
```

## prompts.js: Options at Creation Time

```javascript
// prompts.js
module.exports = [
  {
    type: "input",
    name: "baseUrl",
    message: "API base path",
    default: "/api",
  },
  {
    type: "confirm",
    name: "addMock",
    message: "Add Mock data support?",
    default: true,
  },
];
```

## Testing the Plugin Locally

```bash
# In the plugin directory
npm link

# In the test project directory
npm link vue-cli-plugin-xxx

# Invoke the plugin's generator
vue invoke vue-cli-plugin-xxx

# Or use it when creating a project
vue create my-project --preset ./preset.json
```

## Using Your Team's CLI Plugin

```bash
# Install into an existing project
vue add my-company-xxx

# package.json will gain an entry like
{
  "devDependencies": {
    "vue-cli-plugin-my-company-xxx": "^1.0.0"
  }
}
```

## Summary

- `generator.js`: install deps, render templates, modify main.js
- `index.js`: modify webpack config, register CLI commands
- `prompts.js`: interactive creation options
- CLI plugins are great for standardizing your team's internal best practices
- They eliminate repeated boilerplate configuration across every new project
