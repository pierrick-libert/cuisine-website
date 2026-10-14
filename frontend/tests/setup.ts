import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's own auto-cleanup looks for a *global* afterEach, which this project doesn't enable
// (every test file imports vitest's test APIs explicitly) — so it's wired up here instead,
// once, for every component test file.
afterEach(() => {
  cleanup();
});
