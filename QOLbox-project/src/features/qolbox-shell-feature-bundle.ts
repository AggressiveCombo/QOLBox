import {
  FULLSCREEN_RENDER_CANVAS_FOCUS_SELECTOR,
  FULLSCREEN_RENDER_CANVAS_SELECTOR,
  FULLSCREEN_RENDER_LAYER_SELECTOR,
  QOLBOX_MENU_ROOT_CLASS,
} from '../config/qolbox-constants';
import { FEATURE_DEFINITIONS, type FeatureKey } from '../settings/feature-settings';
import { createFeatureRootClassController } from './feature-root-classes';
import { createGlobalStyleController } from './global-style';
import { MOBILE_GRAB_ICON_HREF } from './mobile-grab-button';

interface QolboxShellFeatureBundleOptions {
  isFeatureActive(featureKey: FeatureKey): boolean;
  isMenuClosed(): boolean;
}

export function createQolboxShellFeatureBundle(options: QolboxShellFeatureBundleOptions) {
  const { ensureGlobalStyle } = createGlobalStyleController({
    styleId: 'qolbox-style',
    fullscreenRenderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
    fullscreenRenderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
    fullscreenRenderCanvasFocusSelector: FULLSCREEN_RENDER_CANVAS_FOCUS_SELECTOR,
    mobileGrabIconHref: MOBILE_GRAB_ICON_HREF,
  });

  const { applyFeatureRootClasses } = createFeatureRootClassController({
    featureDefinitions: FEATURE_DEFINITIONS,
    isMenuClosed: options.isMenuClosed,
    isFeatureActive: options.isFeatureActive,
    menuRootClass: QOLBOX_MENU_ROOT_CLASS,
  });

  return {
    applyFeatureRootClasses,
    ensureGlobalStyle,
  };
}
