import { describe, expect, it } from 'vitest';
import { extractText, reinsertText } from '../../src/domain/rich-text-translation.js';
import type { RichTextDoc } from '../../src/domain/types.js';

describe('extractText (US2, FR-002)', () => {
  it('extracts a bolded phrase in order, alongside plain text', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mix the ' },
            { type: 'text', text: 'butter', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' well.' },
          ],
        },
      ],
    };
    expect(extractText(doc)).toEqual(['Mix the ', 'butter', ' well.']);
  });

  it('extracts an italicized phrase', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'very gently', marks: [{ type: 'italic' }] }],
        },
      ],
    };
    expect(extractText(doc)).toEqual(['very gently']);
  });

  it('extracts bullet list items in order', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preheat the oven' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Grease the pan' }] }] },
          ],
        },
      ],
    };
    expect(extractText(doc)).toEqual(['Preheat the oven', 'Grease the pan']);
  });

  it('does not treat an inline image node as text', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'https://example.com/tart.png' } }] }],
    };
    expect(extractText(doc)).toEqual([]);
  });
});

describe('reinsertText (US2, FR-002)', () => {
  it('replaces text while leaving a bold mark untouched', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mélanger le ' },
            { type: 'text', text: 'beurre', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    const result = reinsertText(doc, ['Mix the ', 'butter']);
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mix the ' },
            { type: 'text', text: 'butter', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    });
  });

  it('preserves bullet list structure, item count, and order', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Préchauffer le four' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Graisser le moule' }] }] },
          ],
        },
      ],
    };
    const result = reinsertText(doc, ['Preheat the oven', 'Grease the pan']);
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preheat the oven' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Grease the pan' }] }] },
          ],
        },
      ],
    });
  });

  it('leaves an inline image node completely untouched', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'https://example.com/tart.png', alt: 'Tart' } }] }],
    };
    expect(reinsertText(doc, [])).toEqual(doc);
  });

  it('throws rather than silently splicing when the translation count is too low', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }],
    };
    expect(() => reinsertText(doc, ['x'])).toThrow();
  });

  it('throws rather than silently ignoring extra input when the translation count is too high', () => {
    const doc: RichTextDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
    };
    expect(() => reinsertText(doc, ['x', 'y'])).toThrow();
  });
});
