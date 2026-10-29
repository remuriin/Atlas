// What Atlas is, for visitors who are not logged in. It sits above the feed, not
// on a page of its own, so the real study reviewers below show the pitch is true.
// Logged-in users never see it.
import { Link } from 'react-router-dom';
import Icon from './Icon';

// Each point says what Atlas does that a shared drive or a group chat does not.
const HIGHLIGHTS = [
  {
    icon: 'search',
    title: 'Find the right one fast',
    text: 'Filter by strand, grade, quarter, and subject: STEM, ABM, HUMSS, GAS, TVL, and more.',
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

function LandingIntro() {
  return (
    <section className="landing-intro" aria-labelledby="landing-intro-heading">
      <h2 id="landing-intro-heading" className="landing-intro__title">
        Reviewers for Senior High, made by students
      </h2>
      <p className="landing-intro__lead">
        Share the reviewers you made, and find ones from other Grade 11 and 12 students for your
        next quarterly exam. Browsing is free and needs no account.
      </p>

      <ul className="landing-intro__list">
        {HIGHLIGHTS.map((highlight) => (
          <li key={highlight.title} className="landing-intro__item">
            <Icon name={highlight.icon} />
            <span>
              <strong className="landing-intro__item-title">{highlight.title}</strong>
              {highlight.text}
            </span>
          </li>
        ))}
      </ul>

      <div className="landing-intro__actions">
        <Link className="button button--primary" to="/register">
          Sign up free
        </Link>
        <Link className="button" to="/login" state={{ from: '/' }}>
          Log in
        </Link>
      </div>
    </section>
  );
}

export default LandingIntro;
