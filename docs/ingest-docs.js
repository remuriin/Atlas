// Uploads the public docs (docs/knowledge/*.md) to the Rem RaaS service that answers the
// Explorer's chat. Only new and changed files are sent, one at a time.
//
//   node docs/ingest-docs.js                  upload new and changed files
//   node docs/ingest-docs.js --dry-run        show what would happen, change nothing
//   node docs/ingest-docs.js --all            upload every file again
//   node docs/ingest-docs.js --only <file>    upload one file, for example --only glossary.md
//   node docs/ingest-docs.js --prune          also delete files on the service that are gone here
//   node docs/ingest-docs.js --ask "<text>"   ask Rem a question and print the answer
//
// The service address and key come from docs/.env (RAAS_URL, RAAS_KEY), which git ignores.
// Every upload uses embedding requests from the shared free Gemini quota, so unchanged
// files are never sent again; docs/.ingest-state.json remembers what was sent. The docs
// checks and the safety scan of the build run first, and nothing is sent if one fails.
// docs/private is never uploaded.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const knowledge = require('./lib/knowledge');
const safety = require('./lib/safety');
const envFile = require('./lib/env-file');

const DOCS = __dirname;
const KNOWLEDGE = path.join(DOCS, 'knowledge');
const STATE_FILE = path.join(DOCS, '.ingest-state.json');
const RETRY_WAITS = [10, 20, 40];
// the service's front door gives up after 5 minutes
const REQUEST_TIMEOUT = 6 * 60 * 1000;

const args = process.argv.slice(2);
const dryRun = args.indexOf('--dry-run') !== -1;
const sendAll = args.indexOf('--all') !== -1;
const prune = args.indexOf('--prune') !== -1;
const onlyAt = args.indexOf('--only');
const only = onlyAt !== -1 ? args[onlyAt + 1] : '';
const askAt = args.indexOf('--ask');
const question = askAt !== -1 ? args[askAt + 1] : '';

function stop(message) {
  console.error(message);
  process.exit(1);
}

function settings() {
  const values = envFile.read(path.join(DOCS, '.env'));
  if (!values.RAAS_URL || !values.RAAS_KEY) {
    stop('docs/.env needs RAAS_URL and RAAS_KEY (see docs/.env.example).');
  }
  const url = values.RAAS_URL.replace(/\/+$/, '');
  if (!/^https:\/\/.+\/i\/[0-9a-f-]{36}$/.test(url)) {
    stop('RAAS_URL in docs/.env must look like https://rag.remservers.me/i/<service id>');
  }
  return { url: url, key: values.RAAS_KEY };
}

function wait(seconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, seconds * 1000);
  });
}

// One request to the service. Busy answers (429, 503) are tried again after 10, 20 and
// 40 seconds; anything else comes back as it is.
async function call(service, method, address, body, contentType) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT);
    let response;
    try {
      const headers = { Authorization: 'Bearer ' + service.key };
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
      response = await fetch(service.url + address, { method: method, headers: headers, body: body, signal: controller.signal });
    } catch (err) {
      clearTimeout(timer);
      if (attempt < RETRY_WAITS.length) {
        console.log('  could not reach the service (' + err.message + '), trying again in ' + RETRY_WAITS[attempt] + ' s');
        await wait(RETRY_WAITS[attempt]);
        continue;
      }
      stop('The service cannot be reached: ' + err.message);
    }
    clearTimeout(timer);
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      data = { error: text.slice(0, 200) };
    }
    if ((response.status === 429 || response.status === 503) && attempt < RETRY_WAITS.length) {
      console.log('  the service is busy (' + response.status + '), trying again in ' + RETRY_WAITS[attempt] + ' s');
      await wait(RETRY_WAITS[attempt]);
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      stop('The service refused RAAS_KEY (' + response.status + '). Check docs/.env.');
    }
    return { status: response.status, data: data };
  }
}

function errorText(result) {
  return result.status + (result.data && result.data.error ? ' ' + result.data.error : '');
}

// The docs as they will be sent, after the same checks the build runs.
function localDocs() {
  const lint = knowledge.lint(KNOWLEDGE);
  const extra = safety.privateStrings(DOCS);
  const problems = lint.errors.slice();
  const docs = [];
  for (let i = 0; i < lint.files.length; i++) {
    const name = lint.files[i];
    const text = knowledge.readFile(KNOWLEDGE, name).split('\r\n').join('\n');
    const leaks = safety.scan(text, 'docs/knowledge/' + name, extra);
    for (let p = 0; p < leaks.length; p++) {
      problems.push(leaks[p]);
    }
    docs.push({ name: name, text: text, hash: crypto.createHash('sha256').update(text).digest('hex') });
  }
  if (problems.length > 0) {
    for (let i = 0; i < problems.length; i++) {
      console.error('error: ' + problems[i]);
    }
    stop('Nothing was sent: fix the ' + problems.length + ' problems above first.');
  }
  return docs;
}

function readState(service) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    // a different service starts from nothing
    if (state.url === service.url && state.files) {
      return state;
    }
  } catch (err) {
    // no state yet
  }
  return { url: service.url, files: {} };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

async function ask(service) {
  const result = await call(service, 'POST', '/query', JSON.stringify({ question: question, topK: 6, markdown: true }), 'application/json');
  if (result.status !== 200) {
    stop('The question failed: ' + errorText(result));
  }
  console.log(result.data.answer);
  const sources = result.data.sources || [];
  if (sources.length > 0) {
    console.log('\nSources:');
    for (let i = 0; i < sources.length; i++) {
      console.log('- ' + sources[i].source + (sources[i].heading ? ' › ' + sources[i].heading : ''));
    }
  }
  if (result.data.answered === false) {
    console.log('\n(Rem found no answer in the docs.)');
  }
}

async function main() {
  const service = settings();
  if (askAt !== -1) {
    if (!question) {
      stop('Write the question after --ask, in quotes.');
    }
    await ask(service);
    return;
  }
  const docs = localDocs();
  if (only && !docs.some(function (doc) {
    return doc.name === only;
  })) {
    stop('docs/knowledge/' + only + ' does not exist.');
  }

  const listed = await call(service, 'GET', '/documents');
  if (listed.status !== 200) {
    stop('Could not list the documents on the service: ' + errorText(listed));
  }
  const remote = {};
  const remoteList = listed.data.documents || [];
  for (let i = 0; i < remoteList.length; i++) {
    remote[remoteList[i].source] = remoteList[i];
  }

  // a service holding files that are not Atlas docs is probably the wrong one
  const names = docs.map(function (doc) {
    return doc.name;
  });
  const foreign = Object.keys(remote).filter(function (name) {
    return names.indexOf(name) === -1;
  });
  if (foreign.length > 0 && !prune) {
    console.error('The service also holds files that are not in docs/knowledge: ' + foreign.join(', '));
    stop('If this is the Atlas docs service, run again with --prune to delete them. Otherwise check RAAS_URL and RAAS_KEY in docs/.env.');
  }

  const state = readState(service);
  const plan = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (only && doc.name !== only) {
      continue;
    }
    const there = remote[doc.name];
    const ready = there && there.status === 'ready';
    if (sendAll || only || !ready || state.files[doc.name] !== doc.hash) {
      plan.push({ doc: doc, replace: Boolean(there) });
    }
  }

  console.log(docs.length + ' docs here, ' + remoteList.length + ' on the service, ' + plan.length + ' to send' +
    (prune && foreign.length > 0 ? ', ' + foreign.length + ' to delete' : '') + (dryRun ? ' (dry run: nothing changes)' : '') + '.');
  for (let i = 0; i < plan.length; i++) {
    console.log('  send ' + plan[i].doc.name + (plan[i].replace ? ' (replaces the copy on the service)' : ''));
  }
  for (let i = 0; i < foreign.length && prune; i++) {
    console.log('  delete ' + foreign[i]);
  }
  if (dryRun) {
    return;
  }

  let chunks = 0;
  for (let i = 0; i < foreign.length && prune; i++) {
    const removed = await call(service, 'DELETE', '/documents/' + encodeURIComponent(foreign[i]));
    if (removed.status !== 204 && removed.status !== 404) {
      stop('Could not delete ' + foreign[i] + ': ' + errorText(removed));
    }
    delete state.files[foreign[i]];
    saveState(state);
    console.log('deleted ' + foreign[i]);
  }
  for (let i = 0; i < plan.length; i++) {
    const doc = plan[i].doc;
    if (plan[i].replace) {
      const removed = await call(service, 'DELETE', '/documents/' + encodeURIComponent(doc.name));
      if (removed.status !== 204 && removed.status !== 404) {
        stop('Could not delete the old ' + doc.name + ': ' + errorText(removed));
      }
      delete state.files[doc.name];
      saveState(state);
    }
    const added = await call(service, 'POST', '/documents/' + encodeURIComponent(doc.name), doc.text, 'text/markdown; charset=utf-8');
    if (added.status !== 201) {
      stop('Could not upload ' + doc.name + ': ' + errorText(added) + '\nThe files before it were sent; run the same command again to continue.');
    }
    state.files[doc.name] = doc.hash;
    saveState(state);
    chunks += added.data.chunks || 0;
    console.log('sent ' + doc.name + ' (' + added.data.chunks + ' chunks)');
  }
  console.log('Done: ' + plan.length + ' sent (' + chunks + ' chunks), ' + (docs.length - plan.length) + ' unchanged.');
}

main().catch(function (err) {
  stop('Stopped: ' + err.message);
});
