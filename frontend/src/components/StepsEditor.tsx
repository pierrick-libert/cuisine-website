import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { move } from '../lib/reorder.js';
import type { Step } from '../services/recipesApi.js';

interface StepsEditorProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

function newStep(): Step {
  return { stepId: crypto.randomUUID(), richText: { type: 'doc', content: [{ type: 'paragraph' }] } };
}

function StepEditorItem({ step, onChange, onDelete }: { step: Step; onChange: (richText: Record<string, unknown>) => void; onDelete: () => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: step.richText,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 9, padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} style={{ fontWeight: 700 }}>
          B
        </button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} style={{ fontStyle: 'italic' }}>
          I
        </button>
        <button
          type="button"
          onClick={() => {
            // Image upload infrastructure is out of this feature's scope (see spec.md
            // Assumptions) — insert by URL in the meantime.
            const url = window.prompt('Image URL');
            if (url) editor?.chain().focus().setImage({ src: url }).run();
          }}
        >
          Image
        </button>
        <button type="button" aria-label="Delete step" onClick={onDelete} style={{ marginLeft: 'auto', border: 'none', background: 'none' }}>
          ✕
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Rich-text (Tiptap) steps editor: bold/italic + inline images, per FR-006. */
export function StepsEditor({ steps, onChange }: StepsEditorProps) {
  return (
    <div>
      {steps.map((step, index) => (
        <div key={step.stepId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13, textAlign: 'center' }}>{index + 1}</span>
            <button type="button" aria-label="Move step up" disabled={index === 0} onClick={() => onChange(move(steps, index, -1))}>
              ↑
            </button>
            <button
              type="button"
              aria-label="Move step down"
              disabled={index === steps.length - 1}
              onClick={() => onChange(move(steps, index, 1))}
            >
              ↓
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <StepEditorItem
              step={step}
              onChange={(richText) => onChange(steps.map((s, i) => (i === index ? { ...s, richText } : s)))}
              onDelete={() => onChange(steps.filter((_, i) => i !== index))}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, newStep()])}
        style={{ fontSize: 12.5, fontWeight: 700, color: '#40704f', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        + Add step
      </button>
    </div>
  );
}
