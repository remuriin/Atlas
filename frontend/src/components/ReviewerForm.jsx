// The form for sharing a new study reviewer and for editing an existing one.
//
// props:
//   mode       'create' or 'edit'
//   reviewer   the reviewer being edited (only for 'edit')
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createReviewer, updateReviewer } from '../services/reviewersService';
import { GRADES, MATERIAL_TYPES, QUARTERS, STRANDS, subjectsForStrand } from '../services/categories';
import { clearFeed } from '../services/feedMemory';
import { describeFileType, formatFileSize } from '../services/format';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_TYPES_TEXT,
  MAX_FILE_SIZE_MB,
  describeOfficeLimits,
  validateFile,
} from '../services/fileRules';
import Alert from './Alert';
import ErrorSummary from './ErrorSummary';
import FormField from './FormField';
import Icon from './Icon';

// The order the fields appear in, used to find the first one with a problem.
const FIELD_ORDER = [
  'title',
  'description',
  'strand',
  'grade',
  'quarter',
  'subject',
  'materialType',
  'tags',
  'file',
  'rightsConfirmed',
];

// These limits match the server's (backend/src/utils/validate.js).
const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;
const MAX_TAGS = 8;
const TAG_MAX = 30;

function ReviewerForm(props) {
  const navigate = useNavigate();
  const isEdit = props.mode === 'edit';

  // When editing, start with the saved values. When creating, start empty.
  let startTitle = '';
  let startDescription = '';
  let startStrand = '';
  let startGrade = '';
  let startQuarter = '';
  let startSubject = '';
  let startMaterialType = '';
  let startTags = '';
  if (isEdit) {
    startTitle = props.reviewer.title;
    startDescription = props.reviewer.description;
    startStrand = props.reviewer.strand;
    startGrade = props.reviewer.grade;
    startQuarter = props.reviewer.quarter;
    startSubject = props.reviewer.subject;
    startMaterialType = props.reviewer.materialType;
    startTags = props.reviewer.tags.join(', ');
  }

  const [title, setTitle] = useState(startTitle);
  const [description, setDescription] = useState(startDescription);
  const [strand, setStrand] = useState(startStrand);
  const [grade, setGrade] = useState(startGrade);
  const [quarter, setQuarter] = useState(startQuarter);
  const [subject, setSubject] = useState(startSubject);
  const [materialType, setMaterialType] = useState(startMaterialType);
  const [tags, setTags] = useState(startTags);
  const [file, setFile] = useState(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  // errors looks like { title: 'message', file: 'message' }
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  // Checks every field and returns an object of problems (empty when all is well).
  const findErrors = () => {
    const found = {};
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const tagList = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag !== '');

    if (cleanTitle.length < TITLE_MIN || cleanTitle.length > TITLE_MAX) {
      found.title = `Enter a title between ${TITLE_MIN} and ${TITLE_MAX} characters.`;
    }
    if (cleanDescription.length < DESCRIPTION_MIN || cleanDescription.length > DESCRIPTION_MAX) {
      found.description = `Enter a description between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX} characters.`;
    }
    if (strand === '') {
      found.strand = 'Choose a strand.';
    }
    if (grade === '') {
      found.grade = 'Choose a grade.';
    }
    if (quarter === '') {
      found.quarter = 'Choose a quarter.';
    }
    if (subject === '') {
      found.subject = 'Choose a subject.';
    }
    if (materialType === '') {
      found.materialType = 'Choose a material type.';
    }
    if (tagList.length > MAX_TAGS) {
      found.tags = `Use ${MAX_TAGS} tags or fewer. You have ${tagList.length}.`;
    } else if (tagList.find((tag) => tag.length > TAG_MAX)) {
      found.tags = `Each tag must be ${TAG_MAX} characters or fewer.`;
    }
    if (file) {
      const fileProblem = validateFile(file);
      if (fileProblem !== '') {
        found.file = fileProblem;
      }
    } else if (!isEdit) {
      found.file = 'Choose a file to upload.';
    }
    // Asked for every new file: a first upload, or a replacement when editing.
    if ((file || !isEdit) && !rightsConfirmed) {
      found.rightsConfirmed = 'Confirm that you made this file or have the right to share it.';
    }

    return found;
  };

  // Shows the problems and puts the cursor in the first field that has one.
  const showErrors = (found) => {
    setErrors(found);
    const firstField = FIELD_ORDER.find((name) => found[name]);
    if (firstField) {
      const input = document.getElementById(`reviewer-${firstField}`);
      if (input) {
        input.focus();
      }
    }
  };

  // Each strand takes different subjects, so a subject the new strand does not
  // take is cleared and has to be chosen again.
  const handleStrandChange = (event) => {
    const nextStrand = event.target.value;
    setStrand(nextStrand);
    if (subjectsForStrand(nextStrand).indexOf(subject) === -1) {
      setSubject('');
    }
  };

  const handleFileChange = (event) => {
    const chosenFile = event.target.files[0] || null;
    setFile(chosenFile);

    // Check the file as soon as it is picked, so nobody fills in the whole
    // form only to learn at the end that the file is not allowed.
    const nextErrors = Object.assign({}, errors);
    delete nextErrors.file;
    if (chosenFile) {
      const fileProblem = validateFile(chosenFile);
      if (fileProblem !== '') {
        nextErrors.file = fileProblem;
      }
    }
    setErrors(nextErrors);
  };

  const handleRemoveFile = () => {
    setFile(null);
    const nextErrors = Object.assign({}, errors);
    delete nextErrors.file;
    setErrors(nextErrors);

    // React cannot clear a file input through its value, so empty the real one.
    const input = document.getElementById('reviewer-file');
    if (input) {
      input.value = '';
      // The Remove button is about to disappear; keep focus somewhere useful.
      input.focus();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setSubmitError('');

    const found = findErrors();
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    setErrors({});

    // A file has to be sent as "form data" rather than JSON.
    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('strand', strand);
    formData.append('grade', grade);
    formData.append('quarter', quarter);
    formData.append('subject', subject);
    formData.append('materialType', materialType);
    formData.append('tags', tags);
    if (file) {
      formData.append('rightsConfirmed', String(rightsConfirmed));
      formData.append('file', file);
    }

    setIsSubmitting(true);
    setProgress(0);

    try {
      let saved;
      let flash;
      if (isEdit) {
        saved = await updateReviewer(props.reviewer.id, formData, setProgress);
        flash = 'Your changes were saved.';
      } else {
        saved = await createReviewer(formData, setProgress);
        flash = 'Your study reviewer is now shared.';
      }
      // The remembered feed would show the old details, so let it load fresh.
      clearFeed();
      navigate(`/reviewers/${saved.id}`, { state: { flash: flash } });
    } catch (err) {
      setIsSubmitting(false);
      // The server double-checks everything. Show its findings next to the fields.
      if (err.fields) {
        showErrors(err.fields);
      } else {
        setSubmitError(err.message);
      }
    }
  };

  const summaryErrors = FIELD_ORDER.filter((name) => errors[name]).map((name) => {
    return { fieldId: `reviewer-${name}`, message: errors[name] };
  });

  let fileLabel = 'File';
  let fileHint = `${ALLOWED_TYPES_TEXT}. Up to ${MAX_FILE_SIZE_MB} MB. PDF, image, or text files work best: they open right inside Atlas.`;
  let submitText = 'Share study reviewer';
  let cancelPath = '/browse';
  if (isEdit) {
    fileLabel = 'Replace file';
    fileHint = `Current file: ${props.reviewer.fileName}. Leave this empty to keep it. ${fileHint}`;
    submitText = 'Save changes';
    cancelPath = `/reviewers/${props.reviewer.id}`;
  }

  // Screen readers hear progress in steps of 25%, not every single percent,
  // which would be a constant stream of numbers.
  let progressAnnouncement = '';
  if (isSubmitting) {
    if (progress >= 100) {
      progressAnnouncement = 'Upload finished. Saving…';
    } else {
      progressAnnouncement = `Uploading: ${Math.floor(progress / 25) * 25} percent done.`;
    }
  }

  return (
    // noValidate turns off the browser's own pop-up messages so that our
    // clearer, consistent messages are the ones people see and hear.
    <form className="form" onSubmit={handleSubmit} noValidate>
      <ErrorSummary errors={summaryErrors} />
      {submitError !== '' && <Alert type="error">{submitError}</Alert>}

      <FormField
        id="reviewer-title"
        label="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        maxLength={TITLE_MAX}
        hint="For example: General Chemistry 1 quarterly exam reviewer"
        error={errors.title}
      />

      <FormField
        id="reviewer-description"
        label="Description"
        type="textarea"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
        maxLength={DESCRIPTION_MAX}
        hint="What does it cover, and who is it useful for?"
        error={errors.description}
      />

      <FormField
        id="reviewer-strand"
        label="Strand"
        type="select"
        value={strand}
        onChange={handleStrandChange}
        required
        options={STRANDS}
        placeholderOption="Choose a strand"
        hint="Choose All strands for core and applied subjects that every strand takes."
        error={errors.strand}
      />

      <FormField
        id="reviewer-grade"
        label="Grade"
        type="select"
        value={grade}
        onChange={(event) => setGrade(event.target.value)}
        required
        options={GRADES}
        placeholderOption="Choose a grade"
        error={errors.grade}
      />

      <FormField
        id="reviewer-quarter"
        label="Quarter"
        type="select"
        value={quarter}
        onChange={(event) => setQuarter(event.target.value)}
        required
        options={QUARTERS}
        placeholderOption="Choose a quarter"
        hint="1st and 2nd quarter are the first semester; 3rd and 4th are the second."
        error={errors.quarter}
      />

      {/* Until a strand is chosen, the core and applied subjects are listed. */}
      <FormField
        id="reviewer-subject"
        label="Subject"
        type="select"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        required
        options={subjectsForStrand(strand)}
        placeholderOption="Choose a subject"
        error={errors.subject}
      />

      <FormField
        id="reviewer-materialType"
        label="Material type"
        type="select"
        value={materialType}
        onChange={(event) => setMaterialType(event.target.value)}
        required
        options={MATERIAL_TYPES}
        placeholderOption="Choose a material type"
        error={errors.materialType}
      />

      <FormField
        id="reviewer-tags"
        label="Tags"
        value={tags}
        onChange={(event) => setTags(event.target.value)}
        hint={`Optional. Separate tags with commas, for example: limits, quarterly exam. Up to ${MAX_TAGS} tags.`}
        error={errors.tags}
      />

      <FormField
        id="reviewer-file"
        label={fileLabel}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleFileChange}
        required={!isEdit}
        hint={fileHint}
        error={errors.file}
      />

      {/* Confirms which file was picked, with its type and size. Always on the
          page so screen readers announce the text when it appears. */}
      <div role="status">
        {file && !errors.file && (
          <div className="file-summary">
            <Icon name="check" />
            <p className="file-summary-text">
              <span className="file-summary-name">Selected: {file.name}</span>
              <span className="text-muted">
                {describeFileType(file.name)}, {formatFileSize(file.size)}
              </span>
            </p>
            <button type="button" className="button" onClick={handleRemoveFile}>
              Remove
              <span className="visually-hidden"> selected file</span>
            </button>
          </div>
        )}
        {/* Word and PowerPoint files are allowed, but cannot be shown inside the
            app, so uploaders are told what a PDF would add. */}
        {file && !errors.file && describeOfficeLimits(file.name) !== '' && (
          <Alert type="info">{describeOfficeLimits(file.name)}</Alert>
        )}
      </div>

      {/* A first upload always asks; an edit asks only once a replacement file is chosen. */}
      {(file || !isEdit) && (
        <div className="field">
          <div className="choice">
            <input
              type="checkbox"
              id="reviewer-rightsConfirmed"
              checked={rightsConfirmed}
              onChange={(event) => setRightsConfirmed(event.target.checked)}
              required
              aria-invalid={Boolean(errors.rightsConfirmed)}
              aria-describedby={errors.rightsConfirmed ? 'reviewer-rightsConfirmed-error' : undefined}
            />
            <label htmlFor="reviewer-rightsConfirmed">
              <span className="choice-name">
                I made this file, or I have the right to share it (required)
              </span>
              <span className="choice-hint">
                Textbooks, paid review-center files, and other people’s work are not allowed. See
                the <Link to="/terms">terms of use</Link>.
              </span>
            </label>
          </div>
          {errors.rightsConfirmed && (
            <p className="field-error" id="reviewer-rightsConfirmed-error">
              {errors.rightsConfirmed}
            </p>
          )}
        </div>
      )}

      {isSubmitting && (
        <div className="upload-progress">
          <label htmlFor="upload-progress">
            Uploading <span aria-hidden="true">{progress}%</span>
          </label>
          <progress id="upload-progress" max="100" value={progress}>
            {progress}%
          </progress>
        </div>
      )}
      <p className="visually-hidden" role="status">
        {progressAnnouncement}
      </p>

      <div className="form-actions">
        <button type="submit" className="button button-primary" aria-disabled={isSubmitting}>
          {submitText}
        </button>
        <Link className="button" to={cancelPath}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default ReviewerForm;
