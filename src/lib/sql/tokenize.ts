// Minimal SQL tokenizer for the editor highlight. Not a parser; anything it
// does not classify falls through as `identifier` (default text color).

export type TokenKind =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'punctuation'
  | 'operator'
  | 'identifier'

export interface SqlToken {
  text: string
  kind: TokenKind
}

const KEYWORDS = new Set([
  'select', 'from', 'where', 'group', 'by', 'having', 'order', 'limit', 'offset',
  'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'drop', 'alter',
  'table', 'index', 'unique', 'view', 'trigger', 'primary', 'foreign', 'key',
  'references', 'constraint', 'check', 'not', 'null', 'default', 'on', 'conflict',
  'do', 'nothing', 'cascade', 'restrict',
  'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'natural', 'using',
  'and', 'or', 'in', 'is', 'between', 'like', 'glob', 'regexp', 'match', 'exists',
  'case', 'when', 'then', 'else', 'end', 'as', 'distinct', 'all', 'any',
  'union', 'except', 'intersect',
  'with', 'recursive', 'over', 'partition', 'rows', 'range', 'unbounded',
  'preceding', 'following', 'current', 'row',
  'asc', 'desc', 'nulls', 'first', 'last',
  'begin', 'commit', 'rollback', 'transaction', 'savepoint', 'release',
  'explain', 'query', 'plan', 'analyze', 'vacuum', 'reindex', 'pragma',
  'true', 'false', 'cast', 'collate', 'asc', 'desc',
])

const FUNCTIONS = new Set([
  'count', 'sum', 'avg', 'min', 'max', 'total', 'group_concat',
  'coalesce', 'nullif', 'ifnull', 'iif',
  'abs', 'round', 'floor', 'ceil', 'mod', 'pow', 'sqrt', 'sign', 'random',
  'upper', 'lower', 'length', 'substr', 'substring', 'trim', 'ltrim', 'rtrim',
  'instr', 'replace', 'printf', 'format', 'hex', 'quote',
  'date', 'time', 'datetime', 'julianday', 'strftime', 'unixepoch',
  'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'first_value', 'last_value',
  'ntile', 'percent_rank', 'cume_dist',
  'json_extract', 'json_object', 'json_array', 'json_type', 'json_valid',
])

export function tokenize(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let i = 0
  const n = sql.length

  const push = (text: string, kind: TokenKind) => {
    if (text.length > 0) tokens.push({ text, kind })
  }

  while (i < n) {
    const ch = sql[i]
    const next = i + 1 < n ? sql[i + 1] : ''

    // Comments
    if (ch === '-' && next === '-') {
      let end = i
      while (end < n && sql[end] !== '\n') end += 1
      push(sql.slice(i, end), 'comment')
      i = end
      continue
    }
    if (ch === '/' && next === '*') {
      let end = i + 2
      while (end < n && !(sql[end] === '*' && sql[end + 1] === '/')) end += 1
      end = Math.min(end + 2, n)
      push(sql.slice(i, end), 'comment')
      i = end
      continue
    }
    // Strings with '' escape
    if (ch === "'") {
      let end = i + 1
      while (end < n) {
        if (sql[end] === "'") {
          if (sql[end + 1] === "'") { end += 2; continue }
          end += 1
          break
        }
        end += 1
      }
      push(sql.slice(i, end), 'string')
      i = end
      continue
    }
    // Numbers
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(next))) {
      let end = i
      while (end < n && /[0-9_.]/.test(sql[end])) end += 1
      push(sql.slice(i, end), 'number')
      i = end
      continue
    }
    // Words (keywords / functions / identifiers)
    if (/[A-Za-z_]/.test(ch)) {
      let end = i
      while (end < n && /[A-Za-z0-9_$]/.test(sql[end])) end += 1
      const word = sql.slice(i, end)
      const lower = word.toLowerCase()
      if (KEYWORDS.has(lower) || FUNCTIONS.has(lower)) {
        push(word, 'keyword')
      } else {
        push(word, 'identifier')
      }
      i = end
      continue
    }
    // Quoted identifiers
    if (ch === '"' || ch === '[' || ch === '`') {
      const close = ch === '[' ? ']' : ch
      let end = i + 1
      while (end < n && sql[end] !== close) end += 1
      end = Math.min(end + 1, n)
      push(sql.slice(i, end), 'identifier')
      i = end
      continue
    }
    // Operators and punctuation
    if ('+-*/%=<>!&|'.includes(ch)) {
      let end = i
      while (end < n && '+-*/%=<>!&|'.includes(sql[end])) end += 1
      push(sql.slice(i, end), 'operator')
      i = end
      continue
    }
    if ('(),;.'.includes(ch)) {
      push(ch, 'punctuation')
      i += 1
      continue
    }
    // Whitespace and anything else passes through as identifier text
    let end = i
    while (end < n && /[\s]/.test(sql[end])) end += 1
    if (end > i) {
      push(sql.slice(i, end), 'identifier')
      i = end
      continue
    }
    push(ch, 'identifier')
    i += 1
  }
  return tokens
}
