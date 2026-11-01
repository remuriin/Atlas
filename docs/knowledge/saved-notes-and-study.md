# Saved study reviewers and notes

Logged-in Atlas users can save any study reviewer to a private Saved list and open it on a study page that shows the file, their own formatted notes and AI flashcards. This page explains what saving stores, what happens when the original study reviewer is deleted or hidden, how the note editor, autosave and note limits work, how notes are cleaned and downloaded, and who can see them.

## What happens when I save a study reviewer in Atlas?

Pressing Save on a study reviewer's card or page adds it to your Atlas Saved list (`PUT /api/reviewers/:id/save`). Saving needs a login: a visitor is sent to the login page with "Log in to save study reviewers." Atlas stores one row in the `saved_items` table with your user id, the study reviewer's id, the time you saved it, and a snapshot (a copy) of its title, subject and strand. The snapshot keeps your saved copy readable if the original is ever deleted, and it is updated whenever the uploader edits the details or an admin fixes the category. The database allows only one saved copy per person and study reviewer (`UNIQUE (user_id, reviewer_id)`), so pressing Save twice, or two quick clicks, still keeps one copy. Your notes for that study reviewer live in the same row. A study reviewer hidden by reports cannot be saved by anyone except its uploader and the admins. Once it is saved, its page shows a "Study with notes and flashcards" button that opens the study page.

## How do I remove a study reviewer from my Atlas Saved list?

There are two ways to remove a saved study reviewer in Atlas, and both delete your notes and flashcards for it:

- Press the Saved button again on its card or page (`DELETE /api/reviewers/:id/save`).
- Press Remove on its card on the Saved page (`DELETE /api/saved/:savedId`).

Both ask first with "Remove from Saved?" and the warning `Your notes and flashcards for “[title]” will be deleted too. This cannot be undone.` There is no undo and no trash folder: the `saved_items` row holds the notes, and the flashcards are deleted together with it. Saving the same study reviewer again later starts with empty notes and no flashcards. Removing a study reviewer from Saved does not change the original or its upvotes.

## What does the Atlas Saved page show?

The Atlas Saved page at `/saved` lists every study reviewer you saved, most recently saved first (`frontend/src/pages/SavedPage.jsx`). Only you can see it. Each card shows the strand pill, the title as a link to the study page, the category, the uploader's name and the file type while the original exists, "Has notes" or "No notes yet", the number of flashcards, the date you saved it, and a Remove button. When nothing is saved yet, the page says "Nothing saved yet" and links to the feed. The list comes from `GET /api/me/saved`, which never includes the notes themselves, only whether they contain any visible text.

## What happens to my saved copy if the original is deleted?

If a study reviewer you saved in Atlas is deleted (by its uploader, by an admin, or because the uploader deleted their account), your saved copy is kept. The database sets the saved row's `reviewer_id` to NULL (`ON DELETE SET NULL` in `backend/db/schema.sql`) instead of deleting the row, so these stay:

- The snapshot of the title, subject and strand.
- Your notes, which you can still read, edit, save and download.
- Your flashcards, which you can still study, mark and delete.

What is lost: the file itself, the grade, quarter, material type, uploader's name and upvotes. The Saved page marks the card with "The original was removed by its uploader. Your notes and flashcards are still here.", and the study page says "The uploader removed the original, so its file is no longer available. Your notes and flashcards are still yours." The same wording is used when an admin deleted it. No new flashcard set can be made, because flashcards are made from the file: Atlas answers 409 "The original study reviewer was removed, so new flashcards cannot be made from it."

## What happens to my saved copy if the original is hidden by reports?

When a study reviewer is hidden after three reports, it stays in the Atlas Saved list of everyone who saved it, together with their notes and flashcards. While it is hidden, its file answers 404 "That study reviewer could not be found." to everyone except the uploader and the admins, so the study page shows that message where a PDF, image or text file would be, the download link fails, and the link to its own page shows "Study reviewer not found". Notes keep saving normally. Making flashcards reads the stored file directly on the server and does not check whether the study reviewer is hidden, so a new set can still be made. Once an admin restores it or fixes its category, the file shows again. If an admin deletes it, the saved copy becomes a removed one (see [what happens if the original is deleted](#what-happens-to-my-saved-copy-if-the-original-is-deleted)).

## What is on the Atlas study page?

Opening a saved study reviewer goes to its Atlas study page at `/saved/:savedId` (`frontend/src/pages/StudyPage.jsx`). It has two tabs, and the chosen tab is kept in the address (`?tab=flashcards`), so the Back button brings it back:

- Material and notes: the file viewer and your notes side by side. PDFs show in the browser's own PDF viewer, PNG and JPG files as a picture, and text files as plain text. Word and PowerPoint files cannot be shown in a browser, so they offer a download. "Download file" saves the file to your device. "Open in new tab" shows a PDF or image whole in a new tab (some phone browsers only show the first page of a PDF inside the study page); for a text file it downloads the file instead, because Atlas sends text files as downloads.
- Flashcards: make and study AI flashcards (see [how Atlas makes flashcards](flashcards.md#how-does-atlas-make-flashcards)).

Your notes stay loaded, only hidden, while the Flashcards tab is open, so switching tabs never loses notes that are still being saved. The page also links back to Saved and to the study reviewer's own page. A saved item that is not yours, or no longer exists, shows "This saved study reviewer is not in your list. It may have been removed."

## What formatting can I use in Atlas notes?

The Atlas note editor (`frontend/src/components/NoteEditor.jsx`) formats text while you type, with a toolbar and keyboard shortcuts:

- Bold and italic.
- Three heading sizes, H1, H2 and H3. Pressing the heading a line already has turns it back into a normal paragraph.
- Bulleted lists.
- Indent and outdent, for lines and for nested bullets.
- Five text colors (red, orange, green, blue, purple) plus Default, and five highlights (yellow, green, blue, pink, orange) plus None. The colors stay readable in the light and dark themes.

Not offered: numbered lists, underline (Ctrl+U does nothing, because underline would vanish after saving), links, images, tables and font choices. Pasted text always arrives as plain text, so formatting, links and pictures copied from websites never come in; you can format the text afterwards. Dragging and dropping content into the editor is turned off, but copy and paste work. Spell check is on.

## What keyboard shortcuts does the Atlas note editor have?

The Atlas note editor accepts these shortcuts; on Apple devices, use Cmd instead of Ctrl:

| Shortcut | What it does |
| --- | --- |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+Alt+1`, `Ctrl+Alt+2`, `Ctrl+Alt+3` | Heading 1, 2 or 3 (press again for a normal paragraph) |
| `Ctrl+Shift+8` | Bulleted list |
| `Ctrl+]` | Indent |
| `Ctrl+[` | Outdent |
| `Ctrl+U` | Nothing, because underline is not kept |

The Tab key moves on to the next button instead of typing a tab, so keyboard users can leave the editor. Esc closes an open text color or highlight menu and puts focus back on its button. The bold, italic, heading, list and indent buttons show their shortcut in a tooltip, and the hint under the "Your notes" heading lists the shortcuts too.

## How does autosave work for Atlas notes?

Atlas notes save themselves to your account (`PUT /api/saved/:savedId/notes`, driven by `frontend/src/components/NotesPanel.jsx`):

- Autosave runs 1.5 seconds after you stop typing. Every change restarts the timer, so a save happens once typing pauses.
- The status line under the editor says "Changes not saved yet.", "Saving…", "All notes saved at" followed by the time, or "Not saved:" followed by the server's reason.
- "Save now" saves at once. It does nothing while a save is running, when nothing has changed, or when the notes are too long.
- Closing the tab or reloading the page with unsaved changes makes the browser ask whether to leave first.
- Moving to another page inside Atlas before the 1.5 seconds are up still sends the last changes as you leave, without waiting for the answer.
- Notes that are too long are not autosaved; the status line says what to remove.

Because notes are stored on the server, they appear on any device where you log in. Note saves have their own roomy rate limit of 600 per 15 minutes, separate from the stricter limit for uploads and other changes.

## How long can Atlas notes be?

Atlas notes for one saved study reviewer have two limits, checked in the browser and again by the server (`validateNotes` in `backend/src/utils/validate.js`):

- 20,000 visible characters: the text you see, with the formatting tags taken out. A counter under the editor shows, for example, "1,234 / 20,000 characters". Above the limit the status line says "Too long to save: remove" and the number of extra characters, and the server answers 400 "Notes can be at most 20000 characters."
- 100,000 characters of stored HTML: the text plus its formatting tags. Heavy formatting uses up room, so this limit can be reached first; the status line then says "Too long to save: remove some text or formatting." and the server answers 400 "These notes are too long to save. Make them shorter."

The database also refuses notes over 100,000 characters (`saved_items_notes_size` in `backend/db/schema.sql`), and the API accepts request bodies of at most 512 KB. Empty notes are allowed.

## Which HTML does the Atlas server accept in notes?

Atlas stores notes as simple HTML, and the server (`NOTES_TAG_PATTERNS` in `backend/src/utils/validate.js`) accepts only these tags, written exactly like this, with no other attributes:

- Opening and closing tags without attributes: `p`, `h1`, `h2`, `h3`, `strong`, `em`, `ul`, `li`, `blockquote`.
- Line breaks: a `br` tag, with or without a closing slash.
- Text colors: a `span` tag whose only attribute is `class="tc-red"`, `class="tc-orange"`, `class="tc-green"`, `class="tc-blue"` or `class="tc-purple"`, and its closing tag.
- Highlights: a `mark` tag whose only attribute is `class="hl-yellow"`, `class="hl-green"`, `class="hl-blue"`, `class="hl-pink"` or `class="hl-orange"`, and its closing tag.

Anything else, including links, images, styles, scripts, event handlers or a tag that never closes, makes the server answer 400 "These notes contain formatting that is not allowed." A less-than sign in the text must be stored as `&lt;`, which the editor always does. Because no other attribute is possible, nothing stored in notes can run code or load anything from another site. The browser keeps the same lists in `frontend/src/services/noteHtml.js`.

## How does Atlas clean notes in the browser?

Browsers fill an editable box with whatever HTML they like, so Atlas rebuilds the notes from scratch after every change (`frontend/src/services/noteHtml.js`), using the same allowlist as the server:

- `b` becomes `strong`, `i` becomes `em`, `div` and other text blocks become `p`, headings 4 to 6 become `h3`, numbered lists become bulleted lists, and indents become `blockquote`.
- Bold, italic and colors that the browser wrote as inline styles or `font` tags become the allowed tags and classes.
- Code, media and form elements, such as `script`, `style`, `iframe`, `img`, `video`, `svg`, `input` and `button`, are dropped together with their content.
- Neighbouring text with the same formatting is merged into one tag.

Stored notes are read with `DOMParser`, which builds an inert copy: scripts never run and images never load. Notes written before formatting existed are stored as plain text (`notes_format` is `text`) and become one paragraph per line when opened; the next save stores them as HTML. The server still checks every save, so the browser cleaning keeps the editor tidy but is not the only safeguard.

## How do I download my Atlas notes?

"Download notes" on the Atlas study page saves your notes as a plain text file, made in your browser without asking the server (`toPlainText` in `frontend/src/services/noteHtml.js`). The file is named after the study reviewer's title followed by ` - notes.txt`; characters that some systems refuse in file names are removed, and the title is cut at 80 characters. The file starts with "Notes:" and the title, then "Downloaded from Atlas on" and the date and time. Formatting becomes simple text marks: one to three `#` signs before headings, `-` before bullets, two spaces per indent level, `**bold**` and `*italic*`. Text colors and highlights are dropped, but the colored text itself is kept. To keep a copy of the study material itself, use "Download file" above the viewer.

## Who can see my Atlas saved study reviewers and notes?

Only you. Every `/api/saved/...` address checks that the saved item belongs to the logged-in person (`loadSavedItem` in `backend/src/middleware/savedAccess.js`). Someone else's saved item gets the same 404 "That saved item could not be found." as a missing one, so nobody can find out what others saved by trying numbers. Your notes are sent only to you, through `GET /api/saved/:savedId`; lists such as `GET /api/me/saved` only say whether notes exist. Admins have no page or API route for other people's saved items, notes or flashcards, and the uploader of a study reviewer cannot see who saved it. Notes are stored in the Atlas database on the server, so the people who run the server could read the database. Deleting your account deletes your saved items, notes and flashcards.
