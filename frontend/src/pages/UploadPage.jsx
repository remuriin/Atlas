// The page for sharing a new study reviewer.
import PageHeading from '../components/PageHeading';
import ReviewerForm from '../components/ReviewerForm';

function UploadPage() {
  return (
    <div className="page-form">
      <PageHeading title="Share a study reviewer" />
      <p className="page-intro">
        Upload notes, a study guide, or a review file you made yourself, so other learners can use
        it.
      </p>
      <ReviewerForm mode="create" />
    </div>
  );
}

export default UploadPage;
