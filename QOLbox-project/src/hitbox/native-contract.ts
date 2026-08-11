import { isNativeObject, readNativePath, readNativeProperty } from './native-access';

// Keep the unavoidable minified Hitbox seams named and reviewable in one place.
export const HITBOX_NATIVE = {
  session: {
    chatSend: 'CJ',
    localGameStart: '_J',
    playerJoined: 'VW',
    remoteGameStart: ['KJ', 'ZJ'] as const,
    runtime: 'KR',
    showStatus: 'vG',
  },
  renderer: {
    backing: 'Bc',
    draw: 'Dg',
    nested: 'hb',
    pixi: 'Ag',
    resize: 'cg',
  },
  mobile: {
    controls: 'PD',
    hide: '_L',
    inputState: 'hg',
    mobileFlag: 'xm',
    pressGrab: 'Fn',
    setInputState: 'ED',
    show: 'NL',
    slots: ['oz', 'rz', 'az'] as const,
    view: 'hf',
  },
} as const;

export interface NativeCompatibilityReport {
  missing: string[];
  mobile: 'compatible' | 'not-active' | 'partial';
  renderer: 'compatible' | 'not-active' | 'partial';
  session: 'compatible' | 'not-active' | 'partial';
}

function isCallableProperty(source: unknown, property: PropertyKey): boolean {
  return typeof readNativeProperty(source, property) === 'function';
}

export function inspectNativeCompatibility(windowObject: unknown): NativeCompatibilityReport {
  const missing: string[] = [];
  const session = readNativeProperty(windowObject, 'multiplayerSession');
  let sessionState: NativeCompatibilityReport['session'] = 'not-active';
  if (isNativeObject(session)) {
    const required: string[] = [HITBOX_NATIVE.session.chatSend, HITBOX_NATIVE.session.playerJoined];
    const hasStart = HITBOX_NATIVE.session.remoteGameStart.some(key => isCallableProperty(session, key));
    const missingSession = required.filter(key => !isCallableProperty(session, key));
    if (!hasStart) missingSession.push(HITBOX_NATIVE.session.remoteGameStart.join('|'));
    missing.push(...missingSession.map(key => `session.${key}`));
    sessionState = missingSession.length ? 'partial' : 'compatible';
  }

  const renderer = readNativePath(windowObject, ['multiplayerSession', HITBOX_NATIVE.session.runtime, HITBOX_NATIVE.renderer.nested]);
  let rendererState: NativeCompatibilityReport['renderer'] = 'not-active';
  if (isNativeObject(renderer)) {
    const missingRenderer: string[] = [HITBOX_NATIVE.renderer.backing, HITBOX_NATIVE.renderer.pixi]
      .filter(key => !isNativeObject(readNativeProperty(renderer, key)));
    if (!isCallableProperty(renderer, HITBOX_NATIVE.renderer.draw) && !isCallableProperty(renderer, HITBOX_NATIVE.renderer.resize)) {
      missingRenderer.push(`${HITBOX_NATIVE.renderer.draw}|${HITBOX_NATIVE.renderer.resize}`);
    }
    missing.push(...missingRenderer.map(key => `renderer.${key}`));
    rendererState = missingRenderer.length ? 'partial' : 'compatible';
  }

  const game = readNativeProperty(windowObject, 'a8');
  const controls = readNativeProperty(game, HITBOX_NATIVE.mobile.controls);
  let mobileState: NativeCompatibilityReport['mobile'] = 'not-active';
  if (isNativeObject(controls)) {
    const missingMobile: string[] = [HITBOX_NATIVE.mobile.setInputState, HITBOX_NATIVE.mobile.show, HITBOX_NATIVE.mobile.hide]
      .filter(key => !isCallableProperty(controls, key));
    if (!HITBOX_NATIVE.mobile.slots.some(key => isNativeObject(readNativeProperty(controls, key)))) {
      missingMobile.push(HITBOX_NATIVE.mobile.slots.join('|'));
    }
    missing.push(...missingMobile.map(key => `mobile.${key}`));
    mobileState = missingMobile.length ? 'partial' : 'compatible';
  }

  return { missing, mobile: mobileState, renderer: rendererState, session: sessionState };
}
