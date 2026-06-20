import {
  CHAT_INPUT_SELECTOR,
  DESKTOP_LOBBY_CHAT_PROMPT,
  FULLSCREEN_RENDER_CANVAS_SELECTOR,
  FULLSCREEN_RENDER_LAYER_SELECTOR,
  GAMEPLAY_FOCUS_EXCLUSION_SELECTOR,
  TOUCH_LOBBY_CHAT_PROMPT,
} from '../config/qolbox-constants';
import { focusElementWithoutScroll } from '../dom/dom-helpers';
import { isNativeTouchLobbyChatPrompt } from '../hitbox/mobile-controls-adapter';
import { createChatInputController } from './chat-input-controls';
import { createGameplayBackgroundFocusController } from './gameplay-background-focus';
import { createRenderCanvasFocusController } from './render-canvas-focus';
import { expandNativeChatAlias } from './slash-command-interceptor';

interface InputFocusFeatureBundleOptions {
  areLobbyCommandsEnabled(): boolean;
  getActiveRenderCanvas(): Element | null;
  isChatFeatureEnabled(): boolean;
  isPlayingMatch(): boolean;
  isQolboxMenuClosed(): boolean;
}

export function createInputFocusFeatureBundle(options: InputFocusFeatureBundleOptions) {
  const { focusActiveRenderCanvas, resetBrowserScroll } = createRenderCanvasFocusController({
    focusElementWithoutScroll,
    getActiveRenderCanvas: options.getActiveRenderCanvas,
  });

  const chatInput = createChatInputController({
    chatInputSelector: CHAT_INPUT_SELECTOR,
    lobbyChatInputSelector: '.lobbyContainer .chatBox .input',
    desktopLobbyChatPrompt: DESKTOP_LOBBY_CHAT_PROMPT,
    touchLobbyChatPrompt: TOUCH_LOBBY_CHAT_PROMPT,
    isChatFeatureEnabled: options.isChatFeatureEnabled,
    areLobbyCommandsEnabled: options.areLobbyCommandsEnabled,
    isTouchLobbyChatPrompt: isNativeTouchLobbyChatPrompt,
    focusActiveRenderCanvas,
    expandNativeChatAlias,
  });

  const gameplayBackgroundFocus = createGameplayBackgroundFocusController({
    exclusionSelector: GAMEPLAY_FOCUS_EXCLUSION_SELECTOR,
    renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
    renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
    getActiveChatInput: chatInput.getActiveChatInput,
    getActiveRenderCanvas: options.getActiveRenderCanvas,
    isPlayingMatch: options.isPlayingMatch,
    isQolboxMenuClosed: options.isQolboxMenuClosed,
  });

  return {
    ...chatInput,
    ...gameplayBackgroundFocus,
    focusActiveRenderCanvas,
    resetBrowserScroll,
  };
}
