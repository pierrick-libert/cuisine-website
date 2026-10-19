import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Integration tests share one local-DynamoDB table with no per-test namespacing, and
    // 004-publish-pipeline-and added a genuine singleton item (PIPELINE#STATUS) that multiple
    // test files write to — running files in parallel (vitest's default) raced two files'
    // writes to that one item. The suite is small enough (well under a second) that running
    // files sequentially costs nothing and removes this whole class of race.
    fileParallelism: false,
  },
});
