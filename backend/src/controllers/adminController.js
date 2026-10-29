// Request handlers for admins: the list of reported study reviewers, and what to do with each.
// Every route here has already passed requireAuth and requireAdmin.
const reviewersModel = require('../models/reviewersModel');
const reportsModel = require('../models/reportsModel');
const savedItemsModel = require('../models/savedItemsModel');
const upload = require('../middleware/upload');
const validate = require('../utils/validate');

const toReportedJson = (row, reports) => {
  return {
    id: row.id,
    title: row.title,
    strand: row.strand,
    grade: row.grade,
    quarter: row.quarter,
    subject: row.subject,
    materialType: row.material_type,
    fileName: row.file_name,
    fileMime: row.file_mime,
    authorName: row.author_name,
    isHidden: row.is_hidden,
    createdAt: row.created_at,
    reportCount: Number(row.report_count),
    lastReportedAt: row.last_reported_at,
    reports: reports.map((report) => {
      return { reason: report.reason, details: report.details, createdAt: report.created_at };
    }),
  };
};

// GET /api/admin/reports
const listReports = async (req, res, next) => {
  try {
    const rows = await reportsModel.listReportedReviewers();
    let reports = [];
    if (rows.length > 0) {
      reports = await reportsModel.listOpenReports(rows.map((row) => row.id));
    }
    const items = rows.map((row) => {
      return toReportedJson(
        row,
        reports.filter((report) => report.reviewer_id === row.id)
      );
    });
    res.json({ items: items });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/reviewers/:id/restore   (the reports were wrong: show it again)
const restoreReviewer = async (req, res, next) => {
  try {
    await reportsModel.resolveReports(req.reviewer.id);
    await reviewersModel.setHidden(req.reviewer.id, false);
    res.json({ restored: true, id: req.reviewer.id });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/reviewers/:id/category   (useful, but filed in the wrong place)
const updateCategory = async (req, res, next) => {
  try {
    const category = validate.validateCategoryFields(req.body);
    await reviewersModel.updateCategory(req.reviewer.id, category);
    // Saved copies keep their own subject and strand, so bring those up to date too.
    await savedItemsModel.refreshSnapshot(
      req.reviewer.id,
      req.reviewer.title,
      category.subject,
      category.strand
    );
    await reportsModel.resolveReports(req.reviewer.id);
    await reviewersModel.setHidden(req.reviewer.id, false);
    res.json({ updated: true, id: req.reviewer.id });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/reviewers/:id   (the reports were right: remove it for everyone)
const deleteReviewer = async (req, res, next) => {
  try {
    // Same order as an uploader's own delete: the row first, then the file.
    await reviewersModel.deleteReviewer(req.reviewer.id);
    await upload.removeStoredFile(req.reviewer.stored_name);
    console.log(`Admin ${req.user.id} deleted reported study reviewer ${req.reviewer.id}.`);
    res.json({ deleted: true, id: req.reviewer.id });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listReports: listReports,
  restoreReviewer: restoreReviewer,
  updateCategory: updateCategory,
  deleteReviewer: deleteReviewer,
};
