interface PakoLike {
  Inflate?: new (options?: { to?: 'string' }) => PakoInflateLike;
  deflate(input: string, options?: { to?: 'string' }): unknown;
  inflate(input: string, options?: { to?: 'string' }): unknown;
}

interface PakoInflateLike {
  err?: unknown;
  msg?: unknown;
  onData?: (chunk: unknown) => void;
  push(input: Uint8Array, final: boolean): unknown;
}

const REQUIRED_MAP_ARRAY_KEYS = ['b', 'j', 's', 'tu', 'gp'] as const;
const OPTIONAL_MAP_ARRAY_KEYS = ['p', 'tc', 'c'] as const;
const MAX_EDITOR_MAP_DATA_LENGTH = 8 * 1024 * 1024;
const MAX_EDITOR_MAP_JSON_LENGTH = 16 * 1024 * 1024;

function getWindowPako(): PakoLike | null {
  const pako = (window as unknown as { pako?: unknown }).pako;
  if (
    typeof pako === 'object' &&
    pako !== null &&
    typeof (pako as PakoLike).deflate === 'function' &&
    typeof (pako as PakoLike).inflate === 'function'
  ) {
    return pako as PakoLike;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCompactMapObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  if (!REQUIRED_MAP_ARRAY_KEYS.every(key => Array.isArray(value[key]))) {
    return false;
  }

  if (!isRecord(value.set)) {
    return false;
  }

  for (const key of OPTIONAL_MAP_ARRAY_KEYS) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      return false;
    }
  }

  const bodies = value.b as unknown[];
  if (!bodies.every(body => {
    if (!isRecord(body) || !Array.isArray(body.s)) {
      return false;
    }

    return body.s.every(shape => (
      isRecord(shape) &&
      Array.isArray(shape.p) &&
      shape.p.every(point => typeof point === 'number' && Number.isFinite(point))
    ));
  })) {
    return false;
  }

  return [...REQUIRED_MAP_ARRAY_KEYS.slice(1), ...OPTIONAL_MAP_ARRAY_KEYS]
    .every(key => value[key] === undefined || (value[key] as unknown[]).every(isRecord));
}

function binaryStringFromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return binary;
}

function getStringPakoResult(result: unknown): string | null {
  if (typeof result === 'string') {
    return result;
  }

  if (result instanceof Uint8Array) {
    return new TextDecoder().decode(result);
  }

  return null;
}

function getBinaryPakoResult(result: unknown): string | null {
  if (typeof result === 'string') {
    return result;
  }

  if (result instanceof Uint8Array) {
    return binaryStringFromBytes(result);
  }

  return null;
}

function bytesFromBinaryString(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function inflateEditorMapJson(pako: PakoLike, compressedBinary: string): string | null {
  if (typeof pako.Inflate !== 'function') {
    const inflated = getStringPakoResult(pako.inflate(compressedBinary, { to: 'string' }));
    return inflated && inflated.length <= MAX_EDITOR_MAP_JSON_LENGTH ? inflated : null;
  }

  const inflator = new pako.Inflate();
  const decoder = new TextDecoder();
  let inflated = '';
  let inflatedBytes = 0;
  inflator.onData = chunk => {
    if (!(chunk instanceof Uint8Array)) {
      throw new Error('Unsupported pako output');
    }
    inflatedBytes += chunk.byteLength;
    if (inflatedBytes > MAX_EDITOR_MAP_JSON_LENGTH) {
      throw new Error('Editor map is too large');
    }
    inflated += decoder.decode(chunk, { stream: true });
  };

  const compressed = bytesFromBinaryString(compressedBinary);
  const chunkSize = 64 * 1024;
  for (let index = 0; index < compressed.length; index += chunkSize) {
    const final = index + chunkSize >= compressed.length;
    if (inflator.push(compressed.subarray(index, index + chunkSize), final) === false || inflator.err) {
      return null;
    }
  }
  inflated += decoder.decode();
  return inflated;
}

export function decodeEditorMapData(mapData: string): unknown | null {
  const pako = getWindowPako();
  const trimmedMapData = mapData.trim();
  if (!pako || !trimmedMapData || trimmedMapData.length > MAX_EDITOR_MAP_DATA_LENGTH) {
    return null;
  }

  try {
    const compressedBinary = window.atob(decodeURIComponent(trimmedMapData));
    const inflated = inflateEditorMapJson(pako, compressedBinary);
    return inflated ? JSON.parse(inflated) as unknown : null;
  } catch {
    return null;
  }
}

export function encodeEditorMapData(mapJson: unknown): string | null {
  const pako = getWindowPako();
  if (!pako || !isCompactMapObject(mapJson)) {
    return null;
  }

  try {
    const deflated = getBinaryPakoResult(pako.deflate(JSON.stringify(mapJson), { to: 'string' }));
    return deflated ? encodeURIComponent(window.btoa(deflated)) : null;
  } catch {
    return null;
  }
}

export function getReadableEditorMapJson(mapData: string): string | null {
  const decodedMap = decodeEditorMapData(mapData);
  return isCompactMapObject(decodedMap) ? `${JSON.stringify(decodedMap, null, 2)}\n` : null;
}

export function getValidatedEditorMapData(mapData: string): string | null {
  const trimmedMapData = mapData.trim();
  return isCompactMapObject(decodeEditorMapData(trimmedMapData)) ? trimmedMapData : null;
}

function getStringMapDataFromParsedJson(value: unknown): string | null {
  if (typeof value === 'string') {
    return getValidatedEditorMapData(value);
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of ['leveldata', 'levelData', 'map', 'mapData', 'data']) {
    const mapData = value[key];
    if (typeof mapData === 'string') {
      const validatedMapData = getValidatedEditorMapData(mapData);
      if (validatedMapData) {
        return validatedMapData;
      }
    }
  }

  return null;
}

function getMapObjectFromParsedJson(value: unknown): unknown | null {
  if (isCompactMapObject(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of ['map', 'mapData', 'data']) {
    const mapData = value[key];
    if (isCompactMapObject(mapData)) {
      return mapData;
    }
  }

  return null;
}

export function getEditorMapDataFromParsedJson(value: unknown): string | null {
  const stringMapData = getStringMapDataFromParsedJson(value);
  if (stringMapData) {
    return stringMapData;
  }

  const mapObject = getMapObjectFromParsedJson(value);
  return mapObject ? encodeEditorMapData(mapObject) : null;
}
