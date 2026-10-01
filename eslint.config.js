import react from 'eslint-plugin-react';

export default [{
  files: ['**/*.js', '**/*.jsx'],
  plugins: { react },
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: {
      console: 'readonly', process: 'readonly', Buffer: 'readonly', fetch: 'readonly', window: 'readonly', document: 'readonly', localStorage: 'readonly', setTimeout: 'readonly', confirm: 'readonly', Intl: 'readonly', URL: 'readonly'
    }
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react/jsx-uses-vars': 'error'
  }
}];
