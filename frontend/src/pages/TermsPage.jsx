// The rules for sharing on Atlas, and how a copyright owner gets a file removed.
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';

// Set in frontend/.env. Without it the page says to use the Report button instead.
const TAKEDOWN_EMAIL = (import.meta.env.VITE_TAKEDOWN_EMAIL || '').trim();

// How quickly a takedown request is acted on, promised on this page.
const TAKEDOWN_DAYS = 7;

function TermsPage() {
  return (
    <div className="narrow">
      <PageHeading title="Terms of use and copyright" />
      <p className="intro">
        Atlas is a place for Senior High School students to share study reviewers they made
        themselves. By uploading, you agree to these rules.
      </p>

      <section className="stack" aria-labelledby="share-heading">
        <h2 id="share-heading">What you may share</h2>
        <ul>
          <li>Reviewers, notes, practice tests, and formula sheets that you made yourself.</li>
          <li>Work you have permission to share, such as a classmate’s reviewer they asked you to post.</li>
        </ul>
      </section>

      <section className="stack" aria-labelledby="not-share-heading">
        <h2 id="not-share-heading">What you may not share</h2>
        <ul>
          <li>Scanned or copied textbooks and modules.</li>
          <li>Paid review-center materials, or anything you had to buy.</li>
          <li>Other people’s work without their permission.</li>
          <li>Offensive content, spam, or files that are not study material.</li>
        </ul>
      </section>

      <section className="stack" aria-labelledby="own-heading">
        <h2 id="own-heading">Who owns what</h2>
        <p>
          You keep the rights to what you upload. By uploading, you let Atlas store it and show it
          to other users, and you confirm that you made it or have the right to share it. Each upload
          records when you confirmed this.
        </p>
        <p>
          Atlas removes files that break these rules. You can edit or delete your own uploads at any
          time from your <Link to="/profile">profile</Link>.
        </p>
      </section>

      <section className="stack" aria-labelledby="takedown-heading">
        <h2 id="takedown-heading">If your work was shared without permission</h2>
        {TAKEDOWN_EMAIL !== '' ? (
          <p>
            Email <a href={`mailto:${TAKEDOWN_EMAIL}`}>{TAKEDOWN_EMAIL}</a> with the link to the
            study reviewer and a short note showing the work is yours (for example, where it was
            first published). It will be removed within {TAKEDOWN_DAYS} days if the claim holds.
          </p>
        ) : (
          <p>
            Log in, open the study reviewer, and choose Report, then Copyright. An admin will remove
            it within {TAKEDOWN_DAYS} days if the claim holds.
          </p>
        )}
        <p>
          Students can also use the Report button on any study reviewer. After 3 reports it is hidden
          until an admin has looked at it.
        </p>
      </section>
    </div>
  );
}

export default TermsPage;
