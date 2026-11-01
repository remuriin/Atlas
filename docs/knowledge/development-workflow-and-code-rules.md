# How Atlas is developed

This page explains how changes to Atlas are made: the branch and pull request workflow in git, how commit messages are written, what merging does and does not deploy, the JavaScript, backend, and CSS code rules the project follows, the checks to run before a pull request, and how the Atlas docs are kept current.

## What git workflow does Atlas use?

Atlas uses a short branch for every change, a workflow called branch-flow. It applies to features, fixes, and docs alike, however small the change is.

- Nobody works on `main` directly. Before the first edit, create a branch from an up-to-date `main`: `feat/` plus a short topic for a feature (for example `feat/short-class-names`), `fix/` for a bug fix (for example `fix/inner-corners`), or `docs/` for a change to docs only. A change that touches several repositories uses the same branch name in each.
- One branch holds one change and becomes one pull request on GitHub, in the public repository `remuriin/Atlas`.
- Every pull request is merged with a squash merge, so it becomes a single commit on `main`, and the branch is deleted afterwards. The history of `main` is one straight line of these commits, from `initial commit` to `fix cut border corners on reviewer cards and notes (#24)`.
- The AI assistant (Claude) that helps build Atlas never runs `git commit`, `git push`, `git merge`, `git rebase`, `gh pr create`, or `gh pr merge` itself. It leaves the work uncommitted on the branch and hands the developer the exact commands, and the developer runs them.
- Changes that do not belong to the task (for example files another tool left behind) stay out of the commit.

## In what order are the Atlas git commands run?

To start a change, update `main` and branch off it:

```
git checkout main
git pull
git checkout -b feat/topic
```

When the work is done, these commands run from the repository folder, one per line, in this order (here for a branch called `feat/topic`):

```
git checkout feat/topic
git add frontend/src/pages/HomePage.jsx
git commit -m "one short lowercase line"
git push -u origin feat/topic
gh pr create --base main --head feat/topic --title "one short lowercase line" --body "One or two plain lines about what this does."
gh pr merge feat/topic --squash --delete-branch
git checkout main
git pull
```

- `git add` names the exact files that changed (the path above is only an example). Avoid `git add -A` when unrelated files are lying around.
- `git push -u origin` sends the branch to GitHub and remembers where it goes.
- `gh pr create` (the GitHub command-line tool) opens the pull request, with the commit line as its title.
- `gh pr merge --squash --delete-branch` squashes the pull request into one commit on `main` and deletes the branch. A plain merge or a rebase is used only when someone asks for one.
- `git checkout main` and `git pull` bring the local copy up to date for the next change.

## How are Atlas commit messages and pull requests written?

- Commit message: one short line in lowercase and plain words, saying what changed. No body, no bullet list, no test counts.
- Pull request title: the same line as the commit message.
- Pull request body: one or two plain lines about what the change does.
- GitHub adds the pull request number when it squashes, so the commit on `main` ends with a number such as `(#24)`.

Recent examples from the Atlas history:

| Pull request | Commit line |
| --- | --- |
| #18 | `landing redesign: full-width bands, feed preview hero, webfonts, footer links` |
| #19 | `css split into component and page files, new logo, panel style on app pages` |
| #20 | `plain hyphen class names, landing palette on all pages, step panels` |
| #22 | `one short class name per element, no gradient on reviewer cards` |
| #23 | `new sample data: 6 students, 16 original pdf reviewers, reset with backup` |
| #24 | `fix cut border corners on reviewer cards and notes` |

A topic and a colon at the front are common when a change has several parts, for example `copyright: rights checkbox on uploads, terms page with takedown contact`.

## Does merging an Atlas pull request deploy anything?

No. Merging a pull request into `main` deploys nothing by itself. The Atlas repository has no `.github/workflows` folder, so there are no GitHub Actions, no continuous integration, and no automatic deploys. Pushing a branch and opening a pull request deploy nothing either.

Every deploy is a manual step that the developer runs after merging:

- Website: `npm run build` in `frontend/`, then `firebase deploy --only hosting:app` from the project root. This publishes `frontend/dist` to the Firebase Hosting site `atlas-f2757` (https://atlas-f2757.web.app).
- Old address: `firebase deploy --only hosting:old` is needed only when `hosting-redirect/` or its part of `firebase.json` changes. That site sends every page of the old LearnHub address to the same page on the new address.
- API: the changed backend files are copied to the server by hand, and the API process is restarted. When `backend/package.json` changed, the dependencies are installed first; when `backend/db/schema.sql` changed, `npm run db:migrate` runs too.

So a merged change is not live until someone deploys it, and the website and the API are deployed separately. The full steps are in [How do I deploy the Atlas website?](deployment.md#how-do-i-deploy-the-atlas-website) and [How do I deploy the Atlas API?](deployment.md#how-do-i-deploy-the-atlas-api).

## What JavaScript style does the Atlas frontend follow?

The Atlas frontend keeps its JavaScript beginner friendly, as the README section "Code rules this project follows" says:

- Plain JavaScript and JSX in ES modules (`import` and `export`). No TypeScript.
- Function components only. Each takes one `props` object and reads `props.title` and so on, without destructuring the props.
- Only three hooks from React itself: `useState`, `useEffect`, and `useContext`. No custom hooks, `useReducer`, `useMemo`, or `useCallback`, and `useRef` is not used either: focus is moved with element ids and `document.getElementById`.
- Two contexts only: `AuthContext` and `ThemeContext`.
- Classic react-router-dom v6 components and hooks: `Routes`, `Route`, `Link`, `NavLink`, `Navigate`, `useNavigate`, `useParams`, `useLocation`, and `useSearchParams`.
- Plain `fetch` inside one wrapper (`services/api.js`), and `XMLHttpRequest` only for upload progress. No data-fetching library.
- No optional chaining, nullish coalescing, spread or rest, JSX spread, or classes. Values are checked with `if` statements, objects are copied with `Object.assign`, and arrays are joined with `concat`.
- Comments explain why, in plain words, and every source file starts with a header comment.

## Which syntax does the Atlas lint check block?

`frontend/eslint.config.js` turns on two sets of rules for every `.js` and `.jsx` file in `frontend/` (the `dist` and `node_modules` folders are skipped):

1. Every rule of `eslint-plugin-jsx-a11y` in its strict set. These check accessibility in JSX: labels, alt text, roles, keyboard handlers, and more.
2. The house style rules, through `no-restricted-syntax`, each with its own message:

| Blocked syntax | Message |
| --- | --- |
| Optional chaining (`a?.b`) | Check the value with an if statement. |
| Nullish coalescing (`a ?? b`) | Use an if statement or the OR operator. |
| Spread (`...items`) | Use concat or Object.assign. |
| Rest (`...others`) | Rest syntax is not used in this project. |
| JSX spread (`{...props}`) | Pass props one by one instead of spreading them. |
| Class declarations and expressions | Use function components, not classes. |

`npm run lint` runs `eslint . --max-warnings 0`, so a single warning fails the check. The config does not include ESLint's recommended rules or the React hooks rules, so mistakes such as unused variables are not caught by lint. The hook limits (no `useMemo`, `useCallback`, `useReducer`, or custom hooks) are a convention, not a lint rule. The backend has no lint script.

## What rules does the Atlas backend code follow?

The Atlas backend in `backend/` is an Express 5 API that runs on Node.js 20 or newer. Its code rules:

- Plain JavaScript in CommonJS (`require` and `module.exports`). No ES modules and no TypeScript.
- No ORM and no query builder. SQL is written by hand for the `pg` driver and always passes values through `$1, $2` placeholders (parameterised SQL), never by gluing them into the SQL text, so user input cannot change a query. Only fixed SQL pieces, such as a shared column list, are joined together.
- Every SQL statement for a table lives in that table's model in `backend/src/models/`, for example `reviewersModel.js`. The schema and the sample data SQL live in `backend/db/`. The one exception is `backend/src/utils/rateLimitStore.js`, which keeps rate limit counts in the `rate_limits` table with its own SQL.
- SQL sticks to textbook CRUD (create, read, update, delete). An "upsert" is a `SELECT` followed by an `INSERT` or `UPDATE` in JavaScript. The rate limit store is again the exception: it uses `INSERT ... ON CONFLICT DO UPDATE`.
- Upvote counts are never stored; they are counted with `COUNT(*)` each time.
- Errors leave the API as `{ "error": { "message": "..." } }`, with an extra `fields` object for form errors.
- The same beginner-friendly limits as the frontend apply: no optional chaining, nullish coalescing, spread or rest, or classes. Nothing checks this automatically, because the backend has no lint script.

## How is the Atlas backend code layered?

A request to the Atlas API passes through layers that each live in their own folder in `backend/src/`:

1. `app.js`: security headers (helmet), CORS for the website's address only (except `/api/ask`, which any page may call), the general rate limit, JSON body reading, and then the five route groups.
2. `routes/`: which address and method go to which handler, and which middleware runs first: `reviewersRoutes.js` (`/api/reviewers`), `meRoutes.js` (`/api/me`), `savedRoutes.js` (`/api/saved`), `adminRoutes.js` (`/api/admin`), and `askRoutes.js` (`/api/ask`).
3. `middleware/`: shared steps such as the Firebase login check (`auth.js`), rate limits, file uploads (`upload.js` and `checkUpload.js`), loading and access checks for `:id` and `:savedId`, and the final error handler.
4. `controllers/`: one handler per endpoint. A handler checks the input with `utils/validate.js`, calls models, and builds the JSON answer. Controllers contain no SQL.
5. `models/`: one file per table, holding all of that table's SQL.

Helpers live in `utils/` and settings in `config/`. Routes chain middleware and a controller; middleware and controllers call models; only models (and the rate limit store) talk to PostgreSQL. More detail is in [How is the Atlas backend code organised into layers?](backend-architecture.md#how-is-the-atlas-backend-code-organised-into-layers) and [What are the steps of a typical Atlas API request?](request-pipeline-and-middleware.md#what-are-the-steps-of-a-typical-atlas-api-request).

## Why does every Atlas source file start with a comment?

Every JavaScript source file in `frontend/src/`, `backend/src/`, and `backend/db/` starts with a comment in plain words that says what the file is for. Some examples:

- `backend/src/app.js` starts with `// Builds the Express app: security settings first, then routes, then error handling.`
- `backend/src/models/reviewersModel.js` starts with `// All SQL for the "reviewers" table lives in this file.`
- `frontend/src/services/api.js` starts with `// A small wrapper around fetch for talking to the Atlas API.`
- `frontend/src/components/SkipLink.jsx` starts with `// The first thing a keyboard user reaches on every page.`

Comments inside the code explain why something is done, in short plain sentences, so a student can follow the code without outside help. Most components that take props also list them in their header comment. Every CSS file opens with a comment that names its section, and `tokens.css` and `index.css` explain their rules at the top. New files follow the same habit. The two config files at the root of `frontend/` (`eslint.config.js` and `vite.config.js`) are the exceptions: they start with code, and their comments sit inside.

## What CSS rules does Atlas follow?

- Plain CSS with custom properties only: no Sass or Less, no Tailwind or other CSS framework, no CSS-in-JS, and no CSS modules. Styles are global and imported once through `frontend/src/styles/index.css`.
- Tokens only: colors, spacing, font sizes, radii, and timings come from `tokens.css`. A new color needs a light value, a dark value, and a contrast check.
- One short hyphenated class per element, with a second class only for a variant such as a strand slug. Rules that several classes share use grouped selectors.
- States use ARIA attributes, such as `[aria-pressed="true"]`, wherever one exists.
- A rule goes in the file for its component (`styles/components/`) or its page (`styles/pages/`). A new file is added to `styles/index.css` in the right place, and `high-contrast.css` stays last.
- Mobile first: the base rules are for phones, and `min-width` media queries (mainly 40rem and 64rem) add to them for larger screens.
- Accessibility in CSS: controls keep at least `--touch-target` (44px), the focus ring is never removed from controls, motion uses the motion tokens so reduced motion keeps working, and states shown with color get a border fallback in `high-contrast.css`.

Naming details are in [How are CSS classes named in Atlas?](accessibility-and-design-system.md#how-are-css-classes-named-in-atlas), and the import order is in [How are the Atlas frontend styles organised?](frontend-architecture.md#how-are-the-atlas-frontend-styles-organised).

## What must be checked before an Atlas pull request?

Atlas has no CI pipeline and no automated tests (neither `package.json` has a test script), so the developer runs these checks by hand before opening a pull request:

1. `npm run lint` in `frontend/`: zero errors and zero warnings.
2. `npm run build` in `frontend/`: the build must finish.
3. Try the change in a browser against a local backend and the Firebase Auth emulator, in both themes and at a phone width.
4. A keyboard pass: Tab through every changed screen. Focus must always be visible, never trapped, and must land somewhere sensible after each action.
5. For visual changes: run axe in Chrome on the changed pages in both themes (target: zero violations), check new color pairs with the WCAG formula (4.5:1 for text, 3:1 for outlines), keep 44px targets, and try reduced motion and forced colors.
6. When a shared list or limit changed, change both sides (see [Which values must stay the same in the Atlas frontend and backend?](#which-values-must-stay-the-same-in-the-atlas-frontend-and-backend)).
7. When `backend/db/schema.sql` changed, run `npm run db:migrate` locally. Every statement must stay safe to run again (`IF NOT EXISTS` or a check first).
8. Update `README.md` and the matching files in `docs/knowledge/`.
9. Stage only the intended files. Never commit `.env` files, `docs/private/`, or `docs/dist/`; `.gitignore` already lists them.

## Which values must stay the same in the Atlas frontend and backend?

The Atlas frontend repeats some backend rules so people get quick feedback, but the server checks everything again and has the final say. When one side changes, the other must change in the same pull request. Paths are inside `frontend/src/` and `backend/src/`.

| Shared rule | Frontend | Backend |
| --- | --- | --- |
| Strands, grades, quarters, subjects, material types | `services/categories.js` | `utils/categories.js` |
| Report reasons, details up to 500 characters | `services/reportsService.js` | `utils/validate.js` |
| Title 3 to 120, description 10 to 2000, up to 8 tags of 30 characters | `components/ReviewerForm.jsx` | `utils/validate.js` |
| Display name 2 to 50 characters | `pages/RegisterPage.jsx`, `pages/ProfilePage.jsx` | `utils/validate.js` |
| Search up to 100 characters | `pages/HomePage.jsx` | `utils/validate.js` |
| Notes up to 20,000 visible characters (100,000 with formatting) | `components/NotesPanel.jsx` | `utils/validate.js` |
| Allowed note tags and color classes | `services/noteHtml.js` | `utils/validate.js` |
| Flashcards per set, 5 to 100 | `components/FlashcardsPanel.jsx` | `utils/validate.js` |
| Largest file in MB | `VITE_MAX_FILE_SIZE_MB` | `MAX_FILE_SIZE_MB` |
| Allowed file types | `services/fileRules.js` | `middleware/upload.js` |

More on the category lists is in [How do the category lists stay the same in the frontend and backend?](categories-and-curriculum.md#how-do-the-category-lists-stay-the-same-in-the-frontend-and-backend).

## How are the Atlas docs kept current?

- `README.md` is the main reference for Atlas: setup, settings, deployment, the API summary, code rules, accessibility, feed behaviour, and known limitations. It is updated in the same pull request as the change it describes.
- `docs/knowledge/` holds topic files like this one. The Atlas Explorer's chat, Rem, answers questions from them by retrieval (RAG): the files are split at their headings into chunks, so each section must make sense on its own and stay between 120 and 1700 characters.
- After a change to code that a knowledge file describes, update that file, then build the Atlas Explorer again and run the ingest again, so Rem answers from the new text. The commands are in [How do I build the Atlas Explorer and ingest the docs?](local-development.md#how-do-i-build-the-atlas-explorer-and-ingest-the-docs).
- Some files stay out of git on purpose: `docs/dist/` (the built Explorer page, which is build output), `docs/private/` (private server notes), and `docs/.ingest-state.json` (the ingest's own record). All three are listed in `.gitignore`.
- The repository is public, so knowledge files never hold secrets, passwords, private addresses, or private server paths. The public API address `api.140-245-60-8.sslip.io` is fine to mention.

## What does a typical Atlas change look like from start to finish?

1. Update `main` and create a branch, for example `git checkout -b fix/short-topic`.
2. Run Atlas locally: the Firebase Auth emulator (`firebase emulators:start --only auth` from the project root), the backend (`npm run dev` in `backend/`), and the website (`npm run dev` in `frontend/`). Setup details are in [Running Atlas locally](local-development.md#how-do-i-start-the-atlas-emulator-api-and-website).
3. Make the change, following the code rules, and keep the shared frontend and backend lists in step.
4. Check it: `npm run lint`, `npm run build`, a keyboard pass, and axe for visual changes.
5. Update `README.md` and the matching `docs/knowledge/` files, then rebuild the Explorer and run the ingest.
6. Commit, push, open the pull request, squash merge it, and update `main`, with the commands in order.
7. Deploy by hand if the change should go live: the website with `firebase deploy --only hosting:app` after a build, and the API by copying the backend and restarting it.

When the AI assistant helps, it does steps 1 to 5 on the branch and leaves the work uncommitted. It then hands over the step 6 commands, and the developer runs them and any deploy.
