# The Atlas Explorer and Rem

This document explains the Atlas Explorer, a single HTML page that shows the whole Atlas project as zoomable diagrams together with these docs and a glossary, and Rem, its chat helper: how to open and read the Explorer, its keys, and where Rem's answers come from.

## What is the Atlas Explorer?

The Atlas Explorer is one standalone HTML file that explains the whole Atlas project. It holds:

- zoomable diagrams of every part of Atlas, from the big picture down to single pages, API routes and database tables;
- a detail sheet for each part, in plain words and in technical words;
- a docs reader with these knowledge documents;
- a glossary of technical words, with popovers that explain a term when you rest the pointer on it;
- Rem, a chat bubble that answers questions from these documents.

The Atlas Explorer is built from the `docs/` folder of the Atlas repository. It is a guide to the project, not part of the Atlas website. It does not connect to the live site, the database or anyone's account.

## How do I open the Atlas Explorer?

Double-click the Atlas Explorer's HTML file to open it in a modern web browser. Nothing needs installing and no server is needed: the diagrams, documents and glossary are all inside the one file, so they work offline. Only the Rem chat needs an internet connection. The built file is not stored in the public repository (`docs/dist/` is listed in `.gitignore`), so it is passed around as a file.

The Explorer's header has the Explore menu (the list of all diagrams), Docs, Glossary, Search, a dark mode switch and help. Every place in the Explorer has its own address after the # sign, so the browser's Back and Forward buttons work inside it.

## Which views does the Atlas Explorer have?

The Atlas Explorer has these views. Their exact contents grow as the Explorer is rebuilt.

| View | What it shows |
| --- | --- |
| System overview ("Atlas at a glance") | Every big part of Atlas, where it runs, and what talks to what |
| Deployment | Where each part runs: Firebase Hosting, and the server with its front door, pm2, PostgreSQL and the uploads folder |
| Frontend | The React website: pages, components, contexts, services and styles |
| Backend | The Express API: routes, middleware, controllers, models, utils and config |
| Request pipeline | The checks one API request passes through, in order |
| Endpoints | A table of every API route with its method, who may call it, its checks and what it does, plus a filter box |
| Data model | The main things Atlas stores and how they relate |
| Database schema | The PostgreSQL tables with their columns and indexes |
| Processes | Step-by-step diagrams of things people do, such as signing in or making flashcards |
| Data flows | Where data travels, such as an uploaded file |
| Flowcharts | Decisions drawn as yes-or-no paths, such as the upload checks |

Processes, Data flows and Flowcharts each open a list of smaller diagrams.

## How do I move around the Atlas Explorer?

The Atlas Explorer starts at the system overview. Click a box to go deeper: a box that has its own diagram opens that diagram (its full picture), and other boxes open a detail sheet. The root track at the top is a breadcrumb: it shows the path from "Atlas" down to the current diagram, and you can click any step to jump back to it. Up goes one level up the root track, and Back returns to the previous place you looked at. Esc closes an open popover, menu, detail sheet or outline first; with nothing open, Esc goes up one level. Each diagram also has a button "Ask Rem about this diagram" and links to related diagrams.

## What is in a detail sheet in the Atlas Explorer?

A detail sheet in the Atlas Explorer describes one part of Atlas, such as a page, a component, an API endpoint, a middleware, a database table, a column or a setting. It starts with an explanation in plain words, then the technical side, a quote from the code, a list of facts, what the part uses and what uses it, the diagrams it appears in, and the docs sections that explain it. Links in the sheet lead on to those related parts, diagrams and docs.

## How does zooming work in the Atlas Explorer?

Each Atlas Explorer diagram has three levels of detail. Zoomed out, you see the main boxes and their names. As you zoom in, more details appear once they are big enough to read, such as the smaller parts inside a box, extra lines of text and more connections; zooming out hides them again. The zoom box shows the zoom in percent and "Detail 1 of 3", "Detail 2 of 3" or "Detail 3 of 3".

Press D, or the details button, to show all details at once whatever the zoom ("All details"); press it again to let the zoom decide. To move around with a mouse or touch screen, drag to pan, use the mouse wheel or pinch to zoom, and double-click to zoom in. The + and - keys zoom, 0 resets the zoom so the whole diagram fits, and the arrow keys pan.

## What do the colors and shapes in the Atlas Explorer mean?

The Atlas Explorer uses the Atlas colors in both light and dark themes. A legend strip under each diagram names only the kinds that diagram uses.

- Main part: green outline and light green fill. It marks the focal piece, the most important one in that picture.
- Atlas code: a plain box for a part that runs Atlas code.
- Stored data: places that keep data, such as PostgreSQL and the uploads folder. They have their own style, so they stand apart from the parts that run code.
- Outside service: a grey box with a thin outline, such as Firebase Authentication or Google Gemini.
- Person: a box with a grey outline, such as the student's browser.
- Planned or optional: a dashed outline, such as the nightly backup job, which is not installed on the server yet.
- Security boundary: a dashed green outline, such as the front door of the server.
- Lines: grey for data or a call, blue for an HTTP or API call, green for the main path, and dashed for something optional, a reply, or something asynchronous (it happens later or in the background).

## Which kinds of diagrams does the Atlas Explorer draw?

The Atlas Explorer draws three kinds of layout:

- Boxes on a grid: the system overview, deployment, flowcharts, the data model, the database schema and state diagrams. In the database schema each table is drawn as a table, with one row per column and then its indexes.
- Sequence diagrams: each part has a dotted lifeline running down the page, and arrows show the messages between parts in time order. Dashed boxes around some messages mark alternatives or optional steps.
- Swimlanes: one lane per part, with the steps of a process or a data flow in order.

Every diagram also has an outline: the same diagram as a plain list of its parts and connections, at every detail level. It is made for screen readers and for anyone who prefers reading to zooming.

## How do the term popovers in the Atlas Explorer work?

Glossary terms in the Atlas Explorer have a dotted underline. Rest the pointer on one (or move to it with Tab) for about 1.5 seconds, and a card opens that explains the term twice: "In plain words" and "Technical". Clicking or tapping a term, or pressing Enter or Space on it, opens the card at once, and Esc closes it. The card has three buttons:

- "Ask Rem about this" sends Rem a ready-made question about the term.
- "Show in diagram" opens the diagram where the term appears, when there is one.
- "Glossary entry" opens the term in the glossary.

Each term is underlined only once per section, so the text stays readable.

## Which keyboard keys does the Atlas Explorer use?

| Key | What it does in the Atlas Explorer |
| --- | --- |
| + and - | Zoom in and out |
| 0 | Reset the zoom so the whole diagram fits |
| Arrow keys | Pan (move) the diagram |
| D | Show all details at once, or let the zoom decide again |
| O | Show or hide the outline, the diagram as a plain list |
| / | Search diagrams, parts, glossary terms and doc sections |
| Esc | Close what is open; with nothing open, go up one level |
| Tab | Move between boxes, links and buttons |

Search in the Atlas Explorer works like Atlas's own search: it uses up to 8 words, matches them from the start of a word, and puts a title that starts with what you typed first.

## What is Rem in the Atlas Explorer?

Rem is the chat bubble in the Atlas Explorer. Ask it a question about Atlas in plain words, such as "How do I reset my password?" or "What does requireAuth do?", and it answers from these knowledge documents. The "Ask Rem" buttons on diagrams and glossary cards send it a ready-made question.

Rem runs on Rem RaaS, the Atlas author's own RAG-as-a-service. RAG means retrieval-augmented generation: first find the passages that match the question, then let an AI model write the answer using only those passages. Rem is not part of the Atlas website, and it cannot see the live site, the database or anyone's account.

## Where do Rem's answers come from?

Rem answers only from the Markdown documents in `docs/knowledge/`, the same documents the Atlas Explorer shows. When the documents are added to Rem (this is called ingesting), Rem splits them at their headings into pieces of at most 1,800 characters and stores a meaning fingerprint for each piece. This fingerprint, called an embedding, is made by Google Gemini.

For each question, Rem finds the few pieces whose meaning is closest to the question and sends them, with the question, to a Google Gemini model. Gemini writes the answer from those pieces only. Rem does not read the Atlas code, the internet or the live site. If a document is out of date or wrong, Rem's answer will be too.

## What happens to my questions in the Rem chat?

When you send a question, the Atlas Explorer sends it over the internet to the Atlas API (`POST /api/ask`), which passes it to the Rem service. The Rem key stays on the Atlas server, so the Explorer file holds no secret and is safe to share. Your recent messages can go along with it, so that a follow-up such as "and for Google accounts?" makes sense; Rem uses at most the last 6 messages and the first 500 characters of each. Rem passes the question and the matching passages to Google Gemini to write the answer, and Google's terms cover what Gemini does with them.

The Rem service does not keep the conversation; it only counts how many questions were asked each day. The Explorer page keeps the conversation only in the browser tab's session storage, so it is gone when you close the tab. Do not type passwords or personal details into the chat.

## What are Rem's limits?

The complete list of limits of the Rem chat in the Atlas Explorer:

- Rem needs an internet connection; the rest of the Explorer does not.
- Rem only knows what these documents say. When they do not cover a question, Rem says it cannot answer from them, and may say what it can help with, instead of guessing.
- When the Rem service or Google Gemini is busy or rate limited, the chat shows a busy message. Wait a moment and ask again.
- The Atlas API accepts 30 questions per 15 minutes from one network address, and the Rem service about 5 requests per second.
- A question can be at most 2,000 characters.
- An answer usually takes a few seconds, longer when the model is busy.
- Answers are written by AI and can contain mistakes. The documents and the code are the final word.
- Rem cannot change anything in Atlas, and it is not a general chatbot.

## How are the Atlas Explorer and Rem kept up to date?

The Atlas knowledge documents and the diagram data live in the Atlas repository under `docs/`. When the project changes, the documents are updated, the Atlas Explorer is rebuilt from `docs/` into a new HTML file, and the changed documents are sent to Rem again (re-ingested), so Rem's answers follow the new version. An older copy of the Explorer file keeps its old diagrams and documents, but its chat still asks the same Rem service, which holds the newest documents. Get a fresh copy of the Explorer after big changes.

## Why do the Atlas docs follow special writing rules?

Rem splits each Atlas document at its headings (one, two or three # signs) and cuts pieces at 1,800 characters, and a section under 120 characters is joined to the one before it. So every section in these documents is written to stand on its own: 120 to 1,700 characters long, with a question as its heading, the subject named again instead of "as mentioned above", and each complete list kept in one section. That way the piece Rem finds holds the whole answer. The documents also use no HTML and no front matter, and no line inside a code block starts with a # sign, because it could be mistaken for a heading.
