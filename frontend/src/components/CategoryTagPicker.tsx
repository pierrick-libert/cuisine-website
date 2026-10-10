interface CategoryTagPickerProps {
  /** The category's display name (not its id) — the server resolves this case-insensitively. */
  categoryName: string;
  onCategoryChange: (categoryName: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

const chipStyle: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 999,
  background: '#f0f0f0',
  fontSize: 12.5,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

/**
 * Category (existing-or-new, free text — server resolves case-insensitively, FR-008) and
 * free-form tags (FR-007).
 */
export function CategoryTagPicker({ categoryName, onCategoryChange, tags, onTagsChange }: CategoryTagPickerProps) {
  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) onTagsChange([...tags, trimmed]);
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        Category
      </label>
      <input
        aria-label="Category"
        value={categoryName}
        onChange={(e) => onCategoryChange(e.target.value)}
        placeholder="e.g. Dessert"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', marginBottom: 14, width: 200 }}
      />

      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        Tags
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {tags.map((tag) => (
          <span key={tag} style={chipStyle}>
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
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
          style={{ border: '1px dashed #ccc', borderRadius: 999, padding: '6px 13px', fontSize: 12.5, width: 110 }}
        />
      </div>
    </div>
  );
}
