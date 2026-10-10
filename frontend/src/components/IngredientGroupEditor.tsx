import { IngredientLineRow } from './IngredientLineRow.js';
import { move } from '../lib/reorder.js';
import type { IngredientGroup, IngredientLine } from '../services/recipesApi.js';

interface IngredientGroupEditorProps {
  groups: IngredientGroup[];
  /** Called with the full new groups array on any add/edit/reorder/delete. */
  onChange: (groups: IngredientGroup[]) => void;
}

function newLine(): IngredientLine {
  return { lineId: crypto.randomUUID(), quantity: 0, unit: null, name: '', approxEquivalent: null };
}

function newGroup(): IngredientGroup {
  return { groupId: crypto.randomUUID(), name: 'New group', lines: [newLine()] };
}

/**
 * Editable ingredient groups — add/reorder/delete groups and lines (FR-003, FR-012, FR-013).
 *
 * @remarks
 * Reordering uses move-up/move-down controls rather than pointer drag-and-drop, to avoid pulling
 * in a drag-and-drop library for a single-user tool (YAGNI, per the project constitution).
 */
export function IngredientGroupEditor({ groups, onChange }: IngredientGroupEditorProps) {
  const updateGroup = (index: number, group: IngredientGroup) =>
    onChange(groups.map((g, i) => (i === index ? group : g)));

  return (
    <div>
      {groups.map((group, groupIndex) => (
        <div key={group.groupId} style={{ border: '1px solid #e5e5e5', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              aria-label="Move group up"
              disabled={groupIndex === 0}
              onClick={() => onChange(move(groups, groupIndex, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move group down"
              disabled={groupIndex === groups.length - 1}
              onClick={() => onChange(move(groups, groupIndex, 1))}
            >
              ↓
            </button>
            <input
              aria-label="Group name"
              value={group.name}
              onChange={(e) => updateGroup(groupIndex, { ...group, name: e.target.value })}
              style={{ fontWeight: 700, fontSize: 13, border: 'none', flex: 1 }}
            />
            <button
              type="button"
              aria-label="Delete group"
              onClick={() => onChange(groups.filter((_, i) => i !== groupIndex))}
              style={{ border: 'none', background: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {group.lines.map((line, lineIndex) => (
            <IngredientLineRow
              key={line.lineId}
              line={line}
              onChange={(updated) =>
                updateGroup(groupIndex, {
                  ...group,
                  lines: group.lines.map((l, i) => (i === lineIndex ? updated : l)),
                })
              }
              onDelete={() =>
                updateGroup(groupIndex, { ...group, lines: group.lines.filter((_, i) => i !== lineIndex) })
              }
              onMoveUp={() => updateGroup(groupIndex, { ...group, lines: move(group.lines, lineIndex, -1) })}
              onMoveDown={() => updateGroup(groupIndex, { ...group, lines: move(group.lines, lineIndex, 1) })}
              canMoveUp={lineIndex > 0}
              canMoveDown={lineIndex < group.lines.length - 1}
            />
          ))}
          <button
            type="button"
            onClick={() => updateGroup(groupIndex, { ...group, lines: [...group.lines, newLine()] })}
            style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#40704f', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            + Add ingredient
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...groups, newGroup()])}
        style={{ fontSize: 12.5, fontWeight: 700, color: '#40704f', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        + Add group
      </button>
    </div>
  );
}
