import { useState } from 'react';
import { uploadImage } from '../services/imagesApi.js';

interface CoverImageUploadProps {
  /** The recipe's current cover image URL, `null` if none is set (005-recipe-media-details FR-002). */
  coverImageUrl: string | null;
  /** Called with the new image's URL on a successful upload, or `null` on Remove. */
  onChange: (coverImageUrl: string | null) => void;
}

/**
 * One recipe's cover image: a file picker, a preview, and a Remove button. Self-contained, owning
 * its own pending/error state, mirroring `PublishToggle`'s pattern.
 *
 * @remarks
 * The first real caller of `POST /images` (002) — the in-step image button only inserts by URL
 * (`StepsEditor.tsx`), so there was no existing upload UI to follow, only the backend contract.
 */
export function CoverImageUpload({ coverImageUrl, onChange }: CoverImageUploadProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setPending(true);
    try {
      const imageUrl = await uploadImage(file);
      onChange(imageUrl);
    } catch {
      setError('Could not upload the image. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {coverImageUrl && (
        <img
          src={coverImageUrl}
          alt="Recipe cover"
          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Cover image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            onChange={handleFileChange}
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>
        {coverImageUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{ alignSelf: 'flex-start', fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-card-bg)' }}
          >
            Remove
          </button>
        )}
        {error && <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>{error}</span>}
      </div>
    </div>
  );
}
