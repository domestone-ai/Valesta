# Valesta MCP server

The Valesta MCP server has no dependencies and needs Node.js 20 or later. It gives a Valesta valuation to any MCP client.

Step-by-step instructions for users, with the AI apps that can use this server:
[AI in Valesta, mode C](../docs/ai/README.md#5-mode-c-the-mcp-server-and-the-ai-app-of-your-subscription).

```
node valesta-mcp.js                 # stdio (Claude Desktop, Claude Code, Gemini CLI, LM Studio, Cursor, VS Code…)
node valesta-mcp.js --http          # stdio + http://127.0.0.1:8790 (live web app, /api/project, MCP over HTTP at /mcp)
node valesta-mcp.js --http --no-stdio --port 8790   # HTTP only
options: --project <file.json>  --projects <folder>  --reports <folder>  --web <app folder>  --lang it|en|es
         --geocoder nominatim|https://…   address search for the geocode tool (off by default)
         --maps        outside map tiles in exported reports, embedded in the file (schematic maps by default)
         --geodata     public geodata services for the assistant: OpenStreetMap Overpass via Private.coffee, Spanish Cadastre
         --no-redact   let the assistant read the client's name and the agency's contact details
```

## Client configuration

Claude Desktop (`claude_desktop_config.json`), Gemini CLI (`~/.gemini/settings.json`), LM Studio (`mcp.json`), Cursor
(`~/.cursor/mcp.json`):

```json
{ "mcpServers": { "valesta": { "command": "node", "args": ["C:\\path\\to\\valesta\\mcp\\valesta-mcp.js", "--http"] } } }
```

Claude Code: `claude mcp add valesta -s user -- node /path/to/valesta/mcp/valesta-mcp.js --http`
or, with the server already running over HTTP: `claude mcp add --transport http valesta http://127.0.0.1:8790/mcp`

VS Code (`.vscode/mcp.json`): `{ "servers": { "valesta": { "type": "stdio", "command": "node", "args": ["C:\\path\\to\\valesta\\mcp\\valesta-mcp.js", "--http"] } } }`

## Tools

Project: `project_info`, `project_new`, `project_open`, `project_save`, `project_list`, `report_export` (HTML/PDF via
Chrome or Edge, in the 17 report languages), `open_web_app`. File names and report folders given by a client stay inside
the `Projects` and `Reports` folders (or the folders given with `--projects` and `--reports`).
Valuation (shared with the in-app assistant, `lib/aitools.js`): `get_valuation`, `update_fields`, `add_comparable`,
`update_comparable`, `remove_comparable`, `set_rooms`, `set_report_text`, `compute_valuation`, `review_valuation`,
`geocode` (Nominatim), `nearby_places` (Overpass), `cadastre_lookup` (Sede Electrónica del Catastro).
Prompt: `valesta_assistant`. Resource: `valesta://project/current`.

## Live sync and security

The HTTP server binds to 127.0.0.1 only, rejects other Host and Origin headers (DNS rebinding), serves only the files of
the web app folder, and uses optimistic versioning (`PUT /api/project` with `base` → 409 when stale). The project is saved
to its JSON file after every change.
