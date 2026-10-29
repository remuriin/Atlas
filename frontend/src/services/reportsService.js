// Reporting a study reviewer, and the admin side of reports.
import { apiRequest, apiRequestBlob } from './api';

// Why a study reviewer can be reported, with a hint shown under each choice.
// Keep the names the same as REPORT_REASONS in backend/src/utils/validate.js.
export const REPORT_REASONS = [
  { name: 'Offensive', hint: 'Hateful, violent, or sexual content.' },
  { name: 'Spam', hint: 'Ads, links to other sites, or the same file posted again and again.' },
  { name: 'Irrelevant', hint: 'Not study material: memes, random files, or an empty file.' },
  { name: 'Wrong category', hint: 'Useful, but filed under the wrong strand, grade, or subject.' },
  { name: 'Copyright', hint: 'A textbook, a paid review-center file, or someone else’s work.' },
];

export const REPORT_DETAILS_MAX = 500;

export const reportReviewer = (reviewerId, reason, details) => {
  return apiRequest(`/api/reviewers/${reviewerId}/report`, {
    method: 'POST',
    json: { reason: reason, details: details },
  });
};

// ---- Admins only ----

export const listReports = () => {
  return apiRequest('/api/admin/reports');
};

export const restoreReviewer = (reviewerId) => {
  return apiRequest(`/api/admin/reviewers/${reviewerId}/restore`, { method: 'POST' });
};

// category: { strand, grade, quarter, subject, materialType }
export const updateReviewerCategory = (reviewerId, category) => {
  return apiRequest(`/api/admin/reviewers/${reviewerId}/category`, {
    method: 'PUT',
    json: category,
  });
};

export const deleteReportedReviewer = (reviewerId) => {
  return apiRequest(`/api/admin/reviewers/${reviewerId}`, { method: 'DELETE' });
};

// A hidden reviewer's file is only sent with an admin's login, which a plain link
// cannot carry, so it is fetched here and opened from memory.
export const fetchReviewerFile = (reviewerId) => {
  return apiRequestBlob(`/api/reviewers/${reviewerId}/file`);
};

// Opens such a file in a new tab. The tab is opened straight away, while the click is
// still happening, because browsers block tabs opened later; the file follows into it.
export const openFileInNewTab = async (reviewerId) => {
  const tab = window.open('', '_blank');
  try {
    const blob = await fetchReviewerFile(reviewerId);
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (err) {
    if (tab) {
      tab.close();
    }
    throw err;
  }
};
