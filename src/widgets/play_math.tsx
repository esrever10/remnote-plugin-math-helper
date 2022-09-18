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

class MapScope {
  localScope: Map<string, any>;
  constructor () {
    this.localScope = new Map()
  }

  get (key) {
    // Remember to sanitize your inputs, or use
    // a datastructure that isn't a footgun.
    return this.localScope.get(key)
  }

  set (key, value) {
    return this.localScope.set(key, value)
  }

  has (key) {
    return this.localScope.has(key)
  }

  // keys () {
  //   return this.localScope.keys()
  // }
}

/*
 * This is a more fully featured example, with all methods
 * used in mathjs.
 *
 */
class AdvancedMapScope extends MapScope {
  parentScope: any;
  constructor (parent) {
    super()
    this.parentScope = parent
  }

  get (key) {
    return this.localScope.get(key) ?? this.parentScope?.get(key)
  }

  has (key) {
    return this.localScope.has(key) ?? this.parentScope?.get(key)
  }

  keys () {
    if (this.parentScope) {
      return new Set([...this.localScope.keys(), ...this.parentScope.keys()])
    } else {
      return this.localScope.keys()
    }
  }

  delete (key) {
    return this.localScope.delete(key)
  }

  clear () {
    return this.localScope.clear()
  }

  /**
   * Creates a child scope from this one. This is used in function calls.
   *
   * @returns a new Map scope that has access to the symbols in the parent, but
   * cannot overwrite them.
   */
  createSubScope () {
    return new AdvancedMapScope(this)
  }

  toString () {
    return this.localScope.toString()
  }
}

function PlayMath() {
  const [result, setResult] = useState<string>();
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

    const defaultScope = new AdvancedMapScope({});
    const scope = JSON.parse(scopeRichText ? scopeRichText : JSON.stringify(defaultScope));
    console.log(`text: ${text}`);

    const customF = {
      "clear": () => {
        parentRem?.setPowerupProperty(PLAYMATH_POWERUP, 'scope', [JSON.stringify(new AdvancedMapScope({}))]);
        setResult("cleared!");
      }
    }
    
    if (text.trim() in customF) {
      customF[text.trim()]();
      return;
    }

    try {
      setResult(Math.evaluate(text, scope).toString());
      parentRem?.setPowerupProperty(PLAYMATH_POWERUP, 'scope', [JSON.stringify(scope as AdvancedMapScope)]);
    } catch (e) {
      setResult(e.toString());
    }
      
    console.log(`result: ${result}`);
    
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
