export function isModifiedQolboxMenuShortcut(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

export function isQolboxMenuShortcut(event: KeyboardEvent, menuKey: string): boolean {
  return !isModifiedQolboxMenuShortcut(event) && (event.key === menuKey || event.code === menuKey);
}
