import type { FullscreenDimensions, FullscreenLayoutProbe } from './fullscreen-types';

export function isFullscreenRenderProbeAligned(
  probe: FullscreenLayoutProbe,
  dimensions: FullscreenDimensions
): boolean {
  if (probe.renderWidth <= 0 || probe.renderHeight <= 0) {
    return false;
  }

  return (
    Math.abs(probe.renderWidth - dimensions.width) <= 2 &&
    Math.abs(probe.renderHeight - dimensions.height) <= 2 &&
    Math.abs(probe.renderLeft - dimensions.left) <= 2 &&
    Math.abs(probe.renderTop - dimensions.top) <= 2 &&
    probe.backingWidth > 0 &&
    probe.backingHeight > 0
  );
}

export function isFullscreenNativeProbeAligned(
  probe: FullscreenLayoutProbe,
  dimensions: FullscreenDimensions
): boolean {
  if (probe.nativeWidth <= 0 || probe.nativeHeight <= 0) {
    return false;
  }

  return Math.abs(probe.nativeWidth - dimensions.width) <= 2 && Math.abs(probe.nativeHeight - dimensions.height) <= 2;
}

export function buildFullscreenProbeSignature(
  dimensions: FullscreenDimensions,
  probe: FullscreenLayoutProbe,
  hasNativeGame: boolean
): string {
  return [
    dimensions.mode,
    dimensions.viewportWidth,
    dimensions.viewportHeight,
    dimensions.width,
    dimensions.height,
    dimensions.left,
    dimensions.top,
    probe.appWidth,
    probe.appHeight,
    probe.relativeWidth,
    probe.relativeHeight,
    probe.renderWidth,
    probe.renderHeight,
    probe.renderLeft,
    probe.renderTop,
    probe.backingWidth,
    probe.backingHeight,
    probe.rendererCount,
    probe.nativeWidth,
    probe.nativeHeight,
    hasNativeGame,
  ].join(':');
}
