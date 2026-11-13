// Reads images/ATTRIBUTIONS.md (the licence credits that must be shown wherever the photos are shown).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const imagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data/images');

export function loadCredits() {
  const file = path.join(imagesDir, 'ATTRIBUTIONS.md');
  if (!existsSync(file)) return [];
  const link = (s) => { const m = /\[(.*)\]\((.*)\)/.exec(s.trim()); return m ? { text: m[1], url: m[2] } : { text: s.trim(), url: null }; };
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('| `images/'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map(([, file, usedFor, source, author, license]) => ({
      file: file.replaceAll('`', ''), used_for: usedFor, source: link(source), author, license: link(license),
    }));
}
