# Support for the project and feedback

Valesta can ask, rarely and quietly, for support of the project on GitHub, and it offers a short feedback form. Both
are optional: they unlock nothing, they never block a valuation or an export, and the app works the same whether the
user answers or not. The code is in `src/js/support.js`, the texts in the interface packs, the tests in
`tests/support.test.js` and `e2e/support.e2e.test.js`.

## Where

- **Help menu** (⋯ → Help): «Support the project» and «Send feedback», always available.
- **Card at the end of the Delivery step**, shown automatically only under the rules below. It is part of the page,
  not a pop-up: it does not take the focus, is not announced by screen readers, and covers nothing.

«Support the project» opens a small dialog: a link to the repository, «Send feedback», the hint to select «Star» at the
top of the repository, and the switch «Occasionally show invitations to support the project».

## When the card may appear

All of these must be true:

1. **Two successful report exports** have been counted on this device (see below for what counts).
2. **Two different local days of use**: the app was opened on at least two calendar days of the device's time zone.
   Reloading the app the same day does not add a day.
3. The automatic invitation is **not turned off** («Don't show again», or the switch in the dialog).
4. **GitHub has not been opened** from this feature (the card or the dialog).
5. The **waiting period** after the last invitation, «Not now», closing the card or the feedback form has **ended**.
6. A report export **has just ended in this run** of the app; the card then appears on the Delivery step at the next
   safe moment.

The first start can never qualify (it is one day of use).

### What counts as a successful export

The point of success that the platform actually reports:

| Export | Counted when |
|---|---|
| HTML report, digital file (ZIP), in the browser | the file was made without error and handed to the browser's download. The browser does not tell whether the user then saved it, so this is not a proof that a file is on disk. |
| Same, in the Android and iOS apps | the system share sheet completed; cancelling it counts nothing. |
| Share (Web Share API) | the share completed; cancelling it counts nothing. |
| PDF (printing) | **never**: neither the browser nor the apps tell whether a PDF was made or the print dialog was cancelled. |
| Project file (JSON), Standard format, agency profile | never: they are not report exports. |

A failed export (an error while making the file) counts nothing.

### A safe moment

The card waits, without polling, until the next event of the app (the end of an export, a dialog closed, the Delivery
step shown again) when any of these is true: the page is hidden or offline; a dialog, the menu, the command palette, a
list or a message is open; printing is in progress; a field has the focus (the user is typing) or an input method is
composing text; an error happened in the last minute. After an export it waits until the export's message (4.2 s) has
gone. If no safe moment comes, it simply does not appear in this run.

## Actions and waiting periods

| Action | Effect on the automatic invitation |
|---|---|
| The card is seen (half of it on screen) | not again in this run; the next one waits **90 days** |
| «Not now» or the close button of the card | waits 90 days |
| «Don't show again» | off on this device, until the switch is turned on again |
| «Open GitHub» (card or dialog) | no more automatic invitations on this device. Nothing records a star: opening the page is not giving a star, and Valesta neither asks nor checks. |
| «Send feedback» (card, dialog or menu) | waits 90 days, whether or not anything is sent |
| Card ignored (the user leaves the step) | if it was seen: not again in this run, and 90 days; if it never came into view, it may appear again on the Delivery step in the same run |

The links of the Help menu always stay available. Updates of the app keep the preferences.

## Data kept on the device

One entry in the browser's `localStorage`, key `valesta-support`, separate from valuations (IndexedDB), exported
files, the valuation schema and client data:

```json
{ "v": 1, "exports": 2, "days": 2, "lastDay": "2026-11-25", "shown": "2026-11-25", "until": "2027-02-23", "off": false, "gh": false }
```

| Field | Meaning |
|---|---|
| `v` | version of this format |
| `exports` | successful report exports, counted only up to 2 |
| `days` | distinct local days of use, counted only up to 2 |
| `lastDay` | last local day counted |
| `shown` | local day the card was last seen |
| `until` | first local day another invitation may appear |
| `off` | automatic invitation turned off |
| `gh` | GitHub opened from this feature |

No history of activity, no identifier, no time of day. **No telemetry**: nothing of this, and nothing about the use of
the app, is sent to Domestone or anyone else. The preference is not synchronised between devices or browsers; the
dialog says so.

Robustness: when the storage cannot be used (blocked, private mode, full) the automatic invitation stays off and the
dialog says that the preference cannot be saved; damaged, unexpected or newer data are never overwritten by the app
and also keep the invitation off, until an explicit choice of the user (the switch, «Don't show again», opening GitHub)
replaces them with valid data. Tabs share the data and read it again before every decision, so a card seen in one
tab is not shown in another.

## Feedback form

- **Fields**: type (technical problem, hard to use, suggestion, question about a calculation or a method, other;
  required), what you were trying to do (optional), what happened or what is missing (required). No rating, no NPS.
- **Before sharing**, the form shows the warning not to include addresses, client data, confidential documents or
  credentials, and to check screenshots. Valesta takes no screenshot and attaches nothing: not the valuation, the
  report, addresses, values, names, contacts, documents, conversations with the AI, logs, page content or URLs.
- **Technical details**, shown in full and removable with one tick (offered by default for technical problems and
  usability): version and build, platform (web or app, browser and major version, operating system: no full browser
  string), language of the app, the section (step identifier such as `deliver`). The exact text to share is in
  «Text that will be shared».
- **Keyboard and screen readers**: the focus starts on the first field and returns where the form was opened from;
  errors are next to their fields (`aria-invalid`, `aria-describedby`) and the first one gets the focus; Escape, the
  close button and a click outside ask before discarding text not yet copied or taken to GitHub; results are read out
  through a polite status line.

## Where feedback goes, and who sees it

There is **no private channel** for feedback: no server, no endpoint, no e-mail sending. The form says so and offers:

1. **Copy feedback**: the text goes to the clipboard. If copying fails, the text appears selected for copying by hand;
   nothing is lost.
2. **Open a public issue on GitHub**, after the warning «The issue will be public and requires a GitHub account»: a new
   tab with a draft issue (title and text filled in). Only that explicit click opens it, and the form says the issue
   reaches the maintainers only when the user submits it on GitHub; it never claims the feedback was sent. A text too
   long for a link (over 7,000 characters once encoded) is never cut: the first click asks to copy it, the next one
   opens GitHub with the title and a request to paste.

No e-mail address is asked, so none can reach a public issue. **Security problems** do not go through the form: it
links to private vulnerability reporting on GitHub, as [SECURITY.md](../SECURITY.md) says, and warns not to publish
details in public issues.

## To check or complete before a release

- **The repository must be public.** On 24 November 2026 `https://github.com/domestone-ai/Valesta` answers 404 to
  visitors (private repository): until it is public, «Open GitHub» and the issue links lead to a «page not found».
- **Issues must be enabled** in the repository settings. This could not be checked here (private repository, no
  authenticated access); `CHANNELS.issues` in `src/js/support.js` hides the issue button when set to `false`.
- **Private vulnerability reporting must be enabled** (Settings → Code security). It is off by default on GitHub, and
  SECURITY.md relies on it.
- **A private feedback channel**, if wanted, needs a server operated by Domestone, a privacy notice for it (controller,
  purpose, retention, rights), a change of the Content-Security-Policy (`connect-src`) and an e-mail field shown only
  with that channel. None of this exists, and no privacy wording has been written for it.
- The texts in the 14 languages beyond Italian, English and Spanish are drafts, like the rest of those packs.

## Turning it off

- **Users**: «Don't show again» on the card, or the switch in Help → «Support the project».
- **A build without the automatic invitation** (for example a white-label deployment): `INVITE = false` in
  `src/js/support.js`. The Help menu stays.
