import { readObjectProperty } from '../utils/object-properties';

function readTextProperty(source: unknown, property: PropertyKey): string | undefined {
  const value = readObjectProperty(source, property);
  return typeof value === 'string' ? value : undefined;
}

export function isEscapeKey(event: unknown): boolean {
  const key = readTextProperty(event, 'key');
  const code = readTextProperty(event, 'code');
  return key === 'Escape' || key === 'Esc' || code === 'Escape';
}

export function isTabKey(event: unknown): boolean {
  const key = readTextProperty(event, 'key');
  const code = readTextProperty(event, 'code');
  return key === 'Tab' || code === 'Tab';
}

export function isEnterKey(event: unknown): boolean {
  return readTextProperty(event, 'key') === 'Enter';
}

export function isArrowLeftKey(event: unknown): boolean {
  return readTextProperty(event, 'key') === 'ArrowLeft' || readTextProperty(event, 'code') === 'ArrowLeft';
}

export function isArrowRightKey(event: unknown): boolean {
  return readTextProperty(event, 'key') === 'ArrowRight' || readTextProperty(event, 'code') === 'ArrowRight';
}
