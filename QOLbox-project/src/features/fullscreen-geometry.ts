import {
  buildFullscreenProbeSignature,
  isFullscreenNativeProbeAligned,
  isFullscreenRenderProbeAligned,
} from './fullscreen-probe-alignment';
import type {
  FullscreenBaseSize,
  FullscreenDimensions,
  FullscreenInsets,
  FullscreenLayoutProbe,
  FullscreenViewportSize,
} from './fullscreen-types';

const MENU_FRAME_PADDING_PX = 0;
const GAMEPLAY_SAFE_TOP_PX = 0;
const GAMEPLAY_SAFE_BOTTOM_PX = 0;
const GAMEPLAY_SAFE_SIDE_PX = 0;

interface FullscreenGeometryOptions {
  getActiveRenderMode(): string;
  getBaseGameSize(): FullscreenBaseSize;
  getViewportSize(): FullscreenViewportSize;
  hasNativeGame(): boolean;
}

export function createFullscreenGeometry(options: FullscreenGeometryOptions) {
  function getModeInsets(mode: string): FullscreenInsets {
    if (mode === 'gameplay' || mode === 'editor') {
      return {
        left: GAMEPLAY_SAFE_SIDE_PX,
        right: GAMEPLAY_SAFE_SIDE_PX,
        top: GAMEPLAY_SAFE_TOP_PX,
        bottom: GAMEPLAY_SAFE_BOTTOM_PX,
      };
    }

    return {
      left: MENU_FRAME_PADDING_PX,
      right: MENU_FRAME_PADDING_PX,
      top: MENU_FRAME_PADDING_PX,
      bottom: MENU_FRAME_PADDING_PX,
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
      shellLeft: 0,
      shellTop: 0,
      shellWidth: viewport.width,
      shellHeight: viewport.height,
      insets,
      mode,
    };
  }

  function getNativeUiZoom(dimensions: FullscreenDimensions = getFullscreenDimensions()): number {
    return Math.min(1, dimensions.width / 1400);
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

  function isNativeProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean {
    return isFullscreenNativeProbeAligned(probe, dimensions);
  }

  function buildFullscreenSignature(dimensions: FullscreenDimensions, probe: FullscreenLayoutProbe): string {
    return buildFullscreenProbeSignature(dimensions, probe, options.hasNativeGame());
  }

  return {
    buildFullscreenSignature,
    getFullscreenDimensions,
    getModeInsets,
    getNativeUiZoom,
    getRelativeContainerBounds,
    isNativeProbeAligned,
    isRenderProbeAligned,
  };
}
