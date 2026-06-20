import { isElementVisible } from '../dom/dom-helpers';

interface MobileGrabLayoutOptions {
  fallbackBaseHeight: number;
  fallbackBaseWidth: number;
  getAbilityButtons(): Element[];
}

interface CssScale {
  height: number;
  width: number;
  x: number;
  y: number;
}

function getCssScale(element: Element, options: MobileGrabLayoutOptions): CssScale {
  const rect = element.getBoundingClientRect();
  const cssWidth = element.clientWidth || Number.parseFloat(window.getComputedStyle(element).width) || rect.width;
  const cssHeight = element.clientHeight || Number.parseFloat(window.getComputedStyle(element).height) || rect.height;

  return {
    x: cssWidth > 0 && rect.width > 0 ? rect.width / cssWidth : 1,
    y: cssHeight > 0 && rect.height > 0 ? rect.height / cssHeight : 1,
    width: cssWidth || options.fallbackBaseWidth,
    height: cssHeight || options.fallbackBaseHeight,
  };
}

function getMobileAbilityGapCss(buttons: readonly Element[], scaleY: number): number {
  const rects = buttons
    .map(button => button.getBoundingClientRect())
    .filter(rect => rect.width > 0 && rect.height > 0)
    .sort((left, right) => left.top - right.top);

  let gap = Infinity;
  for (let index = 1; index < rects.length; index += 1) {
    const currentGap = rects[index].top - rects[index - 1].bottom;
    if (currentGap > 0) {
      gap = Math.min(gap, currentGap);
    }
  }

  return Number.isFinite(gap) ? Math.round(gap / Math.max(0.01, scaleY)) : 10;
}

export function positionMobileGrabButton(button: HTMLElement, options: MobileGrabLayoutOptions): void {
  const container = document.getElementById('relativeContainer');
  const abilityButtons = options.getAbilityButtons();
  const referenceButton = document.querySelector('.buttonArea.bat') || abilityButtons[0];
  if (!container || !referenceButton || !isElementVisible(referenceButton)) {
    button.style.left = 'auto';
    button.style.top = 'auto';
    button.style.right = '40px';
    button.style.bottom = '0px';
    button.style.width = '90px';
    button.style.height = '90px';
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const referenceRect = referenceButton.getBoundingClientRect();
  const scale = getCssScale(container, options);
  const gap = getMobileAbilityGapCss(abilityButtons, scale.y);
  const width = Math.round(referenceRect.width / Math.max(0.01, scale.x)) || 90;
  const height = Math.round(referenceRect.height / Math.max(0.01, scale.y)) || 90;
  const desiredLeft = (referenceRect.left - containerRect.left) / Math.max(0.01, scale.x) - width - gap;
  const desiredTop = (referenceRect.top - containerRect.top) / Math.max(0.01, scale.y);
  const containerRight = Number.isFinite(containerRect.right) ? containerRect.right : containerRect.left + containerRect.width;
  const containerBottom = Number.isFinite(containerRect.bottom) ? containerRect.bottom : containerRect.top + containerRect.height;
  const viewportWidth = window.innerWidth || containerRight;
  const viewportHeight = window.innerHeight || containerBottom;
  const visibleLeft = Math.max(0, containerRect.left);
  const visibleTop = Math.max(0, containerRect.top);
  const visibleRight = Math.min(viewportWidth, containerRight);
  const visibleBottom = Math.min(viewportHeight, containerBottom);
  const minLeft = Math.max(0, Math.round((visibleLeft - containerRect.left) / Math.max(0.01, scale.x)));
  const minTop = Math.max(0, Math.round((visibleTop - containerRect.top) / Math.max(0.01, scale.y)));
  const maxLeft = Math.max(
    minLeft,
    Math.min(scale.width - width, Math.round((visibleRight - containerRect.left) / Math.max(0.01, scale.x) - width))
  );
  const maxTop = Math.max(
    minTop,
    Math.min(scale.height - height, Math.round((visibleBottom - containerRect.top) / Math.max(0.01, scale.y) - height))
  );
  const left = Math.max(minLeft, Math.min(maxLeft, Math.round(desiredLeft)));
  const top = Math.max(minTop, Math.min(maxTop, Math.round(desiredTop)));

  button.style.width = `${width}px`;
  button.style.height = `${height}px`;
  button.style.left = `${left}px`;
  button.style.top = `${top}px`;
  button.style.right = 'auto';
  button.style.bottom = 'auto';
}
