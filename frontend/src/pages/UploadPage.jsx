// The page for sharing a new study reviewer.
// It first checks how many the user has shared, so someone at the limit learns it
// before filling in the form, not after.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyProfile } from '../services/profileService';
import Alert from '../components/Alert';
import PageHeading from '../components/PageHeading';
import ReviewerForm from '../components/ReviewerForm';
import Spinner from '../components/Spinner';

function UploadPage() {
  // null until loaded; if loading fails, the form is shown anyway and the server decides.
  const [counts, setCounts] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const loadCounts = async () => {
      try {
        const profile = await getMyProfile();
        if (!isCancelled) {
          setCounts({ used: profile.uploadCount, limit: profile.uploadLimit });
        }
      } catch (err) {
        // Not worth blocking the page over.
      }
      if (!isCancelled) {
        setIsChecking(false);
      }
    };
    loadCounts();
    return () => {
      isCancelled = true;
    };
  }, []);

  const isAtLimit = counts !== null && counts.used >= counts.limit;

  return (
    <div className="page-form">
      <PageHeading title="Share a study reviewer" />
      <p className="page-intro">
        Upload notes, a study guide, or a review file you made yourself, so other learners can use
        it.
        {counts !== null && !isAtLimit && (
          <> You have shared {counts.used} of {counts.limit}.</>
        )}
      </p>

      {isChecking && <Spinner label="Checking how many you have shared…" />}

      {!isChecking && isAtLimit && (
        <div className="stack">
          <Alert type="info">
            You have shared {counts.limit} study reviewers, the most one person can have. Delete one
            you no longer need to upload another.
          </Alert>
          <div>
            <Link className="button button-primary" to="/profile">
              Go to your profile
            </Link>
          </div>
        </div>
      )}

      {!isChecking && !isAtLimit && <ReviewerForm mode="create" />}
    </div>
  );
}

export default UploadPage;
