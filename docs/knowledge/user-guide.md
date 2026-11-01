# Using Atlas

This guide explains how to use the Atlas website step by step: browsing and searching study reviewers, sharing your own, upvoting, saving, studying with notes and AI flashcards, reporting, and managing your profile, theme and account.

## What can I do on Atlas without an account?

Anyone can use these parts of Atlas without an account:

- The front page at https://atlas-f2757.web.app, which explains Atlas. Logged-in users go straight to the feed instead.
- The feed at /browse, with the Top and New tabs, the filters and the search box.
- Every study reviewer's page (unless reports have hidden it), with its "Open file" or "Download file" button.
- The "Strand colors" key and the Terms of use page at /terms.

Without an account you cannot share, upvote, save, take notes, make flashcards or report on Atlas. Pressing Upvote or Save sends you to the Log in page with a short note such as "Log in to upvote study reviewers.", and after you log in Atlas brings you back to that page. The Upload link also asks you to log in first. An Atlas account is free: see [How do I create an Atlas account?](accounts-and-sign-in.md#how-do-i-create-an-atlas-account)

## How do I find study reviewers on Atlas?

Choose Browse in the menu to open the Atlas feed at /browse. It shows study reviewers as cards, 12 at a time; "Load more" adds the next 12. Two tabs sort the list: Top (most upvotes first, the default) and New (newest first). Four menus filter it: Strand, Grade, Quarter and Subject. Once a strand is chosen, the Subject menu lists only that strand's subjects.

Each card shows the strand as a colored pill, the title, a category line such as "General Chemistry 1 · Grade 11 · Q1 · Summary notes", the description, the tags, the uploader's display name, the date, and the file type and size. The whole upper part of a card opens the study reviewer. Choosing a strand pill filters the feed by that strand, and choosing a tag searches for that tag.

The choices are kept in the address, for example /browse?sort=new&strand=STEM&grade=11, so a filtered list can be bookmarked or shared. "Clear search and filters" resets them. Coming back from a study reviewer with Back shows the same cards at the same place; Atlas remembers this for up to 10 minutes, and a page reload loads a fresh list.

## How does search work on Atlas?

Type words in the "Search study reviewers" box (up to 100 characters) and press Search. Search works together with the tab and the filters. This describes the improved Atlas search, which is not live yet on 2026-11-01:

- Atlas looks at up to 8 words; any extra words are ignored.
- Every word must appear somewhere in the study reviewer's title, description, tags, subject, strand, material type or uploader's display name.
- Each word matches from the start of a word, and capital letters do not matter: "chem" finds "Chemistry", and "stem" finds "STEM" but not "systems".
- A word that starts with a symbol, such as "(2)", is looked for anywhere. Symbols count as typed, so "c++" looks for "c++".

The best matches come first. A title that starts with the whole search gets 100 points. Then each word adds 3 points if it is in the title, 2 if it is in the tags or subject, and 1 if it is only somewhere else. Results with equal points are ordered by upvotes on the Top tab, or by date on the New tab. Atlas search does not look inside the files themselves. The code is `buildSearchWords` in `backend/src/utils/validate.js` and `SEARCH_SCORE` in `backend/src/models/reviewersModel.js`. More detail: [Search and the feed in Atlas](search-and-feed.md).

## What do the strand colors mean on Atlas?

Each strand on Atlas has its own color, shown as a stripe down the left edge of each card and as the strand pill. "Strand colors" above the feed opens a key, and each entry in the key filters the feed to that strand. The colors are: All strands grey, STEM green, ABM olive yellow, HUMSS brown, GAS teal, TVL orange, Arts and Design pink, and Sports red. The strand name is always written out too, so color is never the only clue. Filtering by a strand also shows the "All strands" study reviewers, because every strand takes those subjects. More detail: [What colors do the strands have on Atlas?](categories-and-curriculum.md#what-colors-do-the-strands-have-on-atlas)

## How do I share a study reviewer on Atlas?

Log in, then choose Upload in the menu to open "Share a study reviewer". Fill in the form:

- Title (required): 3 to 120 characters, for example "General Chemistry 1 quarterly exam reviewer".
- Description (required): 10 to 2,000 characters about what it covers and who it helps.
- Strand, Grade, Quarter, Subject and Material type (all required). The Subject menu lists the chosen strand's subjects. Choose "All strands" for core and applied subjects that every strand takes.
- Tags (optional): up to 8, separated by commas, each up to 30 characters. Atlas saves them in lowercase and drops repeats. For TVL, put the exact course name in the tags.
- File (required): see [Which files can I upload to Atlas?](#which-files-can-i-upload-to-atlas)
- The box "I made this file, or I have the right to share it" (required).

Press "Share study reviewer". A progress bar shows the upload. When it is done, Atlas opens the new study reviewer's page with "Your study reviewer is now shared." If something needs fixing, the form lists every problem at the top and next to each field. The Atlas server checks everything again, so the browser's checks cannot be skipped.

## Which files can I upload to Atlas?

Atlas accepts these file types, up to 10 MB each: PDF (.pdf), Word (.docx), PowerPoint (.pptx), plain text (.txt), PNG (.png) and JPG (.jpg or .jpeg). Empty files are refused. Old Word and PowerPoint files (.doc and .ppt) are not accepted, because they can carry macros (small programs that can hide malware); save them as .docx, .pptx or PDF first.

PDF, image and text files work best, because Atlas can show them right inside the page. Word and PowerPoint files can only be downloaded.

Before a file is saved, the Atlas server checks that its contents really match its type, so a renamed file is refused. It also refuses PDFs that contain scripts or attached files, Office files with macros, and a file that is already on Atlas (it names the study reviewer that has it). Virus scanning with ClamAV is built in. On the live site ClamAV is installed and set to daemon mode (checked 2026-10-31); a test upload that confirms it works end to end is still to do. More detail: [Uploads and file safety in Atlas](uploads-and-file-safety.md).

Only share what you made yourself or have the right to share. Textbooks, modules, paid review-center files and other people's work are not allowed (see the Terms of use page at /terms).

## How many study reviewers can I share on Atlas?

Each person can have up to 50 study reviewers on Atlas at a time (the server setting `MAX_UPLOADS_PER_USER`, 50 by default). The Upload page shows how many you have, for example "You have shared 12 of 50." At the limit, the Upload page shows a note and a "Go to your profile" button instead of the form, and the server refuses a new upload before it stores the file. Deleting one of your study reviewers frees a place. Replacing the file of an existing study reviewer does not count as a new upload.

The same exact file cannot be posted twice on Atlas, by you or by anyone else. Atlas keeps a fingerprint (a SHA-256 hash) of every file and tells you which study reviewer already has it. Files uploaded before this check existed have no fingerprint, so a copy of one of those is not caught.

## How do I edit or delete my own study reviewer?

Only the person who uploaded a study reviewer can change it on Atlas. Open it and press Edit, or press Edit on its card under "My uploads" on your Profile page. The edit page shows the same form with the saved details. "Replace file" is optional: leave it empty to keep the current file. The box "I made this file, or I have the right to share it" is asked again only when you choose a new file. Press "Save changes".

To delete, press Delete on the study reviewer's page or on its card under "My uploads", then confirm. Deleting removes the study reviewer and its file for everyone, and it cannot be undone. People who saved it keep their own notes and flashcards, but the file is gone for them too. You cannot edit or delete someone else's study reviewer; the edit page says "You can only edit study reviewers that you uploaded."

## How do upvotes work on Atlas?

Upvotes are the only social feature on Atlas. Press Upvote on a card or on a study reviewer's page to show that it helped you. The button then reads "Upvoted" with a filled arrow, and the number goes up. Press it again to take your upvote back. Each person can upvote a study reviewer once. The number is counted fresh by the server every time, so it is always the true total. The Top tab of the feed puts the study reviewers with the most upvotes first. You need to be logged in to upvote. Atlas has no downvotes, comments, star ratings or written reviews.

## How do I save a study reviewer on Atlas?

Press Save on a card or on a study reviewer's page. Atlas adds it to your Saved list (Saved in the menu), which only you can see. A "Study with notes and flashcards" button then appears on the study reviewer's page. The Saved page shows each saved study reviewer's strand, title, category, uploader and file type, whether it has notes, how many flashcards it has, and when you saved it.

To remove one, press Saved again (or Remove on the Saved page) and confirm. Removing a saved study reviewer also deletes your notes and flashcards for it, and this cannot be undone. You need to be logged in to save.

## How do I study a saved study reviewer on Atlas?

Open it from the Saved page, or press "Study with notes and flashcards" on its page. The Atlas study page has two tabs:

- Material and notes: the file on one side and your notes on the other.
- Flashcards: AI flashcards made from the file.

PDF files show in the browser's own PDF viewer, images show as pictures, and text files show as text. Word and PowerPoint files cannot be shown inside the browser, so the page offers "Download file" instead. "Download file" saves a copy on your device for reading offline, and "Open in new tab" shows the whole file in its own tab. Some phone browsers show only the first page of a PDF inside the page; "Open in new tab" always shows all of it. The link "See it in the feed (upvotes, details)" opens its public page.

## How do notes work on Atlas?

Every saved study reviewer on Atlas has a notes box that only you can see. Notes are formatted while you type. Use the toolbar or these shortcuts (written with Ctrl here; use Cmd instead on a Mac, iPhone or iPad):

- Bold: Ctrl+B. Italic: Ctrl+I.
- Three heading sizes: Ctrl+Alt+1, Ctrl+Alt+2 and Ctrl+Alt+3.
- Bulleted list: Ctrl+Shift+8.
- Indent and outdent: `Ctrl+]` and `Ctrl+[`.
- Text color: Default, Red, Orange, Green, Blue or Purple.
- Highlight: None, Yellow, Green, Blue, Pink or Orange.

Underline is not offered. Pasted text arrives as plain text, and dropping content into the box is turned off. Notes save to your account by themselves about 1.5 seconds after you stop typing, so they appear on any device; "Save now" saves at once. Notes can hold up to 20,000 visible characters. "Download notes" saves a .txt file where headings start with `#`, bullets with `-`, bold text is wrapped in `**` and italic text in `*`. More detail: [Saved study reviewers and notes](saved-notes-and-study.md).

## How do AI flashcards work on Atlas?

Open a saved study reviewer and choose the Flashcards tab. Enter the number of cards (5 to 100, 20 by default) and press "Make flashcards". The Atlas server sends the file's content to Google Gemini, which writes question-and-answer cards from it. This can take up to two minutes.

Short material gives fewer cards instead of filler: about 1 card for every 50 to 100 words works well, and the page tells you when it made fewer cards than you asked for. Each account can make 10 sets per 24 hours, and failed attempts do not count. Flashcards are written by AI and can contain mistakes, so check them as you study. Only you can see your flashcards.

"Make a new set" replaces the old set and your progress on it (Atlas asks first), and "Delete flashcards" removes them. Flashcards cannot be made when the uploader removed the original file, or from old .doc and .ppt files. More detail: [AI flashcards in Atlas](flashcards.md).

## How do I study with flashcards on Atlas?

Each Atlas flashcard shows a question. Press the card, or Space or Enter, to turn it over and see the answer. Previous and Next, or the Left and Right arrow keys, move between cards. After reading the answer, press "Still learning" or "Got it". Atlas saves this for every card, so your progress is still there next time and on other devices. Three tiles count your cards as Not studied, Learning and Learned. "Shuffle" mixes the order (press it again for the original order), and "Only cards not learned yet" hides the cards you marked "Got it". When every card is learned, the page says so.

## What happens to my saved copy if the uploader deletes the study reviewer?

If the uploader deletes a study reviewer, or an admin deletes it after reports, everyone who saved it on Atlas keeps their saved item: its title, subject and strand, plus their own notes and flashcards. The Saved page marks it with "The original was removed by its uploader." The file is no longer available, and new flashcards cannot be made from it. The notes can still be edited and downloaded.

## How do I report a study reviewer on Atlas?

Log in, open the study reviewer and press Report. The Report button does not appear on your own uploads. Choose one reason:

- Offensive: hateful, violent or sexual content.
- Spam: ads, links to other sites, or the same file posted again and again.
- Irrelevant: not study material, such as memes, random files or an empty file.
- Wrong category: useful, but filed under the wrong strand, grade or subject.
- Copyright: a textbook, a paid review-center file, or someone else's work.

Details are optional, up to 500 characters. Press "Send report". Your name is never shown to anyone, not even to admins. Each person can have one open report per study reviewer. After 3 open reports from different people, Atlas hides the study reviewer from everyone except its uploader and the admins, until an admin restores it, fixes its category or deletes it. The uploader sees a note that it is hidden.

## How do I change my display name on Atlas?

Open Profile in the menu. Under Account, type a new display name (2 to 50 characters) and press "Save display name". Your display name is shown next to every study reviewer you share ("Shared by") and in the header ("Logged in as"), and Atlas search matches it too. Your email is shown only to you. The Profile page also shows "Member since" and how you sign in. Google accounts show their Google picture, and other accounts show a circle with your initials. Atlas has no way to upload a picture of your own.

## How do I switch Atlas to dark mode?

The "Dark mode" switch is in the Atlas header (inside the Menu on small screens), and it works with or without an account. It shows On or Off. Until you use the switch, Atlas follows your device's light or dark setting. Your choice is saved in this browser only, so another browser or device keeps its own setting. Atlas also follows the device settings for reduced motion and for more contrast.

## Where can I find study reviewers I opened before?

Open Profile in the menu and look at "Recently viewed". Atlas lists the last 20 study reviewers you opened while logged in, newest first, with each one's subject, uploader and upvotes. Opening a study reviewer again moves it back to the top. Study reviewers hidden by reports are left out. Atlas only records views for logged-in users, so browsing without an account leaves no list. To keep a study reviewer for good, save it instead.

## How do I log out of Atlas?

Press "Log out" in the Atlas header (inside the Menu on small screens). Atlas first asks "Log out of Atlas?", so a stray tap does not end your session. After you confirm, Atlas shows "You are now logged out." on the front page. If you do not log out, Firebase keeps you logged in on that browser, even after you close it.

## How do I delete my Atlas account?

Open Profile, go to "Delete account" and press "Delete my account", then confirm. This deletes your profile, every study reviewer you shared and its file, your upvotes, saved list, notes, flashcards and reports, and finally your login. It cannot be undone. For your safety, it only works within 5 minutes of logging in; with an older login, Atlas shows "Log in again" and brings you back to the Profile page afterwards. Other people keep their own notes on study reviewers they saved from you. More detail: [How do I delete my Atlas account?](accounts-and-sign-in.md#how-do-i-delete-my-atlas-account)

## What does the Atlas website not do?

Atlas keeps things simple. It does not have comments, chat, direct messages, star ratings, written reviews, downvotes or followers. It does not show Word or PowerPoint files inside the page, it does not search inside files, and it does not send email notifications. It has no mobile app, but it works in a phone's browser. You cannot edit or delete someone else's study reviewer, see who reported something, or see other people's saved lists, notes or flashcards. Deleting a study reviewer, a saved item, a flashcard set or an account cannot be undone.
