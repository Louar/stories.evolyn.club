import { createHighlighter } from 'shiki';

const highlighter = await createHighlighter({
  themes: ['snazzy-light', 'aurora-x'],
  langs: ['markdown', 'json', 'yaml']
});

export default highlighter;
