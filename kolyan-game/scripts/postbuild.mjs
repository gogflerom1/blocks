// Writes an artifact-friendly copy (no html/head/body wrappers) next to the build.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync('../kolyan/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/, '')
  .replace(/<meta name="viewport"[^>]*>/, '')
  .replace(/<link rel="manifest"[^>]*>/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/kolyan-escape.html', head.trim() + '\n' + body.trim() + '\n');
console.log('artifact copy:', (head.length + body.length) / 1024 | 0, 'KB');
