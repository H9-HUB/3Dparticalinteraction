#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const dst = path.join(projectRoot, 'public', 'mediapipe', 'models', 'hand_landmarker.task');

const src = process.argv[2];
if (!src) {
  console.error('Usage: npm run add:model -- "C:/path/to/hand_landmarker.task"');
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error('Source file not found:', src);
  process.exit(2);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('Copied model to', path.relative(projectRoot, dst));
