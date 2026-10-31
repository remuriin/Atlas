// Admins only: every study reviewer with open reports, and what to do with each.
//   Restore         the reports were wrong; show it again
//   Fix category    useful, but filed in the wrong place
//   Delete          the reports were right; remove it for everyone
import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  deleteReportedReviewer,
  listReports,
  openFileInNewTab,
  restoreReviewer,
  updateReviewerCategory,
} from '../services/reportsService';
import {
  GRADES,
  MATERIAL_TYPES,
  QUARTERS,
  STRANDS,
  describeCategory,
  subjectsForStrand,
} from '../services/categories';
import { clearFeed } from '../services/feedMemory';
import { countLabel, formatDate } from '../services/format';
import Alert from '../components/Alert';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import Icon from '../components/Icon';
import PageHeading from '../components/PageHeading';
import Spinner from '../components/Spinner';
import StrandLink from '../components/StrandLink';

function AdminPage() {
  const auth = useContext(AuthContext);
  const isAdmin = Boolean(auth.profile && auth.profile.role === 'admin');

  const [items, setItems] = useState([]);
  // status is 'loading', 'ready', or 'error'.
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  // What the last action did, or why it failed.
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // The reviewer whose category is being fixed, and the values chosen so far.
  const [editingId, setEditingId] = useState(null);
  const [category, setCategory] = useState(null);
  const [categoryErrors, setCategoryErrors] = useState({});

  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!isAdmin) {
      return undefined;
    }
    let isCancelled = false;

    const loadReports = async () => {
      setStatus('loading');
      try {
        const data = await listReports();
        if (!isCancelled) {
          setItems(data.items);
          setStatus('ready');
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMessage(err.message);
          setStatus('error');
        }
      }
    };

    loadReports();

    return () => {
      isCancelled = true;
    };
  }, [isAdmin, retryCount]);

  // Takes a reviewer off the list once it has been dealt with.
  const finishItem = (item, message) => {
    setItems(items.filter((other) => other.id !== item.id));
    setActionMessage(message);
    setActionError('');
    // The feed may have changed (a reviewer shown again, moved, or deleted).
    clearFeed();
    const heading = document.getElementById('page-heading');
    if (heading) {
      heading.focus();
    }
  };

  const handleOpenFile = async (item) => {
    setActionError('');
    try {
      await openFileInNewTab(item.id);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleRestore = async (item) => {
    setBusyId(item.id);
    try {
      await restoreReviewer(item.id);
      finishItem(item, `“${item.title}” is shown again and its reports are closed.`);
    } catch (err) {
      setActionError(err.message);
    }
    setBusyId(null);
  };

  const handleStartCategory = (item) => {
    setEditingId(item.id);
    setCategoryErrors({});
    setCategory({
      strand: item.strand,
      grade: item.grade,
      quarter: item.quarter,
      subject: item.subject,
      materialType: item.materialType,
    });
  };

  const changeCategory = (name, value) => {
    const next = Object.assign({}, category, { [name]: value });
    // A new strand may not take the chosen subject.
    if (name === 'strand' && subjectsForStrand(value).indexOf(next.subject) === -1) {
      next.subject = '';
    }
    setCategory(next);
  };

  const handleSaveCategory = async (event, item) => {
    event.preventDefault();
    setBusyId(item.id);
    try {
      await updateReviewerCategory(item.id, category);
      setEditingId(null);
      finishItem(item, `“${item.title}” was moved to ${describeCategory(category)} and is shown again.`);
    } catch (err) {
      if (err.fields) {
        setCategoryErrors(err.fields);
      } else {
        setActionError(err.message);
      }
    }
    setBusyId(null);
  };

  const handleDeleteConfirm = async () => {
    const item = itemToDelete;
    setBusyId(item.id);
    setDeleteError('');
    try {
      await deleteReportedReviewer(item.id);
      setItemToDelete(null);
      finishItem(item, `“${item.title}” and its file were deleted.`);
    } catch (err) {
      setDeleteError(err.message);
    }
    setBusyId(null);
  };

  if (!isAdmin) {
    return (
      <div className="stack">
        <PageHeading title="Reports" />
        <p>Only admins can see this page.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <PageHeading title="Reports" />
        <p className="intro">
          Study reviewers people have reported. Those with 3 or more reports are already hidden
          from the feed. Reporters stay anonymous.
        </p>
        {/* Always on the page, so the messages are announced when they appear. */}
        <div role="status">
          {actionMessage !== '' && <Alert type="success">{actionMessage}</Alert>}
        </div>
        {actionError !== '' && <Alert type="error">{actionError}</Alert>}
      </div>

      {status === 'loading' && <Spinner label="Loading reports…" />}

      {status === 'error' && (
        <div className="stack">
          <Alert type="error">{errorMessage}</Alert>
          <div>
            <button type="button" className="button" onClick={() => setRetryCount(retryCount + 1)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <EmptyState icon="check" title="No open reports" message="Nothing needs looking at right now." />
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="report-list">
          {items.map((item) => (
            <li key={item.id} className="panel">
              <p>
                <StrandLink strand={item.strand} />
              </p>
              <h2 className="review-title">
                <Link to={`/reviewers/${item.id}`}>{item.title}</Link>
              </h2>
              <p className="review-category">{describeCategory(item)}</p>
              <p className="meta">
                <span className="meta-item">
                  <Icon name="user" />
                  Shared by {item.authorName}
                </span>
                <span className="meta-item">
                  <Icon name="alert" />
                  {countLabel(item.reportCount, 'report', 'reports')}
                </span>
              </p>
              {item.isHidden && (
                <p className="status-note">
                  <Icon name="eye-off" />
                  Hidden from the feed until you decide.
                </p>
              )}

              <ul className="report-reasons">
                {item.reports.map((report, index) => (
                  <li key={index}>
                    <strong>{report.reason}</strong>, {formatDate(report.createdAt)}
                    {report.details !== '' && <span>: “{report.details}”</span>}
                  </li>
                ))}
              </ul>

              {editingId === item.id && (
                <form className="stack" onSubmit={(event) => handleSaveCategory(event, item)} noValidate>
                  <div className="report-category">
                    <FormField
                      id={`category-strand-${item.id}`}
                      label="Strand"
                      type="select"
                      value={category.strand}
                      onChange={(event) => changeCategory('strand', event.target.value)}
                      options={STRANDS}
                      placeholderOption="Choose a strand"
                      error={categoryErrors.strand}
                    />
                    <FormField
                      id={`category-grade-${item.id}`}
                      label="Grade"
                      type="select"
                      value={category.grade}
                      onChange={(event) => changeCategory('grade', event.target.value)}
                      options={GRADES}
                      placeholderOption="Choose a grade"
                      error={categoryErrors.grade}
                    />
                    <FormField
                      id={`category-quarter-${item.id}`}
                      label="Quarter"
                      type="select"
                      value={category.quarter}
                      onChange={(event) => changeCategory('quarter', event.target.value)}
                      options={QUARTERS}
                      placeholderOption="Choose a quarter"
                      error={categoryErrors.quarter}
                    />
                    <FormField
                      id={`category-subject-${item.id}`}
                      label="Subject"
                      type="select"
                      value={category.subject}
                      onChange={(event) => changeCategory('subject', event.target.value)}
                      options={subjectsForStrand(category.strand)}
                      placeholderOption="Choose a subject"
                      error={categoryErrors.subject}
                    />
                    <FormField
                      id={`category-type-${item.id}`}
                      label="Material type"
                      type="select"
                      value={category.materialType}
                      onChange={(event) => changeCategory('materialType', event.target.value)}
                      options={MATERIAL_TYPES}
                      placeholderOption="Choose a material type"
                      error={categoryErrors.materialType}
                    />
                  </div>
                  <div className="report-actions">
                    <button
                      type="submit"
                      className="button-green"
                      aria-disabled={busyId === item.id}
                    >
                      Save category and show it
                    </button>
                    <button type="button" className="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {editingId !== item.id && (
                <div className="report-actions">
                  <button type="button" className="button" onClick={() => handleOpenFile(item)}>
                    <Icon name="external" />
                    Open file
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => handleRestore(item)}
                    aria-disabled={busyId === item.id}
                  >
                    <Icon name="check" />
                    Restore
                  </button>
                  <button type="button" className="button" onClick={() => handleStartCategory(item)}>
                    <Icon name="pencil" />
                    Fix category
                  </button>
                  <button
                    type="button"
                    className="button-outline"
                    onClick={() => setItemToDelete(item)}
                  >
                    <Icon name="trash" />
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        id="admin-delete-dialog"
        isOpen={itemToDelete !== null}
        title="Delete this study reviewer?"
        message={
          itemToDelete
            ? `“${itemToDelete.title}” and its file will be removed for everyone. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        isBusy={itemToDelete !== null && busyId === itemToDelete.id}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setItemToDelete(null);
          setDeleteError('');
        }}
      />
    </div>
  );
}

export default AdminPage;
