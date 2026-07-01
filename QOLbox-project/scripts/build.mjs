import { readFile, writeFile } from 'node:fs/promises';
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

function indentSource(source, spaces = 4) {
  const prefix = ' '.repeat(spaces);
  return source
    .split('\n')
    .map(line => (line ? `${prefix}${line}` : ''))
    .join('\n');
}

function getWrappedUserscriptSource(pageScriptSource) {
  return `(() => {
  'use strict';

  const QOLBOX_BRIDGE_READY_SCRIPT = 'window.__qolboxReleaseHistoryBridgeReady = true;';
  const REQUEST_SOURCE = 'qolbox-release-history';
  const RESPONSE_SOURCE = 'qolbox-release-history-bridge';
  const REQUEST_TYPE = 'fetch';
  const RESPONSE_TYPE = 'fetch-result';
  const REQUEST_TIMEOUT_MS = 7000;
  const ALLOWED_HOSTS = new Set(['api.github.com', 'greasyfork.org']);

  function injectPageScript(source, sourceName) {
    const script = document.createElement('script');
    script.textContent = source + '\\n//# sourceURL=' + sourceName;
    const host = document.documentElement || document.head || document.body;
    if (!host) {
      window.setTimeout(() => injectPageScript(source, sourceName), 0);
      return;
    }
    host.appendChild(script);
    script.remove();
  }

  function injectPageFunction(fn, sourceName) {
    injectPageScript('(' + fn.toString() + ')();', sourceName);
  }

  function getUserscriptRequest() {
    if (typeof GM_xmlhttpRequest === 'function') {
      return GM_xmlhttpRequest;
    }
    if (typeof GM === 'object' && GM && typeof GM.xmlHttpRequest === 'function') {
      return GM.xmlHttpRequest.bind(GM);
    }
    return null;
  }

  function isAllowedUrl(url) {
    try {
      const parsed = new URL(String(url));
      return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
    } catch {
      return false;
    }
  }

  function sanitizeHeaders(headers) {
    const sanitized = {};
    if (!headers || typeof headers !== 'object') {
      return sanitized;
    }
    for (const [name, value] of Object.entries(headers)) {
      if (typeof value === 'string' && /^accept$/i.test(name)) {
        sanitized[name] = value;
      }
    }
    return sanitized;
  }

  function postBridgeResponse(id, payload) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      type: RESPONSE_TYPE,
      id,
      ...payload,
    }, window.location.origin);
  }

  function installReleaseHistoryBridge() {
    const request = getUserscriptRequest();
    if (!request) {
      return;
    }

    injectPageScript(QOLBOX_BRIDGE_READY_SCRIPT, 'QOLBox.bridge-ready.js');

    window.addEventListener('message', event => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== REQUEST_SOURCE || data.type !== REQUEST_TYPE) {
        return;
      }

      const id = typeof data.id === 'string' ? data.id : '';
      const url = typeof data.url === 'string' ? data.url : '';
      if (!id || !isAllowedUrl(url)) {
        postBridgeResponse(id, { ok: false, error: 'Release-history request was not allowed.' });
        return;
      }

      let settled = false;
      const details = {
        method: 'GET',
        url,
        headers: sanitizeHeaders(data.headers),
        timeout: REQUEST_TIMEOUT_MS,
        onload(response) {
          if (settled) {
            return;
          }
          settled = true;
          const status = typeof response?.status === 'number' ? response.status : 0;
          if (status < 200 || status >= 300) {
            postBridgeResponse(id, {
              ok: false,
              status,
              error: 'HTTP ' + String(status || 0),
            });
            return;
          }
          postBridgeResponse(id, {
            ok: true,
            status,
            text: typeof response?.responseText === 'string' ? response.responseText : '',
          });
        },
        onerror(error) {
          if (settled) {
            return;
          }
          settled = true;
          postBridgeResponse(id, {
            ok: false,
            error: error instanceof Error ? error.message : 'GM_xmlhttpRequest failed.',
          });
        },
        ontimeout() {
          if (settled) {
            return;
          }
          settled = true;
          postBridgeResponse(id, {
            ok: false,
            error: 'GM_xmlhttpRequest timed out.',
          });
        },
      };

      try {
        const maybePromise = request(details);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(details.onload, details.onerror);
        }
      } catch (error) {
        details.onerror(error);
      }
    }, false);
  }

  function runQolboxPageApp() {
${indentSource(pageScriptSource, 4)}
  }

  installReleaseHistoryBridge();
  injectPageFunction(runQolboxPageApp, 'QOLBox.page.js');
})();`;
}

const buildResult = await build({
  bundle: true,
  charset: 'utf8',
  entryPoints: [path.join(projectDirectory, 'src', 'main.ts')],
  format: 'iife',
  legalComments: 'none',
  logLevel: 'info',
  minify: false,
  platform: 'browser',
  target: ['es2020'],
  write: false,
});

const pageScript = buildResult.outputFiles?.[0]?.text;
if (!pageScript) {
  throw new Error('esbuild did not return a bundled page script.');
}

await writeFile(outputPath, `${metadata}\n${getWrappedUserscriptSource(pageScript)}\n`);

const output = await readFile(outputPath, 'utf8');
if (!output.startsWith(metadata)) {
  throw new Error('Built userscript did not preserve the metadata header.');
}
