# Reports and moderation in Atlas

Atlas lets students report study reviewers that break the rules. Three open reports hide a study reviewer automatically, and admins use the Reports page to show it again, move it to the right category or delete it. This page explains who can report, the report reasons, what hidden means, what each admin action does to the study reviewer and its reports, how someone becomes an admin, how copyright takedowns work, and what admins cannot see.

## Who can report a study reviewer in Atlas?

Any logged-in Atlas user can report a study reviewer that someone else uploaded. The Report button sits on the study reviewer's own page, next to Upvote and Save (`frontend/src/pages/ReviewerPage.jsx`), and only appears for logged-in people who are not the uploader. The server checks the same rules (`POST /api/reviewers/:id/report`, handled by `reportReviewer` in `backend/src/controllers/reviewersController.js`):

- Visitors who are not logged in get 401 "Please log in to do that."
- The uploader gets 403 "You cannot report your own study reviewer. Edit or delete it instead."
- A study reviewer that is already hidden answers 404 to everyone except its uploader and the admins, so other people cannot report it until an admin has acted.
- Reports count toward the write limit of 120 changes per 15 minutes.

A successful report answers 201 (created), and the page replaces the Report button with "Thanks for reporting. An admin will look at this study reviewer."

## What reasons can I choose when reporting a study reviewer?

The Atlas report dialog asks for exactly one reason from this list; the same names are kept in `REPORT_REASONS` in `backend/src/utils/validate.js` and `frontend/src/services/reportsService.js`:

- Offensive: hateful, violent, or sexual content.
- Spam: ads, links to other sites, or the same file posted again and again.
- Irrelevant: not study material, such as memes, random files, or an empty file.
- Wrong category: useful, but filed under the wrong strand, grade, or subject.
- Copyright: a textbook, a paid review-center file, or someone else's work.

You can add optional details of up to 500 characters, for example which part is wrong or where it was copied from. Without a reason the dialog says "Choose a reason."; the server answers 400 "Choose a reason from the list." for a missing or unknown reason and "Details can be at most 500 characters." for longer details. The dialog also says "An admin will look at it. After 3 reports it is hidden until then. Your name is not shown to anyone."

## Can I report the same study reviewer twice in Atlas?

Each person can have only one open report per study reviewer in Atlas. A unique index in the database (`idx_reports_one_open_per_user` in `backend/db/schema.sql`) refuses a second open report from the same person, and the server answers 409 "You already reported this study reviewer. An admin will look at it." The page shows that message where the Report button was, instead of an error. Once an admin has closed the reports with Restore or Fix category, your earlier report no longer counts as open, and you can report the study reviewer again if the problem comes back. Because of this rule, the three reports that hide a study reviewer always come from three different people.

## When does Atlas hide a reported study reviewer?

Atlas hides a study reviewer automatically when it has 3 open reports (`HIDE_AFTER_REPORTS` in `backend/src/controllers/reviewersController.js`). After every new report the server counts the open reports, meaning the reports no admin has dealt with yet; when the count reaches 3, it sets `is_hidden` to true on the study reviewer. Each person can have only one open report per study reviewer, so these are always 3 different people. Hiding happens only at that moment. Nothing un-hides a study reviewer automatically, and editing it does not un-hide it either: only an admin can show it again, with Restore or Fix category. Reports closed by an admin no longer count, so a restored study reviewer is hidden again only after 3 new open reports. One or two open reports change nothing for other users; the study reviewer simply waits on the admins' Reports page.

## What does hidden mean for everyone?

A hidden Atlas study reviewer is treated as missing for everyone except its uploader and the admins (`hideIfHidden` in `backend/src/middleware/reviewerAccess.js`):

- Its page, its file, upvoting, saving, recording a view and reporting answer 404 "That study reviewer could not be found." to everyone else, so its page shows "Study reviewer not found".
- It never appears in the feed or in search results, for anyone, the uploader and admins included.
- It is left out of everyone's Recently viewed list.
- The uploader still sees it on their profile with "Hidden while an admin looks at reports about it." and on its page with "This study reviewer is hidden from everyone else while an admin looks at reports about it." The uploader can still edit or delete it.
- The uploader and the admins open its file with their login, because a plain link cannot carry the login.
- People who saved it keep it in their Saved list with their notes and flashcards, but its file does not load for them while it is hidden.

Existing upvotes are kept, and people can still remove their own upvote or unsave it.

## What does the Atlas admin Reports page show?

Atlas admins review reports on the Reports page at `/admin` (`frontend/src/pages/AdminPage.jsx`, with data from `GET /api/admin/reports`). The menu shows a "Reports" link only to admins, and the server answers 403 "Only admins can do that." to anyone else; other people who open `/admin` see "Only admins can see this page." The page lists every study reviewer that has at least one open report: hidden ones first, then the most reported, then the most recently reported (`listReportedReviewers` in `backend/src/models/reportsModel.js`). Each entry shows:

- The strand, the title as a link to its page, the category and the uploader's name.
- The number of open reports, plus "Hidden from the feed until you decide." when it is hidden.
- The reason, date and details of each open report, newest first.
- The buttons Open file, Restore, Fix category and Delete.

Reporters are anonymous: the list never includes who reported, so admins judge the file, not the people. When nothing is open, the page says "No open reports".

## What do the Atlas admin actions do?

Each action on the Atlas Reports page works on one study reviewer (routes in `backend/src/routes/adminRoutes.js`, handlers in `backend/src/controllers/adminController.js`):

| Action | What happens to the study reviewer | What happens to its reports |
| --- | --- | --- |
| Open file | Nothing changes; the file opens in a new tab, fetched with the admin's login, so it works while hidden. | Nothing changes. |
| Restore | Shown again: `is_hidden` is set to false. | Every open report is closed: `resolved_at` is set to now, and the reports are kept as a record. |
| Fix category | Strand, grade, quarter, subject and material type are changed, then it is shown again. | Every open report is closed (`resolved_at` is set) and kept as a record. |
| Delete | Removed for everyone together with its file, after the confirmation "Delete this study reviewer?". | Deleted together with the study reviewer, so no record of them stays. |

After Restore, Fix category or Delete, the study reviewer leaves the Reports list, a confirmation message appears, and the remembered feed is cleared so the next feed visit loads fresh results. Delete cannot be undone.

## What else happens when an Atlas admin fixes a category or deletes a study reviewer?

Fix category (`PUT /api/admin/reviewers/:id/category`) opens a small form with the strand, grade, quarter, subject and material type menus, filled in with the current values; changing the strand clears a subject that the new strand does not take. The server checks the values like the upload form (400 "Some details need fixing. Check the highlighted fields."), saves them without changing the study reviewer's last-edited time, and updates the subject and strand copied into everyone's saved copies. The button reads "Save category and show it". An admin cannot change the title, description, tags or file of someone else's study reviewer.

Delete (`DELETE /api/admin/reviewers/:id`) removes the database row first and then the file, like the uploader's own delete, and the server log records which admin deleted which study reviewer. Upvotes, view history and reports go with it. People who had saved it keep their notes and flashcards, and their saved copy is marked as removed.

## How does someone become an admin in Atlas?

Atlas has no admin sign-up and no button that makes someone an admin. Every account starts with the role `member`, and the `users.role` column only allows `member` or `admin`. To make an admin, the person first logs in to Atlas once, so that their row exists in the `users` table, and then someone with access to the Atlas database runs:

```
UPDATE users SET role = 'admin' WHERE email = 'student@example.com';
```

The Reports link appears in that person's menu after their next page load, because the profile with the role is loaded when the page opens. Setting `role = 'member'` takes the rights away again. The server checks the role on every admin request (`requireAdmin` in `backend/src/middleware/auth.js`), so hiding the menu link is only a convenience, not the protection.

## How can a copyright owner get a file removed from Atlas?

Every new file on Atlas needs the uploader to tick "I made this file, or I have the right to share it", and the time is stored in `reviewers.rights_confirmed_at`. The Terms of use and copyright page at `/terms`, linked from the footer and the upload form, says what may not be shared: scanned or copied textbooks and modules; paid review-center materials or anything the uploader had to buy; other people's work without their permission; and offensive content, spam or files that are not study material. A copyright owner can ask for removal in one of two ways:

- By email, when the site sets `VITE_TAKEDOWN_EMAIL`: the Terms page shows that address and asks for the link to the study reviewer and a short note showing the work is theirs.
- When no email is set, the Terms page says to log in, open the study reviewer, and choose Report, then Copyright.

The Terms page promises removal within 7 days if the claim holds. An admin removes the file with Delete on the Reports page. Students can also report suspected copying with the Copyright reason, and 3 open reports hide the study reviewer until an admin decides.

## What can Atlas admins not see or do?

Atlas admins have a deliberately small set of powers:

- They cannot see who reported a study reviewer. Reporters' names and ids are never sent to the Reports page, only each report's reason, details and date.
- They cannot see anyone's Saved list, notes or flashcards; no admin page or API route exists for them.
- They cannot edit another person's title, description, tags or file. They can only restore, change the category, or delete.
- They do not see hidden study reviewers in the feed; for admins, hidden ones appear only on the Reports page and on each study reviewer's own page.
- They have no page for closed reports. Closed reports stay in the `reports` table as a record, except those of deleted study reviewers.
- Atlas sends no notifications: neither the uploader nor the reporters are told when a study reviewer is hidden, restored, moved or deleted.
- The Reports page lists only study reviewers with open reports, so it offers no way to find others; the admin API addresses themselves accept any study reviewer id.
