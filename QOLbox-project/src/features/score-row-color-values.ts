import { isStyledElement } from '../dom/element-guards';

export interface RgbColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export function parseCssRgbColor(value: unknown): RgbColor | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i
  );
  if (!match) {
    return null;
  }

  return {
    red: Math.max(0, Math.min(255, Math.round(Number(match[1])))),
    green: Math.max(0, Math.min(255, Math.round(Number(match[2])))),
    blue: Math.max(0, Math.min(255, Math.round(Number(match[3])))),
    alpha: match[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(match[4]))),
  };
}

function parseNumericRgbColor(value: unknown): RgbColor | null {
  const color = Number(value);
  if (!Number.isFinite(color) || color < 0 || color > 0xffffff) {
    return null;
  }

  return {
    red: (color >> 16) & 255,
    green: (color >> 8) & 255,
    blue: color & 255,
    alpha: 1,
  };
}

function parseHexRgbColor(value: unknown): RgbColor | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^#|^0x/i, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }

  return parseNumericRgbColor(Number.parseInt(normalized, 16));
}

export function parsePlayerRgbColor(value: unknown): RgbColor | null {
  return typeof value === 'number'
    ? parseNumericRgbColor(value)
    : parseCssRgbColor(value) || parseHexRgbColor(value);
}

export function colorsMatch(left: RgbColor | null, right: RgbColor | null): boolean {
  return Boolean(
    left && right && left.red === right.red && left.green === right.green && left.blue === right.blue
  );
}

export function getElementBackgroundColor(element: Element): string {
  return isStyledElement(element) && typeof element.style.backgroundColor === 'string'
    ? element.style.backgroundColor
    : '';
}

export function blendRgbColors(foreground: RgbColor, background: RgbColor): RgbColor {
  const alpha = foreground.alpha;
  return {
    red: Math.round(foreground.red * alpha + background.red * (1 - alpha)),
    green: Math.round(foreground.green * alpha + background.green * (1 - alpha)),
    blue: Math.round(foreground.blue * alpha + background.blue * (1 - alpha)),
    alpha: 1,
  };
}

function getRelativeLuminance(color: RgbColor): number {
  const channels = [color.red, color.green, color.blue].map(value => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export function getContrastRatio(left: RgbColor, right: RgbColor): number {
  const leftLuminance = getRelativeLuminance(left);
  const rightLuminance = getRelativeLuminance(right);
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getEffectiveBackgroundColor(element: Element): RgbColor {
  let current: Element | null = element;
  let color: RgbColor = { red: 10, green: 10, blue: 10, alpha: 1 };
  const layers: RgbColor[] = [];

  while (current) {
    const background = parseCssRgbColor(window.getComputedStyle(current).backgroundColor);
    if (background && background.alpha > 0) {
      layers.unshift(background);
      if (background.alpha >= 1) {
        break;
      }
    }
    current = current.parentElement;
  }

  for (const layer of layers) {
    color = layer.alpha >= 1 ? { ...layer, alpha: 1 } : blendRgbColors(layer, color);
  }

  return color;
}

export function getReadableTextColor(background: RgbColor): RgbColor {
  const dark = { red: 0, green: 0, blue: 0, alpha: 1 };
  const light = { red: 255, green: 255, blue: 255, alpha: 1 };
  return getContrastRatio(dark, background) >= getContrastRatio(light, background) ? dark : light;
}

export function toCssRgb(color: RgbColor): string {
  return `rgb(${color.red}, ${color.green}, ${color.blue})`;
}
