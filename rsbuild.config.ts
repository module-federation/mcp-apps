import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      'mcp-app': './src/mcp-app.tsx',
    },
  },
  html: {
    // Use src/mcp-app.html as the HTML template
    template: './src/mcp-app.html',
    filename: 'mcp-app.html',
    // Inject scripts into <body> so inlined scripts can access DOM elements
    inject: 'body',
  },
  output: {
    distPath: {
      root: './dist',
      // Put HTML directly in root (not in dist/html/...)
      html: '',
    },
    // Inline all JS and CSS into the HTML file to produce a single self-contained file
    inlineScripts: true,
    inlineStyles: true,
    // Don't auto-clean: rm -rf dist/ in the build script handles that
    cleanDistPath: false,
  },
  tools: {
    rspack: {
      module: {
        parser: {
          javascript: {
            // Inline dynamic imports so no async chunks are generated separately
            dynamicImportMode: 'eager',
          },
        },
      },
    },
  },
});
