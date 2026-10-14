import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TranslationDraftButton } from '../../src/components/TranslationDraftButton.js';
import { translateRecipe } from '../../src/services/translationApi.js';
import type { RawLocaleContent } from '../../src/services/recipesApi.js';

vi.mock('../../src/services/translationApi.js', () => ({ translateRecipe: vi.fn() }));

const translateRecipeMock = vi.mocked(translateRecipe);

function frenchContent(overrides: Partial<RawLocaleContent> = {}): RawLocaleContent {
  return {
    name: 'Tarte aux pommes',
    description: 'Une tarte classique.',
    groupNames: {},
    ingredientNames: {},
    steps: {},
    ...overrides,
  };
}

describe('TranslationDraftButton', () => {
  beforeEach(() => {
    translateRecipeMock.mockReset();
  });

  it('is disabled when the French name is empty', () => {
    render(
      <TranslationDraftButton frenchContent={frenchContent({ name: '' })} hasExistingEnglishContent={false} onDraft={vi.fn()} />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows a loading state and calls onDraft with the translated content on success', async () => {
    const translated: RawLocaleContent = {
      name: 'Apple Tart',
      description: 'A classic tart.',
      groupNames: {},
      ingredientNames: {},
      steps: {},
    };
    let resolveTranslate!: (value: RawLocaleContent) => void;
    translateRecipeMock.mockReturnValue(new Promise((resolve) => (resolveTranslate = resolve)));
    const onDraft = vi.fn();

    render(<TranslationDraftButton frenchContent={frenchContent()} hasExistingEnglishContent={false} onDraft={onDraft} />);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('Generating…');
    resolveTranslate(translated);

    await waitFor(() => expect(onDraft).toHaveBeenCalledWith(translated));
    expect(screen.getByRole('button')).not.toHaveTextContent('Generating…');
  });

  it('shows an inline error and never calls onDraft when the request fails', async () => {
    translateRecipeMock.mockRejectedValue(new Error('502'));
    const onDraft = vi.fn();

    render(<TranslationDraftButton frenchContent={frenchContent()} hasExistingEnglishContent={false} onDraft={onDraft} />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByText(/could not generate a translation/i)).toBeInTheDocument());
    expect(onDraft).not.toHaveBeenCalled();
  });
});
