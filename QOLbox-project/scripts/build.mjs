import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataPath = path.join(projectDirectory, 'src', 'userscript.meta.txt');
const versionPath = path.join(projectDirectory, 'src', 'config', 'qolbox-version.ts');
const outputPath = path.join(projectDirectory, 'QOLbox.user.js');
const metadata = (await readFile(metadataPath, 'utf8')).trimEnd();
const versionSource = await readFile(versionPath, 'utf8');

if (!metadata.startsWith('// ==UserScript==') || !metadata.endsWith('// ==/UserScript==')) {
  throw new Error('The userscript metadata source is missing its required header markers.');
}

const metadataVersion = metadata.match(/^\/\/ @version\s+(.+)$/m)?.[1]?.trim();
const sourceVersion = versionSource.match(/export const QOLBOX_VERSION = '([^']+)';/)?.[1];
if (!metadataVersion || !sourceVersion || metadataVersion !== sourceVersion) {
  throw new Error(`Userscript metadata version (${metadataVersion || 'missing'}) does not match QOLBOX_VERSION (${sourceVersion || 'missing'}).`);
}

const metadataName = metadata.match(/^\/\/ @name\s+(.+)$/m)?.[1]?.trim();
const expectedName = /-dev$/i.test(sourceVersion) ? 'QOLBox-dev' : 'QOLBox';
if (metadataName !== expectedName) {
  throw new Error(`Userscript metadata name (${metadataName || 'missing'}) does not match expected ${expectedName}.`);
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
