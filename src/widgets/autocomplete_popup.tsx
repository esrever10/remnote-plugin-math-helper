import {
  renderWidget,
  usePlugin,
  AppEvents,
  RichTextInterface,
  useAPIEventListener,
  useRunAsync,
  useTracker,
  WidgetLocation,
  SelectionType,
  RichTextLatexInterface,
  RichText,
  RemViewer,
} from "@remnote/plugin-sdk";
import * as R from "react";
import clsx from "clsx";
import {
  selectNextKeyId,
  selectPrevKeyId,
  insertSelectedKeyId,
} from "../lib/constants";
import * as Re from "remeda";
import { useSyncWidgetPositionWithCaret } from "../lib/hooks";
import { symbolRules } from "../lib/rules";
import { log } from "../lib/logging";

function AutocompletePopup() {
  const plugin = usePlugin();
  const ctx = useRunAsync(
    async () => await plugin.widget.getWidgetContext<WidgetLocation.FloatingWidget>(),
    []
  );

  const [hidden, setHidden] = R.useState(true);
  const floatingWidgetId = ctx?.floatingWidgetId;

  useSyncWidgetPositionWithCaret(floatingWidgetId, hidden);

  // Reactively get hotkey strings - if the user updates these in
  // the settings this component will re-render with the latest
  // values without requiring the user to refresh / reload.

  const selectNextKey = useTracker(
    async (reactivePlugin) =>
      await reactivePlugin.settings.getSetting(selectNextKeyId)
  ) as string;
  const selectPrevKey = useTracker(
    async (reactivePlugin) =>
      await reactivePlugin.settings.getSetting(selectPrevKeyId)
  ) as string;
  const insertSelectedKey = useTracker(
    async (reactivePlugin) =>
      await reactivePlugin.settings.getSetting(insertSelectedKeyId)
  ) as string;

  // Steal autocomplete navigation and insertion keys from the editor
  // while the floating autocomplete window is open.

  R.useEffect(() => {
    const keys = [selectNextKey, selectPrevKey, insertSelectedKey];
    if (!floatingWidgetId) {
      return;
    }
    if (!hidden) {
      plugin.window.stealKeys(floatingWidgetId, keys);
    } else {
      plugin.window.releaseKeys(floatingWidgetId, keys);
    }
  }, [hidden]);

  useAPIEventListener(AppEvents.StealKeyEvent, floatingWidgetId, ({ key }) => {
    if (key === selectNextKey) {
      selectAdjacentWord("down");
    } else if (key === selectPrevKey) {
      selectAdjacentWord("up");
    } else if (key === insertSelectedKey) {
      insertSelectedWord();
    }
  });


  // The last partial word is the current part of a word before the
  // caret that the user has not yet finished typing. We use the
  // lastPartialWord to filter down the autocomplete suggestions to
  // show in the popup window.

  const [lastPartialWord, setLastPartialWord] = R.useState<string>();
  const [autocompleteSuggestions, setAutocompleteSuggestions] = R.useState<
    string[]
  >([]);

  R.useEffect(() => {
    const effect = async () => {
      if (!lastPartialWord || lastPartialWord.length === 0) {
        return;
      }
      const matchingWords = Re.pipe(
        Object.keys(symbolRules),
        Re.filter((o) => {
          return (
            o != null &&
            o.length >= 2 &&
            o.startsWith(lastPartialWord.toLowerCase())
          );
        }),
        Re.uniq(),
        Re.sortBy((x) => x.length)
      );
      setAutocompleteSuggestions(matchingWords);
    };
    effect();
  }, [lastPartialWord]);

  R.useEffect(() => {
    if (lastPartialWord && autocompleteSuggestions.length > 0) {
      setHidden(false);
    } else {
      setHidden(true);
    }
  }, [lastPartialWord, autocompleteSuggestions]);

  useAPIEventListener(
    AppEvents.EditorTextEdited,
    undefined,
    async (newText: RichTextInterface) => {
      if (newText.length >= 2 && newText.at(-1) === ' ' && newText.at(-2)?.i === 'x') {
        const lpw = (newText.at(-2) as RichTextLatexInterface).text?.match(/[\\|\{}](\w+)$/)?.[0];
        setLastPartialWord(lpw);
      }
    });
  

  const [selectedIdx, setSelectedIdx] = R.useState(0);

  R.useEffect(() => {
    if (!hidden) {
      setSelectedIdx(0);
    }
  }, [lastPartialWord]);

  return (
    <div className={clsx("p-[3px] rounded-lg", hidden && "hidden")}>
      <div
        className={clsx(
          "flex flex-col content-start gap-[0.5] w-full box-border p-2",
          "rounded-lg rn-clr-background-primary rn-clr-content-primary shadow-md border border-gray-100",
        )}
      >
        {autocompleteSuggestions.map((word, idx) => (
          <div className="flex flex-row">
            <div
              key={word}
              className={clsx(
                "grow rounded-md p-2 truncate",
                idx === selectedIdx && "rn-clr-background--hovered"
              )}
              onMouseEnter={() => setSelectedIdx(idx)}
              onClick={() => insertWord(idx)}
            >
              {word}
            </div>
            <div className="flex grow items-center">
              <RichText text={symbolRules[word].split("::")[2] ? [{text: symbolRules[word].split("::")[2], i: "x"}] : ["-"]}></RichText>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );

  function selectAdjacentWord(direction: "up" | "down") {
    const newIdx = selectedIdx + (direction === "up" ? -1 : 1);
    if (newIdx >= 0 && newIdx < autocompleteSuggestions.length) {
      setSelectedIdx(newIdx);
    }
  }

  async function insertWord(idx: number) {
    const selectedWord = autocompleteSuggestions[idx];
    if (lastPartialWord && selectedWord && selectedWord.length > 0) {
      const [replace, offset, showcase] = symbolRules[selectedWord].split("::")
      await plugin.editor.setText([
        {
          text: replace,
          i: "x",
        },
      ]);
      setLastPartialWord("");
    }
  }

  async function insertSelectedWord() {
    insertWord(selectedIdx);
  }
}

renderWidget(AutocompletePopup);
