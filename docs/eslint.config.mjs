// Lints docs/: the Explorer's browser code and the Node scripts follow the website's house
// style (frontend/eslint.config.js), plus one more rule: no arrow functions here.
// Run it from docs/:  ../frontend/node_modules/.bin/eslint . --max-warnings 0
import frontend from '../frontend/eslint.config.js';

const NO_ARROWS = {
  selector: 'ArrowFunctionExpression',
  message: 'Arrow functions are not used in docs/. Write function () {} instead.',
};

const config = [{ ignores: ['dist/**', 'private/**'] }];
for (let i = 0; i < frontend.length; i++) {
  const entry = frontend[i];
  if (entry.rules && entry.rules['no-restricted-syntax']) {
    config.push(Object.assign({}, entry, {
      rules: Object.assign({}, entry.rules, {
        'no-restricted-syntax': entry.rules['no-restricted-syntax'].concat([NO_ARROWS]),
      }),
    }));
  } else {
    config.push(entry);
  }
}

export default config;
