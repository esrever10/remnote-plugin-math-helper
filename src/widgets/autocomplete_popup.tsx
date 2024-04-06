import {
  renderWidget,
  usePlugin,
  AppEvents,
  RichTextInterface,
  useAPIEventListener,
  useRunAsync,
  useTracker,
  WidgetLocation,
  RichTextLatexInterface,
  RichText,
  RichTextElementInterface,
  RichTextElementTextInterface,
} from '@remnote/plugin-sdk';
import * as R from 'react';
import clsx from 'clsx';
import { selectNextKeyId, selectPrevKeyId, insertSelectedKeyId } from '../lib/constants';
import * as Re from 'remeda';
import { useSyncWidgetPositionWithCaret } from '../lib/hooks';
import { symbolRules } from '../lib/rules';
import { Logger } from './logger';

function AutocompletePopup() {
  const plugin = usePlugin();
  const ctx = useRunAsync(
    async () => await plugin.widget.getWidgetContext<WidgetLocation.FloatingWidget>(),
    []
  );

  const [hidden, setHidden] = R.useState(true);
  const floatingWidgetId = ctx?.floatingWidgetId;
  Logger.debug(`floatingWidgetId: ${floatingWidgetId}`);

  useSyncWidgetPositionWithCaret(floatingWidgetId, hidden);

  // Reactively get hotkey strings - if the user updates these in
  // the settings this component will re-render with the latest
  // values without requiring the user to refresh / reload.

  const selectNextKey = useTracker(
    async (reactivePlugin) => await reactivePlugin.settings.getSetting(selectNextKeyId)
  ) as string;
  const selectPrevKey = useTracker(
    async (reactivePlugin) => await reactivePlugin.settings.getSetting(selectPrevKeyId)
  ) as string;
  const insertSelectedKey = useTracker(
    async (reactivePlugin) => await reactivePlugin.settings.getSetting(insertSelectedKeyId)
  ) as string;

  const rules = useTracker(async (reactivePlugin) => {
    const start = new Date().getTime();
    const ruleCustom: string = await reactivePlugin.settings.getSetting('rule_custom');
    const customRules = Re.fromPairs(
      Re.map(ruleCustom.split('\n'), (x) => {
        const [key, ...values] = x.split('::');
        return [key, values.join('::')] as [string, string];
      })
    );

    const mergedRules = Re.mergeAll([symbolRules, customRules]);

    const end = new Date().getTime();
    Logger.debug(`get rules cost is ${end - start}ms`);
    return mergedRules;
  }) as {};

  // Steal autocomplete navigation and insertion keys from the editor
  // while the floating autocomplete window is open.

  R.useEffect(() => {
    const keys = [selectNextKey, selectPrevKey, insertSelectedKey, 'enter'];
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
      selectAdjacentWord('down');
    } else if (key === selectPrevKey) {
      selectAdjacentWord('up');
    } else if (key === insertSelectedKey) {
      insertSelectedWord();
    }
  });

  // The last partial word is the current part of a word before the
  // caret that the user has not yet finished typing. We use the
  // lastPartialWord to filter down the autocomplete suggestions to
  // show in the popup window.

  const [lastPretext, setLastPretext] = R.useState<RichTextElementInterface>();
  const [lastPartialWord, setLastPartialWord] = R.useState<string>();
  const [autocompleteSuggestions, setAutocompleteSuggestions] = R.useState<string[]>([]);

  R.useEffect(() => {
    const effect = async () => {
      if (!lastPartialWord || lastPartialWord.length === 0) {
        return;
      }
      const matchingWords = Re.pipe(
        Object.keys(rules),
        Re.filter((o) => {
          return o != null && o.length >= 1 && o.startsWith(lastPartialWord);
        }),
        Re.uniq(),
        Re.sortBy((x) => x.length)
      );
      setAutocompleteSuggestions(matchingWords.slice(0, 20));
      Logger.debug(
        `lastPartialWord to show: 
        ${lastPartialWord},
        ${matchingWords},
        ${matchingWords.slice(0, 20)}`
      );
      setHidden(false);
    };
    effect();
  }, [lastPartialWord]);

  R.useEffect(() => {
    if (autocompleteSuggestions.length <= 0) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  }, [autocompleteSuggestions]);

  // useTracker(async (reactivePlugin) => {
  //   const editorText = await reactivePlugin.editor.getFocusedEditorText();
  //   if (!editorText) {
  //     return;
  //   }
  // Logger.debug(`editorText: ${editorText}`);
  //   if (editorText.length >= 2 && editorText.at(-1) === ' ' && editorText.at(-2)?.i === 'x') {
  //     const lpw = (editorText.at(-2) as RichTextLatexInterface).text?.match(/[\\|\{}](\w+)$/)?.[0];
  //     if (lpw) {
  //       setLastPretext(editorText.slice(0, -2));
  //       setLastPartialWord(lpw);
  //     }
  //   }
  // });

  const formatRichText = (richText: RichTextInterface) => {
    return richText
      .map((x) => {
        if (x.i === undefined) return `[${x as string}]`;
        let res = '';
        switch (x.i) {
          case 'x':
            res = `x: ${(x as RichTextLatexInterface).text}`;
            break;
          case 'm':
            res = `m: ${(x as RichTextElementTextInterface).text}`;
            break;
          default:
            res = `${x.i}`;
        }
        return `[${res}]`;
      })
      .join(', ');
  };

  useAPIEventListener(
    AppEvents.EditorTextEdited,
    undefined,
    async (newTextArray: RichTextInterface) => {
      Logger.debug(formatRichText(newTextArray));
      if (newTextArray.length === 0) {
        return;
      }
      const newText = newTextArray.findLast((x) => x.i === 'x');

      if (newText && newText.i === 'x') {
        var lpw = (newText as RichTextLatexInterface).text;
        var index = lpw.lastIndexOf('\\');
        if (index !== -1) {
          lpw = lpw.slice(index);
        }
        Logger.debug(`lpw: ${lpw}`);
        if (lpw && lpw.length > 1) {
          setLastPretext(newText);
          setLastPartialWord(lpw.trim());
        }
      }
    }
  );

  const [selectedIdx, setSelectedIdx] = R.useState(0);

  R.useEffect(() => {
    if (!hidden) {
      setSelectedIdx(0);
    }
  }, [lastPartialWord]);

  const renderText: (string) => RichTextInterface = R.useMemo(
    () => (word: string) => {
      return rules[word].split('::')[2]
        ? [{ text: rules[word].split('::')[2] as string, i: 'x' }]
        : [{ text: '-', i: 'm' }];
    },
    [rules]
  );

  return (
    <div className={clsx('p-[3px] rounded-lg', hidden && 'hidden')}>
      <div
        className={clsx(
          'flex flex-col content-start gap-[0.5] w-full box-border p-2',
          'rounded-lg rn-clr-background-primary rn-clr-content-primary shadow-md border border-gray-100'
        )}
      >
        {autocompleteSuggestions.map((word, idx) => (
          <div key={idx} className="flex flex-row">
            <div
              key={word}
              className={clsx(
                'grow rounded-md p-2 truncate',
                idx === selectedIdx && 'rn-clr-background--hovered'
              )}
              onMouseEnter={() => setSelectedIdx(idx)}
              onClick={() => insertWord(idx)}
            >
              {word}
            </div>
            <div className="flex items-center grow">
              <RichText text={renderText(word)}></RichText>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  function selectAdjacentWord(direction: 'up' | 'down') {
    const newIdx = selectedIdx + (direction === 'up' ? -1 : 1);
    if (newIdx >= 0 && newIdx < autocompleteSuggestions.length) {
      setSelectedIdx(newIdx);
    }
  }

  async function insertWord(idx: number) {
    const selectedWord = autocompleteSuggestions[idx];
    if (lastPartialWord && selectedWord && selectedWord.length > 0) {
      const [replace, offset, showcase] = rules[selectedWord].split('::');
      const realOne = lastPretext;

      if (realOne?.i === 'x') {
        Logger.debug(
          `selectedWord: ${selectedWord}, lastPartialWord: ${lastPartialWord}, realOne.text: ${realOne.text}, replace: ${replace}`
        );
        realOne.text = realOne.text.trimEnd();
        if (realOne.text.endsWith(lastPartialWord)) {
          realOne.text =
            realOne.text.substring(0, realOne.text.length - lastPartialWord.length) + replace;
          Logger.debug(`Result Word: ${realOne.text}`);
          if (document.querySelector('#controlled-popup-portal .latex-editor__input') !== null) {
            const textarea: HTMLTextAreaElement | null = document?.querySelector(
              '#controlled-popup-portal .latex-editor__input'
            );

            textarea!.value = realOne.text;
            const end = textarea!.value.length;
            textarea!.setSelectionRange(end - offset - 1, end - offset - 1);
          }
        }
      }
    }
    setLastPartialWord('');
    setAutocompleteSuggestions([]);
    setHidden(true);
  }

  async function insertSelectedWord() {
    insertWord(selectedIdx);
  }
}

renderWidget(AutocompletePopup);
