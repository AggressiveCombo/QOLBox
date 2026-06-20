interface FeatureDefinition<FeatureKey extends string = string> {
  key: FeatureKey;
}

interface FeatureRootClassOptions<FeatureKey extends string = string> {
  featureDefinitions: readonly FeatureDefinition<FeatureKey>[];
  isMenuClosed(): boolean;
  isFeatureActive(featureKey: FeatureKey): boolean;
  menuRootClass: string;
}

export function getFeatureRootClass(featureKey: string): string {
  return `qolbox-feature-${featureKey}`;
}

export function createFeatureRootClassController<FeatureKey extends string>(options: FeatureRootClassOptions<FeatureKey>) {
  function applyFeatureRootClasses(): void {
    const root = document.documentElement;
    if (!root || !root.classList) {
      return;
    }

    for (const feature of options.featureDefinitions) {
      root.classList.toggle(getFeatureRootClass(feature.key), options.isFeatureActive(feature.key));
    }

    root.classList.toggle(options.menuRootClass, !options.isMenuClosed());
  }

  return {
    applyFeatureRootClasses,
  };
}
