# Valesta brand files

Valesta is the property valuation app of Domestone S.r.l.

The name “Valesta” and the Valesta logo are not licensed under AGPL-3.0. They remain the property of
Domestone S.r.l. Their use is governed by [TRADEMARK_POLICY.md](../TRADEMARK_POLICY.md). A modified version must use its own
name and logo (section 5 of the policy) and must replace these files in its distribution.

## Files

| File | Use |
|---|---|
| `valesta-logo.svg` | Logo (symbol and name) on light backgrounds: the primary version |
| `valesta-logo-reverse.svg` | Logo on dark or teal backgrounds |
| `valesta-logo-mono-black.svg` | One-colour logo, black |
| `valesta-logo-mono-white.svg` | One-colour logo, white |
| `valesta-logo-stacked.svg`, `-reverse`, `-mono-black` | Stacked logo (symbol above the name) for square spaces |
| `valesta-symbol.svg`, `-reverse`, `-black`, `-white` | Symbol, from 48 px up |
| `valesta-symbol-small.svg`, `-reverse`, `-black` | Symbol for 16–32 px, with wider joints |
| `valesta-wordmark.svg`, `-black` | Name only |
| `valesta-app-icon.svg` | App icon with rounded corners (small-size symbol): favicon, PWA icons, app header |
| `valesta-app-icon-maskable.svg` | Full-bleed app icon for platforms that apply their own mask (PWA maskable, iOS, Android) |
| `brand.json` | Colours and the symbol on a 64-unit grid, read by `native/make_icons.py` |

The build reads these files to produce the favicon, the PWA icons and the native icons and splash screens.

## Symbol

An arch of two halves on piers, closed by a keystone shaped like a V: the value holds every decision as the keystone
holds the arch (direction “Chiave di volta”, chosen in November 2026).

- Grid of 256 × 256 units, centred: arch radii 94 and 54, piers 40 wide, keystone 64 wide.
- The joints beside the keystone and above the piers are 7 units wide; the small-size symbol uses 13 units so that they
  survive at 16–32 px. Without the joints the arch would read as a magnet: keep them.
- On light backgrounds the arch is teal deep and the keystone mint; on dark backgrounds the arch is white and the
  keystone mint light. The accent colour is used only on the keystone.

## Colours

| Name | Hex | Use |
|---|---|---|
| Teal deep | `#0B4F47` | Arch, name, start of the icon gradient |
| Teal | `#12796B` | End of the icon gradient |
| Mint | `#12A37F` | Keystone on light backgrounds (graphics only, 3.2:1 on white) |
| Mint light | `#5BE3B0` | Keystone on dark backgrounds |

## Name

Set in Montserrat 600 (SIL Open Font License 1.1) in capitals, letter-spacing 0.155 of the cap height, with optical
kerning, and converted to outlines, so no font is needed. The reversed versions use weight 570, because white on dark
looks heavier.

## Rules

- **Clear space:** around the logo, at least the height of the keystone.
- **Minimum size:** horizontal logo 120 px wide on screen or 30 mm in print; stacked logo 64 px or 16 mm; symbol 16 px
  with the small-size file.
- **Backgrounds:** the colour version only on white or light backgrounds; on teal, black or dark photos the reversed or
  the white version.
- **Do not:** recolour the keystone or the arch, distort the proportions, rotate the symbol, add shadows or outlines,
  remove the joints, or retype the name in a font.
