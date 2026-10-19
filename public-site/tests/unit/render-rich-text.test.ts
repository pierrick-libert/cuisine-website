import { describe, expect, it } from 'vitest';
import { renderRichText } from '../../src/render-rich-text.js';

describe('renderRichText', () => {
  it('renders a plain paragraph', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mix the flour.' }] }] };
    expect(renderRichText(doc)).toBe('<p>Mix the flour.</p>');
  });

  it('renders bold and italic marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    };
    expect(renderRichText(doc)).toBe('<p><strong>Bold</strong> and <em>italic</em></p>');
  });

  it('renders a bullet list', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
          ],
        },
      ],
    };
    expect(renderRichText(doc)).toBe('<ul><li><p>First</p></li><li><p>Second</p></li></ul>');
  });

  it('renders an image node', () => {
    const doc = { type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/a.jpg', alt: 'A photo' } }] };
    expect(renderRichText(doc)).toBe('<img src="https://example.com/a.jpg" alt="A photo">');
  });

  it('renders an ordered list (Minor: StepsEditor uses an unconfigured StarterKit, reachable via "1. " shortcut)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
          ],
        },
      ],
    };
    expect(renderRichText(doc)).toBe('<ol><li><p>First</p></li><li><p>Second</p></li></ol>');
  });

  it('renders a hard break as <br>, not silently dropping it (Minor: Shift+Enter in the editor)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Line one' }, { type: 'hardBreak' }, { type: 'text', text: 'Line two' }],
        },
      ],
    };
    expect(renderRichText(doc)).toBe('<p>Line one<br>Line two</p>');
  });

  it('escapes HTML-significant characters in text', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script> & "quotes"' }] }] };
    expect(renderRichText(doc)).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;</p>');
  });
});
