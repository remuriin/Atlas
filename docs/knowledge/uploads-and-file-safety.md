# Uploads and file safety in Atlas

Atlas lets logged-in students share study reviewers as files. This page explains which file types Atlas accepts, the size and count limits, every check an uploaded file passes before it is saved, where files are stored, how they are sent back to readers, and what the checks cannot catch. The upload code lives in `backend/src/middleware/upload.js`, `backend/src/middleware/checkUpload.js` and the helpers in `backend/src/utils/`.

## Which file types can I upload to Atlas?

Atlas accepts files with seven extensions for a study reviewer: PDF, Word, PowerPoint, text, PNG and JPG files. A file is accepted only when both its extension and its content type (the MIME type, a label such as `application/pdf` that the browser sends with the file) match one pair of the allowlist in `backend/src/middleware/upload.js`:

| Extension | Content type |
| --- | --- |
| `.pdf` | `application/pdf` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `.txt` | `text/plain` |
| `.png` | `image/png` |
| `.jpg` | `image/jpeg` |
| `.jpeg` | `image/jpeg` |

The upload form checks the same extensions first (`frontend/src/services/fileRules.js`), and its file picker only offers them. Any other file gets the answer 415 "That file type is not allowed. Upload a PDF, Word, PowerPoint, text, PNG, or JPG file." Some computers label Office files with an unusual content type (for example when Office is not installed); Atlas refuses those uploads with the same message even though the file itself is fine. PDF, PNG, JPG and text files open inside Atlas, while Word and PowerPoint files can only be downloaded, so the form suggests saving them as PDF.

## Why does Atlas refuse old .doc and .ppt files?

Atlas does not accept new uploads in the old Word (`.doc`) and PowerPoint (`.ppt`) formats, because those formats can carry macros: small programs inside the document, and the most common way Office files spread malware. The upload form says "Old Word and PowerPoint files (.doc, .ppt) are not allowed. Save it as .docx, .pptx, or PDF first." and the server refuses them with its usual 415 "That file type is not allowed" answer. The newer `.docx` and `.pptx` formats are accepted, and a macro-enabled file renamed to `.docx` or `.pptx` is still caught by the content check (see [what Atlas checks inside Office files](#what-does-atlas-check-inside-word-powerpoint-image-and-text-files)). Old `.doc` and `.ppt` study reviewers uploaded before this rule existed still download normally, but flashcards cannot be made from them.

## How big can an upload to Atlas be?

One Atlas upload holds exactly one file of at most `MAX_FILE_SIZE_MB` megabytes, which is 10 MB unless the server's `backend/.env` sets another value. The upload form checks the size first (using `VITE_MAX_FILE_SIZE_MB`, also 10 by default) and says "That file is too large. The limit is 10 MB." The server enforces the same limit while the file streams in: multer, the library that receives uploads, stops reading at the limit and deletes the part already written, and Atlas answers 413 with the same message. Empty files are refused too, with "This file is empty." Sending more than one file answers 400 `Upload one file at a time, in the "file" field.` The text fields of the upload form are limited as well, to at most 10 fields of at most 20 KB each.

## How many study reviewers can one person upload to Atlas?

Each person can have at most `MAX_UPLOADS_PER_USER` study reviewers on Atlas at a time, 50 by default. The limit is checked right after login and before the file is read (`checkUploadQuota` in `backend/src/middleware/reviewerAccess.js`), so nothing is stored for someone who is already at the limit. The server then answers 403 "You have 50 study reviewers, the most one person can share. Delete one from your profile to upload another." The Upload page asks the server first: while there is room it says "You have shared X of 50.", and at the limit it shows a note and a link to the profile instead of the form. Replacing the file of an existing study reviewer does not count as a new upload, and deleting a study reviewer frees a place.

## How does Atlas check an uploaded file?

Atlas runs these steps in this order for a new upload (`POST /api/reviewers` in `backend/src/routes/reviewersRoutes.js`). Each step must pass before the next one runs; the number after "or" is the HTTP status code the server answers with:

1. Rate limit: at most 120 changes per 15 minutes from one network address, or 429.
2. Login: a valid Firebase login token, or 401.
3. Upload quota: fewer than 50 study reviewers, or 403. The file has not been read yet.
4. Type filter (multer): extension and content type match the allowlist, or 415. The file never touches the disk.
5. Size limit: at most 10 MB, or 413. The partial file is deleted.
6. Content check (`utils/fileContents.js`): the file's own bytes match its type, or 415.
7. Virus scan (`utils/virusScan.js`): scanner failure 503, threat found 422.
8. Fingerprint: the SHA-256 hash of the file is computed.
9. A file is present, or 400.
10. Form fields (title, description, category, tags) are valid, or 400.
11. The rights checkbox is ticked, or 400.
12. Duplicate check: no study reviewer has the same fingerprint, or 409.
13. The study reviewer is saved, and Atlas answers 201.

Steps 6 to 8 run in `backend/src/middleware/checkUpload.js`, and steps 9 to 13 in `createReviewer` in `backend/src/controllers/reviewersController.js`. Any refusal from step 5 on deletes the uploaded file at once. Editing with a replacement file runs the same steps, except that the quota is skipped and only the uploader may continue.

## What does Atlas check inside a PDF?

Atlas checks the bytes of every PDF in `backend/src/utils/fileContents.js`, because the extension and content type are chosen by the uploader, and a program renamed to `notes.pdf` would pass them. A PDF must contain the signature `%PDF-` within its first 1,024 bytes (some PDF writers put a little junk before it), or Atlas answers 415 "This file is not a real PDF." Atlas then searches the whole file for these PDF names:

- `/JavaScript` and `/JS`, which run scripts;
- `/Launch`, which opens other programs;
- `/EmbeddedFile` and `/EmbeddedFiles`, which hide whole files inside the PDF.

If any of them appears, the upload is refused with 415 "This PDF contains scripts or attached files, which are not allowed. Print it to a new PDF and upload that one." Printing to a new PDF keeps the pages but drops scripts and attachments. Study notes never need these features. The search reads the file as it is stored, so a name hidden inside a compressed part of the PDF is not seen; the virus scan is the next layer there.

## What does Atlas check inside Word, PowerPoint, image and text files?

Besides PDFs, Atlas checks every other allowed file type by its contents in `backend/src/utils/fileContents.js`. Each failure answers 415 and deletes the file:

- Any type: a file of 0 bytes is refused with "This file is empty."
- `.docx` and `.pptx` are ZIP archives full of XML files. The archive must open with `backend/src/utils/zipReader.js` and contain `[Content_Types].xml` plus `word/document.xml` (Word) or `ppt/presentation.xml` (PowerPoint), or the answer is "This file is not a real Word or PowerPoint file." A password-protected Office file is stored in a different, encrypted format, so it fails this check too.
- Macros: any part named `vbaProject.bin`, which is what a macro file such as `.docm` renamed to `.docx` contains, gives "This file contains macros, which are not allowed. Save it as a normal .docx or .pptx, or as a PDF."
- `.png` must start with the 8-byte PNG signature, or "This file is not a real PNG image."
- `.jpg` and `.jpeg` must start with the bytes FF D8 FF, or "This file is not a real JPG image."
- `.txt` must hold no control bytes other than tab, line feed, form feed and carriage return, or "This file is not plain text. If it is text, save it as UTF-8 and try again." Text saved as UTF-16 contains zero bytes and fails this check.

## How does Atlas guard against zip bombs in Word and PowerPoint files?

A zip bomb is a tiny compressed file that unpacks into gigabytes and can use up a server's memory. Atlas reads Word and PowerPoint archives with its own small reader, `backend/src/utils/zipReader.js`, built on Node's `zlib`, with these guards:

- At most 5,000 entries in one archive; more makes the file unreadable.
- Each unpacked part stops at 50 MB (`maxOutputLength`): unpacking ends as soon as the limit is passed.
- Only plain ZIP is read. ZIP64 archives are refused, and entries that are encrypted or use a compression method other than "stored" or "deflate" are skipped.
- Nothing is unpacked before it is needed. The upload check only lists the names inside the archive and unpacks nothing; parts are unpacked later, when flashcards read the text of `word/document.xml` or of the slides.

During the upload check an unreadable archive gives "This file is not a real Word or PowerPoint file." When flashcards read a damaged archive, Atlas answers 422 "This file could not be read. It may be damaged."

## How does the Atlas virus scan work?

After the content check, Atlas can scan every upload with ClamAV, the free antivirus most Linux servers use (`backend/src/utils/virusScan.js`). The `CLAMAV_MODE` setting in `backend/.env` picks how:

- `off`: no scan. This is the default, meant for development. A server running in production mode logs "Warning: CLAMAV_MODE is off, so uploads are not virus-scanned." when it starts.
- `daemon`: the file is streamed to the running ClamAV service through its socket (`CLAMAV_SOCKET`). Fast, but the service keeps about 1 to 1.5 GB of RAM in use. Timeout 30 seconds.
- `command`: the `clamscan` program runs once per upload. Low memory, but each scan takes 10 to 30 seconds. Timeout 120 seconds.

Any other value stops the server at start-up. The scan fails closed: if the scanner cannot run or does not answer in time, the file is deleted and Atlas answers 503 "Uploads are paused because the virus scan is not working. Try again in a few minutes." If ClamAV finds a threat, the file is deleted, the server log records the user id and the threat name, and Atlas answers 422 "The virus scan flagged this file as unsafe, so it was not uploaded." On the live Atlas server ClamAV is installed and `CLAMAV_MODE` is `daemon` (checked 2026-10-31); the EICAR test upload that confirms the scan end to end is still to do.

## How does Atlas stop the same file being uploaded twice?

Every accepted upload gets a fingerprint: the SHA-256 hash of its bytes, stored in `reviewers.file_hash`. Identical files always have the same fingerprint, and any change to a file gives a different one. Before saving, Atlas looks the fingerprint up; if another study reviewer already has it, the upload is refused with 409 and the existing title, for example "This exact file is already on Atlas as “Stoichiometry Practice Test”. Search for it instead of posting it again." A unique index in the database also refuses the second copy when two identical uploads arrive at the same moment; that case answers 409 "This exact file is already on Atlas. Search for it instead of posting it again." When editing, uploading the study reviewer's own current file again is allowed. Files uploaded before fingerprints existed have none, so a copy of one of them is not caught. The check compares exact bytes only: the same notes exported again as a new PDF count as a different file.

## What details does an Atlas upload form need?

Besides the file, the Atlas server checks the form fields in `backend/src/utils/validate.js` and answers 400 "Some details need fixing. Check the highlighted fields." with a message next to each field that has a problem:

- Title: 3 to 120 characters.
- Description: 10 to 2,000 characters.
- Strand, grade (11 or 12), quarter (1st to 4th) and material type: one of the listed values.
- Subject: one of the subjects that the chosen strand takes.
- Tags: optional and comma-separated, at most 8 tags of at most 30 characters each. Tags are stored in lowercase, and repeats are dropped.
- Rights checkbox: "I made this file, or I have the right to share it" must be ticked, or 400 "Confirm that you made this file or have the right to share it." The time of the confirmation is stored in `reviewers.rights_confirmed_at`.

The checkbox is asked for every new file: a first upload, or a replacement file when editing. Editing only the text does not ask for it again. The browser runs the same checks before sending, so most problems show up at once, but only the server's checks can be trusted.

## Where does Atlas store uploaded files?

Atlas stores uploaded files on the server's own disk, in the folder set by `UPLOAD_DIR` (by default `uploads` inside the backend folder), not in Firebase Storage. Each file gets a new random name: 32 hexadecimal characters made from 16 random bytes, plus the allowed extension, such as `3f9a…c2.pdf`. The name of the uploader's file is never used on disk, so a tricky name such as `../../server.js` cannot escape the uploads folder, and every read and delete also strips folder parts with `path.basename` as a second guard. The original name is kept in the database only for display and as the download name, after cleaning: folder parts and invisible control characters are removed, an empty name becomes `file`, and only the last 200 characters are kept. The database row also stores the content type taken from Atlas's own allowlist (never the one the browser claimed), the size, the SHA-256 fingerprint and the time the rights box was ticked.

## How does Atlas send a stored file back?

Atlas serves files with `GET /api/reviewers/:id/file` (`sendReviewerFile` in `backend/src/controllers/reviewersController.js`). Anyone can open the file of a visible study reviewer, even without logging in. A hidden study reviewer's file answers 404 to everyone except its uploader and the admins, who open it with their login. The reply sets:

- `Content-Type`: the type stored from the allowlist.
- `Content-Disposition`: `inline` (show it in the browser tab) for PDF, PNG and JPEG files, and `attachment` (save it as a download) for text, Word and PowerPoint files. Adding `?download=1` always gives `attachment`.
- The download name twice: a plain version in which characters outside simple ASCII, quotes and backslashes become `_`, and a `filename*=UTF-8''…` version that keeps accents and other alphabets for modern browsers.
- `X-Content-Type-Options: nosniff`, which tells the browser to trust the content type instead of guessing, so a disguised file cannot run as a web page.

If the file is missing from the disk, Atlas answers 404 "The file for this study reviewer is missing."

## What happens when I replace or delete a file on Atlas?

The uploader can replace a study reviewer's file from its Edit page (`PUT /api/reviewers/:id`). The owner check runs before the new file is accepted, so strangers cannot fill the disk. The new file goes through every upload check and needs the rights box ticked again. Atlas first points the database row at the new file and only then deletes the old one, so a failed update keeps the old file working and deletes the new upload instead. Saved copies get the new title, subject and strand, and a replacement does not count toward the 50-upload limit.

Deleting a study reviewer (`DELETE /api/reviewers/:id`, uploader only) removes the database row first and then the file, so a failed delete leaves nothing broken. Its upvotes, view history and reports are deleted with it. People who saved it keep their notes and flashcards. Deleting an account deletes every file that person uploaded, and admins can delete a reported study reviewer.

## What happens to an uploaded file when an Atlas check fails?

Atlas never keeps a file that failed a check:

- Rate limit, login and quota failures happen before multer reads the file, so nothing is stored.
- A file with a wrong type is refused by multer's filter before it is written, so it never touches the disk.
- A file over the size limit is stopped while it streams in, and multer deletes the part already written.
- A failed content check or virus scan, or an unexpected error during them, deletes the file at once (`rejectFile` in `backend/src/middleware/checkUpload.js`).
- If a later step fails (missing form details, rights box not ticked, duplicate file, database error), the controller deletes the new file, because nothing in the database points at it.
- When an edit with a replacement file fails, the new file is deleted and the old file stays in use.

File problems are shown next to the file field of the form, because the server sends each message together with the name of the field it belongs to; quota, login and rate-limit messages appear at the top of the form.

## What can the Atlas upload checks not catch?

The Atlas upload checks lower the risk but cannot prove that a file is harmless:

- The content checks are signature-based: they look at the first bytes, the ZIP structure, a few risky PDF names and the macro part. A file can match its signature and still carry something unwanted, such as extra data after an image or other embedded content in a Word file.
- The PDF check reads the file as stored, so a script hidden inside a compressed part of a PDF is not seen.
- ClamAV only recognises threats already on its signature list, so a brand-new threat can pass it.
- On the live Atlas server the virus scan is not yet confirmed end to end: ClamAV is installed and set to `daemon` (checked 2026-10-31), but the test upload of the harmless EICAR file is still to do.
- Duplicate detection only catches byte-for-byte copies.
- Atlas does not check whether a file is really study material or who owns it; that is left to the rights checkbox, reports and admins.
