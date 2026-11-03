/// <reference types="vitest/config" />
import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

/** Recursos do PDF.js (CMaps, fontes padrão, wasm, perfis ICC) que o app precisa servir localmente. */
const PDFJS_DIRS = ["cmaps", "standard_fonts", "wasm", "iccs"];
const PDFJS_PUBLIC = "pdfjs";
const pdfjsRoot = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));

const MIME: Record<string, string> = {
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".js": "text/javascript",
  ".icc": "application/vnd.iccprofile",
};

/** Serve `/pdfjs/*` a partir de node_modules no dev e copia para `dist/pdfjs` no build (100% offline). */
function pdfjsResources(): Plugin {
  let outDir = "dist";
  return {
    name: "livrepdf-pdfjs-resources",
    configResolved(config) {
      outDir = join(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(`/${PDFJS_PUBLIC}/`, (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? "").split("?")[0])).replace(/^[\/]+/, "");
        const [dir] = rel.split(sep);
        const file = join(pdfjsRoot, rel);
        if (!PDFJS_DIRS.includes(dir) || !file.startsWith(pdfjsRoot) || !existsSync(file) || !statSync(file).isFile()) {
          return next();
        }
        const ext = file.slice(file.lastIndexOf("."));
        res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
    writeBundle() {
      for (const dir of PDFJS_DIRS) {
        cpSync(join(pdfjsRoot, dir), join(outDir, PDFJS_PUBLIC, dir), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), pdfjsResources()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // No Node, usar o build legacy do PDF.js (sem worker de browser).
    alias: [{ find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" }],
    // A inicialização do fake worker do PDF.js em Node pode passar de 5s a frio.
    testTimeout: 15000,
  },
});
