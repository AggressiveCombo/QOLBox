import type { FullscreenDimensions, FullscreenLayoutProbe } from './fullscreen-types';

export function isFullscreenRenderProbeAligned(
  probe: FullscreenLayoutProbe,
  dimensions: FullscreenDimensions
): boolean {
  if (probe.renderWidth <= 0 || probe.renderHeight <= 0) {
    return false;
  }

  const rawPixelRatio = Number(window.devicePixelRatio);
  const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;
  const backingAligned =
    Math.abs(probe.backingWidth - Math.round(dimensions.width * pixelRatio)) <= 2 &&
    Math.abs(probe.backingHeight - Math.round(dimensions.height * pixelRatio)) <= 2;
  const expectedResolution = pixelRatio * dimensions.width / dimensions.baseWidth;
  const rendererAligned =
    dimensions.baseWidth > 0 &&
    probe.rendererLogicalHeight > 0 &&
    Math.abs(probe.rendererLogicalWidth - dimensions.baseWidth) <= 1 &&
    Math.abs(probe.rendererLogicalHeight - dimensions.baseHeight) <= 1 &&
    Math.abs(probe.rendererResolution - expectedResolution) <= 0.01;

  return (
    Math.abs(probe.renderWidth - dimensions.width) <= 2 &&
    Math.abs(probe.renderHeight - dimensions.height) <= 2 &&
    Math.abs(probe.renderLeft - dimensions.left) <= 2 &&
    Math.abs(probe.renderTop - dimensions.top) <= 2 &&
    backingAligned &&
    rendererAligned
  );
}
