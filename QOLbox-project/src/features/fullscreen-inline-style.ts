import { isStyledElement, type StyleDeclarationLike } from '../dom/element-guards';

export function getFullscreenInlineStyle(element: Element): StyleDeclarationLike | null {
  if (isStyledElement(element)) {
    return element.style;
  }

  return null;
}

export function removeFullscreenInlineProperties(element: Element, properties: readonly string[]): void {
  const style = getFullscreenInlineStyle(element);
  if (!style) {
    return;
  }

  for (const property of properties) {
    style.removeProperty(property);
  }
}

export function getFullscreenInlineStyleProperty(element: Element, property: string): string {
  return getFullscreenInlineStyle(element)?.getPropertyValue(property) ?? '';
}
