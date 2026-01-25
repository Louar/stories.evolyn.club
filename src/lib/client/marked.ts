import { Marked, type TokenizerAndRendererExtension, type Tokens } from 'marked';
import { createDirectives } from 'marked-directive';

const annotationExt: TokenizerAndRendererExtension = {
  name: 'annotate',
  level: 'inline',
  start(src) {
    return src.match(/【[^】\n]+】/)?.index;
  },
  tokenizer(src) {
    const rule = /^【([^】\n]+)】/;
    const match = rule.exec(src);

    if (match) {
      const content = match[1].trim();
      const isInteger = /^\d+$/.test(content);

      return {
        type: 'annotate',
        raw: match[0],
        display: isInteger ? content : 'bron'
      };
    }
  },
  renderer(token: Tokens.Generic) {
    return `<sup class="annotation" data-annotation="${token.raw}">${token.display}</sup>`;
  }
};

const highlightExt: TokenizerAndRendererExtension = {
  name: 'mark',
  level: 'inline',
  start(src) {
    return src.indexOf('==');
  },
  tokenizer(src) {
    const match = /^==([^=]+)==/.exec(src);
    if (match) {
      return {
        type: 'mark',
        raw: match[0],
        text: match[1],
        tokens: this.lexer.inlineTokens(match[1]),
      };
    }
  },
  renderer(token) {
    let text: string = token.text;
    if (token.tokens?.length) text = this.parser.parseInline(token.tokens);
    return `<mark>${text}</mark>`;
  }
};

// Check https://github.com/bent10/marked-extensions/tree/main/packages/directive
export const marked = new Marked({ extensions: [highlightExt, annotationExt] }).use(createDirectives());
