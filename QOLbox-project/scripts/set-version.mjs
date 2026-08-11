import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataPath = path.join(projectDirectory, 'src', 'userscript.meta.txt');
const versionPath = path.join(projectDirectory, 'src', 'config', 'qolbox-version.ts');
const RELEASE_DOWNLOAD_URL = 'https://update.greasyfork.org/scripts/568667/QOLBox.user.js';
const RELEASE_UPDATE_URL = 'https://update.greasyfork.org/scripts/568667/QOLBox.meta.js';

const [mode, requestedVersion] = process.argv.slice(2);
if ((mode !== 'dev' && mode !== 'release') || !requestedVersion) {
  throw new Error('Usage: node scripts/set-version.mjs <dev|release> <major.minor.patch>');
}

const baseVersion = requestedVersion.replace(/-dev$/i, '');
if (!/^\d+\.\d+\.\d+$/.test(baseVersion) || (mode === 'release' && requestedVersion !== baseVersion)) {
  throw new Error(`Expected a ${mode} version like 3.0.0, got ${requestedVersion}`);
}

const isDevelopment = mode === 'dev';
const nextName = isDevelopment ? 'QOLBox-dev' : 'QOLBox';
const nextVersion = isDevelopment ? `${baseVersion}-dev` : baseVersion;

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Could not update ${label}.`);
  }
  return source.replace(pattern, replacement);
}

function upsertMetadataLine(source, key, value) {
  const pattern = new RegExp(`^// @${key}\\s+.+$`, 'm');
  return pattern.test(source)
    ? source.replace(pattern, `// @${key} ${value}`)
    : source.replace('// ==/UserScript==', `// @${key} ${value}\n// ==/UserScript==`);
}

let metadata = await readFile(metadataPath, 'utf8');
metadata = replaceRequired(metadata, /^\/\/ @name\s+.+$/m, `// @name         ${nextName}`, 'userscript name');
metadata = replaceRequired(metadata, /^\/\/ @version\s+.+$/m, `// @version      ${nextVersion}`, 'userscript version');
metadata = metadata.replace(/^\/\/ @(downloadURL|updateURL)\s+.+\r?\n/gm, '');
if (!isDevelopment) {
  metadata = upsertMetadataLine(metadata, 'downloadURL', RELEASE_DOWNLOAD_URL);
  metadata = upsertMetadataLine(metadata, 'updateURL', RELEASE_UPDATE_URL);
}
await writeFile(metadataPath, metadata);

const versionSource = await readFile(versionPath, 'utf8');
await writeFile(
  versionPath,
  replaceRequired(
    versionSource,
    /export const QOLBOX_VERSION = '[^']+';/,
    `export const QOLBOX_VERSION = '${nextVersion}';`,
    'QOLBOX_VERSION'
  )
);

console.log(`Set ${nextName} ${nextVersion}`);
