import { useEffect, useMemo, useRef } from 'react'
import { tokenize, type TokenKind } from '../../lib/sql/tokenize'

interface SqlEditorProps {
  id?: string
  value: string
  onChange: (value: string) => void
  /** ⌘/Ctrl+Enter */
  onRun: () => void
  ariaLabel?: string
  ariaDescribedBy?: string
  minHeight?: number
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  keyword: 'sql-token-keyword',
  string: 'sql-token-string',
  number: 'sql-token-number',
  comment: 'sql-token-comment',
  punctuation: 'sql-token-punct',
  operator: 'sql-token-operator',
  identifier: 'sql-token-identifier',
}

/**
 * Gutter-free SQL editor: a transparent textarea over a highlighted <pre>.
 * No editor dependency — deliberately (plan §4.4). Native textarea typing,
 * selection and mobile keyboard behavior; highlight is cosmetic.
 */
export function SqlEditor({
  id = 'sql-editor',
  value,
  onChange,
  onRun,
  ariaLabel = 'SQL editor',
  ariaDescribedBy,
  minHeight = 220,
}: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const preRef = useRef<HTMLPreElement | null>(null)

  const tokens = useMemo(() => tokenize(value), [value])

  // Keep the highlight scroll aligned with the textarea.
  useEffect(() => {
    const textarea = textareaRef.current
    const pre = preRef.current
    if (!textarea || !pre) return
    pre.scrollTop = textarea.scrollTop
    pre.scrollLeft = textarea.scrollLeft
  })

  const handleScroll = () => {
    const textarea = textareaRef.current
    const pre = preRef.current
    if (!textarea || !pre) return
    pre.scrollTop = textarea.scrollTop
    pre.scrollLeft = textarea.scrollLeft
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onRun()
      return
    }
    if (event.key === 'Escape') {
      event.currentTarget.blur()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      const target = event.currentTarget
      const { selectionStart, selectionEnd, value: text } = target
      const inserted = '  '
      const next = text.slice(0, selectionStart) + inserted + text.slice(selectionEnd)
      onChange(next)
      // Restore the caret after React re-renders with the new value.
      requestAnimationFrame(() => {
        const current = textareaRef.current
        if (!current) return
        const caret = selectionStart + inserted.length
        current.setSelectionRange(caret, caret)
      })
    }
  }

  return (
    <div className="sql-editor" style={{ minHeight }}>
      <pre ref={preRef} className="sql-editor-highlight" aria-hidden="true">
        {tokens.map((token, index) => (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ))}
        {'\n'}
      </pre>
      <textarea
        ref={textareaRef}
        id={id}
        className="sql-editor-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  )
}
