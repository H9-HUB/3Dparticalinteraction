#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const nodeModules = path.join(projectRoot, 'node_modules');
const mpPkgDir = path.join(nodeModules, '@mediapipe', 'tasks-vision');
const srcWasmDir = path.join(mpPkgDir, 'wasm');
const publicDir = path.join(projectRoot, 'public');
const dstWasmDir = path.join(publicDir, 'mediapipe', 'wasm');
const dstModelsDir = path.join(publicDir, 'mediapipe', 'models');

/** Ensure directory exists */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Copy all files in a directory */
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  ensureDir(dst);
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Download with https and follow redirects */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const doReq = (u, redirects = 0) => {
      https
        .get(u, (res) => {
          // Follow redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirects > 5) return reject(new Error('Too many redirects for ' + u));
            const next = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, u).toString();
            res.resume();
            return doReq(next, redirects + 1);
          }
          if (res.statusCode !== 200) {
            return reject(new Error('HTTP ' + res.statusCode + ' for ' + u));
          }
          ensureDir(path.dirname(dest));
          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve(dest)));
        })
        .on('error', reject);
    };
    doReq(url);
  });
}

async function main() {
  if (process.env.SKIP_MP_PREPARE === '1' || String(process.env.SKIP_MP_PREPARE).toLowerCase() === 'true') {
    console.log('[mediapipe] SKIP_MP_PREPARE=1 set, skipping assets preparation');
    return 0;
  }
  try {
    // 1) Copy wasm files from package to public
    if (fs.existsSync(srcWasmDir)) {
      copyDir(srcWasmDir, dstWasmDir);
      console.log('[mediapipe] Copied wasm to', path.relative(projectRoot, dstWasmDir));
    } else {
      console.warn('[mediapipe] wasm source not found:', srcWasmDir);
    }

    // 2) Download model to public (try multiple mirrors)
    const modelFile = path.join(dstModelsDir, 'hand_landmarker.task');
    if (!fs.existsSync(modelFile)) {
      const envUrl = process.env.MEDIAPIPE_MODEL_URL && String(process.env.MEDIAPIPE_MODEL_URL).trim();
      const sources = [
        envUrl || '',
        // Google official bucket
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        // AISTUDIO mirror (if available)
        'https://aistudiocdn.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      ];
      let ok = false;
      for (const url of sources) {
        if (!url) continue;
        try {
          console.log('[mediapipe] Downloading model from:', url);
          await download(url, modelFile);
          ok = true;
          break;
        } catch (e) {
          console.warn('[mediapipe] Download failed, try next mirror:', String(e));
        }
      }
      if (!ok) throw new Error('Failed to download hand_landmarker.task from all sources');
    }
    console.log('[mediapipe] Model ready at', path.relative(projectRoot, modelFile));
  } catch (err) {
    console.warn('[mediapipe] Prepare step warning:', err.message || String(err));
    // Do not fail whole install/build; allow runtime fallback/error message
    return 0;
  }
}

main().then(() => { process.exitCode = 0; }).catch(() => { process.exitCode = 0; });
