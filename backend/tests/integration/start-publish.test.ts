import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
vi.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: class {
    send = sendMock;
  },
  StartExecutionCommand: class {
    constructor(public input: unknown) {}
  },
  DescribeExecutionCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { handler: startPublishHandler } = await import('../../src/handlers/start-publish.js');
const { handler: startUnpublishHandler } = await import('../../src/handlers/start-unpublish.js');
const { createRecipe, listRecipes } = await import('../../src/repository/recipe-repository.js');
const { setSelectedForNextPublish, setPipelineStatus } = await import('../../src/repository/publish-repository.js');
const { ensureTable, parseBody } = await import('./helpers.js');

/** Other test files in this shared local-DynamoDB table create and toggle recipes without
 * always toggling them back off — clear every toggle before each test here so "nothing
 * toggled on" and "exactly these recipes" assertions are deterministic. */
async function untoggleEveryRecipe(): Promise<void> {
  const recipes = await listRecipes();
  await Promise.all(
    recipes.filter((r) => r.selectedForNextPublish).map((r) => setSelectedForNextPublish(r.recipeId, false)),
  );
}

describe('POST /publish, POST /unpublish (004, FR-003/FR-004/FR-009)', () => {
  beforeAll(ensureTable);
  beforeEach(async () => {
    sendMock.mockReset();
    await setPipelineStatus({ running: false, executionArn: null, action: null, startedAt: null, lastResult: null });
    await untoggleEveryRecipe();
  });

  it('returns 409 when a run is already in progress', async () => {
    await setPipelineStatus({
      running: true,
      executionArn: 'arn:aws:states:eu-central-1:1:execution:P:x',
      action: 'publish',
      startedAt: '2026-10-19T00:00:00Z',
      lastResult: null,
    });

    const result = await startPublishHandler();

    expect(result.statusCode).toBe(409);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns nothing-to-publish and starts no execution when no recipe is toggled on', async () => {
    const result = await startPublishHandler();

    const body = parseBody<{ status: string }>(result);
    expect(result.statusCode).toBe(200);
    expect(body.status).toBe('nothing-to-publish');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('starts a Publish execution for toggled recipes and records the running status', async () => {
    sendMock.mockResolvedValue({ executionArn: 'arn:aws:states:eu-central-1:1:execution:P:new' });
    const recipe = await createRecipe({ locale: 'en', name: 'To Publish' });
    await setSelectedForNextPublish(recipe.recipeId, true);

    const result = await startPublishHandler();

    expect(result.statusCode).toBe(202);
    const body = parseBody<{ status: string; executionArn: string }>(result);
    expect(body.status).toBe('started');
    expect(body.executionArn).toBe('arn:aws:states:eu-central-1:1:execution:P:new');
    const sentInput = (sendMock.mock.calls[0]![0] as { input: { input: string } }).input;
    expect(JSON.parse(sentInput.input)).toEqual({ action: 'publish', recipeIds: [recipe.recipeId] });
  });

  it('returns nothing-to-unpublish when no recipe is toggled on', async () => {
    const result = await startUnpublishHandler();

    const body = parseBody<{ status: string }>(result);
    expect(result.statusCode).toBe(200);
    expect(body.status).toBe('nothing-to-unpublish');
  });

  it('starts an Unpublish execution for toggled recipes', async () => {
    sendMock.mockResolvedValue({ executionArn: 'arn:aws:states:eu-central-1:1:execution:P:unpub' });
    const recipe = await createRecipe({ locale: 'en', name: 'To Unpublish' });
    await setSelectedForNextPublish(recipe.recipeId, true);

    const result = await startUnpublishHandler();

    expect(result.statusCode).toBe(202);
    const sentInput = (sendMock.mock.calls[0]![0] as { input: { input: string } }).input;
    expect(JSON.parse(sentInput.input)).toEqual({ action: 'unpublish', recipeIds: [recipe.recipeId] });
  });
});
