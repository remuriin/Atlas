// The front page for visitors: what Atlas is, who it is for, and how it works.
// The feed itself lives at /browse.
//   - Logged-in users go straight to /browse; they already know what Atlas is.
//   - Old feed links such as /?strand=STEM are sent on to /browse?strand=STEM.
// The page is a set of full-width bands; each band keeps its content in a .container.
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

// Example cards for the picture beside the headline. They are a drawing of the
// feed, not real reviewers, so screen readers skip them.
const PREVIEW_CARDS = [
  {
    strand: 'STEM',
    title: 'Gen Chem 1: stoichiometry and gas laws',
    meta: 'Grade 11 · Q2',
    file: 'PDF · 14 pages',
    votes: 128,
  },
  {
    strand: 'ABM',
    title: 'Fundamentals of ABM 2: the accounting cycle',
    meta: 'Grade 12 · Q1',
    file: 'PDF · 9 pages',
    votes: 86,
  },
  {
    strand: 'HUMSS',
    title: 'Philippine Politics and Governance: the 1987 Constitution',
    meta: 'Grade 12 · Q3',
    file: 'PDF · 21 pages',
    votes: 64,
  },
];

// Each point says what Atlas does that a shared drive or a group chat does not.
// "picture" picks the small drawing of that part of Atlas shown in the tile.
const HIGHLIGHTS = [
  {
    picture: 'filters',
    title: 'Find the right one fast',
    text: 'Filter by strand, grade, quarter, and subject instead of scrolling through a group chat.',
  },
  {
    picture: 'upvote',
    title: 'The best ones first',
    text: 'Students upvote the reviewers that helped them, so the useful ones rise to the top.',
  },
  {
    picture: 'notes',
    title: 'Study right here',
    text: 'Save a reviewer and read it next to your own notes, on your phone or computer.',
  },
  {
    picture: 'flashcard',
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

// The small drawing in each highlight tile. Decoration only: the tile's text says it all.
function HighlightPicture(props) {
  if (props.name === 'filters') {
    return (
      <div className="landing__picture landing__picture--filters" aria-hidden="true">
        <span className="landing__chip landing__chip--on">Grade 11</span>
        <span className="landing__chip">Q2</span>
        <span className="landing__chip landing__chip--on">Gen Chem 1</span>
        <span className="landing__chip">STEM</span>
      </div>
    );
  }
  if (props.name === 'upvote') {
    return (
      <div className="landing__picture landing__picture--upvote" aria-hidden="true">
        <span className="landing__vote landing__vote--on">
          <Icon name="arrow-up" />
          <span className="mono">128</span>
        </span>
        <span className="landing__vote">
          <Icon name="arrow-up" />
          <span className="mono">41</span>
        </span>
      </div>
    );
  }
  if (props.name === 'notes') {
    return (
      <div className="landing__picture landing__picture--notes" aria-hidden="true">
        <span className="landing__page">
          <span className="landing__line" />
          <span className="landing__line landing__line--mark" />
          <span className="landing__line" />
          <span className="landing__line landing__line--short" />
        </span>
        <span className="landing__note">
          <span className="landing__line" />
          <span className="landing__line landing__line--short" />
        </span>
      </div>
    );
  }
  return (
    <div className="landing__picture landing__picture--flashcard" aria-hidden="true">
      <span className="landing__flashcard">
        <span>What is Avogadro&rsquo;s number?</span>
        <span className="mono">6.022 × 10²³</span>
      </span>
    </div>
  );
}

function LandingPage() {
  const auth = useContext(AuthContext);
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  if (OLD_FEED_PARAMS.some((name) => searchParams.has(name))) {
    return <Navigate to={`/browse${location.search}`} replace />;
  }

  // Wait for Firebase, so a logged-in user is not shown the pitch for a moment first.
  if (auth.isLoading) {
    return (
      <div className="container">
        <Spinner label="Loading…" />
      </div>
    );
  }
  // A message from the page before (for example "You are now logged out") stays here.
  if (auth.firebaseUser && !(location.state && location.state.flash)) {
    return <Navigate to="/browse" replace />;
  }

  return (
    <div className="landing">
      <section className="landing__band landing__hero" aria-labelledby="page-heading">
        <div className="container landing__hero-inner">
          <div className="landing__hero-text">
            <FlashMessage />
            <PageHeading title="Reviewers for Senior High, made by students" />
            <p className="landing__lead">
              Share the reviewers you made, and find ones from other Grade 11 and 12 students
              for your next quarterly exam. Browsing is free and needs no account.
            </p>
            <div className="landing__actions">
              <Link className="button button--primary button--large" to="/register">
                Sign up free
              </Link>
              <Link className="button button--large" to="/browse">
                Browse study reviewers
                <Icon name="arrow-right" />
              </Link>
            </div>
          </div>

          <div className="landing__preview" aria-hidden="true">
            {PREVIEW_CARDS.map((card) => (
              <div
                key={card.title}
                className={`card reviewer-card landing__preview-card strand--${strandSlug(card.strand)}`}
              >
                <span className="label label--strand">{card.strand}</span>
                <strong className="landing__preview-title">{card.title}</strong>
                <span className="landing__preview-meta">
                  <span>{card.meta}</span>
                  <span className="mono">{card.file}</span>
                  <span className="landing__preview-votes">
                    <Icon name="arrow-up" />
                    <span className="mono">{card.votes}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing__band landing__strands" aria-labelledby="strands-heading">
        <div className="container">
          <h2 id="strands-heading" className="landing__band-heading">
            Browse by strand
          </h2>
          <ul className="landing__strand-list">
            {STRANDS.map((strand) => (
              <li key={strand}>
                <Link
                  className={`landing__strand strand--${strandSlug(strand)}`}
                  to={`/browse?strand=${encodeURIComponent(strand)}`}
                >
                  <strong>{strand}</strong>
                  <span className="landing__strand-text">{STRAND_DESCRIPTIONS[strand]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing__band" aria-labelledby="why-heading">
        <div className="container">
          <h2 id="why-heading" className="landing__band-heading">
            Why Atlas
          </h2>
          <ul className="landing__features">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight.title} className="landing__feature">
                <HighlightPicture name={highlight.picture} />
                <strong className="landing__feature-title">{highlight.title}</strong>
                <span className="landing__feature-text">{highlight.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing__band landing__how" aria-labelledby="how-heading">
        <div className="container">
          <h2 id="how-heading" className="landing__band-heading">
            How it works
          </h2>
          <ol className="landing__steps">
            {STEPS.map((step) => (
              <li key={step.title} className="landing__step">
                <strong className="landing__feature-title">{step.title}</strong>
                {step.text}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing__band landing__closing" aria-labelledby="closing-heading">
        <div className="container">
          <h2 id="closing-heading" className="landing__closing-heading">
            Got a reviewer that helped you?
          </h2>
          <p className="landing__lead">Share it, and help the next student pass the same exam.</p>
          <div className="landing__actions">
            <Link className="button button--primary button--large" to="/register">
              Sign up free
            </Link>
            <Link className="button button--large" to="/terms">
              What you may share
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
