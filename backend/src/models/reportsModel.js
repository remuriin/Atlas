// All SQL for the "reports" table lives in this file.
const pool = require('../config/db');

const createReport = async (reviewerId, userId, reason, details) => {
  // Add one report. The database refuses a second open report from the same person.
  const result = await pool.query(
    `INSERT INTO reports (reviewer_id, user_id, reason, details)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [reviewerId, userId, reason, details]
  );
  return result.rows[0];
};

const countOpenReports = async (reviewerId) => {
  // How many different people have an open report on this reviewer.
  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM reports WHERE reviewer_id = $1 AND resolved_at IS NULL',
    [reviewerId]
  );
  return Number(result.rows[0].count);
};

const listReportedReviewers = async () => {
  // Every reviewer with open reports: hidden ones first, then the most reported.
  // The reporters' names are left out on purpose: admins judge the file, not the people.
  const result = await pool.query(
    `SELECT r.id, r.title, r.strand, r.grade, r.quarter, r.subject, r.material_type,
            r.file_name, r.file_mime, r.is_hidden, r.created_at,
            u.display_name AS author_name,
            COUNT(rep.id) AS report_count,
            MAX(rep.created_at) AS last_reported_at
     FROM reports rep
     INNER JOIN reviewers r ON r.id = rep.reviewer_id
     INNER JOIN users u ON u.id = r.author_id
     WHERE rep.resolved_at IS NULL
     GROUP BY r.id, u.id
     ORDER BY r.is_hidden DESC, report_count DESC, last_reported_at DESC`
  );
  return result.rows;
};

const listOpenReports = async (reviewerIds) => {
  // The open reports of the given reviewers, newest first.
  const result = await pool.query(
    `SELECT reviewer_id, reason, details, created_at
     FROM reports
     WHERE resolved_at IS NULL AND reviewer_id = ANY($1)
     ORDER BY created_at DESC`,
    [reviewerIds]
  );
  return result.rows;
};

const resolveReports = async (reviewerId) => {
  // Mark every open report on this reviewer as dealt with.
  await pool.query(
    'UPDATE reports SET resolved_at = NOW() WHERE reviewer_id = $1 AND resolved_at IS NULL',
    [reviewerId]
  );
};

module.exports = {
  createReport: createReport,
  countOpenReports: countOpenReports,
  listReportedReviewers: listReportedReviewers,
  listOpenReports: listOpenReports,
  resolveReports: resolveReports,
};
