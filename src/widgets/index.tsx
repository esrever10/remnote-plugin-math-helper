import {
  WidgetLocation,
  declareIndexPlugin,
  ReactRNPlugin,
  AppEvents,
  useRunAsync,
  RichTextInterface,
  useSyncedStorageState,
  useLocalStorageState,
  RichTextElementInterface,
} from "@remnote/plugin-sdk";
import "../style.css";
import {
  POPUP_Y_OFFSET,
  selectNextKeyId,
  selectPrevKeyId,
  insertSelectedKeyId,
  PLAYMATH_POWERUP,
  PLAYMATH_POWERUP_ITEM,
} from "../lib/constants";

let lastFloatingWidgetId: string;

async function onActivate(plugin: ReactRNPlugin) {
  
  await plugin.app.registerWidget(
    "autocomplete_popup",
    WidgetLocation.FloatingWidget,
    {
      dimensions: { height: "auto", width: "250px" },
    }
  );

  await plugin.settings.registerStringSetting({
    id: selectNextKeyId,
    title: "Select Next Shortcut",
    defaultValue: "down",
  });

  await plugin.settings.registerStringSetting({
    id: selectPrevKeyId,
    title: "Select Previous Shortcut",
    defaultValue: "up",
  });

  await plugin.settings.registerStringSetting({
    id: insertSelectedKeyId,
    title: "Insert Selected Shortcut",
    defaultValue: "enter",
  });

  await plugin.settings.registerStringSetting({
    id: "rule_custom",
    title: "Custom rule of auto-complete. (Please check the plugin detail to see how to custom.)",
    defaultValue: "",
    multiline: true,
  });

  var lastCaret = {x: 500} as DOMRect;

  const openAutocompleteWindow = async () => {
    const caret = await plugin.editor.getCaretPosition();
    lastFloatingWidgetId = await plugin.window.openFloatingWidget(
      "autocomplete_popup",
      { top: caret ? caret.y + POPUP_Y_OFFSET : lastCaret.y, left: caret ? caret.x : lastCaret.x }
    );
    if (caret) {
      lastCaret = caret;
    }
  };

  await openAutocompleteWindow();

  // Whenever the user edits text we check if there is already an open
  // autocomplete floating widget. If there is no current autocomplete widget
  // then open one.

  plugin.event.addListener(AppEvents.EditorTextEdited, undefined, async (newText: RichTextInterface) => {
  
    console.log(`newText: ${newText}`);
    const rem = await plugin.focus.getFocusedRem();
    if (rem) {
      const parent = await rem?.getParentRem();
      const isPlayMath = await parent?.hasPowerup(PLAYMATH_POWERUP);
      if (isPlayMath) {
        const isPlayMathItem = await rem?.hasPowerup(PLAYMATH_POWERUP_ITEM);
        if (!isPlayMathItem) {
          await rem?.addPowerup(PLAYMATH_POWERUP_ITEM);
        }
        if (rem.text[0]?.i !== 'm') {
          await rem?.setText([
            {
              text: newText.toString(),
              i: "m",
              code: true,
            },
          ]);
        }
      }
    }
    
    if (
      lastFloatingWidgetId &&
      (await plugin.window.isFloatingWidgetOpen(lastFloatingWidgetId))
    ) {
      return;
    }
    await openAutocompleteWindow();
  });

  await plugin.app.registerPowerup(
    "Play Math",
    PLAYMATH_POWERUP,
    "A play math plugin",
    {
      slots: [{ 
        code: 'scope',
        name: 'Scppe',
        onlyProgrammaticModifying: true,
        hidden: true,
      }],
    }
  );

  await plugin.app.registerPowerup(
    "MathItem",
    PLAYMATH_POWERUP_ITEM,
    "",
    {
      slots: [{ code: "scope", name: "Scope" }],
    }
  );
  
  await plugin.app.registerWidget(
    "play_math",
    WidgetLocation.UnderRemEditor,
    {
      dimensions: { height: "auto", width: "100%" },
      powerupFilter: PLAYMATH_POWERUP_ITEM,
    }
  );
  
  await plugin.app.registerCommand({
    id: "command_play_math",
    name: "playmath",
    action: async () => {
      const rem = await plugin.focus.getFocusedRem();
      await rem?.addPowerup(PLAYMATH_POWERUP);
      const defaultText = `Play Math`;
      await rem?.setText([defaultText]);
      await plugin.editor.moveCaret(defaultText.length, 2)
    },
  });

}


async function onDeactivate(plugin: ReactRNPlugin) {
  const keys = [
    await plugin.settings.getSetting(selectNextKeyId),
    await plugin.settings.getSetting(selectPrevKeyId),
    await plugin.settings.getSetting(insertSelectedKeyId)
  ] as string[];
  await plugin.window.releaseKeys(lastFloatingWidgetId, keys);
}

declareIndexPlugin(onActivate, onDeactivate);
