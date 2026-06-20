export interface CanvasBackingSize {
  height: number;
  width: number;
}

export interface DatasetLike {
  [key: string]: string | undefined;
}

export interface DatasetElement extends Element {
  dataset: DatasetLike;
}

export interface FocusableElement extends Element {
  focus(options?: FocusOptions): void;
}

export interface StyleDeclarationLike {
  getPropertyPriority(property: string): string;
  getPropertyValue(property: string): string;
  backgroundColor?: string;
  display?: string;
  height?: string;
  pointerEvents?: string;
  removeProperty(property: string): string;
  setProperty(property: string, value: string, priority?: string): void;
  width?: string;
}

export interface StyledElement extends Element {
  style: StyleDeclarationLike;
}

export interface TabbableElement extends Element {
  tabIndex: number;
}

function isObjectLike(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function isHtmlElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement === 'function' && value instanceof HTMLElement;
}

export function isSvgElement(value: unknown): value is SVGElement {
  return typeof SVGElement === 'function' && value instanceof SVGElement;
}

export function hasDataset(value: unknown): value is DatasetElement {
  return (
    value instanceof Element &&
    'dataset' in value &&
    isObjectLike(value.dataset)
  );
}

export function isFocusableElement(value: unknown): value is FocusableElement {
  return (
    value instanceof Element &&
    'focus' in value &&
    typeof value.focus === 'function'
  );
}

export function isStyleDeclaration(value: unknown): value is StyleDeclarationLike {
  return (
    isObjectLike(value) &&
    'getPropertyPriority' in value &&
    typeof value.getPropertyPriority === 'function' &&
    'getPropertyValue' in value &&
    typeof value.getPropertyValue === 'function' &&
    'removeProperty' in value &&
    typeof value.removeProperty === 'function' &&
    'setProperty' in value &&
    typeof value.setProperty === 'function'
  );
}

export function isStyledElement(value: unknown): value is StyledElement {
  return (
    value instanceof Element &&
    'style' in value &&
    isStyleDeclaration(value.style)
  );
}

export function isTabbableElement(value: unknown): value is TabbableElement {
  return (
    value instanceof Element &&
    'tabIndex' in value &&
    typeof value.tabIndex === 'number'
  );
}

export function getCanvasBackingSize(value: unknown): CanvasBackingSize | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('width' in value) ||
    !('height' in value) ||
    typeof value.width !== 'number' ||
    typeof value.height !== 'number'
  ) {
    return null;
  }

  return {
    width: value.width,
    height: value.height,
  };
}
