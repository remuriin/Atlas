// The front page for visitors: what Atlas is, who it is for, and how it works.
// The feed itself lives at /browse.
//   - Logged-in users go straight to /browse; they already know what Atlas is.
//   - Old feed links such as /?strand=STEM are sent on to /browse?strand=STEM.
import { useContext } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { STRANDS, strandSlug } from '../services/categories';
import FlashMessage from '../components/FlashMessage';
import Icon from '../components/Icon';
import PageHeading from '../components/PageHeading';
import Spinner from '../components/Spinner';

// The feed's settings in the address, from before the feed moved to /browse.
const OLD_FEED_PARAMS = ['sort', 'strand', 'grade', 'quarter', 'subject', 'q'];

// Each point says what Atlas does that a shared drive or a group chat does not.
const HIGHLIGHTS = [
  {
    icon: 'search',
    title: 'Find the right one fast',
    text: 'Filter by strand, grade, quarter, and subject instead of scrolling through a group chat.',
  },
  {
    icon: 'arrow-up',
    title: 'The best ones first',
    text: 'Students upvote the reviewers that helped them, so the useful ones rise to the top.',
  },
  {
    icon: 'bookmark',
    title: 'Study right here',
    text: 'Save a reviewer and read it next to your own notes, on your phone or computer.',
  },
  {
    icon: 'cards',
    title: 'Turn it into flashcards',
    text: 'Make a set of practice flashcards from any saved reviewer in one click.',
  },
];

const STEPS = [
  {
    title: 'Share',
    text: 'Upload a reviewer you made and file it under its strand, grade, quarter, and subject.',
  },
  {
    title: 'Upvote',
    text: 'Students upvote what helped them. Anything wrong or copied can be reported.',
  },
  {
    title: 'Study',
    text: 'Save the ones you need, add your own notes, and practise with flashcards.',
  },
];

// The strand names spelled out, for anyone who knows them only by their letters.
const STRAND_DESCRIPTIONS = {
  'All strands': 'Core and applied subjects every strand takes',
  STEM: 'Science, Technology, Engineering, and Mathematics',
  ABM: 'Accountancy, Business, and Management',
  HUMSS: 'Humanities and Social Sciences',
  GAS: 'General Academic Strand',
  TVL: 'Technical-Vocational-Livelihood',
  'Arts and Design': 'Arts and Design track',
  Sports: 'Sports track',
};

function LandingPage() {
  const auth = useContext(AuthContext);
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  if (OLD_FEED_PARAMS.some((name) => searchParams.has(name))) {
    return <Navigate to={`/browse${location.search}`} replace />;
  }

  // Wait for Firebase, so a logged-in user is not shown the pitch for a moment first.
  if (auth.isLoading) {
    return <Spinner label="Loading…" />;
  }
  // A message from the page before (for example "You are now logged out") stays here.
  if (auth.firebaseUser && !(location.state && location.state.flash)) {
    return <Navigate to="/browse" replace />;
  }

  return (
    <div className="landing stack stack--loose">
      <section className="landing__hero" aria-labelledby="page-heading">
        <FlashMessage />
        <PageHeading title="Reviewers for Senior High, made by students" />
        <p className="landing__lead">
          Share the reviewers you made, and find ones from other Grade 11 and 12 students for your
          next quarterly exam. Browsing is free and needs no account.
        </p>
        <div className="landing__actions">
          <Link className="button button--primary" to="/register">
            Sign up free
          </Link>
          <Link className="button" to="/browse">
            Browse study reviewers
            <Icon name="arrow-right" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="why-heading">
        <h2 id="why-heading" className="section-heading">
          Why Atlas
        </h2>
        <ul className="landing__grid">
          {HIGHLIGHTS.map((highlight) => (
            <li key={highlight.title} className="card card--padded landing__point">
              <Icon name={highlight.icon} />
              <span>
                <strong className="landing__point-title">{highlight.title}</strong>
                {highlight.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="section-heading">
          How it works
        </h2>
        <ol className="landing__steps">
          {STEPS.map((step) => (
            <li key={step.title} className="landing__step">
              <strong className="landing__point-title">{step.title}</strong>
              {step.text}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="strands-heading">
        <h2 id="strands-heading" className="section-heading">
          Browse by strand
        </h2>
        <ul className="landing__grid landing__grid--strands">
          {STRANDS.map((strand) => (
            <li key={strand}>
              <Link
                className={`card landing__strand strand--${strandSlug(strand)}`}
                to={`/browse?strand=${encodeURIComponent(strand)}`}
              >
                <strong>{strand}</strong>
                <span className="landing__strand-text">{STRAND_DESCRIPTIONS[strand]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing__closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading" className="section-heading">
          Got a reviewer that helped you?
        </h2>
        <p>Share it, and help the next student pass the same exam.</p>
        <div className="landing__actions">
          <Link className="button button--primary" to="/register">
            Sign up free
          </Link>
          <Link className="button" to="/terms">
            What you may share
          </Link>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
