import { isStyledElement } from '../dom/element-guards';

interface ReserveNativeStatusOptions {
  reserveWaitText: string;
  roomClosedPattern: RegExp;
  roomFullPattern: RegExp;
  wrongPasswordPattern: RegExp;
}

function getWindowLines(windowElement: Element): string[] {
  const textElement = windowElement.querySelector('.textBox') || windowElement;
  return (textElement.textContent || '').split(/\r?\n/);
}

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function setDisplayNone(element: Element): void {
  if (isStyledElement(element)) {
    element.style.display = 'none';
  }
}

export function createReserveNativeStatus(options: ReserveNativeStatusOptions) {
  function getNativeConnectingWindows(): Element[] {
    return [...document.querySelectorAll('.connectingWindowContainer:not(.qolboxReserveWindowContainer)')];
  }

  function getNativeConnectingText(): string {
    return getNativeConnectingWindows()
      .map(windowElement => windowElement.textContent || '')
      .join('\n');
  }

  function hideNativeConnectingWindows(): void {
    for (const windowElement of getNativeConnectingWindows()) {
      setDisplayNone(windowElement);
    }
  }

  function getReserveStatusLines(): string[] {
    return getNativeConnectingWindows()
      .flatMap(getWindowLines)
      .map(normalizeLine)
      .filter(line => {
        return (
          line &&
          !options.roomFullPattern.test(line) &&
          !options.roomClosedPattern.test(line) &&
          !options.wrongPasswordPattern.test(line) &&
          !/^cancel$/i.test(line) &&
          line !== options.reserveWaitText
        );
      });
  }

  function getReserveNativeMessage(pattern: RegExp): string {
    return (
      getNativeConnectingWindows()
        .flatMap(getWindowLines)
        .map(normalizeLine)
        .find(line => line && pattern.test(line)) || ''
    );
  }

  return {
    getNativeConnectingText,
    getNativeConnectingWindows,
    getReserveNativeMessage,
    getReserveStatusLines,
    hideNativeConnectingWindows,
  };
}
