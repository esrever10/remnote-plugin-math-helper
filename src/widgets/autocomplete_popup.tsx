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
  RichTextElementInterface,
} from '@remnote/plugin-sdk';
import * as R from 'react';
import clsx from 'clsx';
import { selectNextKeyId, selectPrevKeyId, insertSelectedKeyId } from '../lib/constants';
import * as Re from 'remeda';
import { useSyncWidgetPositionWithCaret } from '../lib/hooks';
import { symbolRules } from '../lib/rules';

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
    setMergedRules(mergedRules);
    const end = new Date().getTime();
    console.warn('get rules cost is', `${end - start}ms`);
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

  const [lastPretext, setLastPretext] = R.useState<RichTextInterface>();
  const [lastPartialWord, setLastPartialWord] = R.useState<string>();
  const [autocompleteSuggestions, setAutocompleteSuggestions] = R.useState<string[]>([]);
  const [mergedRules, setMergedRules] = R.useState({});

  R.useEffect(() => {
    const effect = async () => {
      if (!lastPartialWord || lastPartialWord.length === 0) {
        return;
      }
      const start = new Date().getTime();
      const matchingWords = Re.pipe(
        Object.keys(rules),
        Re.filter((o) => {
          return o != null && o.length >= 1 && o.startsWith(lastPartialWord);
        }),
        Re.uniq(),
        Re.sortBy((x) => x.length)
      );
      setAutocompleteSuggestions(matchingWords);
      const end = new Date().getTime();
      console.warn('cost is', `${end - start}ms`);
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

  // useTracker(async (reactivePlugin) => {
  //   const editorText = await reactivePlugin.editor.getFocusedEditorText();
  //   if (!editorText) {
  //     return;
  //   }
  //   console.log(`editorText: ${editorText}`);
  //   if (editorText.length >= 2 && editorText.at(-1) === ' ' && editorText.at(-2)?.i === 'x') {
  //     const lpw = (editorText.at(-2) as RichTextLatexInterface).text?.match(/[\\|\{}](\w+)$/)?.[0];
  //     if (lpw) {
  //       setLastPretext(editorText.slice(0, -2));
  //       setLastPartialWord(lpw);
  //     }
  //   }
  // });

  useAPIEventListener(AppEvents.EditorTextEdited, undefined, async (newText: RichTextInterface) => {
    if (newText.length >= 2 && newText.at(-1) === ' ' && newText.at(-2)?.i === 'x') {
      var lpw = (newText.at(-2) as RichTextLatexInterface).text;
      var index = lpw.lastIndexOf('\\');
      if (index !== -1) {
        lpw = lpw.slice(index);
      }
      if (lpw && lpw.length) {
        console.warn('lastPartialWord2222-lpw', lpw);
        setLastPretext(newText);
        setLastPartialWord(lpw);
      }
    }
  });

  const [selectedIdx, setSelectedIdx] = R.useState(0);

  R.useEffect(() => {
    if (!hidden) {
      setSelectedIdx(0);
    }
  }, [lastPartialWord]);

  return (
    <div className={clsx('p-[3px] rounded-lg', hidden && 'hidden')}>
      <div
        className={clsx(
          'flex flex-col content-start gap-[0.5] w-full box-border p-2',
          'rounded-lg rn-clr-background-primary rn-clr-content-primary shadow-md border border-gray-100'
        )}
      >
        {autocompleteSuggestions.map((word, idx) => (
          <div className="flex flex-row">
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
            <div className="flex grow items-center">
              {/* <RichText
                text={
                  mergedRules[word].split('::')[2]
                    ? [{ text: mergedRules[word].split('::')[2], i: 'x' }]
                    : ['-']
                }
              ></RichText> */}
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
    console.warn(`selectedWord0: ${selectedWord}`);
    if (lastPartialWord && selectedWord && selectedWord.length > 0) {
      const [replace, offset, showcase] = mergedRules[selectedWord].split('::');
      var lastEl: RichTextElementInterface | undefined = lastPretext?.slice(-1)[0];
      if (lastEl === undefined) return;
      var pre: RichTextInterface | undefined = lastPretext;
      if (lastEl?.i === undefined && lastEl === ' ') {
        pre = lastPretext?.slice(0, -1);
      }

      if (pre === undefined) return;
      lastEl = pre.slice(-1)[0];
      if (lastEl?.i === 'x' && lastEl.text.endsWith(lastPartialWord)) {
        lastEl.text =
          lastEl.text.substring(0, lastEl.text.length - lastPartialWord.length) + replace;
      }
      console.warn(`selectedWord: ${selectedWord}`);
      if (document.querySelector('#controlled-popup-portal .latex-editor__input') !== null) {
        const textarea = document?.querySelector('#controlled-popup-portal .latex-editor__input');
        console.log(`textarea: ${textarea}`);
        textarea!.value = lastEl.text;
      }
      // await plugin.editor.setText(pre);
    }
    setLastPartialWord('');
    setHidden(true);
  }

  async function insertSelectedWord() {
    insertWord(selectedIdx);
  }
}

renderWidget(AutocompletePopup);
