import jsxA11y from 'eslint-plugin-jsx-a11y';

// The house style avoids "advanced" JavaScript so the code stays beginner friendly.
// These rules make ESLint point out any of it that slips in.
const HOUSE_STYLE_RULES = [
  { selector: 'ChainExpression', message: 'Optional chaining is not used in this project. Check the value with an if statement.' },
  { selector: "LogicalExpression[operator='??']", message: 'Nullish coalescing is not used in this project. Use an if statement or ||.' },
  { selector: 'SpreadElement', message: 'Spread syntax is not used in this project. Use concat or Object.assign.' },
  { selector: 'RestElement', message: 'Rest syntax is not used in this project.' },
  { selector: 'JSXSpreadAttribute', message: 'Pass props one by one instead of spreading them.' },
  { selector: 'ClassDeclaration', message: 'Use function components, not classes.' },
  { selector: 'ClassExpression', message: 'Use function components, not classes.' },
];

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'jsx-a11y': jsxA11y },
    rules: Object.assign({}, jsxA11y.flatConfigs.strict.rules, {
      'no-restricted-syntax': ['error'].concat(HOUSE_STYLE_RULES),
    }),
  },
];
