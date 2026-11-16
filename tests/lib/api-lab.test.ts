import { describe, expect, it } from 'vitest'
import {
  addHistoryEntry,
  assertSameOriginApiUrl,
  buildCurlCommand,
  buildHeaders,
  buildRequestTarget,
  clipBody,
  contentTypeOf,
  formatElapsed,
  methodAllowsBody,
  readCappedText,
  shellQuote,
  tryPrettyJson,
  validatePath,
  validateQuery,
  MAX_BODY_DISPLAY_BYTES,
  type HeaderRow,
  type HistoryEntry,
} from '../../src/lib/api-lab'

const ORIGIN = 'https://lab.example'

describe('validatePath', () => {
  it('accepts /api/v1 and nested /api/v1 paths', () => {
    expect(validatePath('/api/v1')).toEqual({ ok: true, value: '/api/v1' })
    expect(validatePath('/api/v1/')).toEqual({ ok: true, value: '/api/v1/' })
    expect(validatePath('/api/v1/products')).toEqual({ ok: true, value: '/api/v1/products' })
    expect(validatePath('/api/v1/products/canvas-tote-bag?x')).toEqual(
      { ok: false, error: expect.any(String) },
    )
  })

  it('rejects absolute URLs and scheme-prefixed strings', () => {
    for (const value of [
      'https://evil.example/api/v1/products',
      'http://lab.example/api/v1/products',
      'ftp://lab.example/x',
      '//evil.example/api/v1',
      'javascript:alert(1)',
      'data:text/plain,hi',
    ]) {
      const result = validatePath(value)
      expect(result.ok, value).toBe(false)
    }
  })

  it('rejects non-/api/v1 paths', () => {
    for (const value of ['/', '/api', '/api/v2/products', '/admin', '/api/health']) {
      expect(validatePath(value).ok, value).toBe(false)
    }
  })

  it('rejects query strings, fragments, whitespace, backslashes and dot segments', () => {
    expect(validatePath('/api/v1/products?perPage=3').ok).toBe(false)
    expect(validatePath('/api/v1/products#frag').ok).toBe(false)
    expect(validatePath('/api/v1/products id').ok).toBe(false)
    expect(validatePath('/api/v1\\products').ok).toBe(false)
    expect(validatePath('/api/v1/../health').ok).toBe(false)
    expect(validatePath('/api/v1/%2e%2e/x').ok).toBe(true) // encoded dots are not segments here
  })

  it('trims surrounding whitespace before validating', () => {
    expect(validatePath('  /api/v1/products  ')).toEqual({ ok: true, value: '/api/v1/products' })
  })
})

describe('validateQuery', () => {
  it('accepts empty and typical queries', () => {
    expect(validateQuery('')).toEqual({ ok: true, value: '' })
    expect(validateQuery('perPage=3&sort=price_asc')).toEqual({
      ok: true,
      value: 'perPage=3&sort=price_asc',
    })
    expect(validateQuery('?perPage=3')).toEqual({ ok: true, value: 'perPage=3' })
  })

  it('rejects whitespace and control characters', () => {
    expect(validateQuery('perPage=3 &x=1').ok).toBe(false)
    expect(validateQuery('perPage=\r\nInjected: yes').ok).toBe(false)
  })

  it('rejects overlong queries', () => {
    expect(validateQuery('a'.repeat(513)).ok).toBe(false)
    expect(validateQuery('a'.repeat(512)).ok).toBe(true)
  })
})

describe('buildHeaders', () => {
  const row = (id: string, name: string, value: string): HeaderRow => ({ id, name, value })

  it('skips fully-empty rows and trims values', () => {
    const { headers, issues } = buildHeaders([row('1', '', ''), row('2', ' X-A ', ' b ')])
    expect(headers).toEqual({ 'X-A': 'b' })
    expect(issues).toEqual([])
  })

  it('flags rows with a value but no name', () => {
    const { headers, issues } = buildHeaders([row('1', '', 'b')])
    expect(headers).toEqual({})
    expect(issues).toHaveLength(1)
  })

  it('rejects invalid names and header-injection values', () => {
    const { headers, issues } = buildHeaders([
      row('1', 'Bad Name', 'x'),
      row('2', 'X-OK', 'line1\r\nX-Evil: yes'),
      row('3', 'X-Also-OK', 'fine'),
    ])
    expect(headers).toEqual({ 'X-Also-OK': 'fine' })
    expect(issues).toHaveLength(2)
  })

  it('last duplicate wins, case-insensitively', () => {
    const { headers } = buildHeaders([
      row('1', 'X-Dup', 'first'),
      row('2', 'x-dup', 'second'),
    ])
    expect(headers).toEqual({ 'x-dup': 'second' })
  })
})

describe('buildRequestTarget', () => {
  it('joins path and query', () => {
    expect(buildRequestTarget('/api/v1/products', 'perPage=3')).toBe(
      '/api/v1/products?perPage=3',
    )
    expect(buildRequestTarget('/api/v1/products', '')).toBe('/api/v1/products')
  })
})

describe('assertSameOriginApiUrl', () => {
  it('accepts the same-origin /api/v1 URL', () => {
    const result = assertSameOriginApiUrl('/api/v1/products?perPage=3', ORIGIN)
    expect(result).toEqual({ ok: true, value: `${ORIGIN}/api/v1/products?perPage=3` })
  })

  it('refuses cross-origin resolutions', () => {
    const result = assertSameOriginApiUrl('https://evil.example/api/v1/products', ORIGIN)
    expect(result.ok).toBe(false)
  })

  it('refuses same-origin paths outside /api/v1', () => {
    const result = assertSameOriginApiUrl('/api/health', ORIGIN)
    expect(result.ok).toBe(false)
  })
})

describe('shellQuote / buildCurlCommand', () => {
  it('single-quotes values and escapes embedded quotes', () => {
    expect(shellQuote('plain')).toBe("'plain'")
    expect(shellQuote("it's")).toBe("'it'\\''s'")
  })

  it('builds an absolute-URL curl with headers and a raw body', () => {
    const curl = buildCurlCommand({
      method: 'POST',
      origin: ORIGIN,
      path: '/api/v1/cart/items',
      query: '',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-12345' },
      body: '{"slug":"canvas-tote-bag","quantity":1}',
    })
    expect(curl).toBe(
      `curl -i -X POST '${ORIGIN}/api/v1/cart/items' -H 'Content-Type: application/json' -H 'Idempotency-Key: key-12345' --data-raw '{"slug":"canvas-tote-bag","quantity":1}'`,
    )
  })

  it('omits the body for GET and for POST with an empty body', () => {
    const get = buildCurlCommand({
      method: 'GET',
      origin: ORIGIN,
      path: '/api/v1/products',
      query: 'perPage=3',
      headers: {},
      body: '{"ignored":true}',
    })
    expect(get).toBe(`curl -i -X GET '${ORIGIN}/api/v1/products?perPage=3'`)

    const emptyPost = buildCurlCommand({
      method: 'POST',
      origin: ORIGIN,
      path: '/api/v1/practice/session/reset',
      query: '',
      headers: {},
      body: '   ',
    })
    expect(emptyPost).not.toContain('--data-raw')
  })
})

describe('clipBody', () => {
  it('returns small bodies whole', () => {
    expect(clipBody('hello', 10)).toEqual({ text: 'hello', clipped: false, byteLength: 5 })
  })

  it('clips multibyte-safe bodies to the byte cap', () => {
    const input = 'é'.repeat(MAX_BODY_DISPLAY_BYTES) // 2 bytes each
    const result = clipBody(input, MAX_BODY_DISPLAY_BYTES)
    expect(result.clipped).toBe(true)
    expect(new TextEncoder().encode(result.text).byteLength).toBeLessThanOrEqual(
      MAX_BODY_DISPLAY_BYTES,
    )
    expect(result.byteLength).toBe(MAX_BODY_DISPLAY_BYTES * 2)
  })
})

describe('readCappedText', () => {
  function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
  }

  it('reads a small body completely', async () => {
    const bytes = new TextEncoder().encode('{"ok":true}')
    const response = new Response(streamOf([bytes]))
    const result = await readCappedText(response, 1024)
    expect(result.text).toBe('{"ok":true}')
    expect(result.clipped).toBe(false)
    expect(result.byteLength).toBe(bytes.byteLength)
  })

  it('cancels the stream and clips when the body exceeds the cap', async () => {
    const chunk = new Uint8Array(1024).fill(97)
    const response = new Response(streamOf([chunk, chunk, chunk, chunk]))
    const result = await readCappedText(response, 1500)
    expect(result.clipped).toBe(true)
    expect(result.byteLength).toBe(1500)
    expect(result.text).toHaveLength(1500)
  })
})

describe('tryPrettyJson', () => {
  it('pretty-prints JSON objects and arrays', () => {
    expect(tryPrettyJson('{"a":1}')).toEqual({ pretty: true, text: '{\n  "a": 1\n}' })
    expect(tryPrettyJson('[1,2]').pretty).toBe(true)
  })

  it('returns non-JSON unchanged', () => {
    expect(tryPrettyJson('plain text')).toEqual({ pretty: false, text: 'plain text' })
    expect(tryPrettyJson('{broken')).toEqual({ pretty: false, text: '{broken' })
  })
})

describe('contentTypeOf', () => {
  it('finds the content-type case-insensitively', () => {
    expect(contentTypeOf({ 'Content-Type': 'Application/JSON' })).toBe('application/json')
    expect(contentTypeOf({ 'x-other': 'y' })).toBeUndefined()
  })
})

describe('formatElapsed', () => {
  it('formats sub-second and second timings', () => {
    expect(formatElapsed(42)).toBe('42 ms')
    expect(formatElapsed(1234)).toBe('1.23 s')
    expect(formatElapsed(Number.NaN)).toBe('0 ms')
  })
})

describe('methodAllowsBody', () => {
  it('allows bodies only for POST and PATCH', () => {
    expect(methodAllowsBody('GET')).toBe(false)
    expect(methodAllowsBody('DELETE')).toBe(false)
    expect(methodAllowsBody('POST')).toBe(true)
    expect(methodAllowsBody('PATCH')).toBe(true)
  })
})

describe('addHistoryEntry', () => {
  const entry = (id: string): HistoryEntry => ({
    id,
    method: 'GET',
    target: '/api/v1/products',
    status: 200,
    elapsedMs: 12,
    at: 1,
  })

  it('keeps entries newest-first and capped at the limit', () => {
    let entries: HistoryEntry[] = []
    for (let i = 0; i < 12; i += 1) {
      entries = addHistoryEntry(entries, entry(String(i)), 10)
    }
    expect(entries).toHaveLength(10)
    expect(entries[0].id).toBe('11')
    expect(entries[9].id).toBe('2')
  })
})
