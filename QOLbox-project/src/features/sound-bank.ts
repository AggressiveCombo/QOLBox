import { readNativeReflectProperty } from '../hitbox/native-access';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

const SOUND_BANK_STATE_KEY = 'vm.hitbox.soundBanks.v1';
const SOUND_BANK_DATABASE = 'qolbox-sound-banks';
const SOUND_BANK_STORE = 'sounds';
const VANILLA_BANK_ID = 'vanilla';
const MAX_SOUND_BYTES = 15 * 1024 * 1024;
const MAX_SOUND_MANIFEST_BYTES = 1024 * 1024;

interface SoundEffectDefinition {
  label: string;
  source: string;
}

interface StoredSound {
  bankId: string;
  blob?: Blob;
  effect: string;
  url?: string;
}

interface SoundBank {
  id: string;
  name: string;
  sounds: Record<string, string>;
}

interface SoundBankState {
  active: string;
  banks: SoundBank[];
}

export const SOUND_EFFECTS: readonly SoundEffectDefinition[] = [
  { label: 'Bat hit', source: 'bathit1.wav' },
  { label: 'Bat swing', source: 'batswing1.wav' },
  { label: 'Canopy open', source: 'canopy_open.mp3' },
  { label: 'Canopy open alternate', source: 'canopy_open_2.mp3' },
  { label: 'Interface click', source: 'click_03.wav' },
  { label: 'Editor click', source: 'click_06.wav' },
  { label: 'Landing plink', source: 'click_loud_plink_2.wav' },
  { label: 'Digital squeak', source: 'digi_squeak.mp3' },
  { label: 'Electric sound', source: 'elecsound1.mp3' },
  { label: 'Force push', source: 'forcepush.mp3' },
  { label: 'Force push end', source: 'forcepush_end.mp3' },
  { label: 'Enemy force push', source: 'forcepush_enemy.mp3' },
  { label: 'Force push failed', source: 'forcepush_fail.mp3' },
  { label: 'Enemy force push failed', source: 'forcepush_fail_enemy.mp3' },
  { label: 'Ground impact', source: 'groundsound1.wav' },
  { label: 'Ground sound 1', source: 'gs6.mp3' },
  { label: 'Ground sound 2', source: 'gs12.mp3' },
  { label: 'Jump', source: 'pop_drip_mid_q_2.wav' },
  { label: 'Double jump', source: 'pop_drip_mid_q_2_l.wav' },
  { label: 'Notification', source: 'pop_note.wav' },
  { label: 'Prop impact', source: 'prop1.mp3' },
  { label: 'Rocket explosion', source: 'rkt_explode.mp3' },
  { label: 'Rocket fire', source: 'rkt_fire.mp3' },
  { label: 'Rocket ready', source: 'rkt_ready.mp3' },
  { label: 'Splat 1', source: 'splat2.mp3' },
  { label: 'Splat 2', source: 'splat3.mp3' },
  { label: 'Soft hollow impact', source: 'ssfx_hollow_large_soft_1.wav' },
  { label: 'Winner notification', source: 'winnernotification.mp3' },
];

const SOUND_EFFECT_SOURCES = new Set(SOUND_EFFECTS.map(effect => effect.source));

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function loadState(): SoundBankState {
  try {
    const parsed = JSON.parse(getLocalStorageItem(SOUND_BANK_STATE_KEY) || 'null') as Partial<SoundBankState> | null;
    const banks = Array.isArray(parsed?.banks)
      ? parsed.banks.filter(bank => bank && typeof bank.id === 'string' && typeof bank.name === 'string')
        .map(bank => ({
          id: bank.id,
          name: bank.name,
          sounds: Object.fromEntries(Object.entries(bank.sounds && typeof bank.sounds === 'object' ? bank.sounds : {})
            .filter(([effect, fileName]) => SOUND_EFFECT_SOURCES.has(effect) && typeof fileName === 'string')),
        }))
      : [];
    const parsedActive = parsed?.active;
    const active = typeof parsedActive === 'string' &&
      (parsedActive === VANILLA_BANK_ID || banks.some(bank => bank.id === parsedActive))
      ? parsedActive
      : VANILLA_BANK_ID;
    return { active, banks };
  } catch {
    return { active: VANILLA_BANK_ID, banks: [] };
  }
}

function saveState(state: SoundBankState): void {
  setLocalStorageItem(SOUND_BANK_STATE_KEY, JSON.stringify(state));
}

function openSoundDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SOUND_BANK_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SOUND_BANK_STORE, { keyPath: ['bankId', 'effect'] });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the sound bank database.'));
  });
}

async function readStoredSound(bankId: string, effect: string): Promise<StoredSound | null> {
  const database = await openSoundDatabase();
  return new Promise<StoredSound | null>((resolve, reject) => {
    const request = database.transaction(SOUND_BANK_STORE).objectStore(SOUND_BANK_STORE).get([bankId, effect]);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read the custom sound.'));
  }).finally(() => database.close());
}

async function writeStoredSound(sound: StoredSound): Promise<void> {
  const database = await openSoundDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SOUND_BANK_STORE, 'readwrite');
    transaction.objectStore(SOUND_BANK_STORE).put(sound);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the custom sound.'));
  }).finally(() => database.close());
}

async function deleteStoredSound(bankId: string, effect?: string): Promise<void> {
  const database = await openSoundDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SOUND_BANK_STORE, 'readwrite');
    const store = transaction.objectStore(SOUND_BANK_STORE);
    if (effect) {
      store.delete([bankId, effect]);
    } else {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if ((cursor.value as StoredSound).bankId === bankId) cursor.delete();
        cursor.continue();
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not remove the custom sound.'));
  }).finally(() => database.close());
}

function getHowlSource(howl: unknown): string | null {
  const rawSource = readNativeReflectProperty(howl, '_src');
  const source = Array.isArray(rawSource) ? rawSource[0] : rawSource;
  if (typeof source !== 'string') return null;
  const fileName = source.split(/[?#]/, 1)[0]?.split('/').pop()?.toLowerCase() || '';
  return SOUND_EFFECT_SOURCES.has(fileName) ? fileName : null;
}

function getRemoteSoundUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function getManifestEffect(hint: string, url: string): string | null {
  const hintedSource = hint.trim().toLowerCase();
  if (SOUND_EFFECT_SOURCES.has(hintedSource)) return hintedSource;
  try {
    const source = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').toLowerCase();
    return SOUND_EFFECT_SOURCES.has(source) ? source : null;
  } catch {
    return null;
  }
}

function parseSoundBankManifest(file: File, text: string): { name: string; sounds: Map<string, string> } {
  const fallbackName = file.name.replace(/\.[^.]+$/, '').trim() || 'Imported Bank';
  const sounds = new Map<string, string>();
  const addSound = (hint: string, value: unknown) => {
    const url = typeof value === 'string' ? getRemoteSoundUrl(value.trim()) : null;
    const effect = url ? getManifestEffect(hint, url) : null;
    if (!url) throw new Error('Sound bank URLs must be direct HTTPS audio URLs.');
    if (!effect) throw new Error(`Could not match “${hint || value}” to a Hitbox effect filename.`);
    sounds.set(effect, url);
  };
  let name = fallbackName;
  if (/^\s*(?:\[|\{)/.test(text)) {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      for (const value of parsed) addSound('', value);
    } else if (parsed && typeof parsed === 'object') {
      const manifest = parsed as Record<string, unknown>;
      if (typeof manifest.name === 'string' && manifest.name.trim()) name = manifest.name.trim();
      const entries = manifest.sounds && typeof manifest.sounds === 'object' && !Array.isArray(manifest.sounds)
        ? Object.entries(manifest.sounds as Record<string, unknown>)
        : Object.entries(manifest).filter(([key]) => key !== 'name');
      for (const [effect, value] of entries) addSound(effect, value);
    } else {
      throw new Error('The sound bank manifest must contain URLs or an object of effect-to-URL mappings.');
    }
  } else {
    for (const line of text.split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
      const assignment = line.match(/^([^=]+)=(https:\/\/.*)$/i);
      addSound(assignment?.[1] || '', assignment?.[2] || line);
    }
  }
  if (!sounds.size) throw new Error('The sound bank manifest contains no effects.');
  return { name: name.slice(0, 80), sounds };
}

function playAudio(url: string, volume = 1, rate = 1, loop = false): HTMLAudioElement {
  const audio = new Audio(url);
  audio.loop = loop;
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.playbackRate = Math.max(0.25, Math.min(4, rate));
  void audio.play().catch(() => undefined);
  return audio;
}

function getHowlPlaybackSettings(howl: unknown): { loop: boolean; rate: number; volume: number } {
  const howlVolume = Number(readNativeReflectProperty(howl, '_volume'));
  const howlRate = Number(readNativeReflectProperty(howl, '_rate'));
  const howlerVolume = Number(readNativeReflectProperty(readNativeReflectProperty(window, 'Howler'), '_volume'));
  return {
    loop: readNativeReflectProperty(howl, '_loop') === true,
    rate: Number.isFinite(howlRate) ? howlRate : 1,
    volume: (Number.isFinite(howlVolume) ? howlVolume : 1) * (Number.isFinite(howlerVolume) ? howlerVolume : 1),
  };
}

function getEffectHowl(effect: string): unknown {
  const howls = readNativeReflectProperty(readNativeReflectProperty(window, 'Howler'), '_howls');
  return Array.isArray(howls) ? howls.find(howl => getHowlSource(howl) === effect) : null;
}

export function createSoundBankController() {
  const state = loadState();
  let replacementUrls = new Map<string, string>();
  let selectedEffect = SOUND_EFFECTS[0]?.source || '';
  let nextPlaybackId = -1;
  let playbacksByHowl = new WeakMap<object, Map<number, HTMLAudioElement>>();
  const activePlaybacks = new Set<HTMLAudioElement>();
  let refreshSequence = 0;
  let lastError = '';

  function stopAllReplacements(): void {
    for (const audio of activePlaybacks) {
      audio.pause();
      audio.removeAttribute('src');
    }
    activePlaybacks.clear();
    playbacksByHowl = new WeakMap<object, Map<number, HTMLAudioElement>>();
  }

  function getActiveBank(): SoundBank | null {
    return state.banks.find(bank => bank.id === state.active) || null;
  }

  async function refreshReplacements(): Promise<void> {
    const sequence = ++refreshSequence;
    const bank = getActiveBank();
    const nextUrls = new Map<string, string>();
    if (bank) {
      const records = await Promise.all(Object.keys(bank.sounds).map(effect => readStoredSound(bank.id, effect)));
      if (sequence !== refreshSequence) return;
      for (const record of records) {
        if (record?.blob) nextUrls.set(record.effect, URL.createObjectURL(record.blob));
        else if (record?.url) nextUrls.set(record.effect, record.url);
      }
    }
    stopAllReplacements();
    for (const url of replacementUrls.values()) URL.revokeObjectURL(url);
    replacementUrls = nextUrls;
  }

  function playReplacement(howl: unknown): number | null {
    const effect = getHowlSource(howl);
    const url = effect ? replacementUrls.get(effect) : null;
    if (!url || (typeof howl !== 'object' && typeof howl !== 'function') || howl === null) return null;
    const settings = getHowlPlaybackSettings(howl);
    const audio = playAudio(url, settings.volume, settings.rate, settings.loop);
    const id = nextPlaybackId--;
    const playbacks = playbacksByHowl.get(howl) || new Map<number, HTMLAudioElement>();
    playbacks.set(id, audio);
    playbacksByHowl.set(howl, playbacks);
    activePlaybacks.add(audio);
    const finish = () => {
      playbacks.delete(id);
      activePlaybacks.delete(audio);
    };
    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('error', finish, { once: true });
    return id;
  }

  function stopReplacement(howl: unknown, id?: unknown): boolean {
    if ((typeof howl !== 'object' && typeof howl !== 'function') || howl === null) return false;
    const playbacks = playbacksByHowl.get(howl);
    if (!playbacks?.size) return false;
    const targets = typeof id === 'number' ? [playbacks.get(id)].filter(Boolean) as HTMLAudioElement[] : [...playbacks.values()];
    if (!targets.length) return false;
    for (const audio of targets) {
      if (typeof id === 'number' && !audio.loop) continue;
      audio.pause();
      activePlaybacks.delete(audio);
      for (const [playbackId, candidate] of playbacks) {
        if (candidate === audio) playbacks.delete(playbackId);
      }
    }
    return true;
  }

  function getMarkup(): string {
    const activeBank = getActiveBank();
    const bankOptions = [
      `<option value="${VANILLA_BANK_ID}"${state.active === VANILLA_BANK_ID ? ' selected' : ''}>Vanilla</option>`,
      ...state.banks.map(bank =>
        `<option value="${escapeHtml(bank.id)}"${state.active === bank.id ? ' selected' : ''}>${escapeHtml(bank.name)}</option>`
      ),
    ].join('');
    const effectOptions = SOUND_EFFECTS.map(effect =>
      `<option value="${escapeHtml(effect.source)}"${selectedEffect === effect.source ? ' selected' : ''}>${escapeHtml(effect.label)} — ${escapeHtml(effect.source)}</option>`
    ).join('');
    const replacements = activeBank
      ? Object.entries(activeBank.sounds).map(([effect, fileName]) => {
          const label = SOUND_EFFECTS.find(candidate => candidate.source === effect)?.label || effect;
          return `<div class="qolboxSoundReplacement">
            <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(fileName)}</small></span>
            <div class="qolboxSoundReplacementActions">
              <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-preview" data-qolbox-icon="play" data-effect="${escapeHtml(effect)}">Preview</button>
              <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-remove" data-qolbox-icon="trash" data-effect="${escapeHtml(effect)}">Remove</button>
            </div>
          </div>`;
        }).join('')
      : '';
    return `<section class="qolboxSoundBanks" aria-labelledby="qolboxSoundBanksTitle">
      <div id="qolboxSoundBanksTitle" class="qolboxMenuFeatureName" data-qolbox-icon="music">Sound Banks</div>
      <div class="qolboxSoundBankControls">
        <label class="qolboxSoundBankField">
          <span>Active bank</span>
          <select class="qolboxMenuInput" data-qolbox-sound-bank>${bankOptions}</select>
        </label>
        <div class="qolboxSoundBankActions">
          <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-new" data-qolbox-icon="file-plus">New bank</button>
          <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-import" data-qolbox-icon="upload">Import</button>
          ${activeBank ? '<button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-delete" data-qolbox-icon="trash">Delete bank</button>' : ''}
        </div>
        <input hidden type="file" accept=".json,.txt,application/json,text/plain" data-qolbox-sound-manifest>
      </div>
      ${activeBank ? `<div class="qolboxSoundBankReplace">
        <label class="qolboxSoundBankField">
          <span>Effect to replace</span>
          <select class="qolboxMenuInput" data-qolbox-sound-effect>${effectOptions}</select>
        </label>
        <button class="qolboxMenuButton primary" type="button" data-qolbox-action="sound-bank-choose" data-qolbox-icon="upload">Choose audio</button>
        <input hidden type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" data-qolbox-sound-file>
      </div>
      <div class="qolboxSoundReplacementHeader"><strong>Replacements</strong></div>
      <div class="qolboxSoundReplacementList">${replacements || '<span class="qolboxMenuFeatureSummary">No replaced effects yet.</span>'}</div>`
      : ''}
      ${lastError ? `<div class="qolboxMenuFieldError" role="alert">${escapeHtml(lastError)}</div>` : ''}
    </section>`;
  }

  async function handleAction(action: string, element: HTMLElement): Promise<boolean> {
    if (!action.startsWith('sound-bank-')) return false;
    lastError = '';
    try {
      if (action === 'sound-bank-new') {
        const name = window.prompt('Sound bank name', 'My Sound Bank')?.trim();
        if (name) {
          const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
          state.banks.push({ id, name: name.slice(0, 80), sounds: {} });
          state.active = id;
          saveState(state);
          await refreshReplacements();
        }
      } else if (action === 'sound-bank-delete') {
        const bank = getActiveBank();
        if (bank && window.confirm(`Delete “${bank.name}” and its saved sounds?`)) {
          await deleteStoredSound(bank.id);
          state.banks = state.banks.filter(candidate => candidate.id !== bank.id);
          state.active = VANILLA_BANK_ID;
          saveState(state);
          await refreshReplacements();
        }
      } else if (action === 'sound-bank-import') {
        element.closest('.qolboxSoundBanks')?.querySelector<HTMLInputElement>('[data-qolbox-sound-manifest]')?.click();
        return false;
      } else if (action === 'sound-bank-choose') {
        element.closest('.qolboxSoundBanks')?.querySelector<HTMLInputElement>('[data-qolbox-sound-file]')?.click();
        return false;
      } else if (action === 'sound-bank-preview') {
        const effect = element.dataset.effect || '';
        const url = replacementUrls.get(effect);
        if (url) {
          const settings = getHowlPlaybackSettings(getEffectHowl(effect));
          const audio = playAudio(url, settings.volume, settings.rate);
          activePlaybacks.add(audio);
          const finish = () => activePlaybacks.delete(audio);
          audio.addEventListener('ended', finish, { once: true });
          audio.addEventListener('error', finish, { once: true });
        }
        return false;
      } else if (action === 'sound-bank-remove') {
        const bank = getActiveBank();
        const effect = element.dataset.effect || '';
        if (bank && bank.sounds[effect]) {
          await deleteStoredSound(bank.id, effect);
          delete bank.sounds[effect];
          saveState(state);
          await refreshReplacements();
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'The sound bank action failed.';
    }
    return true;
  }

  async function handleInput(element: HTMLInputElement | HTMLSelectElement): Promise<boolean> {
    if (element.matches('[data-qolbox-sound-bank]')) {
      state.active = element.value === VANILLA_BANK_ID || state.banks.some(bank => bank.id === element.value)
        ? element.value
        : VANILLA_BANK_ID;
      saveState(state);
      await refreshReplacements();
      return true;
    }
    if (element.matches('[data-qolbox-sound-effect]')) {
      if (SOUND_EFFECT_SOURCES.has(element.value)) selectedEffect = element.value;
      return false;
    }
    if (element.matches('[data-qolbox-sound-manifest]') && element instanceof HTMLInputElement) {
      const file = element.files?.[0];
      if (!file) return true;
      lastError = '';
      if (file.size > MAX_SOUND_MANIFEST_BYTES) {
        lastError = 'Choose a sound bank manifest no larger than 1 MB.';
        element.value = '';
        return true;
      }
      try {
        const manifest = parseSoundBankManifest(file, await file.text());
        const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        try {
          await Promise.all([...manifest.sounds].map(([effect, url]) => writeStoredSound({ bankId: id, effect, url })));
        } catch (error) {
          await deleteStoredSound(id).catch(() => undefined);
          throw error;
        }
        state.banks.push({ id, name: manifest.name, sounds: Object.fromEntries(manifest.sounds) });
        state.active = id;
        saveState(state);
        await refreshReplacements();
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'The sound bank could not be imported.';
      }
      element.value = '';
      return true;
    }
    if (!element.matches('[data-qolbox-sound-file]') || !(element instanceof HTMLInputElement)) return false;
    const file = element.files?.[0];
    const bank = getActiveBank();
    const effect = element.closest('.qolboxSoundBanks')
      ?.querySelector<HTMLSelectElement>('[data-qolbox-sound-effect]')?.value || '';
    if (!file || !bank || !SOUND_EFFECT_SOURCES.has(effect)) return true;
    lastError = '';
    if (file.size > MAX_SOUND_BYTES) {
      lastError = 'Choose an audio file no larger than 15 MB.';
      return true;
    }
    try {
      await writeStoredSound({ bankId: bank.id, blob: file, effect });
      bank.sounds[effect] = file.name;
      saveState(state);
      await refreshReplacements();
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'The custom sound could not be saved.';
    }
    return true;
  }

  void refreshReplacements().catch(() => undefined);

  return {
    getMarkup,
    handleAction,
    handleInput,
    playReplacement,
    refreshReplacements,
    stopAllReplacements,
    stopReplacement,
  };
}
