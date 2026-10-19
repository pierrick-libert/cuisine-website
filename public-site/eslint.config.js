import tseslint from 'typescript-eslint';
import tsdoc from 'eslint-plugin-tsdoc';

export default tseslint.config(
  // assets/ is browser-loaded plain scripts (global functions, not modules — see browse.js's
  // own comment), not part of the TS build graph.
  { ignores: ['dist/', 'node_modules/', '_site/', 'assets/'] },
  ...tseslint.configs.recommended,
  {
    plugins: { tsdoc },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      'tsdoc/syntax': 'warn',
    },
  },
);
