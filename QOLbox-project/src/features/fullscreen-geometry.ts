import {
  isFullscreenRenderProbeAligned,
} from './fullscreen-probe-alignment';
import type {
  FullscreenBaseSize,
  FullscreenDimensions,
  FullscreenInsets,
  FullscreenLayoutProbe,
  FullscreenViewportSize,
} from './fullscreen-types';

interface FullscreenGeometryOptions {
  getActiveRenderMode(): string;
  getBaseGameSize(): FullscreenBaseSize;
  getViewportSize(): FullscreenViewportSize;
}

export function createFullscreenGeometry(options: FullscreenGeometryOptions) {
  function getModeInsets(_mode: string): FullscreenInsets {
    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    };
  }

  function getFullscreenDimensions(
    viewport: FullscreenViewportSize = options.getViewportSize(),
    mode: string = options.getActiveRenderMode()
  ): FullscreenDimensions {
    const base = options.getBaseGameSize();
    const insets = getModeInsets(mode);
    const availableWidth = Math.max(1, viewport.width - insets.left - insets.right);
    const availableHeight = Math.max(1, viewport.height - insets.top - insets.bottom);
    const scale = Math.max(0.01, Math.min(availableWidth / base.width, availableHeight / base.height));
    const width = Math.max(1, Math.round(base.width * scale));
    const height = Math.max(1, Math.round(base.height * scale));
    const left = insets.left + Math.max(0, Math.floor((availableWidth - width) / 2));
    const top = insets.top + Math.max(0, Math.floor((availableHeight - height) / 2));

    return {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      baseWidth: base.width,
      baseHeight: base.height,
      width,
      height,
      scale,
      left,
      top,
      insets,
      mode,
    };
  }

  function getRelativeContainerBounds(dimensions: FullscreenDimensions = getFullscreenDimensions()) {
    return {
      left: dimensions.left,
      top: dimensions.top,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  function isRenderProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean {
    return isFullscreenRenderProbeAligned(probe, dimensions);
  }

  return {
    getFullscreenDimensions,
    getModeInsets,
    getRelativeContainerBounds,
    isRenderProbeAligned,
  };
}
