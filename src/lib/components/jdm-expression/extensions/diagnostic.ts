type RenderDiagnosticMessageParams = {
  text: string;
  className?: string;
};

export const escapeHtml = (str: string) => {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

export const renderDiagnosticMessage = ({ text, className }: RenderDiagnosticMessageParams) => {
  return text.replace(/`([^`]+)`/g, (_match, content) => {
    let color = '#CE8E6D';
    if (/^["'].*["']$/.test(content)) {
      color = '#6aab73';
    } else if (/^\d+$/.test(content)) {
      color = '#57a8f5';
    }

    return `<span class="${className}" style="color: ${color};">${escapeHtml(content)}</span>`;
  });
};
