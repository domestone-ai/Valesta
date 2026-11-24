# Contributing to Valesta

Thank you for your help. Read this guide before you open a pull request.

## Before you start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md). All persons who take part in the project must obey it.
- For a large change, open an issue first. Then we can agree on the approach before you write code.
- For a security problem, do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## Contributor License Agreement (CLA)

We accept contributions only under the project [Contributor License Agreement](CLA.md). An automated check asks you
to accept it in your first pull request. We merge a pull request only after you accept the CLA.

## Set up the development environment

Requirements:

- Python 3.11 or later.
- Node.js 20 or later. The CI uses Node.js 22.
- Chrome or Edge, for the end-to-end tests.
- For the Android app only: JDK 21 and the Android SDK. `python -I native/setup_toolchain.py` installs them into the
  folder `_tools` next to the repository. It does not change the system.

Install the development tools (ESLint and playwright-core). They are not part of the app:

```text
npm ci --ignore-scripts
```

Optional: run the compliance check before each commit.

```text
git config core.hooksPath .githooks
```

## Build

| Output | Command | Result |
|---|---|---|
| Single-file app, web app (PWA), MCP server | `python -I build.py` | `dist/Valesta.html`, `dist/Web/`, `dist/mcp/` |
| Windows app | `npm --prefix desktop ci`, then `npm --prefix desktop run dist` | `dist/windows/Valesta-Setup-<version>.exe` |
| Android app (test) | `.\native\build-android.ps1` | `dist/android/Valesta-<version>-debug.apk` |
| Android app (release) | `.\native\build-android.ps1 -Release` | `dist/android/Valesta-<version>.apk` and `.aab` |

The Windows and Android builds start from the output of `build.py`. Run `python -I build.py` first.

Only the maintainers sign release builds. The release key of the Android app stays outside the repository. Never
commit a keystore, a certificate or a password.

## Test

Run all the checks before you open a pull request. The CI runs the same checks.

```text
python -I build.py                                     # build
for f in tests/*.test.js; do node --test "$f"; done    # unit tests (bash)
npx --no-install eslint src/js desktop mcp tests e2e   # lint
node --test e2e/*.test.js                              # end-to-end tests, after the build
node .github/scripts/compliance-check.mjs              # licences, headers, secrets, data
```

In PowerShell, run the unit tests with this command:

```powershell
Get-ChildItem tests\*.test.js | ForEach-Object { node --test $_.FullName }
```

Rules for tests:

- Each change of behaviour needs a test. For a bug, write a test that fails before the fix.
- Tests use synthetic data only.
- `tests/methodology-docs.test.js` checks the code references in [docs/methodology/](docs/methodology/README.md). When
  you move code that a document quotes, the test fails. Then update the line number in the document in the same
  change.

## Work on the code

- [docs/architecture.md](docs/architecture.md) describes the modules, the build and the platforms.
- `src/js/engine.js` and the other calculation modules are pure: no DOM, no network. They run in the browser and in
  Node.js. Keep them so.
- The interface follows [docs/design-system.md](docs/design-system.md) and
  [docs/motion-guidelines.md](docs/motion-guidelines.md). Use the design tokens. Do not write colours or durations
  directly into a component.
- The app has a Content-Security-Policy. Do not add inline event handlers, `eval` or scripts from other servers.
- The app sends no data to an outside service until the user turns that service on. A new outside service needs a
  switch in **Privacy and outside services** and an entry in [NOTICE](NOTICE).

### Interface languages

- English, Spanish and Italian are in `src/js/ui_i18n.js`. The other 14 languages are packs in
  `src/js/lang-ui/ui.<code>.js`.
- `node tools/ui_strings.js` prints the English texts to translate. `node tools/ui_strings.js <code>` lists the texts
  that a pack does not have and the labels that the app no longer uses.
- Keep every key, the arguments of the functions, the placeholders (`{0}`, `{doc}`) and the currency sign `¤`.
  `tests/ui_i18n.test.js` checks them.
- Plural forms use `h.pl(n, { one, few, many, other })`.
- A new language needs its report pack first (`src/js/lang/report.<code>.js`).
- After a change to the Chinese texts, cut the font Noto Sans SC again with `tools/subset_cjk.py`. The script needs
  fonttools and brotli.

## Open a pull request

1. Fork the repository and make a branch from `main`.
2. Make one logical change in each pull request.
3. Run all the checks of [Test](#test).
4. For a change that users can see, add a line to [CHANGELOG.md](CHANGELOG.md), in a section `[Unreleased]` at the
   top.
5. Open the pull request and complete the checklist of the template.

Write commit messages in English. Start the first line with the area and a verb in the imperative, for example
`Interface: show the unit of the adopted value`. Keep the first line short (72 characters or fewer).

## Rules for every contribution

1. **Header.** Each source file (`.js`, `.mjs`, `.cjs`, `.css`, `.html`, `.py`, `.ps1`, `.java`, `.swift`) starts with
   the AGPL-3.0 header, with the copyright of Domestone S.r.l. Copy it from `tools/source-header.txt` or from an
   existing file.
2. **No secrets.** No API keys, tokens, passwords, keystores, certificates or real `.env` files.
3. **No real data.** Never commit any of these:
   - data about clients, persons, properties or transactions;
   - deeds, floor plans or photos of properties;
   - market datasets.

   Use synthetic or fictitious data only.
4. **Dependencies.** Add a dependency only after you make sure that its licence is compatible with AGPL-3.0. Add it to
   [NOTICE](NOTICE). If the Windows or the Android app includes it, also add its licence text to
   [LICENSES/](LICENSES).
5. **Connectors.** Proprietary connectors to commercial services do not belong in this repository.
6. **Checks.** The build, the tests, the lint and the compliance check must pass.
7. **Language.** Write code comments, commit messages and documents in English. Write documents for users with the
   rules of ASD-STE100 Simplified Technical English. Interface texts go into the language packs, not into the code.
8. **Marks.** Use the names and logos of Domestone and Valesta only as [TRADEMARK_POLICY.md](TRADEMARK_POLICY.md)
   permits.
