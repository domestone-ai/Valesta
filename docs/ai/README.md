# AI in Valesta: modes and instructions

This guide tells you how to use artificial intelligence (AI) with Valesta. We wrote it in ASD-STE100 Simplified
Technical English.

The guide gives information about the products of other companies. We examined this information on 24 November
2026. These companies can change their products, plans and prices. Before you start, read the pages in
[References](#9-references).

## Contents

1. [What the AI assistant does](#1-what-the-ai-assistant-does)
2. [Select a mode](#2-select-a-mode)
3. [Mode A: the assistant in the app, with an API key](#3-mode-a-the-assistant-in-the-app-with-an-api-key)
4. [Mode B: other providers and local models](#4-mode-b-other-providers-and-local-models)
5. [Mode C: the MCP server and the AI app of your subscription](#5-mode-c-the-mcp-server-and-the-ai-app-of-your-subscription)
6. [Phone and tablet](#6-phone-and-tablet)
7. [Data protection](#7-data-protection)
8. [Problems and solutions](#8-problems-and-solutions)
9. [References](#9-references)

## 1. What the AI assistant does

The AI assistant reads the data that you give to it: text, documents, photos and dictation. It puts these data into
the fields of the valuation.

The assistant can do these tasks:

- Write the data of the property, of the client and of the report into the fields.
- Add and change the comparables, their ratings and the rooms of the property.
- Find the location of the property and the services near it. In Spain, it also finds the cadastral data.
- Search the web for comparables and market statistics.
- Calculate the valuation and do the quality review.
- Write the texts of the report and make them better.

You keep the control of the valuation:

- Each change of the assistant is a proposal. You accept it, edit it or reject it in **AI proposals to review**.
- The fields that the assistant filled stay marked until you confirm them.
- The valuation keeps a log of the work of the assistant. The report shows that you used AI.
- The assistant cannot confirm the market inputs: the negotiation coefficient, the time trend and the annex values.
  You must confirm them.
- The assistant cannot change the coefficients and the annex amounts that you set directly for a comparable.

> **CAUTION:** Examine each proposal before you accept it. You are responsible for the valuation. The AI is not
> responsible for it.

Some tasks use an outside service:

| Task | Setting | Default |
|---|---|---|
| Search the web for comparables and statistics | **Web search (comparables, statistics)**, in the settings of the assistant | On |
| Find the location from the address | **Address search**, in **Privacy and outside services** | Off |
| Find the services near the property and the Spanish cadastral data | **Public geodata services for the assistant (nearby places, Spanish cadastre)**, in the settings of the assistant. It is the same setting as **Geodata services of the assistant**, in **Privacy and outside services**. | Off |

## 2. Select a mode

| | Mode A | Mode B | Mode C |
|---|---|---|---|
| What it is | The assistant in Valesta, with Anthropic, OpenAI or Google | The assistant in Valesta, with another provider or with a model on your computer | The AI app of your subscription, connected to Valesta through MCP |
| What you need | An API key | The address of an OpenAI-compatible service, or Ollama or LM Studio on your computer | Node.js, and an AI app that can use local MCP servers |
| Cost | You pay the provider for each use. | You pay the provider for each use. A model on your computer has no cost. | Your subscription |
| Computer | Yes | Yes | Yes |
| Phone and tablet | Yes | Only services on the internet | No |
| Files | PDF, Word, text, photos | Word, text. Photos only with models that accept images. No PDF. | The files that the AI app accepts |

> **NOTE:** A chat subscription does not include the API. Examples: ChatGPT Plus, Claude Pro, Google AI Pro. For mode
> A, you need an API account. You pay for each use of the API. Some plans include API credits, for example Claude
> Max. Read the pages of the provider.

## 3. Mode A: the assistant in the app, with an API key

### 3.1 The API key

| Provider | Page for the key | Default model in Valesta | Other models in Valesta | Location of the provider |
|---|---|---|---|---|
| Anthropic Claude | <https://platform.claude.com/settings/keys> | `claude-opus-5-5` | `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-2` | United States |
| OpenAI | <https://platform.openai.com/api-keys> | `gpt-5.1` | `gpt-5-mini`, `gpt-4.1` | United States |
| Google Gemini | <https://aistudio.google.com/apikey> | `gemini-2.5-flash` | `gemini-2.5-pro`, `gemini-3-pro-preview` | United States |

1. Open the page of the provider. In the settings of the assistant, **Get a key ↗** opens this page.
2. Sign in, or make a new account.
3. If the provider asks for it, add a payment method or buy credit.
4. Make a new API key.
5. Copy the key.

> **CAUTION:** Do not give your API key to other persons. A person with your key can use your account. You pay for
> this use.

### 3.2 Connect the assistant

1. Open Valesta.
2. Select **Assistant**.
3. Select **Settings**.
4. In **Provider**, select the provider.
5. Paste the key into **API key**.
6. In **Model**, keep the default model, or select a different model.
7. Select **Test connection**.
8. Make sure that Valesta shows **Connection works.**

| Setting | Function | Default |
|---|---|---|
| **Remember the key on this device** | Keeps the key in the browser. The key is not encrypted. When this setting is off, Valesta forgets the key when you close it. | Off |
| **Reasoning depth** | **Fast**, **Balanced** or **Thorough**. A deeper level needs more time and costs more. | **Balanced** |
| **Web search (comparables, statistics)** | Lets the assistant search the web through the provider. | On |
| **Do not send the client’s name or the agency’s contact details** | Keeps these data out of the messages to the provider. | On |
| **Public geodata services for the assistant (nearby places, Spanish cadastre)** | Sends the coordinates of the property to OpenStreetMap Overpass, through Private.coffee (Austria). Sends the cadastral reference or the coordinates to the Spanish Cadastre. These services also receive your IP address. | Off |

Valesta never writes the key into the files of a project.

### 3.3 Use the assistant

1. Write your request in the message field.
2. To dictate your request, select the microphone (**Voice dictation**).
3. To attach files, select the paper clip (**Attach files (PDF, images, text, Word)**). You can also paste files into
   the message field.
4. Select **Send**.
5. Read the reply of the assistant.
6. Examine the proposals in **AI proposals to review**.
7. For each proposal, select **Accept**, **Edit** or **Reject**. To accept all the proposals, select **Accept all**.
8. To cancel all the changes of one request, select **Undo these changes**.

The buttons for quick requests are: **Fill from documents**, **Find comparables**, **Services and cadastre**, **Review
the report**, **Improve the texts** and **Explain the result**.

| File | Limit | What Valesta does |
|---|---|---|
| PDF | 25 MB | Sends the file to the provider. |
| Images (JPEG, PNG, WebP, GIF) | No limit | Makes each image smaller (1600 pixels) before it sends it. |
| Word (`.docx`) | 150,000 characters | Reads the text of the file on your device. Sends only the text. |
| Text (`.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.xml`, `.html`, `.htm`, `.eml`) | 150,000 characters | Sends the text. |

### 3.4 Photos and the condition of the property

The assistant can see these items in the photos: the finishes, the kitchen, the bathrooms, the floors, the windows,
signs of damp and the general maintenance. From the photos, it can propose ratings, for example for the factor
**Condition and finishes**.

The assistant cannot see:

- The installations in the walls, and their conformity.
- Structural defects.
- Work done without a permit.

The light, the furniture and the angle of a photo can give a wrong impression.

> **CAUTION:** Do not use photos as the only source of data for the condition of the property. Do a site visit.

## 4. Mode B: other providers and local models

1. Select **Assistant**, then select **Settings**.
2. In **Provider**, select **OpenAI-compatible / local**.
3. In **Server address (base URL)**, select an address from the list, or write the address of the service.
4. In **Model**, write the name of the model.
5. If the service uses a key, paste the key into **API key**.
6. Select **Test connection**.

| Service | Address | Location |
|---|---|---|
| Ollama | `http://localhost:11434/v1` | Your computer |
| LM Studio | `http://localhost:1234/v1` | Your computer |
| OpenRouter | `https://openrouter.ai/api/v1` | United States |
| Mistral | `https://api.mistral.ai/v1` | France |
| Groq | `https://api.groq.com/openai/v1` | United States |
| Other services, for example DeepSeek, Kimi (Moonshot AI) or Qwen (Alibaba Cloud) | The OpenAI-compatible address in the documentation of the service | Read the documentation of the service |

Limits in mode B:

- The assistant cannot read PDF files. Attach a Word file, or paste the text into your message.
- To read photos, the model must accept images.
- The model must support tool calls. Small models make more mistakes.
- Web search is not available.

A model on your computer keeps the data on your computer. No data go to other companies.

### 4.1 Ollama

1. Install Ollama from <https://ollama.com>.
2. Download a model that supports tool calls. Valesta uses `qwen2.5:14b` by default:
   ```text
   ollama pull qwen2.5:14b
   ```
3. Make sure that Ollama runs.
4. In Valesta, select **OpenAI-compatible / local** and the address of Ollama.
5. In **Model**, write `qwen2.5:14b`.
6. Select **Test connection**.

> **NOTE:** If you open Valesta from the file `Valesta.html`, Ollama must accept the requests from this file. Set the
> environment variable `OLLAMA_ORIGINS` to `*`. On Windows, run `setx OLLAMA_ORIGINS "*"`. On macOS, run
> `launchctl setenv OLLAMA_ORIGINS "*"`. On Linux, read the documentation of Ollama. Then stop Ollama and start it
> again. If you open Valesta from the MCP server (`http://127.0.0.1:8790`), this setting is not necessary.

> **CAUTION:** With `OLLAMA_ORIGINS=*`, all the web pages that you open can send requests to Ollama. Use this setting
> only when you need it.

### 4.2 LM Studio

1. Install LM Studio from <https://lmstudio.ai>.
2. Download a model that supports tool calls.
3. Start the local server of LM Studio.
4. In the server settings of LM Studio, select **Enable CORS**.
5. In Valesta, select **OpenAI-compatible / local** and the address of LM Studio.
6. In **Model**, write the name of the model.
7. Select **Test connection**.

## 5. Mode C: the MCP server and the AI app of your subscription

The Model Context Protocol (MCP) connects an AI app to tools. The Valesta MCP server runs on your computer. It gives
the valuation tools to an AI app on the same computer. With it, you can use the AI app of your subscription. The
server accepts connections only from your computer.

### 5.1 AI apps

| AI app | What you need | Where you add the server |
|---|---|---|
| Claude Desktop | A Claude account | **Settings** > **Developer**: the file `claude_desktop_config.json` |
| Claude Code | Claude Pro, Max or Ultra | The command `claude mcp add` |
| Codex (command line or editor extension) | ChatGPT Plus or Pro. Sign in with ChatGPT. | The file `~/.codex/config.toml`, or the command `codex mcp add` |
| Gemini CLI | A Google account. Google AI Pro or Ultra gives higher limits. | The file `~/.gemini/settings.json` |
| Qwen Code | A Qwen account or an API key | The file `settings.json` of Qwen Code, or the command `qwen mcp add` |
| Kimi CLI (Kimi Code CLI) | A Kimi account or an API key | The command `kimi mcp add`, or the option `--mcp-config-file` |
| Cursor | A Cursor account | The file `~/.cursor/mcp.json` |
| VS Code | GitHub Copilot, or a different AI extension that can use MCP servers | The file `.vscode/mcp.json` |
| LM Studio | No account: a model on your computer | The file `mcp.json` of LM Studio |

> **NOTE:** The plans, the limits and the free use of these apps can change. Examine the current conditions before
> you start.

These apps cannot use the Valesta MCP server:

- The chat web sites, for example chatgpt.com, claude.ai, gemini.google.com, kimi.com, chat.qwen.ai and
  chat.deepseek.com. They run on the servers of their company. These servers cannot connect to your computer. Some of
  these sites can connect to MCP servers on the internet, but the Valesta MCP server is not for the internet.
- The AI apps for phone and tablet.

For DeepSeek: on 24 November 2026, we did not find a DeepSeek app that can use local MCP servers. Use mode B with a
DeepSeek API key. Or use Claude Code with the DeepSeek API, as the DeepSeek documentation tells.

> **CAUTION:** Do not make the MCP server available on the internet, for example with a tunnel. If you do, other
> persons can read and change your valuations.

### 5.2 Prepare the server

You need:

- A computer with Windows, macOS or Linux.
- Node.js 20 or a later version, from <https://nodejs.org>.

Get the server in one of these two ways.

**Download the server (recommended)**

1. Download `Valesta-MCP-1.0.0.zip` from the
   [latest release](https://github.com/domestone-ai/Valesta/releases/latest).
2. Extract the file to a permanent location, for example `C:\Valesta`.
3. Make sure that the folder has the folders `mcp` and `Web` in it.

**Build the server**

You also need Python 3.11 or a later version.

1. Make a copy of the Valesta repository on your computer.
2. In the folder of the repository, run this command:
   ```text
   python -I build.py
   ```
3. Make sure that the build made the folder `dist`, with the folders `mcp` and `Web` in it.
4. Copy the folder `dist` to a permanent location, for example `C:\Valesta`.

The server writes the projects to the folder `Projects` and the reports to the folder `Reports`. These folders are
next to the folder `mcp`.

### 5.3 Add the server to the AI app

In the examples, `C:/Valesta` is the folder of section 5.2. If your folder is different, change the text.

**Claude Desktop, Gemini CLI, Qwen Code, Cursor and LM Studio.** Add this text to the configuration file of the AI app:

```json
{
  "mcpServers": {
    "valesta": { "command": "node", "args": ["C:/Valesta/mcp/valesta-mcp.js", "--http"] }
  }
}
```

If the file already has the section `mcpServers`, add only the entry `valesta`.

**Claude Code.** Run this command:

```text
claude mcp add valesta -s user -- node C:/Valesta/mcp/valesta-mcp.js --http
```

**Codex.** Run this command:

```text
codex mcp add valesta -- node C:/Valesta/mcp/valesta-mcp.js --http
```

Or add this text to the file `~/.codex/config.toml`:

```toml
[mcp_servers.valesta]
command = "node"
args = ["C:/Valesta/mcp/valesta-mcp.js", "--http"]
```

**Kimi CLI.** Run `kimi mcp add`, as the documentation of Kimi CLI tells. Or write the JSON text above into a file.
Then start Kimi CLI with the option `--mcp-config-file` and the name of this file.

**VS Code.** Add this text to the file `.vscode/mcp.json`:

```json
{ "servers": { "valesta": { "type": "stdio", "command": "node", "args": ["C:/Valesta/mcp/valesta-mcp.js", "--http"] } } }
```

### 5.4 Use the server

1. Start the AI app again.
2. Make sure that the AI app shows the Valesta tools. In Claude Code, Codex, Gemini CLI and Qwen Code, type `/mcp`.
3. Ask the AI app to open the Valesta web app. Or, in your browser, open `http://127.0.0.1:8790`.
4. Make sure that Valesta shows **Connected to the MCP server: changes by the external assistant appear here**.
5. Write your request in the AI app.
6. Attach the documents and the photos in the AI app.
7. In Valesta, examine the changes. Valesta shows them as proposals to review.

The server saves the project file after each change.

Examples of requests:

- "Start a new valuation."
- "Read the attached deed and fill in the data of the property."
- "Find the services near the property."
- "Calculate the valuation and do the quality review."
- "Export the report to PDF in Italian."

The server gives these tools to the AI app:

- Project: `project_info`, `project_new`, `project_open`, `project_save`, `project_list`, `report_export`,
  `open_web_app`.
- Valuation: `get_valuation`, `update_fields`, `add_comparable`, `update_comparable`, `remove_comparable`,
  `set_rooms`, `set_report_text`, `compute_valuation`, `review_valuation`, `geocode`, `nearby_places`,
  `cadastre_lookup`.
- Prompt: `valesta_assistant`. Resource: `valesta://project/current`.

| Option | Function |
|---|---|
| `--http` | Also starts the Valesta web app and MCP over HTTP, at `http://127.0.0.1:8790`. |
| `--no-stdio` | Uses only HTTP. |
| `--port <number>` | Sets the port of the HTTP server. The default is 8790. |
| `--project <file.json>` | Opens this project file. |
| `--projects <folder>` | Sets the folder of the projects. The default is `Projects`. |
| `--reports <folder>` | Sets the folder of the reports. The default is `Reports`. |
| `--web <folder>` | Sets the folder of the web app. The default is `Web`. |
| `--lang en`, `--lang es` or `--lang it` | Sets the language of the messages of the server. |
| `--geocoder nominatim` | Turns on the address search with OpenStreetMap Nominatim. With `--geocoder https://…`, the server uses your service. |
| `--maps` | Puts map tiles from outside services into the exported reports. |
| `--geodata` | Turns on the public geodata services for the assistant. |
| `--no-redact` | Lets the AI app read the client’s name and the agency’s contact details. |

Data in mode C:

- The server keeps the valuation on your computer.
- The AI app sends to its company your messages, your attachments and the data that the tools give to it.
- The tools do not give the photos of the project to the AI app.
- The client’s name and the agency’s contact details stay hidden from the AI app. The option `--no-redact` shows them.

## 6. Phone and tablet

Valesta operates on a phone and on a tablet. You can install it as a web app. You can also build the Android and iOS
apps from the folder `native`.

- Mode A operates.
- Mode B operates with services on the internet. A model on your computer is not available on the phone, because
  the phone cannot connect to `localhost` of the computer.
- To take photos, select the paper clip. The phone shows the camera, the gallery and the files.
- To dictate, select the microphone. If Valesta shows **Dictation is not supported by this browser.**, use the
  microphone of the keyboard of the phone.
- Mode C does not operate on a phone or on a tablet.

To use mode C after a site visit:

1. On the phone, do the site visit. In Valesta, take the photos and write the data that you find.
2. Select **Save**. Valesta saves the valuation to a file (`.json`), with the photos.
3. Move the file to the computer.
4. Copy the file into the folder `Projects` of the MCP server.
5. In the AI app, write "Open the project" and the name of the file.
6. To let the AI app see the photos, attach them in the AI app. The tools do not give the photos of the project to
   the AI app.

> **NOTE:** Valesta keeps each valuation on the device where you make it. Valesta does not synchronize the valuations
> between devices.

## 7. Data protection

- Valesta keeps the valuations on your device. Domestone receives no data.
- No data go to an outside service until you turn on that service. You do this at the first start, or in **Privacy
  and outside services**.
- The assistant sends data to the provider only when you use it.
- The settings of the assistant show where the provider is.
- If the provider is outside the European Economic Area, examine the data safeguards in your contract with the
  provider. Tell your clients.
- Do not send personal data that the valuation does not need.

## 8. Problems and solutions

| Problem | Cause | Solution |
|---|---|---|
| Valesta shows **Enter the API key in the settings.** | There is no key. | Paste the key into **API key**. |
| The provider refuses the key. | The key is not correct, or the account has no credit. | Make a new key. Examine the credit of the account. |
| Valesta shows **no network or the provider blocks browser requests (CORS)**. | There is no connection, or the service does not accept requests from the browser. | Examine the connection. For Ollama, set `OLLAMA_ORIGINS` (section 4.1). For LM Studio, select **Enable CORS**. |
| Valesta shows **Dictation is not supported by this browser.** | The browser has no speech recognition. | Use Chrome, Edge or Safari. Or use the microphone of the keyboard. |
| Valesta shows **File too large** and the name of the file. | The PDF is larger than 25 MB, or the text has more than 150,000 characters. | Divide the file into smaller files. |
| Valesta shows **Cannot read** and the name of the file. | Valesta cannot read this type of file. | Attach a PDF, an image, a Word file (`.docx`) or a text file. |
| The assistant reports **path not editable**. | The assistant tried to change a field that only you can change. | Do the change yourself. |
| The AI app does not show the Valesta tools. | The path to `valesta-mcp.js` is not correct, or Node.js is not installed. | Examine the path. Run `node --version`. Start the AI app again. |
| `http://127.0.0.1:8790` does not show the project of the AI app. | A different program uses the port 8790. The server then uses the next free port, from 8791 to 8799. | Ask the AI app to open the Valesta web app. Or set a free port with `--port`. |

## 9. References

We examined these pages on 24 November 2026.

- OpenAI: [What is ChatGPT Plus?](https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus) and
  [Managing billing for ChatGPT and the API platform](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform)
- OpenAI: [Codex: authentication](https://developers.openai.com/codex/auth) and
  [Codex: MCP](https://developers.openai.com/codex/mcp)
- OpenAI: [Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
- Anthropic: [Why is Claude API usage billed separately from my paid Claude plan?](https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-do-i-have-to-pay-separately-to-use-the-claude-api-and-console)
  and [API credits for Max, Ultra, and Team plans](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)
- Anthropic: [Getting started with local MCP servers on Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
  and [Use Claude Code with your Pro, Max, or Ultra plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan)
- Google: [Google AI plans (Gemini API)](https://ai.google.dev/gemini-api/docs/google-ai-plans),
  [MCP servers with Gemini CLI](https://www.geminicli.com/docs/tools/mcp-server) and
  [Gemini CLI: frequently asked questions](https://www.geminicli.com/docs/resources/faq)
- Qwen: [Connect Qwen Code to tools via MCP](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/) and
  [Qwen Code: authentication](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/auth/)
- Moonshot AI: [Kimi CLI](https://github.com/MoonshotAI/kimi-cli)
- DeepSeek: [Integrate with Claude Code](https://api-docs.deepseek.com/guides/agent_integrations/claude_code)
- Valesta: [the MCP server](../../mcp/README.md) and [Data and privacy](../../README.md#data-and-privacy)
