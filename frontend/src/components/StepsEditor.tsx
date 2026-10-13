import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import type { JSONContent } from '@tiptap/core';
import { move } from '../lib/reorder.js';
import type { Step } from '../services/recipesApi.js';

interface StepsEditorProps {
  steps: Step[];
  /** Called with the full new steps array on any add/edit/reorder/delete. */
  onChange: (steps: Step[]) => void;
}

function newStep(): Step {
  return { stepId: crypto.randomUUID(), richText: { type: 'doc', content: [{ type: 'paragraph' }] } };
}

/** One step's Tiptap editor instance — each step is its own independent rich-text document. */
function StepEditorItem({ step, onChange, onDelete }: { step: Step; onChange: (richText: JSONContent) => void; onDelete: () => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: step.richText,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  const toolbarButtonStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 5,
    border: 'none',
    background: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--color-text)',
  };

  return (
    <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 9, marginBottom: 12, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 8,
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border-light)',
        }}
      >
        <button type="button" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} style={{ ...toolbarButtonStyle, fontWeight: 700 }}>
          B
        </button>
        <button type="button" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} style={{ ...toolbarButtonStyle, fontStyle: 'italic' }}>
          I
        </button>
        <button
          type="button"
          aria-label="Bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          style={toolbarButtonStyle}
        >
          •≡
        </button>
        <button
          type="button"
          aria-label="Insert image"
          onClick={() => {
            // Image upload infrastructure is out of this feature's scope (see spec.md
            // Assumptions) — insert by URL in the meantime.
            const url = window.prompt('Image URL');
            if (url) editor?.chain().focus().setImage({ src: url }).run();
          }}
          style={toolbarButtonStyle}
        >
          🖼
        </button>
        <button type="button" aria-label="Delete step" onClick={onDelete} style={{ ...toolbarButtonStyle, marginLeft: 'auto', color: 'var(--color-text-faint)' }}>
          ✕
        </button>
      </div>
      <div style={{ padding: 16, fontSize: 13.5, lineHeight: 1.7 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/**
 * Rich-text (Tiptap) steps editor: bold/italic + inline images, per FR-006.
 *
 * @remarks
 * Image insertion is by URL, not upload — an upload pipeline is out of this feature's scope (see
 * `spec.md`'s Assumptions).
 */
export function StepsEditor({ steps, onChange }: StepsEditorProps) {
  return (
    <div>
      {steps.map((step, index) => (
        <div key={step.stepId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, color: 'var(--color-text-faint)' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{index + 1}</span>
            <button
              type="button"
              aria-label="Move step up"
              disabled={index === 0}
              onClick={() => onChange(move(steps, index, -1))}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move step down"
              disabled={index === steps.length - 1}
              onClick={() => onChange(move(steps, index, 1))}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
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
        style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        + Add step
      </button>
    </div>
  );
}
