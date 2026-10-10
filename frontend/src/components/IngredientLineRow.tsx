import type { IngredientLine } from '../services/recipesApi.js';

interface IngredientLineRowProps {
  line: IngredientLine;
  /** Called with the updated line on any field change. */
  onChange: (line: IngredientLine) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Whether this is not already the first line in its group. */
  canMoveUp: boolean;
  /** Whether this is not already the last line in its group. */
  canMoveDown: boolean;
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 13,
};

/** A single ingredient row: quantity/unit/name, plus the optional approximate equivalent. */
export function IngredientLineRow({
  line,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: IngredientLineRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <button type="button" aria-label="Move ingredient up" disabled={!canMoveUp} onClick={onMoveUp}>
        ↑
      </button>
      <button type="button" aria-label="Move ingredient down" disabled={!canMoveDown} onClick={onMoveDown}>
        ↓
      </button>
      <input
        aria-label="Quantity"
        type="number"
        value={line.quantity}
        onChange={(e) => onChange({ ...line, quantity: Number(e.target.value) })}
        style={{ ...inputStyle, width: 64, textAlign: 'right' }}
      />
      <input
        aria-label="Unit"
        value={line.unit ?? ''}
        placeholder="unit"
        onChange={(e) => onChange({ ...line, unit: e.target.value || null })}
        style={{ ...inputStyle, width: 72 }}
      />
      <input
        aria-label="Ingredient name"
        value={line.name}
        placeholder="ingredient name"
        onChange={(e) => onChange({ ...line, name: e.target.value })}
        style={{ ...inputStyle, flex: 1 }}
      />
      <input
        aria-label="Approximate equivalent quantity (optional)"
        type="number"
        value={line.approxEquivalent?.quantity ?? ''}
        placeholder="≈ qty"
        onChange={(e) => {
          const quantity = e.target.value === '' ? null : Number(e.target.value);
          onChange({
            ...line,
            approxEquivalent:
              quantity === null
                ? null
                : { quantity, unit: line.approxEquivalent?.unit ?? 'tbsp' },
          });
        }}
        style={{ ...inputStyle, width: 56, textAlign: 'right' }}
      />
      <input
        aria-label="Approximate equivalent unit (optional)"
        value={line.approxEquivalent?.unit ?? ''}
        placeholder="≈ unit"
        disabled={!line.approxEquivalent}
        onChange={(e) =>
          onChange({
            ...line,
            approxEquivalent: line.approxEquivalent
              ? { ...line.approxEquivalent, unit: e.target.value }
              : null,
          })
        }
        style={{ ...inputStyle, width: 56 }}
      />
      <button type="button" aria-label="Delete ingredient" onClick={onDelete} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
        ✕
      </button>
    </div>
  );
}
