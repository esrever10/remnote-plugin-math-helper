## Features

- Provides autocomplete suggestions in a popup menu when user input LaTex math formula.
- Provides a general rule format to customize the autocomplete behavior so that users can add arbitrary autocomplete rules and modify built-in rules, not just mathematical formulas.
- Automatically add space on both sides of the latex block.

## Showcase

![](https://raw.githubusercontent.com/esrever10/remnote-plugin-math-helper/main/images/latex.png)

## Update

- You should open Native Mode to allow plugin to insert text into latex box.

## How to Use

- The default hotkeys are:

  - `down`: select the next suggestion.
  - `up`: select the previous suggestion.
  - `enter`: insert the currently selected suggestion into the editor.

- You can customise the hotkeys in the settings.

  - Note that hotkeys for this plugin must be specified as text in the settings - eg. `ctrl+n` or `tab` rather than using the normal hotkey system in RemNote.

- You can custom the autocomplete rules in setting view. The following rules:

  ```
  RuleFormat:
    {Origin}::{Replace}::{Offset}::{Showcase}

  Explain:
    {Origin}: The origin characters.
    {Replace}: The characters displayed after auto-completion.
    {Offset}: How many characters the cursor needs to be left moved after auto-completion.
    {Showcase}: How to use the pattern of origin characters. If not, just leave it blank.
  ```

  For example, `\frac::\frac{}{}::3::\frac a b`, this means when you input `\fr`, `\frac` will be listed in the suggestion pop menu, and then you select it, `\frac{}{}` will be inputed into LaTex editor. `3` means the cursor will moves back three characters(This feature has not yet been implemented for technical reasons). `\frac a b` is a showcase to show that how to use this symbol.

## Feedback

- Discord: esrever10#6879

## Donate

![](https://raw.githubusercontent.com/esrever10/remnote-plugin-texthook/main/images/weixin.jpg)
