import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoverImageUpload } from '../../src/components/CoverImageUpload.js';
import { uploadImage } from '../../src/services/imagesApi.js';

vi.mock('../../src/services/imagesApi.js', () => ({
  uploadImage: vi.fn(),
}));

const uploadImageMock = vi.mocked(uploadImage);

const file = new File(['fake-image-bytes'], 'tart.jpg', { type: 'image/jpeg' });

describe('CoverImageUpload (005-recipe-media-details FR-002)', () => {
  it('shows no preview when coverImageUrl is null', () => {
    render(<CoverImageUpload coverImageUrl={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows a preview of the existing cover image', () => {
    render(<CoverImageUpload coverImageUrl="https://example.com/a.jpg" onChange={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/a.jpg');
  });

  it('uploads the selected file and reports the resulting URL', async () => {
    uploadImageMock.mockResolvedValue('https://example.com/new.jpg');
    const onChange = vi.fn();

    render(<CoverImageUpload coverImageUrl={null} onChange={onChange} />);
    const input = screen.getByLabelText(/cover image/i);
    await userEvent.upload(input, file);

    expect(uploadImageMock).toHaveBeenCalledWith(file);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://example.com/new.jpg'));
  });

  it('shows an error and does not call onChange when the upload fails', async () => {
    uploadImageMock.mockImplementation(() => Promise.reject(new Error('500')));
    const onChange = vi.fn();

    render(<CoverImageUpload coverImageUrl={null} onChange={onChange} />);
    const input = screen.getByLabelText(/cover image/i);
    await userEvent.upload(input, file);

    await waitFor(() => expect(screen.getByText(/could not upload/i)).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with null when the Remove button is clicked', async () => {
    const onChange = vi.fn();
    render(<CoverImageUpload coverImageUrl="https://example.com/a.jpg" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
