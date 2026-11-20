import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/', 'data/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      // the old code base uses `any` in a few places; warn instead of failing the build
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
