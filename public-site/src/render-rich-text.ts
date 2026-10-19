/** A Tiptap/ProseMirror JSON node, loosely typed — only the fields this module reads. */
interface TiptapNode {
  type: string;
  text?: string;
  marks?: Array<{ type: string }>;
  attrs?: Record<string, unknown>;
  content?: unknown[];
}

function isTiptapNode(value: unknown): value is TiptapNode {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderChildren(content: unknown[] | undefined): string {
  return (content ?? []).map(renderNode).join('');
}

function renderNode(node: unknown): string {
  if (!isTiptapNode(node)) return '';

  switch (node.type) {
    case 'doc':
      return renderChildren(node.content);
    case 'paragraph':
      return `<p>${renderChildren(node.content)}</p>`;
    case 'bulletList':
      return `<ul>${renderChildren(node.content)}</ul>`;
    case 'orderedList':
      return `<ol>${renderChildren(node.content)}</ol>`;
    case 'listItem':
      return `<li>${renderChildren(node.content)}</li>`;
    case 'hardBreak':
      return '<br>';
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
    }
    case 'text': {
      const text = escapeHtml(node.text ?? '');
      const marks = node.marks ?? [];
      return marks.reduce((html, mark) => {
        if (mark.type === 'bold') return `<strong>${html}</strong>`;
        if (mark.type === 'italic') return `<em>${html}</em>`;
        return html;
      }, text);
    }
    default:
      // Any node type not used by this project's editor (StepsEditor.tsx: StarterKit + Image
      // only exposes bold/italic/bulletList/image) renders its children only, so an unexpected
      // node never produces broken or missing output.
      return renderChildren(node.content);
  }
}

/**
 * Renders a Tiptap/ProseMirror JSON document (a recipe step's rich text) to static HTML.
 *
 * @remarks
 * Deliberately bounded to a fixed, known vocabulary rather than depending on the full
 * `@tiptap/html` renderer and its extension set — a much smaller, Lambda-bundle-friendly
 * footprint. Covers every node/mark `StepsEditor.tsx`'s toolbar exposes directly (bold, italic,
 * bullet list, image) plus `orderedList`/`hardBreak`, which are reachable through the editor's
 * unconfigured `StarterKit` via markdown-style shortcuts ("1. ", Shift+Enter) even without a
 * toolbar button — any other node type not in this list renders its children only, rather than
 * crashing or (for a leaf node like `hardBreak` used to be, before it had its own case) silently
 * dropping content.
 */
export function renderRichText(doc: object): string {
  return renderNode(doc);
}
