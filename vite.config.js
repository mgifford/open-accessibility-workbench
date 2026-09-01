import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Self-hosts the transformers.js WASM backend so the ONNX runtime is served from
 * our own origin (matching WASM_PATH in src/ai/model-runtime.js) rather than a
 * third-party CDN. Only copies when the files exist (the AI dependency is
 * optional); the AI model runtime is flag-gated regardless.
 */
function selfHostWasmPlugin() {
  return {
    name: 'oaw-selfhost-wasm',
    apply: 'build',
    closeBundle() {
      // Only self-host WASM when the AI runtime is actually built in.
      if (process.env.VITE_AI_RUNTIME !== '1') return;
      const src = resolve(process.cwd(), 'node_modules/onnxruntime-web/dist');
      if (!existsSync(src)) return;
      const destDir = resolve(process.cwd(), 'dist/wasm');
      mkdirSync(destDir, { recursive: true });
      for (const f of readdirSync(src)) {
        if (/\.(wasm|mjs)$/.test(f)) {
          try { copyFileSync(resolve(src, f), resolve(destDir, f)); } catch { /* best-effort */ }
        }
      }
    }
  };
}

/**
 * Injects the fingerprinted app-shell asset list into the built service worker so
 * it can PRECACHE the shell at install (enabling an offline relaunch after one
 * online visit). Runs after the bundle and publicDir copy are on disk.
 */
function precacheManifestPlugin() {
  return {
    name: 'oaw-precache-manifest',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      const swPath = resolve(outDir, 'service-worker.js');
      if (!existsSync(swPath)) return;

      const assetsDir = resolve(outDir, 'assets');
      const assets = existsSync(assetsDir)
        ? readdirSync(assetsDir)
            .filter((f) => /\.(js|css)$/.test(f))
            // Precache only the app shell. Exclude the large, on-demand AI chunks
            // (transformers.js runtime and the AI worker) — they load lazily only
            // when a user enables AI and must not bloat the offline shell.
            .filter((f) => !/transformers|onnxruntime|ort-|ai-worker/.test(f))
            .map((f) => `assets/${f}`)
        : [];
      // The shell entry points. Relative paths resolve against the SW's scope.
      const manifest = ['index.html', './', ...assets];

      // A build-unique id so each deploy uses a fresh cache name; the SW's
      // activate step then purges the previous build's precache (otherwise a
      // static cache name serves a stale shell cache-first forever).
      const buildId = (assets.find((a) => /index-.*\.js$/.test(a)) || String(Date.now()))
        .replace(/[^a-zA-Z0-9]/g, '').slice(-12);

      let sw = readFileSync(swPath, 'utf8');
      sw = `self.__PRECACHE_MANIFEST__ = ${JSON.stringify(manifest)};\n` +
           `self.__BUILD_ID__ = ${JSON.stringify(buildId)};\n` + sw;
      writeFileSync(swPath, sw);
    }
  };
}

export default defineConfig({
  root: './',
  base: './',
  publicDir: 'public',
  plugins: [precacheManifestPlugin(), selfHostWasmPlugin()],
  build: {
    outDir: 'dist',
    target: 'esnext'
  },
  worker: {
    format: 'es'
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.js']
  }
});
