# Atlas docs and the Atlas Explorer

This folder documents the whole Atlas project in two forms:

- `knowledge/`: one Markdown file per topic (29 files, with the glossary). They are written for people and for Rem, the chat assistant, which answers from them. They are public: never put a password, key, IP address or server path in them.
- The **Atlas Explorer**: one standalone HTML file with every diagram of Atlas, all the docs, the glossary, search, and the Rem chat. Zoom in on a diagram to see more detail, click any part for its full picture, and hover over a dotted term for a plain-words explanation.

This README is not sent to Rem.

## Build the Explorer

```
cd frontend && npm ci && cd ..      # once: the build embeds the website's fonts
node docs/build-explorer.js
```

The result is `docs/dist/atlas-explorer.html` (about 2.2 MB). Open it in any browser, even offline: everything except the chat works without a connection. The build first checks the docs, every diagram's layout, the colour contrast and the safety rules, and writes nothing when one of them fails.

Options:

- `--no-chat` leaves the chat out.
- `--private` also writes `atlas-explorer-private.html`, which adds the notes in `docs/private/`. Keep that file on your own computer.
- `--snapshots` also writes one static page per diagram and zoom level to `docs/dist/snapshots`, for the diagram-design `self_check.py`.

## The chat and sharing the page

The chat asks the Atlas API (`POST /api/ask`), which passes the question to the "Atlas docs" service in Rem RaaS. The build takes the API address from `VITE_API_URL` in `frontend/.env.production`, or from `ATLAS_API_URL` in `docs/.env` if set. **The built page contains no key**: the Rem key stays on the server, in `backend/.env` (`RAAS_URL`, `RAAS_KEY`), so the page can be shared freely. The API allows 30 questions per 15 minutes per visitor. `docs/dist/` is ignored by git only because it is build output.

The ingest script below still needs `docs/.env` (copy `docs/.env.example`) with `RAAS_URL` and a key of the service. That key can delete or replace the Atlas docs in Rem and spends the free Gemini quota that the other Rem services share, so keep it private. If it leaks: make a new key in the dashboard, put it in `docs/.env` and in the server's `backend/.env`, restart the API, and run `node docs/ingest-docs.js --all` in case the docs were changed.

## Send the docs to Rem

```
node docs/ingest-docs.js --dry-run     # see what would be sent
node docs/ingest-docs.js               # send new and changed files
node docs/ingest-docs.js --ask "How are uploads checked?"
```

Run it after every change in `knowledge/`. It runs the same checks as the build, sends only the files that changed (it remembers them in `docs/.ingest-state.json`), and stops if the service holds files that are not Atlas docs, which usually means a wrong key. `--all` sends everything again, `--only glossary.md` sends one file, and `--prune` also deletes files that no longer exist here. Every upload uses embedding requests from the shared quota, so do not run `--all` without a reason.

## Write a doc

- One topic per file, with a short lowercase name like `rate-limits.md`, listed in `explorer/data/docs-index.js`.
- One `#` title, then `##` sections phrased as the questions people ask ("How does the Atlas flashcard limit work?"). Rem cuts the files at the headings, so every section must make sense on its own: name Atlas and the subject again instead of writing "it" or "as above".
- Each section is 120 to 1800 characters. No front matter, no HTML, no `####` headings, and no line starting with `#` inside a code block.
- New terms go into `knowledge/glossary.md`: `## Term`, then a `Technical:` line, an `In plain words:` line, and optionally `Also called:`.
- Server details that must stay private go into `docs/private/` (ignored by git, never sent to Rem). Strings listed in `docs/private/denylist.txt` stop the build and the upload when they appear in a public doc.

## Draw a diagram

Diagrams are data in `explorer/data/views/<id>.js`; the engine in `explorer/core/` lays them out. `explorer/VIEWS.md` explains the format and the rules. While drawing:

```
node docs/preview-view.js <id>          # lists layout problems, writes docs/dist/preview/<id>-lod1..3.html
node docs/shoot-explorer.js <id>        # screenshots of the built page, fit / 1.5x / 2.6x, light and dark
```

The diagrams of every API endpoint (`ep.*`) and every page (`page.*`) are drawn by the build from the code (`lib/generated-views.js`), so they stay correct when the code changes.

## Check everything

```
node docs/build-explorer.js --snapshots
node docs/check-explorer.js
cd docs && ../frontend/node_modules/.bin/eslint . --max-warnings 0
```

`check-explorer.js` opens the built page in headless Edge and uses it like a visitor: every diagram, the keys, a part's sheet, a doc link, a term card, the glossary and the chat pane (Node 22 or newer). The snapshots can be checked with the diagram-design skill's `self_check.py --offline`.

The Explorer's code follows the same beginner-friendly house style as the website (no classes, spread, optional chaining or `??`), and no arrow functions.
