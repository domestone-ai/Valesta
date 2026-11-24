# Motion guidelines

Motion tells the user where they are, what changes, what caused the change and whether an action is complete. Motion
never slows down the work: no bounce, no wait, no decorative animation. See also
[design-system.md](design-system.md).

## Tokens

| Token | Value | Use |
|---|---|---|
| `--ui-dur-1` | 100 ms | immediate feedback: colour of buttons, items and borders |
| `--ui-dur-2` | 140 ms | micro transitions: menus, popovers, tooltips; drawers and toasts that leave |
| `--ui-dur-3` | 200 ms | panels and indicators: dialogs, command bar, tabs, segmented controls, details |
| `--ui-dur-4` | 240 ms | step change; drawers, the panel and toasts that arrive |
| `--ui-ease` | `cubic-bezier(.2, 0, 0, 1)` | standard: colour and feedback |
| `--ui-ease-out` | `cubic-bezier(.16, 1, .3, 1)` | what arrives: it starts firmly and settles softly |
| `--ui-ease-in` | `cubic-bezier(.4, 0, 1, 1)` | what leaves: it goes quickly |
| `--ui-shift` | 12 px | travel of a step change |

What arrives takes more time than what leaves: the user sees where a thing arrives, not where it goes.

## What moves

| Element | Motion |
|---|---|
| Interactive elements | colour only (background, border, text), 100 ms |
| **Step change** | the content comes in from the side the user comes from: forward from the right, back from the left; 12 px and a fade in 240 ms. Home and the start screen rise 4 px in 200 ms. |
| Mode change | the panel comes in from the right (16 px, 240 ms) when it shows; the form fades in (200 ms) and does not move |
| Segmented controls (mode, theme, preview fit) | the background of the choice slides under the new option, 200 ms (`motion.js`) |
| Panel tabs | the line under the tab slides to the selected tab (plum for the AI), 200 ms; the content of the tab shows in 140 ms |
| Selected step in the sidebar | background and bar settle in 200 ms |
| Value in the header | when it changes, the number shows for a moment in the accent colour and goes back to the text colour (0.9 s). It is a colour, never a count. |
| Menus and popovers | fade, 4 px and scale from 0.98 in 140 ms, from the corner they hang from |
| Dialogs and command bar | rise 8 px with scale from 0.985 in 200 ms; the backdrop fades with them |
| Steps drawer | comes in from the left in 240 ms over a light scrim; leaves in 140 ms. When closed it is hidden and gets no focus. |
| Panel drawer (below 1240 px) and phone sheet | come in in 240 ms, leave in 140 ms; they can be interrupted |
| Comparable cards, coordinates, guide | open and close in height, 200 ms, where the browser can; the arrow of the guide turns |
| Toast | rises 12 px in 240 ms; leaves in 140 ms |
| Support card (Delivery step) | fades in and rises 4 px in 160 ms, once |
| Keyboard focus ring | closes on the element in 140 ms |
| Linked page in the preview | the ring shows and fades in 200 ms; it stays 1.2 s |
| Tooltips | opacity, 100 ms: after 250 ms on hover, at once with keyboard focus |
| "In the calculation" switch | the knob moves 16 px in 100 ms |

## What does not move

- **Redraws.** When a step is redrawn because data changed, nothing moves. Motion comes only when the user changes
  step or screen.
- **Report preview.** No fade. The pages update after a pause of 260 ms in typing; they keep zoom and scroll and do
  not take the focus. The preview goes to the page of the step only when "Follow the step" is on.
- **Theme change.** It is immediate.
- **Preview divider.** It follows the pointer with no delay and no elastic effect; the preview fits again on release.
- **Columns.** The widths of form and preview change at once. Only the content moves, for a short time.
- **Data.** No number counts up or down: a moving value can look like a result of a calculation.
- **First paint.** The indicators of segmented controls start in place. They slide only when the choice changes.

## Rules

- Never `transition: all`. Movement uses `opacity` and `transform` only. The one exception is the height of details,
  where the browser can interpolate it.
- No blur of large surfaces. No decorative or looping animation. The only loop is the "MCP" dot, which shows an active
  link.
- Every motion can be interrupted: a new click starts from the current state.
- **Focus after a step change.** When the user selects a step in the sidebar, the focus stays on that item. When the
  step opens from inside the page, the focus goes to the title. When part of the page is redrawn, the focus goes back
  to the same element.
- **Focus in the steps drawer.** When it opens, the focus goes to the current step. When the user selects a step, the
  drawer closes and the focus goes to the title. Esc puts the focus back on the "Steps" button.
- **Messages.** A message shows near the action. No message at each key press: the automatic save is silent. A wait
  indicator is only for real long operations, for example an export or the AI.

## Reduced motion

With `prefers-reduced-motion: reduce`, the app removes all animations and all movement. Step change, panel, menus,
dialogs, command bar, drawers, details, the support card and map scroll show at once. Indicators and switch knobs jump
to the new position. Two things stay:

- colour changes, because they are feedback and not movement;
- a simple fade for toasts and drawers.

The meaning never depends on motion.

## Files

| File | Content |
|---|---|
| `src/css/app.css` | tokens, animations and transitions; the `prefers-reduced-motion` block |
| `src/js/motion.js` | indicators that slide (segmented controls and tabs) |
| `src/js/editor.js` | step change (`enter`, `stepDir`), panel tabs, value in the header |
| `src/js/layout.js` | mode change and steps drawer |
| `e2e/app.e2e.test.js` | direction of the step change, indicators, reduced motion |
