# Design system

This document describes the visual system of the Valesta interface: colour tokens, type, spacing, components, header,
workspace layout and themes. Motion has its own document: [motion-guidelines.md](motion-guidelines.md).

## 1. Principle

> A precise, quiet professional tool, with a final document that has a strong editorial identity.

- **The app** gives precision, clarity, speed and control.
- **The report** gives authority and transparency. It has its own identity (paper, agency profile). It does not follow
  the theme of the app.

The quality comes from the precision of the system, not from effects.

## 2. Colour: "Carta e inchiostro"

The interface uses ivory paper, sepia ink and a terracotta accent. The accent is used sparingly. The petrol-green
brand stays on the logo and on the reports.

There is one source of truth: `src/css/app.css`, blocks `:root` (light) and `:root[data-theme="dark"]` (dark).

- **`--ui-*`**: the values that the components use.
- **`--color-*`**: the semantic layer, aliases of the `--ui-*` values. New code uses these names.

| Semantic token | Variable | Light | Dark | Use |
|---|---|---|---|---|
| `--color-canvas` | `--ui-bg` | #F9F4EA | #1C1814 | background of the app |
| `--color-surface` | `--ui-panel` | #FFFDFA | #25201B | panels, cards, header |
| `--color-surface-secondary` | `--ui-surface-2` | #F7EFE2 | #2C2621 | hover, secondary areas |
| `--color-surface-raised` | `--ui-raised` | #FFFDFA | #2C2621 | menus, dialogs, popovers (with a shadow) |
| `--color-surface-sunken` | `--ui-surface-3` | #F1E9DE | #342D27 | tracks of segmented controls |
| `--color-text-primary` | `--ui-text` | #27221D | #F0E9D9 | text |
| `--color-text-secondary` | `--ui-ink-2` | #4D4640 | #D5CDC0 | labels, navigation items |
| `--color-text-muted` | `--ui-muted` | #665F58 | #A99F91 | help text, metadata |
| — | `--ui-faint` | #6F6962 | #A0988F | micro text, "to do" states |
| `--color-border-decorative` | `--ui-border` | #E1D8CB | #403933 | dividers, card borders |
| `--color-border-control` | `--ui-line-2` | #898077 | #7D766D | field borders (3:1 or more) |
| `--color-brand` | `--ui-brand` | #0E5A4E | #7AC8B4 | brand (logo, reports) |
| `--color-action-primary` | `--ui-accent` | #8B5535 | #DA966C | primary action, links, current step |
| `--color-action-primary-hover` | `--ui-accent-deep` | #794424 | #EBA67B | primary action on hover |
| `--color-selection` | `--ui-accent-50` | #F6E6DA | #3C291D | selected item |
| `--color-focus` | `--ui-focus` | #8B5535 | #DA966C | keyboard focus ring |
| `--color-success` | `--ui-green` | #576B4C | #90A87E | step complete, positive result (sage) |
| `--color-warning` | `--ui-warn` | #865E12 | #C59A4B | open checks, warnings (ochre) |
| `--color-danger` | `--ui-danger` | #A63D37 | #E9847E | errors, delete (brick) |
| `--color-info` | `--ui-info` | #496982 | #83A5BB | information (dusty blue) |
| `--color-ai` | `--ui-ai` | #794D80 | #C8A1CE | AI assistant and its proposals (warm plum) |

### Rules for colour

- **One role, one treatment.** Terracotta is for the primary action, links and the current step. Selection uses a pale
  tint with a bar at the side. Completion uses sage. Data quality is a number with its class in an outlined box.
- **Plum** is only for the AI.
- **Surfaces**: no decorative gradients, no transparency, no blur. Cards have a border and no shadow. A shadow shows
  elevation only: menus, dialogs, drawers, pages of the preview.
- **Always light**: logos and signatures shown as images (`--ui-paper*`) and the map (`--ui-map-*`). An empty image
  box follows the theme.

### Contrast

`tests/theme.test.js` checks the contrast of every pair that the components use, in both themes (WCAG 2.x).

| Theme | Text (limit 4.5:1) | Controls, states and focus (limit 3:1) |
|---|---|---|
| Light | 4.75:1 or more | 3.40:1 or more |
| Dark | 5.19:1 or more | 3.33:1 or more |

This is an automatic check. Tests with screen readers and with users are still necessary.

## 3. Type

- **Families.** **Inter** for the interface and the data. **Literata** for the titles of the steps and for the value
  on the Result step. The fonts are in the app (SIL Open Font License 1.1). The app loads no remote fonts.
- **Three separate scopes.** The "Valesta" wordmark is the SVG of the brand. The fonts of the report are set in
  "Style and brand" and apply to the document only.
- **Scale** (seven sizes):

  | Role | Size / line height, weight |
  |---|---|
  | Title of the step | 28/34 px Literata 600 (22 px on a phone) |
  | Title of a card or section | 15/21 px, 600 |
  | Value in the header, key figures | 16/20 px, 600 |
  | Body text and fields | 14/20 px, 400 (16 px on touch screens) |
  | Labels, navigation items, secondary tables | 13/18 px, 500 |
  | Micro text, badges, metadata | 12/16 px |
  | Eyebrows (phase and step, menu groups) | 11/16 px, 600, spaced capitals |

- **Weights.** 400 for text, 500 for labels and summary values, 600 for titles and selected items. 700 only for the
  value on the Result step and for the labels on the map.
- **Numbers.** Tabular figures for prices, areas, statistics, coefficients, counters and tables. Align them to the
  right when people compare them. Every value and range shows its unit.
- **Labels.** A placeholder is never the only label of a field.

## 4. Spacing, sizes, radii

- **Scale `--sp-*`**: 4, 8, 12, 16, 24, 32, 48 px.
- **Distances**: label to field 6 px; related fields 12–16 px; cards and sections 24 px; card padding 20 × 24 px.
- **Fields**: 40 px high (42 px on touch screens). **Buttons**: 38 px (32 px for the small version).
- **Radii**: 6 px for fields, 8 px for buttons, 10 px for cards and panels.
- **Work area**: padding of 28 px at the top and 32 px at the sides (24 px up to 1440 px).

## 5. Components and states

- **States of every control**: rest, hover, visible focus, pressed, selected, disabled, error. "Selected" is never a
  colour only.
- **Buttons**: primary is solid terracotta; secondary has an outline; AI is plum; disabled uses a sunken surface and
  the "not allowed" cursor, never opacity only.
- **Delete**: a quiet bin icon, always visible. It turns brick red and marks the row on hover or focus.
- **Fields**: the control border is 3:1 or more. On hover the border gets darker. On focus the ring and the accent
  border show. A field that is not valid has an error border and an error background. In tables, editable cells look
  like fields also at rest.
- **States of the steps**: a shape and a name for screen readers.

  | State | Shape | Colour |
  |---|---|---|
  | Complete | ✓ full circle | sage |
  | In progress (started, essential data missing) | ◐ half circle | secondary text |
  | Open checks, also when optional | ▲ triangle, with the number of checks | ochre |
  | To do | ○ empty circle | faint |
  | Optional | ◌ dashed circle | faint |
  | Current | pale background, bar at the side, weight 600 and `aria-current="step"` | — |

- **Counters**: "2/4" for a phase means complete steps without open checks ("2 of 4 steps complete"); "7/9" on the
  comparables means included of total.
- **Foot of the sidebar**: the completion of the essential data, and the open checks ("3 open checks", which opens the
  Checks tab).
- **Comparison view of the comparables**: a table at the top of the step. From the left: the "In the calculation"
  switch, the ID (it opens the card), location, asking price with its price per m², area, base price per m², factors,
  adjusted price per m² (bold), source and condition. The factors show in ochre when the gross adjustment is above
  35 %. The table shows the values of the engine and does not calculate them again.
- **Switch** (`role="switch"`): on, terracotta track with the knob on the right; off, sunken track with a control
  border.
- **Options with a description** (report model, covers): a name, one line on what it does, `aria-pressed`. The
  selected option has a border, the selection tint and a tick.
- **Paper samples**: the font sample, the logo and a signature image are white also in the dark theme, because they
  show paper.
- **Field errors**: a message under the field, with `aria-invalid` and `aria-describedby`. It goes away when the value
  can be read.
- **Location map**: 360 px high; it can grow to 640 px (`valesta-map-big`). Zoom, centre and "My location" are on the
  map.
- **Preview toolbar**: zoom in percent, then icons with a name: fit width, fit page, chapters, follow the step, full
  screen. The device keeps the zoom, the choice and the position (`valesta-preview`).

## 6. Header

The zones, from left to right:

1. **Navigation**: the icon goes to the list of valuations, with "Valuations /".
2. **Valuation**: the title (address · floor · town) and, under it, country · property type · language. Each one opens
   its choice.
3. **State**: "Market value · 3 open checks" with the value, and "Quality 81/100 · B" (accessible name "Quality check:
   81 of 100, class B"). The score is 100 minus the penalties of the checks. The class goes from A to E.
4. **Tools**: search and commands ("Search or go to…", Ctrl K), the AI assistant (a separate plum button), undo and
   redo.
5. **View**: the three workspace modes.
6. **Actions**: "Export" and the menu.

When space is short, the title of the valuation stays on a computer. These items go first, in this order: the text
mark (below 1600 px), the text of the search (below 1366 px; the icon stays, with a tooltip), "Valuations /" (below
1320 px), undo and redo (below 1080 px), quality and labels (below 900 px).

## 7. Workspace layout

**Width by task.** Forms are 800 px wide. Comparables, adjustment, methods, result, checks and the list of valuations
go up to 1120 px. The width comes from `data-view` on `#tab-body`, not from the width of the window.

**Three modes** above 1240 px, from the control next to "Export":

1. **Form**: steps and form, document closed.
2. **Form + document** (default): the form keeps its width (800 px, 720 px on medium screens); the document takes the
   rest, at least 400 px.
3. **Document review**: the form stays in a column of 520 px, the sheet goes up to 125 % and the steps go in a drawer.

**Steps drawer.** The steps become a drawer when the sidebar (216 px), a 720 px form and a 400 px document do not fit
(below about 1390 px), in Document review, and on a tablet in portrait. The "Steps" button at the top of the step
strip opens it. Select a step, click outside or press Esc to close it.

**Divider.** Drag it with the mouse, or use ← → (24 px), Shift + ← → (96 px), Home and End (limits), Enter or a double
click (default width). The form is never narrower than 520 px. The device keeps the mode and one width for each mode
(`valesta-layout`). Menu → View → "Reset the layout" sets the default values again.

**Narrow screens.** Below 1240 px the document is a drawer on the right. Below 760 px the app uses the bottom bar of
the phone layout. Form grids follow the work area (container queries): 4 columns, 2 below 700 px, 1 below 470 px.

## 8. Themes

- **Choice**: Light, Dark and Automatic in menu ⋯ → **View**.
- **Start**: the page applies the theme before the first paint. The device keeps the choice (`valesta-theme`).
- **Dark theme**: warm brown-grey surfaces with clear steps (background #1C1814, panels #25201B, secondary and raised
  surfaces #2C2621) and ivory text.
- **Report and map**: the report stays on white paper with the colours of the agency profile. The map stays light,
  with no filter.
- **Browser bar**: it keeps the petrol green of the brand (#0B4F47).

## 9. Do not

- Generic SaaS dashboards, glassmorphism, decorative gradients, heavy shadows.
- Cards in cards without a function, badges everywhere, small text to fit more content.
- Slow or spectacular animations.
- The same maximum width for all tasks.
- Changes to the brand identity (logo, petrol green of the reports).

## 10. Files

| File | Content |
|---|---|
| `src/css/app.css` | tokens, components, header, layout |
| `src/js/layout.js` | modes, divider, steps drawer, reset |
| `src/js/theme.js` | theme |
| `src/js/motion.js` | indicators that slide under the selected option (segmented controls, panel tabs) |
| `src/index.template.html` | header zones, controls, divider, theme script in `<head>` |
| `src/js/editor.js` | state of the value, quality, step states, step strip, `data-view`, focus, comparison view, font sample, field errors, preview tools |
| `src/js/ui_i18n.js`, `src/js/lang-ui/*` | labels in 17 languages |
| `tests/theme.test.js`, `e2e/app.e2e.test.js` | contrast, layout, header and states |
