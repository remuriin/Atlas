# Study reviewer categories

This document lists how Atlas files every study reviewer under the Senior High School curriculum: strands, grades, quarters, material types and the complete subject lists, plus the strand colors, the strand filter, how older study reviewers were moved, and the two files that must match.

## How does Atlas file a study reviewer?

Every study reviewer on Atlas is filed under five required fields, plus optional tags:

- Strand: the SHS strand it is for, or "All strands".
- Grade: 11 or 12.
- Quarter: 1st, 2nd, 3rd or 4th.
- Subject: one subject from the chosen strand's list.
- Material type: Reviewer, Summary notes, Practice test, Formula sheet or Other.

The lists follow the K to 12 Senior High School curriculum that Grade 12 students follow in school year (SY) 2026-2027. The Atlas server checks every value against the lists (`checkCategoryFields` in `backend/src/utils/validate.js`), so nothing outside them can be saved, and a subject must belong to the chosen strand. Cards show the category as one line, for example "General Chemistry 1 · Grade 11 · Q1 · Summary notes".

## Which strands does Atlas use?

Atlas uses these eight strand values:

| Strand | Full name | Color |
| --- | --- | --- |
| All strands | Core and applied subjects every strand takes | grey |
| STEM | Science, Technology, Engineering, and Mathematics | green |
| ABM | Accountancy, Business, and Management | olive yellow |
| HUMSS | Humanities and Social Sciences | brown |
| GAS | General Academic Strand | teal |
| TVL | Technical-Vocational-Livelihood | orange |
| Arts and Design | Arts and Design track | pink |
| Sports | Sports track | red |

The full names are the ones shown on the Atlas front page (`frontend/src/pages/LandingPage.jsx`), where each strand is also a link to the feed filtered to it.

## What does "All strands" mean on Atlas?

"All strands" is the Atlas strand for study reviewers about core and applied subjects that every strand takes, such as General Mathematics or Practical Research 1. Its subject list has the 17 core subjects, the 7 applied subjects and the 2 closing subjects (26 in all), and no specialized subjects.

In the Atlas feed, filtering by any strand also shows the "All strands" study reviewers, because students of that strand take those subjects too. Filtering by "All strands" itself shows only the "All strands" study reviewers. Study reviewers made before the categories existed were moved to "All strands"; see [How were older study reviewers moved into the categories?](#how-were-older-study-reviewers-moved-into-the-categories)

## Which grades and quarters does Atlas use?

Atlas uses two grades, 11 and 12, and four quarters: 1st and 2nd (the first semester) and 3rd and 4th (the second semester). Cards and the feed's result text show quarters short, as Q1 to Q4. The upload form explains: "1st and 2nd quarter are the first semester; 3rd and 4th are the second." The feed has a Grade filter and a Quarter filter, and each must match exactly.

## Which material types does Atlas use?

Atlas has five material types: Reviewer, Summary notes, Practice test, Formula sheet and Other. The material type says what kind of study material the file is. It is required when sharing a study reviewer and shows at the end of the category line on each card. The feed has no filter for material type, but Atlas search matches it.

## Which core subjects are on Atlas?

Atlas lists 17 core subjects. Every strand takes them, so they appear in every strand's subject menu, in this order:

1. Oral Communication
2. Reading and Writing
3. Komunikasyon at Pananaliksik sa Wika at Kulturang Pilipino
4. Pagbasa at Pagsusuri ng Iba't Ibang Teksto Tungo sa Pananaliksik
5. 21st Century Literature from the Philippines and the World
6. Contemporary Philippine Arts from the Regions
7. Media and Information Literacy
8. General Mathematics
9. Statistics and Probability
10. Earth and Life Science
11. Earth Science
12. Disaster Readiness and Risk Reduction
13. Physical Science
14. Personal Development
15. Understanding Culture, Society and Politics
16. Introduction to the Philosophy of the Human Person
17. Physical Education and Health

## Which applied subjects are on Atlas?

Atlas lists 7 applied subjects. Every strand takes them too, with content shaped for each strand, so they appear in every strand's subject menu right after the core subjects:

1. English for Academic and Professional Purposes
2. Practical Research 1
3. Practical Research 2
4. Filipino sa Piling Larangan
5. Empowerment Technologies
6. Entrepreneurship
7. Inquiries, Investigations and Immersion

## Which specialized subjects does each strand have on Atlas?

Specialized subjects are the ones only one strand takes. This is the complete Atlas list (subjects separated by semicolons):

- STEM (8): Pre-Calculus; Basic Calculus; General Biology 1; General Biology 2; General Chemistry 1; General Chemistry 2; General Physics 1; General Physics 2.
- ABM (8): Applied Economics; Business Ethics and Social Responsibility; Fundamentals of Accountancy, Business and Management 1; Fundamentals of Accountancy, Business and Management 2; Business Mathematics; Business Finance; Organization and Management; Principles of Marketing.
- HUMSS (8): Creative Writing; Creative Nonfiction; Introduction to World Religions and Belief Systems; Community Engagement, Solidarity and Citizenship; Philippine Politics and Governance; Trends, Networks and Critical Thinking in the 21st Century Culture; Disciplines and Ideas in the Social Sciences; Disciplines and Ideas in the Applied Social Sciences.
- GAS (6): Humanities 1; Humanities 2; Social Science 1; Applied Economics; Organization and Management; Disaster Readiness and Risk Reduction.
- TVL (4): Home Economics specialization; ICT specialization; Industrial Arts specialization; Agri-Fishery Arts specialization.
- Arts and Design (1): Arts and Design specialized subject.
- Sports (1): Sports specialized subject.
- All strands: none.

## Which subjects end every strand's list on Atlas?

Every strand's subject menu on Atlas ends with two closing subjects: "Work Immersion / Research / Culminating Activity" and "Other". The function `subjectsForStrand` builds a strand's menu in this order: the 17 core subjects, the 7 applied subjects, that strand's specialized subjects, then the 2 closing subjects, with repeats removed. So GAS lists "Disaster Readiness and Risk Reduction" only once, among the core subjects.

Menu sizes: All strands 26, STEM 34, ABM 34, HUMSS 34, GAS 31, TVL 30, Arts and Design 27, Sports 27. Before a strand is chosen, the feed's Subject filter lists all 59 different subjects (`ALL_SUBJECTS`), and the upload form lists the subjects that "All strands" uses.

## Why are some Atlas subjects so general?

TVL has too many courses to list, so its Atlas specialized subjects are four groups: the Home Economics, ICT, Industrial Arts and Agri-Fishery Arts specializations. The exact course name goes in the tags instead. Arts and Design and Sports each have one catch-all subject: "Arts and Design specialized subject" and "Sports specialized subject". Every strand also has "Other" for anything that fits no subject. Because Atlas search matches tags, typing a TVL course name in the search box finds the study reviewers tagged with it.

## What colors do the strands have on Atlas?

Each strand has a color on Atlas. It is used for the stripe down the left edge of each card, the strand pill, and the swatch in the "Strand colors" key above the feed. The strand name is always written out too, so color is never the only clue.

| Strand | Color | Light theme stripe | Dark theme stripe |
| --- | --- | --- | --- |
| All strands | grey | `#59636e` | `#9198a1` |
| STEM | green | `#1a7f37` | `#3fb950` |
| ABM | olive yellow | `#7d6d00` | `#c8b336` |
| HUMSS | brown | `#8a5a2b` | `#c9915f` |
| GAS | teal | `#1b7c83` | `#39c5bb` |
| TVL | orange | `#bc4c00` | `#f0883e` |
| Arts and Design | pink | `#bf3989` | `#f778ba` |
| Sports | red | `#cf222e` | `#f85149` |

The colors are `--subject-*` tokens in `frontend/src/styles/tokens.css` (the names are left from the older subject colors), matched to strands in `frontend/src/styles/components/strands.css`. Every stripe has a contrast of at least 4.6:1 on the light page and 5.6:1 on the dark page. An unknown strand gets the "All strands" grey.

## How does the strand filter work in the Atlas feed?

The Strand menu in the Atlas feed, the strand pills on cards and the "Strand colors" key all set `strand=` in the address, for example /browse?strand=STEM. The API then returns the study reviewers of that strand plus the "All strands" ones (`FILTER_BY_CATEGORY_AND_SEARCH` in `backend/src/models/reviewersModel.js`). The grade, quarter and subject filters must match exactly.

Once a strand is chosen, the Subject menu lists only that strand's subjects, and changing the strand clears a subject the new strand does not take. A filter value that is not in its list is ignored, so an old or hand-edited link still loads. Study reviewers hidden by reports never appear in the feed.

## How were older study reviewers moved into the categories?

Study reviewers from before the SHS categories (pull request #8, 2026-10-29) had a general subject, such as "Mathematics", and no strand. `npm run db:migrate` runs `backend/db/schema.sql`, which adds the new columns and then, only for rows without a strand:

- moves the old subject, in lowercase, into the tags (unless it is already a tag);
- sets the subject to "Other", the strand to "All strands", the grade to 11, the quarter to 1st and the material type to "Reviewer".

Saved copies take their study reviewer's new strand and subject. A saved copy whose original was already deleted gets "All strands" and keeps its old subject as plain text. After that, the new columns become required (NOT NULL). Because only rows without a strand are touched, running the migration again changes nothing. Uploaders should edit moved study reviewers into the right category; one that already had 8 tags now has 9 and must drop one before it can be saved again.

The old general subjects were Mathematics, Science, English, History, Social Studies, Computer Science, Engineering, Business, Health and Medicine, Languages, Arts and Other.

## How do the category lists stay the same in the frontend and backend?

The Atlas category lists exist twice: in `backend/src/utils/categories.js`, which the API uses to check uploads, edits, admin category fixes and feed filters, and in `frontend/src/services/categories.js`, which the website uses for its menus. Both files say they must stay the same, and nothing checks this automatically. If they differ, the form can offer a value the server refuses (such as "Choose a subject from the list for this strand."), or a feed filter is silently ignored.

The frontend file also has two extras: `strandSlug`, the short name that picks each strand's color, and `describeCategory`, which writes the category line on cards. To change a list, edit both files the same way, then deploy both the website and the API. As of 2026-11-01 the two lists are identical.

## What will change for the Strengthened SHS curriculum?

According to the README, Grade 11 moved to the Strengthened Senior High School curriculum (with tracks and elective clusters) in SY 2026-2027. The Atlas lists follow the older K to 12 strands that this year's Grade 12 still uses, so they will need replacing once this year's Grade 12 finishes. Atlas does not support the Strengthened curriculum yet.
