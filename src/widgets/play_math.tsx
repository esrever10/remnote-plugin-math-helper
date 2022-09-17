import React from "react";
import {
  AppEvents,
  renderWidget,
  RichTextElementTextInterface,
  useAPIEventListener,
  useLocalStorageState,
  usePlugin,
  useRunAsync,
  useSyncedStorageState,
  WidgetLocation,
} from "@remnote/plugin-sdk";
import * as Math from "mathjs";
import { PLAYMATH_POWERUP } from "../lib/constants";

const { useState, useEffect } = React;

function PlayMath() {
  const [result, setResult] = useState<string>("");
  const plugin = usePlugin();

  const widgetContext = useRunAsync(() => plugin.widget.getWidgetContext<WidgetLocation.UnderRemEditor>(), []);

  async function syncText() {
    const rem = await plugin.rem.findOne(widgetContext?.remId);
    if (!rem?.text || rem.text.length < 1) {
      return;
    }
    if (rem?.text[0].i && rem?.text[0].i !== 'm') {
      return;
    }
    const text = (rem?.text[0] as RichTextElementTextInterface).text;
    if (!text) {
      setResult("");
      return;
    }
    const parentRem = await rem.getParentRem();
    const scopeRichText = await parentRem?.getPowerupProperty(PLAYMATH_POWERUP, 'scope');
    if (scopeRichText) {
      console.log(scopeRichText![0]);
    }
    const scope = JSON.parse(scopeRichText ? scopeRichText : "{}");
    try {
      console.log(`text: ${text}`);
      try {
        const parser = Math.parser();
        for (var key in scope) {
          parser.set(key, scope[key]);
        }
        setResult(parser.evaluate(text).toString());
        parentRem?.setPowerupProperty(PLAYMATH_POWERUP, 'scope', [JSON.stringify(parser.getAll())]);
      } catch (e) {
        console.log(e.toString());
      }
      
      console.log(`result: ${result}`);
    } catch {}
    
  }


  useAPIEventListener(AppEvents.RemChanged, widgetContext?.remId, async () => {
    syncText();
  });

  useEffect(() => {
    syncText();
  }, [widgetContext?.remId]);

  return (
    <div className="ml-10 text-blue-500">= {result}</div>
  );
}

renderWidget(PlayMath);
