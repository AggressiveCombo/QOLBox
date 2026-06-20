import {
  FALLBACK_BASE_HEIGHT,
  FALLBACK_BASE_WIDTH,
} from '../config/qolbox-constants';
import { findChangeControlsItem, findSettingsContainer } from '../dom/settings-menu-dom';
import {
  createMobileGrabController,
  MOBILE_GRAB_ICON_HREF,
  type MobileGrabController,
} from './mobile-grab-button';
import { createMobileQolboxMenuEntryController } from './mobile-qolbox-menu-entry';

export { MOBILE_GRAB_ICON_HREF };

interface MobileFeatureBundleOptions {
  isMobileGrabEnabled(): boolean;
  openMenu(): void;
}

export interface MobileFeatureBundle extends MobileGrabController {
  patchMobileQolboxHamburgerEntry(): boolean;
}

export function createMobileFeatureBundle(options: MobileFeatureBundleOptions): MobileFeatureBundle {
  const mobileGrabController = createMobileGrabController({
    fallbackBaseHeight: FALLBACK_BASE_HEIGHT,
    fallbackBaseWidth: FALLBACK_BASE_WIDTH,
    isEnabled: options.isMobileGrabEnabled,
  });

  const { patchMobileQolboxHamburgerEntry } = createMobileQolboxMenuEntryController({
    findChangeControlsItem,
    getSettingsContainer: findSettingsContainer,
    isMobileQolboxMenuContext: mobileGrabController.isMobileQolboxMenuContext,
    openMenu: options.openMenu,
  });

  return {
    ...mobileGrabController,
    patchMobileQolboxHamburgerEntry,
  };
}
