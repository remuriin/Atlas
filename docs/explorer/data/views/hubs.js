// Pages that gather diagrams (Processes, Flows, Logic) and the endpoint catalogue.
AX.addView({
  id: 'processes', parent: 'system', type: 'hub', group: 'Processes',
  title: 'How things happen in Atlas', eyebrow: 'PROCESSES',
  purpose: 'Step-by-step pictures of what happens when someone signs in, shares a study reviewer, makes flashcards, reports a file, deletes an account, writes notes, or when Atlas is deployed.',
  items: ['p-signin', 'p-upload', 'p-flashcards', 'p-report', 'p-delete-account', 'p-notes', 'p-deploy', 'db-ops'],
});

AX.addView({
  id: 'flows', parent: 'system', type: 'hub', group: 'Data flows',
  title: 'Where the data goes', eyebrow: 'DATA FLOWS',
  purpose: 'Follow one kind of data through Atlas from start to end: an uploaded file, a person’s own data, and the docs that feed the Rem chat.',
  items: ['f-file', 'f-personal', 'f-docs'],
});

AX.addView({
  id: 'logic', parent: 'system', type: 'hub', group: 'Logic',
  title: 'How Atlas decides', eyebrow: 'FLOWCHARTS',
  purpose: 'The decisions inside the code: which uploads are accepted, when flashcards can be made, how search ranks results, how rate limits work, and the life of a study reviewer.',
  items: ['l-upload-checks', 'l-flashcards', 'l-search', 'l-rate', 's-reviewer', 'pipeline'],
});

AX.addView({
  id: 'endpoints', parent: 'backend', type: 'catalogue', group: 'Backend',
  title: 'Every API endpoint', eyebrow: 'ENDPOINT CATALOGUE',
  purpose: 'All 30 addresses the Atlas API answers, who may call each one, and the checks each request passes, in order. Click a path for its own diagram.',
});
