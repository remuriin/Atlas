// How the docs reader groups the files in docs/knowledge. Every file must appear
// once; the build stops if one is missing or listed twice.
module.exports = [
  { title: 'Start here', stems: ['atlas-overview', 'user-guide', 'atlas-explorer-and-rem'] },
  { title: 'Product', stems: ['accounts-and-sign-in', 'categories-and-curriculum', 'search-and-feed', 'uploads-and-file-safety', 'saved-notes-and-study', 'flashcards', 'reports-and-moderation'] },
  { title: 'Frontend', stems: ['frontend-architecture', 'frontend-pages-and-components', 'accessibility-and-design-system'] },
  { title: 'Backend and API', stems: ['backend-architecture', 'request-pipeline-and-middleware', 'api-endpoints', 'rate-limits', 'security-overview'] },
  { title: 'Data', stems: ['database-schema-and-data-model', 'database-operations'] },
  { title: 'Where it runs', stems: ['hosting-and-traffic-path', 'vps-and-shared-infrastructure', 'deployment', 'configuration-and-environment'] },
  { title: 'Working on Atlas', stems: ['local-development', 'development-workflow-and-code-rules', 'troubleshooting', 'known-limitations-and-pending-work'] },
  { title: 'Reference', stems: ['glossary'] },
];
