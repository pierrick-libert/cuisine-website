import type { RichTextDoc } from './types.js';

/** A Tiptap/ProseMirror JSON node, loosely typed — only the fields this module reads/writes. */
interface TiptapNode {
  type: string;
  text?: string;
  content?: unknown[];
  [key: string]: unknown;
}

function isTiptapNode(value: unknown): value is TiptapNode {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/**
 * Walks a Tiptap/ProseMirror JSON document in traversal order and collects every text node's
 * string content.
 *
 * @remarks
 * Paired with {@link reinsertText} so a document's words can be translated while every mark
 * (bold/italic), node type, and child ordering — including image nodes and bullet-list nesting —
 * is left completely untouched. The document's structure is never regenerated from a model's
 * output, only substituted at the leaf level (FR-002, 003-translation-drafting/spec.md).
 *
 * @param doc - A Tiptap JSON document (e.g. a recipe step's rich text).
 * @returns Every `{type: "text"}` node's `text` value, in traversal order.
 */
export function extractText(doc: RichTextDoc): string[] {
  const texts: string[] = [];

  function walk(node: unknown): void {
    if (!isTiptapNode(node)) return;
    if (node.type === 'text') {
      texts.push(node.text ?? '');
      return;
    }
    for (const child of node.content ?? []) walk(child);
  }

  walk(doc);
  return texts;
}

/**
 * Rebuilds a Tiptap/ProseMirror JSON document with each text node's content replaced by the
 * corresponding translated string, in the same traversal order {@link extractText} uses.
 *
 * @param doc - The original document — never mutated; a new tree is returned.
 * @param translations - One string per text node `extractText(doc)` would return, in the same
 * order.
 * @returns A new document, structurally identical to `doc`, with only text-node content replaced.
 * @throws {@link Error} if `translations`' length doesn't exactly match the number of text nodes
 * in `doc` — a mismatch means the document cannot be safely reassembled (FR-007); this is a
 * defense-in-depth check, since the handler is expected to validate the combined count first.
 */
export function reinsertText(doc: RichTextDoc, translations: string[]): RichTextDoc {
  let index = 0;

  function walk(node: unknown): unknown {
    if (!isTiptapNode(node)) return node;
    if (node.type === 'text') {
      if (index >= translations.length) {
        throw new Error("Translation count does not match the document's text node count.");
      }
      return { ...node, text: translations[index++] };
    }
    if (!node.content) return node;
    return { ...node, content: node.content.map(walk) };
  }

  const result = walk(doc) as RichTextDoc;
  if (index !== translations.length) {
    throw new Error("Translation count does not match the document's text node count.");
  }
  return result;
}
