# Changelog

This file records the changes of each version of Valesta that users can see.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The version numbers follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-24

First public release of **Valesta (Value Estate Assistant)**, the property valuation app of Domestone S.r.l. We
develop and test Valesta for Windows and Android.

### Added

#### Platforms

- **Windows app**: an installer for Windows 10 and 11, 64-bit (Electron and NSIS). The app opens links to other
  sites in the default browser and cannot go to other pages. One copy of the app runs at a time.
- **Android app** for Android 7.0 and later (Capacitor). The release is signed with a key that stays outside the
  repository.
- **Single-file app** (`dist/Valesta.html`) and **web app (PWA)** for browsers. Both work offline.
- **MCP server** (Node.js, no dependencies) for the AI app of a subscription, with live sync to the app.
- The iOS shell (`native/ios`) is source code only. We do not build or test it.

#### Valuation

- **Sales comparison with homogenisation coefficients.** Negotiation coefficient with the reasoning of the valuer,
  time adjustment and deduction of annexes. Homogenisation factors with scales weighted by factor or uniform, and
  levels suggested from the data. Each coefficient shows its origin (Valesta default or set by the valuer) and its
  source.
- **Weights and estimators.** Weights from the reliability of the source and the similarity to the subject. Four
  estimators. The confidence interval of the weighted estimator uses the weighted standard deviation and the
  effective sample size (Kish).
- **Uncertainty.** Monte Carlo simulation (P10–P90) and leave-one-out analysis.
- **Other approaches.** Income (direct capitalisation), depreciated replacement cost and residual value, with a
  reconciliation by weights and the reasoning for the weights.
- **Rounding** by country (for example 100,000 forint in Hungary), or with a step that the valuer selects.
- **Quality checks** and a quality score from A to E that tells what to improve. New valuations start with neutral
  market inputs, and the valuer must confirm them.
- **Safe inputs.** The key numbers have limits. A zero or negative area gives a warning, not a value.

#### Method and sources

- **Methodology** (`docs/methodology/`): each formula, parameter and threshold of the engine, the uncertainty
  analysis, the other approaches, the international framework (IVS 2025, RICS Red Book, EVS 2025), one card for each
  country and a bibliography with the verification status of each source.
- **Technical paper** (`docs/methodology/paper/`): the method as a paper, with a worked example. The same Markdown
  gives the page on GitHub, an HTML page and an A4 PDF (`tools/paper/`).
- **Method applied in this valuation**: a page of the technical report with the approach, the evidence, the
  adjustment, the weights, the estimator, the confidence interval and the limits. The client report has a short
  method chapter.
- **Methodological references** in the sources chapter of the report, each with its verification status.
- **In the app**: "How the result is computed" in the result step, with the formulas and the sections of the
  methodology, and the sources of the country.

#### Report

- **A4 reports** with automatic page fitting, four covers, design options and agency profiles (white label).
- **Technical sheet**: energy performance, seismic safety and the declarations of conformity of the installations,
  with the cost of remedial works.
- **Document checks**: title, easements, planning, cadastre, energy and more, with the typical documents of the
  country. The report tells what the valuer verified and what to check before signing.
- **Supporting documents**: PDF and images with kind, issuer, date, reference and SHA-256 fingerprint, an annex index
  and a "Digital dossier" ZIP.
- **Export** to PDF, HTML and ZIP. Exported HTML reports contain their maps as images.
- **Chinese reports** embed Noto Sans SC (SIL OFL 1.1), cut to the characters that the report can print.

#### Countries

- **19 country packs**: currency, area basis, national standards and typical documents. Amounts show in the currency
  of the country, also in words. The packs are drafts until local professionals validate them.
- **Location and maps**: address search, a pin that you can move, points of interest and coordinates in WGS84,
  Gauss-Boaga or UTM. Base maps from the national mapping services. The report gives the credit of the map.

#### Interface

- **17 languages** for the interface and the report: Chinese (simplified), Croatian, Czech, Danish, Dutch, English,
  French, German, Hungarian, Italian, Norwegian (bokmål), Polish, Portuguese, Romanian, Russian, Spanish and Swedish.
  One button sets the language of the app and of the report. Numbers, dates, amounts in words and plural forms follow
  the language.
- **Guided workflow**: four phases (property, market, analysis, report) with their steps and states, and a live
  preview of the page that the step changes.
- **Workspace layouts**: Form, Form + document and Document review, with a divider that you can move with the mouse
  or the keyboard. On narrow screens the steps go into a drawer.
- **Comparison view** of the comparables, with an inclusion switch for each comparable.
- **Carta e inchiostro palette**: ivory paper, ink text and a terracotta accent, in a light, a dark and an automatic
  theme. The logo and the reports keep the petrol green of the brand (`docs/design-system.md`).
- **Motion** that shows where the user is and what changed, in 100–240 ms. With reduced motion, nothing moves
  (`docs/motion-guidelines.md`).
- **Accessibility**: text contrast to WCAG AA, accessible names for tables and fields, keyboard access and focus
  management.
- **Support note**: the result and delivery steps state that Valesta supports the valuer and does not replace them.
  The note is not in the exported reports.
- **Phone and tablet layouts**, with a bottom bar on the phone.

#### AI assistant

- **Three modes**: an API key of Anthropic, OpenAI or Google; an OpenAI-compatible service or a local model; the MCP
  server with the AI app of a subscription.
- **Review of each change**: each change of the AI is a proposal that the valuer accepts, edits or rejects. Fields
  that the AI filled stay marked until the valuer confirms them. The valuation keeps a log of the AI, and the report
  states how the valuer used AI.
- **AI guide** (`docs/ai/`): the three modes, step by step, in ASD-STE100 Simplified Technical English.

#### Support and feedback

- **Send feedback** (menu ⋯ → Help): a form whose text you can copy or open as a public issue on GitHub. The app
  sends nothing by itself.
- **Support the project**: a short dialog with a link to the repository. After real use, a small card in the delivery
  step can ask for support. It shows rarely and stops when you select "Don't show again" (`docs/support-and-feedback.md`).

#### Project

- Licence AGPL-3.0-or-later, Contributor License Agreement 1.1, trademark policy 2.0, NOTICE and the licence texts of
  third-party components.
- Continuous integration: build, unit tests, lint, end-to-end tests in Chrome, compliance check (licences, headers,
  secrets, data) and CLA check.
- Valesta imports the settings, archive and agency profiles of Valorem 1.1, the app before Valesta.

### Security

- **Privacy by default.** No data go to an outside service until the user turns that service on. At the first
  start, a window asks which services to use. Nothing is selected before the user chooses.
- **No telemetry.** No account, no server of Domestone, no usage statistics, no advertising.
- **Content-Security-Policy** in all the builds. Only the scripts of the build run.
- **Windows app**: context isolation, sandbox, no Node.js in the page, and only the permission to write to the
  clipboard.
- **MCP server**: it listens on `127.0.0.1` only and keeps files inside its project and report folders.
- **API keys** stay in memory, unless the user tells Valesta to remember them on the device. Valesta never writes a
  key into a project file.

### Known limitations

- Native speakers must review the interface and report texts beyond English, Spanish and Italian. Those texts are AI
  drafts.
- Local professionals must validate the 19 country packs.
- The installers have no code-signing certificate. Windows can show **Windows protected your PC** before the
  installation.
- Check the terms of use of the map and address services for your use.

[1.0.0]: https://github.com/domestone-ai/Valesta/releases/tag/v1.0.0
