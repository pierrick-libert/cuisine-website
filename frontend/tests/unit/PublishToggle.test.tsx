import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublishToggle } from '../../src/components/PublishToggle.js';
import { setRecipePublishToggle } from '../../src/services/publishApi.js';

vi.mock('../../src/services/publishApi.js', () => ({
  setRecipePublishToggle: vi.fn(),
}));

// Each test below sets its own mock implementation inline rather than resetting it in a shared
// beforeEach — a `beforeEach(() => mock.mockReset())` paired with a rejected mock on this
// checkbox-based component reproducibly surfaces as a spurious "unhandled rejection" test
// failure in this vitest/jsdom version, confirmed by isolating it to exactly that combination;
// the component's actual error-handling behavior (verified independently) is correct.
const setRecipePublishToggleMock = vi.mocked(setRecipePublishToggle);

describe('PublishToggle (004, FR-001)', () => {
  it('reflects the selected prop', () => {
    render(<PublishToggle recipeId="r1" selected={true} onToggled={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('calls the API with the opposite value and reports the new state on success', async () => {
    setRecipePublishToggleMock.mockResolvedValue({
      recipeId: 'r1',
      selectedForNextPublish: true,
      publishStatus: 'not_published',
    });
    const onToggled = vi.fn();

    render(<PublishToggle recipeId="r1" selected={false} onToggled={onToggled} />);
    await userEvent.click(screen.getByRole('checkbox'));

    expect(setRecipePublishToggleMock).toHaveBeenCalledWith('r1', true);
    await waitFor(() => expect(onToggled).toHaveBeenCalledWith(true));
  });

  it('reverts to the prior value and shows an error when the API call fails', async () => {
    setRecipePublishToggleMock.mockImplementation(() => Promise.reject(new Error('500')));
    const onToggled = vi.fn();

    render(<PublishToggle recipeId="r1" selected={false} onToggled={onToggled} />);
    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(screen.getByText(/could not update/i)).toBeInTheDocument());
    expect(onToggled).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('disables the checkbox while the request is pending', async () => {
    let resolveToggle!: (value: { recipeId: string; selectedForNextPublish: boolean; publishStatus: 'not_published' }) => void;
    setRecipePublishToggleMock.mockReturnValue(new Promise((resolve) => (resolveToggle = resolve)));

    render(<PublishToggle recipeId="r1" selected={false} onToggled={vi.fn()} />);
    await userEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('checkbox')).toBeDisabled();
    resolveToggle({ recipeId: 'r1', selectedForNextPublish: true, publishStatus: 'not_published' });
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
  });
});
