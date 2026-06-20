interface FirstBootOnboardingOptions {
  isOnboardingComplete(): boolean;
  showFirstBootOnboarding(): void;
}

export function createFirstBootOnboardingScheduler(options: FirstBootOnboardingOptions) {
  function scheduleFirstBootOnboarding(): void {
    if (options.isOnboardingComplete()) {
      return;
    }

    const show = () => {
      window.setTimeout(options.showFirstBootOnboarding, 0);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show, { once: true });
    } else {
      show();
    }
  }

  return {
    scheduleFirstBootOnboarding,
  };
}
