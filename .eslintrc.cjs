/** Root ESLint config. Apps may extend with framework-specific rules. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'eslint-config-prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    '.next',
    'out',
    'coverage',
    'next-env.d.ts',
    '*.config.js',
    '*.config.cjs',
    '*.config.mjs',
  ],
};
