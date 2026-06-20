export interface MobileGrabGlobalStyleOptions {
  mobileGrabIconHref: string;
}

export function getMobileGrabGlobalStyleText(options: MobileGrabGlobalStyleOptions): string {
  return `
      .buttonArea.qolboxMobileGrabButton {
        background-image: url("${options.mobileGrabIconHref}") !important;
        background-position: center center !important;
        background-repeat: no-repeat !important;
        background-size: 68% !important;
        box-sizing: border-box !important;
        display: none;
        transform: none !important;
        z-index: 12;
      }
    `;
}
