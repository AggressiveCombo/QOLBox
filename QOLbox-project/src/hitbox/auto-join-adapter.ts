import { isNativeObject, readNativeProperty } from './native-access';

function getNativeAutoJoin(): unknown {
  return readNativeProperty(window, 'autoJoin');
}

export function isNativeAutoJoinMatch(joinId: unknown, password: unknown): boolean {
  const autoJoin = getNativeAutoJoin();
  if (!isNativeObject(autoJoin)) {
    return false;
  }

  // Direct-link auto-join metadata stores the target room address and password bypass here.
  return (
    joinId === readNativeProperty(autoJoin, 'address') &&
    password === readNativeProperty(autoJoin, 'passbypass')
  );
}

export function isNativeAutoJoinOnePersonRoom(): boolean {
  const autoJoin = getNativeAutoJoin();
  if (!isNativeObject(autoJoin)) {
    return false;
  }

  // Current direct-link metadata may omit max players, so missing values stay unknown.
  const maxPlayers = Number(
    readNativeProperty(autoJoin, 'maxPlayers') ||
      readNativeProperty(autoJoin, 'maxplayers') ||
      readNativeProperty(autoJoin, 'max')
  );
  return Number.isFinite(maxPlayers) && maxPlayers === 1;
}
