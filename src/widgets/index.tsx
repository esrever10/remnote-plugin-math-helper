import {
  WidgetLocation,
  declareIndexPlugin,
  ReactRNPlugin,
  AppEvents,
  RichTextInterface,
} from '@remnote/plugin-sdk';

import '../style.css';
import '../App.css';
import {
  POPUP_Y_OFFSET,
  selectNextKeyId,
  selectPrevKeyId,
  insertSelectedKeyId,
  POPUP_X_OFFSET,
} from '../lib/constants';
import { Logger } from './logger';

let lastFloatingWidgetId: string;

async function onActivate(plugin: ReactRNPlugin) {
  plugin.app.registerCSS('latex', `.latex-node { padding: 0 6px; }`);

  await plugin.app.registerWidget('autocomplete_popup', WidgetLocation.FloatingWidget, {
    dimensions: { height: 'auto', width: '250px' },
  });

  await plugin.settings.registerStringSetting({
    id: selectNextKeyId,
    title: 'Select Next Shortcut',
    defaultValue: 'down',
  });

  await plugin.settings.registerStringSetting({
    id: selectPrevKeyId,
    title: 'Select Previous Shortcut',
    defaultValue: 'up',
  });

  await plugin.settings.registerStringSetting({
    id: insertSelectedKeyId,
    title: 'Insert Selected Shortcut',
    defaultValue: 'enter',
  });

  await plugin.settings.registerStringSetting({
    id: 'rule_custom',
    title: 'Custom rule of auto-complete. (Please check the plugin detail to see how to custom.)',
    defaultValue: '',
    multiline: true,
  });

  var lastCaret = { x: 500, y: 0 } as DOMRect;

  const openAutocompleteWindow = async () => {
    const caret: DOMRect | undefined = await plugin.editor.getCaretPosition();
    Logger.debug(`caret: ${caret?.x}, ${caret?.y}`);
    Logger.debug(`lastCaret: ${lastCaret.x}, ${lastCaret.y}`);

    lastFloatingWidgetId = await plugin.window.openFloatingWidget('autocomplete_popup', {
      top: caret ? caret.y + POPUP_Y_OFFSET : lastCaret.y,
      left: caret ? caret.x - POPUP_X_OFFSET : lastCaret.x,
    });
    if (caret) {
      lastCaret = caret;
    }
  };

  await openAutocompleteWindow();

  // Whenever the user edits text we check if there is already an open
  // autocomplete floating widget. If there is no current autocomplete widget
  // then open one.

  plugin.event.addListener(AppEvents.EditorTextEdited, undefined, async (_: RichTextInterface) => {
    const isFloatWigetOpen = await plugin.window.isFloatingWidgetOpen(lastFloatingWidgetId);
    Logger.debug(
      `lastFloatingWidgetId, isFloatWigetOpen: ${lastFloatingWidgetId}, ${isFloatWigetOpen}`
    );
    if (lastFloatingWidgetId && isFloatWigetOpen) {
      return;
    }
    await openAutocompleteWindow();
  });
}

async function onDeactivate(plugin: ReactRNPlugin) {
  const keys = [
    await plugin.settings.getSetting(selectNextKeyId),
    await plugin.settings.getSetting(selectPrevKeyId),
    await plugin.settings.getSetting(insertSelectedKeyId),
  ] as string[];
  await plugin.window.releaseKeys(lastFloatingWidgetId, keys);
}

declareIndexPlugin(onActivate, onDeactivate);
