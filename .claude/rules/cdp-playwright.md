you will receive a `PLAYWRIGHT_MCP_EXTENSION_TOKEN`. Before connecting, **ask the user which browser to use** (`chrome` or `msedge`). Then connect to the user's existing browser:
```bash
PLAYWRIGHT_MCP_EXTENSION_TOKEN={token} playwright-cli attach --extension={chrome|msedge}
```
After attaching, a session named `{chrome|msedge}` is created. **All subsequent commands MUST use `--s={chrome|msedge}`** to target the correct session. Do NOT open a new browser. Only use `snapshot` for page verification, never `screenshot`.
