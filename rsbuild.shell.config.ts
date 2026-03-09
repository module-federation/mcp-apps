/**
 * Shell build configuration for HTTP mode.
 *
 * Produces `dist/mcp-app-shell.html` (~1 KB) that loads JS/CSS from an external
 * URL. The asset URLs use `__MF_MCP_BASE__` as a placeholder, which is replaced
 * at runtime (in server.ts) with the actual HTTP server base URL
 * (e.g. `http://localhost:3001`).
 *
 * The actual JS/CSS bundles are placed in `dist/static/` and served by the
 * Express `/static` route in index.ts.
 *
 * Usage: rsbuild build --config rsbuild.shell.config.ts
 */
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      // Use a different entry name so rsbuild generates mcp-app-shell.html
      // instead of mcp-app.html (which would overwrite the inline build output).
      'mcp-app-shell': './src/mcp-app.tsx',
    },
  },
  html: {
    // Clean template without any <script type="module"> entry reference so that
    // rsbuild doesn't leave a dangling ./mcp-app.tsx script tag in the output.
    template: './src/mcp-app-shell-template.html',
    inject: 'body',
  },
  output: {
    distPath: {
      root: './dist',
      // HTML goes directly into dist/ (not dist/html/)
      html: '',
    },
    // External assets — NOT inlined. JS/CSS go to dist/static/js/ and dist/static/css/.
    inlineScripts: false,
    inlineStyles: false,
    // Prefix all asset paths in the shell HTML with this placeholder so that
    // server.ts can replace it with the real base URL at serve time.
    assetPrefix: '__MF_MCP_BASE__',
    // Deterministic filenames — no content hash, so we can reference them
    // in the placeholder without knowing the hash at compile time.
    filename: {
      js: '[name].js',
      css: '[name].css',
    },
    // Don't wipe dist/ here — the main build already ran first.
    cleanDistPath: false,
  },
  tools: {
    rspack: {
      module: {
        parser: {
          javascript: {
            // Inline dynamic imports so no async chunks are generated separately.
            dynamicImportMode: 'eager',
          },
        },
      },
    },
  },
});
