import { marked } from 'marked'
import DOMPurify from 'dompurify'

/** Renders a markdown string as sanitized block-level HTML. */
export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text) as string)
}

/** Renders a markdown string as sanitized inline HTML (no wrapping <p> tag). */
export function renderMarkdownInline(text: string): string {
  return DOMPurify.sanitize(marked.parseInline(text) as string)
}
