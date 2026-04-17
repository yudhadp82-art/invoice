# Invoice App

## Context7 MCP

Repo ini sudah terintegrasi dengan Context7 MCP untuk lookup dokumentasi library saat dipakai dari AI editor atau agent yang mendukung MCP.

Setup:

1. Jalankan `npm install`.
2. Salin `.mcp.json.example` menjadi `.mcp.json`.
3. Isi `CONTEXT7_API_KEY` di `.mcp.json` dengan API key dari https://context7.com/dashboard.

### Codex CLI

Untuk memakai Context7 langsung dari Codex CLI, daftarkan server MCP global:

```powershell
codex mcp add context7 --env CONTEXT7_API_KEY=YOUR_KEY -- node D:\invoice\invoice\node_modules\@upstash\context7-mcp\dist\index.js
```

Lalu restart sesi Codex agar server MCP baru dimuat.

Catatan:

- `.mcp.json` di-ignore oleh Git karena berisi secret lokal.
- Server Context7 dijalankan dari package lokal `@upstash/context7-mcp`, jadi tidak bergantung ke global npm path per user.
- Rule Cursor untuk penggunaan Context7 ada di `.cursor/rules/context7-invoice-stack.mdc`.
