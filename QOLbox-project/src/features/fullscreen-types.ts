export interface FullscreenViewportSize {
  height: number;
  width: number;
}

export interface FullscreenBaseSize {
  height: number;
  width: number;
}

export interface FullscreenInsets {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface FullscreenDimensions {
  baseHeight: number;
  baseWidth: number;
  height: number;
  insets: FullscreenInsets;
  left: number;
  mode: string;
  scale: number;
  shellHeight: number;
  shellLeft: number;
  shellTop: number;
  shellWidth: number;
  top: number;
  viewportHeight: number;
  viewportWidth: number;
  width: number;
}

export interface FullscreenLayoutProbe {
  appHeight: number;
  appWidth: number;
  backingHeight: number;
  backingWidth: number;
  nativeHeight: number;
  nativeWidth: number;
  relativeHeight: number;
  relativeWidth: number;
  renderHeight: number;
  renderLeft: number;
  renderTop: number;
  renderWidth: number;
  rendererCount: number;
}
