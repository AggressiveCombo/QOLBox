export interface FullscreenGlobalStyleOptions {
  fullscreenRenderCanvasFocusSelector: string;
  fullscreenRenderCanvasSelector: string;
  fullscreenRenderLayerSelector: string;
}

function prefixSelectorList(prefix: string, selectorList: string): string {
  return selectorList
    .split(',')
    .map(selector => `${prefix} ${selector.trim()}`)
    .join(',\n      ');
}

export function getFullscreenGlobalStyleText(options: FullscreenGlobalStyleOptions): string {
  return `
      html.qolbox-feature-fullscreen,
      html.qolbox-feature-fullscreen body {
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        overflow: hidden !important;
        background: #0a0a0a !important;
      }

      html.qolbox-feature-fullscreen #appContainer,
      html.qolbox-feature-fullscreen #relativeContainer {
        margin: 0 !important;
        max-width: none !important;
        max-height: none !important;
        border: 0 !important;
      }

      html.qolbox-feature-fullscreen #backgroundImage,
      html.qolbox-feature-fullscreen .mainMenuFancy {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        right: auto !important;
        bottom: auto !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: none !important;
        max-height: none !important;
      }

      ${prefixSelectorList('html.qolbox-feature-fullscreen', options.fullscreenRenderLayerSelector)} {
        position: absolute !important;
        margin: 0 !important;
        max-width: none !important;
        max-height: none !important;
        overflow: hidden !important;
        transform: none !important;
      }

      html.qolbox-feature-fullscreen #editorContainer {
        overflow: visible !important;
        transform-origin: top left !important;
      }

      ${prefixSelectorList('html.qolbox-feature-fullscreen', options.fullscreenRenderCanvasSelector)} {
        display: block !important;
        max-width: none !important;
        max-height: none !important;
        transform: none !important;
      }

      /* Keep game keyboard focus after chat closes without drawing a browser focus ring over the playfield. */
      ${prefixSelectorList('html.qolbox-feature-chat', options.fullscreenRenderCanvasFocusSelector)} {
        outline: 0 !important;
        outline-color: transparent !important;
        outline-style: none !important;
        outline-width: 0 !important;
      }

      html.qolbox-feature-fullscreen .scores {
        display: none !important;
      }

      html.qolbox-feature-fullscreen .spectateControls {
        bottom: 12px !important;
      }

      html.qolbox-feature-fullscreen .scores .title {
        background-color: rgb(56, 56, 56) !important;
      }

      html.qolbox-feature-fullscreen .scores .title,
      html.qolbox-feature-fullscreen .scores .entryContainer,
      html.qolbox-feature-fullscreen .scores .entryContainer .number,
      html.qolbox-feature-fullscreen .scores .entryContainer .name {
        vertical-align: middle !important;
      }
    `;
}
