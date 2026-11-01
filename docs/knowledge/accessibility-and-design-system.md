# Accessibility and the design system

Atlas aims to work for everyone, including people who use only a keyboard, a screen reader, zoom, high contrast, or reduced motion. This page explains the accessibility target of Atlas and how it is checked, how keyboard and screen reader support works, and the design system behind the look of Atlas: design tokens, light and dark themes, strand colors, fonts, and CSS class naming.

## What accessibility standard does Atlas aim for?

Atlas targets WCAG 2.2 level AA (the Web Content Accessibility Guidelines, version 2.2, middle level). The Accessibility section of the README lists what was checked and how:

- Lint: `npm run lint` in `frontend/` runs ESLint with `eslint-plugin-jsx-a11y` and its strict rule set. The result must be zero errors and zero warnings (`--max-warnings 0`).
- axe: axe-core (WCAG 2.0, 2.1, and 2.2 A and AA rules, plus best practices) was run in Chrome against every page in both themes, including pages showing form errors, empty states, the open delete dialog, and the open mobile menu. The result was zero violations. This is a manual check: axe is not a project dependency and no script runs it.
- Contrast: every token pair was computed with the WCAG contrast formula (see [What contrast ratios do Atlas colors reach?](#what-contrast-ratios-do-atlas-colors-reach)).
- Keyboard only: registering, logging in, uploading, editing, upvoting, renaming, deleting, and logging out were all done without a mouse.
- Width and zoom: no sideways scrolling at 320, 360, 768, 1024, and 1440 px wide, or with text at 200%. A 320 px wide window is what 400% zoom on a 1280 px screen produces.

Not checked yet: a real screen reader (see [What accessibility checks has Atlas not done yet?](#what-accessibility-checks-has-atlas-not-done-yet)).

## What contrast ratios do Atlas colors reach?

WCAG 2.2 AA asks for 4.5:1 for normal text, and 3:1 for large text and for the outlines of controls. The lowest Atlas pairs, computed with the WCAG formula and listed in the README:

| Pair | Light theme | Dark theme |
| --- | --- | --- |
| White text on the green primary button | 4.52:1 | 4.63:1 |
| Input and button outlines on the page | 3.4:1 | 3.6:1 |
| Focus ring on the page | 5.2:1 | 6.1:1 |
| Strand stripe and legend swatch on the page | at least 4.6:1 | at least 5.6:1 |
| Strand pill text on its own background | at least 6.1:1 | at least 9.4:1 |

In the dark theme the header and footer use GitHub's darkest shade (`--color-inset`, #010409). On it, body text reaches 17.4:1, muted text 7.1:1, links 6.6:1, and control outlines 3.9:1.

Three changes were made to the starting GitHub palette so that every pair passes. A darker outline color (`--color-border-control`) was added for inputs and buttons, because the card border color is only 1.4:1 and is used just for decorative dividers. The dark theme's green button gets darker on hover, because the lighter hover green would drop white text to 4.1:1. The outline "Delete" button sits on the page background, because red text on the dark button grey was only 4.44:1.

## How does keyboard navigation work in Atlas?

Everything in Atlas works with a keyboard alone:

- "Skip to main content" is the first Tab stop on every page. It moves focus into the main element without changing the address.
- Tab order follows the visual order: skip link, logo, menu links, theme switch, account buttons, then the page content. On the feed that is the search box and its button, the four filters, the "Strand colors" key, the tabs, and then each card.
- Every focusable control shows a 2px focus ring in the accent color (3px when the system asks for more contrast). The ring is drawn as an outline, so it also shows in Windows High Contrast mode.
- The header sticks to the top of the screen, so the page keeps a strip clear beneath it (`scroll-padding-top` set to `--header-clearance`, 4.75rem). A focused control is never hidden under the header. On very short screens (under 30rem tall, such as a phone on its side or a page zoomed to 400%) the header scrolls away instead.
- Busy buttons use `aria-disabled` instead of `disabled`, so they keep focus and simply do nothing while an action runs.
- Each card has exactly one link for the keyboard (the title), even though the whole upper part of the card can be clicked. The strand and tag pills are separate links.

Atlas moves focus with element ids and `document.getElementById`; it does not use React refs.

## Where does focus go when an Atlas page changes?

`PageHeading` (`frontend/src/components/PageHeading.jsx`) handles every page change in Atlas. When the path changes, it sets the tab title to the page title followed by "· Atlas", scrolls to the top, and moves focus to the page's h1, which has `tabIndex="-1"` and no visible ring. On the very first page load it leaves focus alone, so the skip link stays the first Tab stop. Changing only the query (a tab, a filter, or a search) is not a page change, so focus stays on the control that was used.

Other places where Atlas moves focus on purpose:

- Back to the feed: focus returns to the card that had been opened, at the same scroll position.
- "Load more": focus moves to the first newly loaded card.
- A tag chosen far down the feed: focus moves to the page heading, because that card is gone.
- A failed form submit: focus moves to the first field with a problem.
- A confirmed delete: on the profile page focus moves to the "My uploads" heading; on the Saved and Reports pages it moves to the page heading.
- A message closed with its close button, a chosen file removed, or the filters cleared: focus moves to a heading, the file input, or the search box, so it is never left on nothing.
- Switching between log in and password reset: focus moves to the new heading.

## How do Atlas tabs, dialogs, and menus work with a keyboard?

- Tabs (`TabBar`, used for Top and New on the feed and for the study tools): the row has `role="tablist"`, each tab has `role="tab"` and `aria-selected`, and the content has `role="tabpanel"`. Only the selected tab is a Tab stop. Left and Right arrows move between tabs and wrap around, Home and End jump to the ends, and focus follows the selection.
- Dialogs (`ConfirmDialog` and `ReportDialog`) use the browser's own dialog element opened with `showModal()`. Focus moves into the dialog and cannot Tab out of it, the page behind cannot be clicked, Esc closes it, and focus returns to the button that opened it. Cancel is the first button, so it gets focus first and a stray Enter does nothing harmful. While the action runs, both buttons stay focusable but do nothing.
- Mobile menu: below 48rem the main menu sits behind a "Menu" button with `aria-expanded` and `aria-controls`. Esc closes it and returns focus to the button (unless a dialog is open), and the menu closes after a link is chosen.
- Strand colors: the key is a native details element, so it opens and closes with Enter or Space.
- Note editor color menus: the "Text color" and "Highlight" buttons use `aria-expanded`. Esc closes the open menu and returns focus to its button, and a click elsewhere closes it too.

## What keyboard shortcuts do the Atlas study tools have?

Flashcards (`Flashcard` and `FlashcardsPanel`):

- Each card is a single button, so Space or Enter turns it over. Only the side facing up is read by screen readers; the other side has `aria-hidden`.
- Left and Right arrows move to the previous and next card while the Flashcards tab is open. They do nothing while typing in a field, while a dialog is open, or when the tabs above already used the key.

Notes (`NoteEditor`), with Ctrl on Windows and Linux and Cmd on Apple devices:

| Shortcut | Effect |
| --- | --- |
| Ctrl/Cmd+B | Bold |
| Ctrl/Cmd+I | Italic |
| Ctrl/Cmd+Alt+1, 2, or 3 | Heading 1, 2, or 3 (pressing it again turns the line back into a paragraph) |
| Ctrl/Cmd+Shift+8 | Bulleted list |
| Ctrl/Cmd+] | Indent |
| Ctrl/Cmd+[ | Outdent |

Ctrl+U does nothing, because underline is not one of the kept formats. Tab leaves the editor and moves on to the next button, so the editor never traps the keyboard. The editor is a `contentEditable` box with `role="textbox"` and `aria-multiline="true"`, labelled by its visible label and described by the shortcut hint. The toolbar is a `role="group"` named "Formatting", and its buttons show their state with `aria-pressed`.

## How do Atlas forms report errors?

Atlas forms use `noValidate`, so the browser's own pop-up messages never appear and the clearer Atlas messages are the only ones people see and hear.

- Each field (`FormField`) has a visible label, "(required)" written in the label when needed, and an optional hint. The hint and the error are tied to the input with `aria-describedby`, and a field with a problem gets `aria-invalid`.
- Each error message has an alert icon and a hidden "Error:" in front, so it is not shown by color alone.
- After a failed submit, `ErrorSummary` appears at the top with `role="alert"`, a heading such as "There are 3 problems to fix", and one link per problem. Each link puts the cursor in its field. Focus moves to the first field with a problem.
- Field errors from the server (the `fields` object in the API's error answer) are shown the same way, next to their fields.
- Password fields have a real "Show" or "Hide" button whose name says what pressing it will do, for example "Show password".
- A chosen file is checked at once, so nobody fills in the whole form only to learn that the file is not allowed.
- In the report dialog, sending without a reason shows "Choose a reason." and moves focus to the first choice.

## What does Atlas announce to screen readers?

Atlas uses live regions, so screen readers hear changes without focus moving. Polite announcements (`role="status"`) cover:

- the feed's result sentence, such as "Showing 12 study reviewers in STEM, Grade 11.", and "Loading study reviewers…"
- upvote changes, such as "Upvoted. 5 upvotes." or "Upvote removed. 4 upvotes."
- save changes, such as "Saved. Find it under Saved in the menu."
- upload progress in steps of 25%, then "Upload finished. Saving…"
- the chosen file, with its name, type, and size
- the notes save status, such as "Saving…" or "All notes saved at 3:41 PM."
- flashcard changes: the card number and question, the answer after a flip, shuffling, and new sets
- success messages: a saved display name, a sent report, and deletes and removals
- the label of every loading `Spinner`

Errors use `role="alert"`, which interrupts. The containers for these messages stay on the page even when empty, so screen readers notice new text in them. The grey loading placeholders and the spinning ring are hidden from screen readers, and every icon has `aria-hidden="true"`.

## How does Atlas avoid relying on color alone?

Atlas never uses color as the only clue:

- Errors have an alert icon and the word "Error" as well as the red color.
- The selected tab has a thick bar and bold text, not only a color change. The menu link of the current page is also marked with a bar and bold text.
- An upvoted button changes its word to "Upvoted" and its arrow from outline to solid. A saved button changes to "Saved" with a solid bookmark.
- Strand colors always come with the strand name written out. In the "Strand colors" key, the strand being shown is bold and its swatch gets a ring.
- Toggle buttons (upvote, save, dark mode, shuffle, "Only cards not learned yet", and the editor's formatting buttons) give their state to screen readers with `aria-pressed`.
- The theme switch shows "On" or "Off" next to "Dark mode".
- The flashcard progress tiles show a number and a word: "Not studied", "Learning", or "Learned".

## How large are touch targets in Atlas?

Every control in Atlas is at least 44 by 44 CSS pixels, which is larger than the 24 px minimum in WCAG 2.2 AA. The size comes from one token, `--touch-target: 2.75rem`, used as `min-height` (and `min-width` where needed) on buttons, tabs, menu links, the logo, the Back link, link-style buttons, card title links, footer links, and the entries of the strand colors key. Strand and tag pills look small, but they sit inside `chip-link` links that are 44 px tall, so they are easy to tap while the pill itself stays small. Because the token uses `rem`, targets grow with the browser's text size. The README reports that target sizes were measured at every test width (320, 360, 768, 1024, and 1440 px). Buttons also use `touch-action: manipulation`, which removes the old tap delay on touch screens.

## What color tokens does the Atlas design system use?

Every Atlas color is a CSS custom property in `frontend/src/styles/tokens.css`, based on the GitHub Primer palette. Components use these variables instead of raw color values (the one exception is a light shadow under flashcards), so both themes stay in sync. The main tokens:

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--color-canvas` | #ffffff | #0d1117 | Page background |
| `--color-subtle` | #f6f8fa | #151b23 | Raised panels and forms |
| `--color-inset` | #f6f8fa | #010409 | Header and footer |
| `--color-border` | #d1d9e0 | #3d444d | Decorative dividers and card outlines |
| `--color-border-control` | #818b98 | #656c76 | Input and button outlines |
| `--color-text` | #1f2328 | #e6edf3 | Body text |
| `--color-text-muted` | #59636e | #9198a1 | Secondary text |
| `--color-accent` | #0969da | #4493f8 | Links and the focus ring |
| `--color-success` | #1f883d | #238636 | Green primary buttons |
| `--color-danger-emphasis` | #d1242f | #da3633 | Red buttons |
| `--color-attention` | #9a6700 | #d29922 | "Still learning" marks |

Other color tokens cover hover and text variants (such as `--color-success-hover`, `--color-success-text`, and `--color-danger-hover`), button backgrounds, the dialog backdrop and shadow, the drop-down arrow, scrollbars, the note colors, and twelve `--subject-*` color families, eight of which are used for strands.

## What type, spacing, and shape tokens does Atlas use?

Sizes in `frontend/src/styles/tokens.css` use `rem`, so they follow the visitor's browser text size.

- Font sizes: `--font-size-xs` 0.75rem, `--font-size-sm` 0.875rem, `--font-size-md` 1rem, `--font-size-lg` 1.25rem, `--font-size-xl` 1.5rem, and `--font-size-xxl` 2rem. The landing headline uses `--font-size-display`: 2.25rem, then 3rem from 40rem wide and 3.75rem from 64rem wide.
- Line heights: `--line-height-display` 1.08, `--line-height-tight` 1.3, and `--line-height-base` 1.5.
- Font weights: normal 400, medium 500, and bold 600.
- Spacing: `--space-1` 0.25rem, `--space-2` 0.5rem, `--space-3` 0.75rem, `--space-4` 1rem, `--space-5` 1.5rem, `--space-6` 2rem, and `--space-7` 3rem.
- Shape: `--radius` 0.375rem (6px, the GitHub corner) for buttons and inputs, `--radius-large` 0.75rem for panels and cards, `--radius-pill` 2rem, and `--border-width` 1px.
- Sizes: `--touch-target` 2.75rem (44px), `--header-clearance` 4.75rem, `--content-width` 80rem, `--reading-width` 45rem, and `--focus-ring-width` 2px.

The layout is mobile first. Media queries sit mainly at 40rem (640px) and 64rem (1024px), and the header menu folds behind the "Menu" button below 48rem (768px).

## How does Atlas handle motion and reduced motion?

Motion in Atlas is short and only there to help. The motion tokens in `tokens.css` are `--motion-fast` 120ms (hover colors on buttons, tabs, and cards), `--motion-base` 200ms (the flashcard flip), `--motion-slow` 500ms (only the entrance of the three example cards on the landing page), and the easing curve `--motion-ease`, which is `cubic-bezier(0.3, 0, 0.5, 1)`.

When the system setting `prefers-reduced-motion: reduce` is on:

- the three motion tokens drop to 0.01ms, so transitions and the flashcard flip become instant;
- the loading spinner stops and becomes a still ring, and its "Loading" text stays;
- the grey loading placeholders stop pulsing;
- the example cards on the landing page appear without their entrance animation.

Atlas has no autoplaying video, sound, or carousels.

## How does Atlas choose the light or dark theme?

Atlas has a light theme and a dark theme, chosen through the `data-theme` attribute on the html element:

1. A small script in `frontend/index.html` runs before the first frame is drawn. If the visitor saved a choice earlier (the `localStorage` key `atlas-theme`, or the old `learnhub-theme` key), that choice wins.
2. Otherwise the device setting decides, through `prefers-color-scheme: dark`.
3. The "Dark mode" button in the header (`ThemeToggle`) switches themes. It is a toggle button with `aria-pressed`, and it shows "On" or "Off" (hidden from screen readers, so they do not hear the state twice). Pressing it saves the choice in `localStorage`.

`tokens.css` defines the light colors on `:root` and `:root[data-theme="light"]` (light is also the fallback) and the dark colors on `:root[data-theme="dark"]`. Each theme sets `color-scheme`, and `index.html` has a `color-scheme` meta tag with the value `light dark`, so parts the browser draws itself, such as form controls and scrollbars, match the theme. Scrollbars use the theme colors everywhere except inside the browser's own PDF viewer, which a page cannot style.

Atlas does not follow a change of the device setting during a visit. Without a saved choice, the new setting applies on the next page load.

## How does Atlas support high contrast settings?

Atlas supports two system settings for contrast:

- `prefers-contrast: more` (a request for more contrast from the operating system or browser). In `tokens.css`, decorative borders take the stronger control outline color, muted text becomes the normal text color, and the focus ring grows from 2px to 3px, in both themes.
- `forced-colors: active` (Windows High Contrast and other forced color modes). The system replaces the page colors, and `frontend/src/styles/high-contrast.css`, imported last, keeps the important states visible with borders. Pressed upvote and save buttons, pressed flashcard option buttons, the selected tab, and the current menu link get a `Highlight` border. Tags, strand key swatches, and flashcard faces get visible borders. Loading placeholders get `GrayText` borders. Drop-down menus use the browser's own arrow, and the spinner uses `GrayText` and `Highlight`. `base.css` goes back to the system scrollbars in this mode.

Buttons that normally have a transparent border (such as the green and red buttons) show that border as a visible outline in forced colors, and the focus ring is drawn as an outline, so it stays visible. Strand colors are replaced by system colors in this mode, and the written strand names still say which is which.

## How are Atlas strand colors assigned and checked?

Every strand has its own color: a 4px stripe down the left edge of each card, its strand pill, and a swatch in the "Strand colors" key. `strandSlug()` in `frontend/src/services/categories.js` turns a strand into a short class name, and `frontend/src/styles/components/strands.css` maps each class to one of the `--subject-*` color families in `tokens.css`:

| Strand | Class | Color family |
| --- | --- | --- |
| All strands | `all` | `--subject-other` (grey) |
| STEM | `stem` | `--subject-science` (green) |
| ABM | `abm` | `--subject-business` (olive) |
| HUMSS | `humss` | `--subject-history` (brown) |
| GAS | `gas` | `--subject-social` (teal) |
| TVL | `tvl` | `--subject-engineering` (orange) |
| Arts and Design | `arts` | `--subject-arts` (pink) |
| Sports | `sports` | `--subject-health` (red) |

Each class sets three variables: `--strand-color` (stripe, swatch, and pill border), `--strand-bg` (pill background), and `--strand-text` (pill text). An unknown strand gets the grey of "All strands". Every stripe and swatch reaches at least 4.6:1 on the page in the light theme and 5.6:1 in the dark theme, and every pill's text reaches at least 6.1:1 (light) and 9.4:1 (dark) on its own background. The strand name is always written out, so color is never the only clue. The README and an older code comment still say `components.css`; since the CSS split, the mapping lives in `components/strands.css`. See also [What colors do the strands have on Atlas?](categories-and-curriculum.md#what-colors-do-the-strands-have-on-atlas).

## How are note colors and highlights kept readable in Atlas?

Formatted notes in Atlas offer 5 text colors (red, orange, green, blue, purple) and 5 highlights (yellow, green, blue, pink, orange), plus "Default" and "None" to remove them. Each one has its own token per theme in `tokens.css`, from `--note-red` to `--note-purple` and from `--note-hl-yellow` to `--note-hl-orange`. Every text color, and normal text too, reaches at least 5.6:1 in the light theme and 5.1:1 in the dark theme, both on the page and on every highlight.

Notes are stored with class names (such as `tc-red` and `hl-yellow`), never with raw colors. While editing, the browser's editing commands need real color values, so `frontend/src/services/noteHtml.js` uses fixed marker values that never show on screen, and rules in `frontend/src/styles/pages/study.css` swap each marker for the real color of the current theme. That is why the same notes stay readable when the theme changes.

## Which fonts does Atlas use?

Atlas uses two variable fonts. Both are bundled with the app through npm packages and imported in `frontend/src/main.jsx`:

- Schibsted Grotesk Variable (`@fontsource-variable/schibsted-grotesk`) for all text. Token: `--font-family`.
- JetBrains Mono Variable (`@fontsource-variable/jetbrains-mono`) only for real data, through the `mono` class: for example a card's file type and size, and the numbers on the landing page's example cards and steps. Token: `--font-mono`.

Because the font files ship inside the build, Atlas makes no requests to Google Fonts or any other font service. While the fonts load, system fonts show instead: `-apple-system`, `BlinkMacSystemFont`, Segoe UI, Noto Sans, Helvetica, and Arial for text, and `ui-monospace`, `SFMono-Regular`, and Consolas for monospace. Font sizes use `rem`, so they follow the visitor's browser text size, and `text-size-adjust: 100%` stops phones from enlarging text when they rotate, without blocking zoom.

## How are CSS classes named in Atlas?

Atlas CSS follows a few simple naming rules, in place since pull requests #20 and #22:

- Each element gets one short, plain, hyphenated class that says what it is, for example `review`, `review-title`, `button-green`, `field-error`, or `legend-swatch`. There is no BEM-style naming and no utility framework; a few small helpers in `base.css` (such as `stack`, `row`, `muted`, `mono`, and `visually-hidden`) cover common layout and text needs.
- A second class is used only for a variant chosen while the app runs: the strand slug (`review stem`, `pill abm`), the alert type (`alert error`), a flashcard progress tile's status (`tile learned`), or a note color swatch (`swatch color-red`).
- Rules that several classes share are written once with grouped selectors, for example `.button, .button-green, .button-red` in `components/buttons.css`, instead of stacking several classes on one element.
- States use ARIA attributes where one exists: `[aria-pressed="true"]`, `[aria-selected="true"]`, `[aria-current="page"]`, and `[aria-disabled="true"]`. Otherwise the element swaps its one class for another, for example `nav` becomes `nav-open` and `flashcard` becomes `flashcard-flipped`.
- Values come from the tokens in `tokens.css`. Component and page stylesheets never hard-code colors, with one exception: a light shadow under flashcards.
- Every rule sits in the file for its component (`styles/components/`) or its page (`styles/pages/`), and `styles/index.css` imports the files in a fixed order.

## What accessibility checks has Atlas not done yet?

- No real screen reader test. NVDA, JAWS, VoiceOver, and TalkBack have not been tried. Roles, names, and live regions were checked in the browser's accessibility tree and by axe, but nobody has listened to Atlas with a screen reader yet.
- No automatic checks on each change. There is no CI pipeline: lint runs only when someone runs `npm run lint`, and axe was run by hand.
- Known gaps listed in the README: text inside the clickable part of a card cannot be selected by dragging (it can on the study reviewer's own page); some phone browsers show only the first page of a PDF inside the study page, while "Open in new tab" always shows the whole file; and the browser's own PDF viewer cannot be themed.
- The notes editor relies on `document.execCommand`, which is old but still works in every current browser.
- Word and PowerPoint files cannot be shown inside Atlas, only downloaded, so they are only as accessible as the downloaded file itself.
