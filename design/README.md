# Design reference

- `screens/desktop/`: full-page screenshots at 1440 px wide, one per phase 1 screen (plus the farm page's other tabs)
- `screens/phone/`: the same screens at 390 px wide
- `screens/dialogs/`: the main dialogs and panels
- `prototype/`: the source of the clickable prototype. These files use a design-tool format (`<x-dc>` markup
  with `{{holes}}`, and a `class Component extends DCLogic` block at the bottom holding sample data and
  behaviour). **Read them for exact wording, sample values and what each button does. Don't run them or copy
  their markup**; rebuild the UI in React with the shared components.

The numbers in the screenshots come from the prototype's sample data. The app computes its own numbers from
the demo data, so they will differ. Match the layout, wording and behaviour.
