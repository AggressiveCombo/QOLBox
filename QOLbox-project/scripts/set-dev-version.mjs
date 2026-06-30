import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataPath = path.join(projectDirectory, 'src', 'userscript.meta.txt');
const versionPath = path.join(projectDirectory, 'src', 'config', 'qolbox-version.ts');

const nextVersion = process.argv[2];
const nextName = 'QOLBox-dev';

if (!nextVersion) {
  throw new Error('Usage: npm run version:dev -- 2.1.0-dev');
}

if (!/^\d+\.\d+\.\d+-dev$/i.test(nextVersion)) {
  throw new Error(`Expected a dev version like 2.1.0-dev, got ${nextVersion}`);
}

function replaceRequired(source, pattern, replacement, label) {
  const nextSource = source.replace(pattern, replacement);
  if (nextSource === source) {
    throw new Error(`Could not update ${label}.`);
  }
  return nextSource;
}

const metadata = await readFile(metadataPath, 'utf8');
await writeFile(
  metadataPath,
  replaceRequired(
    replaceRequired(metadata, /^\/\/ @name\s+.+$/m, `// @name         ${nextName}`, 'userscript name'),
    /^\/\/ @version\s+.+$/m,
    `// @version      ${nextVersion}`,
    'userscript version'
  )
);

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
