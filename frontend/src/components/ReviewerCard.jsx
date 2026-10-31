// One study reviewer shown as a card in a list.
//
// The whole upper part of the card opens the reviewer, not just the title
// text. This is done in CSS: the title link is stretched over the card body,
// so there is still exactly one link for keyboards and screen readers.
//
// props:
//   reviewer            the reviewer object from the API
//   headingLevel        'h2' or 'h3', so the card fits the page's heading order
//   showOwnerActions    true to show Edit and Delete (used on the profile page)
//   onDelete            called with the reviewer when Delete is pressed
import { Link, useLocation } from 'react-router-dom';
import { describeFileType, formatDate, formatFileSize } from '../services/format';
import { rememberOpenedReviewer } from '../services/feedMemory';
import { describeCategory, strandSlug } from '../services/categories';
import Icon from './Icon';
import SaveButton from './SaveButton';
import StrandLink from './StrandLink';
import TagList from './TagList';
import UpvoteButton from './UpvoteButton';

function ReviewerCard(props) {
  const reviewer = props.reviewer;
  const Heading = props.headingLevel || 'h2';
  const location = useLocation();

  return (
    // The colored stripe down the left edge shows the strand at a glance.
    <article className={`card reviewer-card strand--${strandSlug(reviewer.strand)}`}>
      <div className="reviewer-card__body">
        <p>
          <StrandLink strand={reviewer.strand} />
        </p>

        <Heading className="reviewer-card__title">
          {/* "fromPath" tells the reviewer's page where its Back link should lead. */}
          <Link
            id={`reviewer-link-${reviewer.id}`}
            to={`/reviewers/${reviewer.id}`}
            state={{ fromPath: location.pathname }}
            onClick={() => rememberOpenedReviewer(reviewer.id)}
          >
            {reviewer.title}
          </Link>
        </Heading>

        <p className="reviewer-card__category">{describeCategory(reviewer)}</p>

        {/* Only the uploader (on the profile page) and admins ever get a hidden one. */}
        {reviewer.isHidden && (
          <p className="status-note">
            <Icon name="eye-off" />
            Hidden while an admin looks at reports about it.
          </p>
        )}

        <p className="reviewer-card__description">{reviewer.description}</p>

        <TagList tags={reviewer.tags} />

        <p className="meta">
          <span className="meta__item">
            <Icon name="user" />
            <span className="visually-hidden">Shared by</span>
            {reviewer.authorName}
          </span>
          <span className="meta__item">
            <Icon name="clock" />
            <span className="visually-hidden">Posted</span>
            {formatDate(reviewer.createdAt)}
          </span>
        </p>
        <p className="meta">
          <span className="meta__item">
            <Icon name="file" />
            <span className="visually-hidden">File:</span>
            <span className="mono">
              {describeFileType(reviewer.fileName)}, {formatFileSize(reviewer.fileSize)}
            </span>
          </span>
        </p>
      </div>

      <div className="reviewer-card__footer">
        <div className="row">
          <UpvoteButton
            reviewerId={reviewer.id}
            title={reviewer.title}
            count={reviewer.upvoteCount}
            hasUpvoted={reviewer.hasUpvoted}
          />
          <SaveButton reviewerId={reviewer.id} title={reviewer.title} isSaved={reviewer.isSaved} />
        </div>

        {props.showOwnerActions && (
          <div className="row">
            <Link
              className="button"
              to={`/reviewers/${reviewer.id}/edit`}
              aria-label={`Edit ${reviewer.title}`}
            >
              <Icon name="pencil" />
              Edit
            </Link>
            <button
              type="button"
              id={`delete-button-${reviewer.id}`}
              className="button button--danger-outline"
              aria-label={`Delete ${reviewer.title}`}
              onClick={() => props.onDelete(reviewer)}
            >
              <Icon name="trash" />
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default ReviewerCard;
