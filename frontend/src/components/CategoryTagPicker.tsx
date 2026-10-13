import { useState } from 'react';

interface CategoryTagPickerProps {
  /** The category's display name (not its id) — the server resolves this case-insensitively. */
  categoryName: string;
  onCategoryChange: (categoryName: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

const pillStyle: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

/**
 * Category (existing-or-new, free text — server resolves case-insensitively, FR-008) and
 * free-form tags (FR-007).
 */
export function CategoryTagPicker({ categoryName, onCategoryChange, tags, onTagsChange }: CategoryTagPickerProps) {
  const [editingCategory, setEditingCategory] = useState(!categoryName);

  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) onTagsChange([...tags, trimmed]);
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>Category &amp; tags</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {categoryName && !editingCategory ? (
          <span style={{ ...pillStyle, background: 'var(--color-accent-soft-bg)', color: 'var(--color-accent-soft-text)' }}>
            {categoryName}
            <button
              type="button"
              aria-label="Change category"
              onClick={() => setEditingCategory(true)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
            >
              ✕
            </button>
          </span>
        ) : (
          <input
            aria-label="Category"
            value={categoryName}
            autoFocus={editingCategory && Boolean(categoryName)}
            onChange={(e) => onCategoryChange(e.target.value)}
            onBlur={() => setEditingCategory(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditingCategory(false);
            }}
            placeholder="e.g. Dessert"
            style={{
              border: '1px dashed var(--color-border-lighter)',
              borderRadius: 999,
              padding: '6px 13px',
              fontSize: 12.5,
              fontWeight: 600,
              background: 'transparent',
              outline: 'none',
              width: 120,
            }}
          />
        )}

        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border-lighter)' }} />

        {tags.map((tag) => (
          <span key={tag} style={{ ...pillStyle, background: 'var(--color-tag-bg)', color: 'var(--color-tag-text)' }}>
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          aria-label="Add tag"
          placeholder="+ add tag"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
          style={{
            border: '1px dashed var(--color-border-lighter)',
            borderRadius: 999,
            padding: '6px 13px',
            fontSize: 12.5,
            background: 'transparent',
            outline: 'none',
            width: 100,
          }}
        />
      </div>
    </div>
  );
}
