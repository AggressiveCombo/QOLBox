import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadataPath = path.join(projectDirectory, 'src', 'userscript.meta.txt');
const noticesPath = path.join(projectDirectory, 'THIRD_PARTY_NOTICES.md');
const versionPath = path.join(projectDirectory, 'src', 'config', 'qolbox-version.ts');
const isTestBuild = process.argv.includes('--test');
const outputPath = path.join(projectDirectory, isTestBuild ? 'QOLBox.test.user.js' : 'QOLBox.user.js');
const metadata = (await readFile(metadataPath, 'utf8')).trimEnd();
const thirdPartyNotices = (await readFile(noticesPath, 'utf8')).trimEnd();
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

const metadataDownloadUrl = metadata.match(/^\/\/ @downloadURL\s+(.+)$/m)?.[1]?.trim();
const metadataUpdateUrl = metadata.match(/^\/\/ @updateURL\s+(.+)$/m)?.[1]?.trim();
if (/-dev$/i.test(sourceVersion)) {
  if (metadataDownloadUrl || metadataUpdateUrl) {
    throw new Error('Development metadata must not use the production update channel.');
  }
} else if (
  metadataDownloadUrl !== 'https://update.greasyfork.org/scripts/568667/QOLBox.user.js' ||
  metadataUpdateUrl !== 'https://update.greasyfork.org/scripts/568667/QOLBox.meta.js'
) {
  throw new Error('Release metadata is missing the production update channel.');
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
  const PAGE_APP_STATUS_TIMEOUT_MS = 5000;
  const PAGE_APP_STATUS_ATTRIBUTE = 'data-qolbox-page-app-status-' + Math.random().toString(36).slice(2);
  const MAX_REQUESTS_PER_PAGE = 4;
  const MAX_RESPONSE_LENGTH = 2 * 1024 * 1024;
  const ENDPOINTS = {
    github: {
      url: 'https://api.github.com/repos/AggressiveCombo/QOLBox/releases?per_page=100',
      accept: 'application/json',
    },
    greasyfork: {
      url: 'https://greasyfork.org/en/scripts/568667-qolbox/versions?show_all_versions=1',
      accept: 'text/html',
    },
  };
  let requestCount = 0;
  function injectPageScript(source, sourceName) {
    const script = document.createElement('script');
    script.textContent = source + '\\n//# sourceURL=' + sourceName;
    const host = document.documentElement || document.head || document.body;
    if (!host) {
      document.addEventListener('DOMContentLoaded', () => injectPageScript(source, sourceName), { once: true });
      return;
    }
    host.appendChild(script);
    script.remove();
  }

  function injectPageFunction(fn, sourceName) {
    injectPageScript(
      'try { (' + fn.toString() + ')(); document.documentElement.setAttribute("' + PAGE_APP_STATUS_ATTRIBUTE + '", "ready"); } catch (error) { document.documentElement.setAttribute("' + PAGE_APP_STATUS_ATTRIBUTE + '", "error:" + String(error && error.message || error)); throw error; }',
      sourceName
    );
  }

  function installPageAppStatusWatch() {
    return () => window.setTimeout(() => {
      const status = document.documentElement.getAttribute(PAGE_APP_STATUS_ATTRIBUTE) || '';
      document.documentElement.removeAttribute(PAGE_APP_STATUS_ATTRIBUTE);
      if (status.startsWith('error:')) {
        console.error('[QOLBox] Page application failed to start:', status.slice(6) || 'unknown error');
      } else if (status !== 'ready') {
        console.error('[QOLBox] Page application did not start. Inline script injection may be blocked by CSP.');
      }
    }, PAGE_APP_STATUS_TIMEOUT_MS);
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
    if (!request || !/\\/game2\\.html$/i.test(window.location.pathname)) {
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
      const endpoint = typeof data.endpoint === 'string' ? ENDPOINTS[data.endpoint] : null;
      if (!id || !endpoint || requestCount >= MAX_REQUESTS_PER_PAGE) {
        postBridgeResponse(id, { ok: false, error: 'Release-history request was not allowed.' });
        return;
      }
      requestCount += 1;

      let settled = false;
      const details = {
        method: 'GET',
        url: endpoint.url,
        headers: { Accept: endpoint.accept },
        anonymous: true,
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
          const responseText = typeof response?.responseText === 'string' ? response.responseText : '';
          if (responseText.length > MAX_RESPONSE_LENGTH) {
            postBridgeResponse(id, {
              ok: false,
              status,
              error: 'Release-history response was too large.',
            });
            return;
          }
          postBridgeResponse(id, {
            ok: true,
            status,
            text: responseText,
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

  const schedulePageAppFailureCheck = installPageAppStatusWatch();
  installReleaseHistoryBridge();
  injectPageFunction(runQolboxPageApp, 'QOLBox.page.js');
  schedulePageAppFailureCheck();
})();`;
}

const buildResult = await build({
  bundle: true,
  charset: 'utf8',
  entryPoints: [path.join(projectDirectory, 'src', 'main.ts')],
  format: 'iife',
  dropLabels: isTestBuild ? [] : ['QOLBOX_TEST'],
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

await writeFile(outputPath, `${metadata}\n/*\n${thirdPartyNotices}\n*/\n${getWrappedUserscriptSource(pageScript)}\n`);

const output = await readFile(outputPath, 'utf8');
if (!output.startsWith(metadata)) {
  throw new Error('Built userscript did not preserve the metadata header.');
}
