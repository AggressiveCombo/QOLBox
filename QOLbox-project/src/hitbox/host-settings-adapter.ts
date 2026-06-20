import { callNativeMethod, isNativeObject, readNativePath, readNativeProperty } from './native-access';

// These fields are accepted and transmitted by vanilla `/set`, but omitted from vanilla `/settings`.
const EXTRA_HOST_SETTINGS: readonly (readonly [name: string, field: string])[] = [
  ['bbPower', 'it'],
  ['bbRange', 'st'],
  ['bbAngleVariance', 'ht'],
  ['bbFireOn', 'nt'],
  ['bbFireFramesLength', 'at'],
  ['bbHideAfterFireFrames', 'lt'],
  ['bbResetOn', 'ut'],
  ['bbInitAmmoCost', 'ot'],
  ['bbHoldAmmoCost', 'rt'],
  ['egEnabled', 'Ot'],
  ['egSize', 'Rt'],
  ['egAge', 'Dt'],
  ['egGravityScale', 'Lt'],
  ['egRestitution', 'Ut'],
  ['egExplodeRadius', 'jt'],
  ['egStartSpin', 'Wt'],
  ['egMaxThrowPower', 'Jt'],
  ['egAmmoNeeded', 'Gt'],
  ['egDelay1', 'Ht'],
  ['egDelay2', 'zt'],
  ['egDelayBeforeAmmoUse', 'Yt'],
  ['egAimRate', 'qt'],
  ['egShape', 'Vt'],
];

function getHostSettingsObject(session: unknown): unknown {
  return (
    readNativePath(session, ['JD', '$L']) ||
    readNativePath(session, ['KR', 'uL', 'settings', 0]) ||
    readNativePath(session, ['TJ', 'JD', 'tP', 0, 'state', 'settings', 0]) ||
    readNativePath(session, ['JD', 'tP', 0, 'state', 'settings', 0]) ||
    null
  );
}

export function readAllHostSettingLines(session: unknown): string[] | null {
  const settings = getHostSettingsObject(session);
  if (!isNativeObject(settings)) {
    return null;
  }

  const nativeResult = callNativeMethod(settings, 'pi');
  if (!nativeResult.called || !Array.isArray(nativeResult.result) || !nativeResult.result.every(line => typeof line === 'string')) {
    return null;
  }

  const lines = nativeResult.result.slice();
  if (lines[lines.length - 1] === '===') {
    lines.pop();
  }

  for (const [name, field] of EXTRA_HOST_SETTINGS) {
    const value = readNativeProperty(settings, field);
    if (value !== undefined) {
      lines.push(`${name}: ${String(value)}`);
    }
  }

  lines.push('===');
  return lines;
}
