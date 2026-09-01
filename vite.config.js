import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
            // Precache JS/CSS the shell needs; skip source maps and the AI/parse
            // worker chunks are pulled in on demand but caching them is harmless.
            .filter((f) => /\.(js|css)$/.test(f))
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
  plugins: [precacheManifestPlugin()],
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
