import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataPath = path.join(projectDirectory, 'src', 'userscript.meta.txt');
const outputPath = path.join(projectDirectory, 'QOLbox.user.js');
const metadata = (await readFile(metadataPath, 'utf8')).trimEnd();

if (!metadata.startsWith('// ==UserScript==') || !metadata.endsWith('// ==/UserScript==')) {
  throw new Error('The userscript metadata source is missing its required header markers.');
}

await build({
  banner: { js: metadata },
  bundle: true,
  charset: 'utf8',
  entryPoints: [path.join(projectDirectory, 'src', 'main.ts')],
  format: 'iife',
  legalComments: 'none',
  logLevel: 'info',
  minify: false,
  outfile: outputPath,
  platform: 'browser',
  target: ['es2020'],
});

const output = await readFile(outputPath, 'utf8');
if (!output.startsWith(metadata)) {
  throw new Error('Built userscript did not preserve the metadata header.');
}
