// Minimal markdown-ish renderer for contract prose: paragraphs, `- `
// bullet lists and `code` spans. Never injects HTML — every node is built
// from escaped React text.
import { Fragment, type ReactNode } from 'react'

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/`([^`]+)`/g)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <code key={`${keyPrefix}-${index}`}>{part}</code>
    ) : (
      <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>
    ),
  )
}

export function renderDescription(text: string): ReactNode {
  const blocks = text.split('\n\n').map((block) => block.trim()).filter(Boolean)
  const nodes: ReactNode[] = []
  let list: string[] = []
  let key = 0

  function flushList() {
    if (list.length === 0) {
      return
    }
    const items = list
    list = []
    nodes.push(
      <ul className="contract-list" key={`ul-${key}`}>
        {items.map((item, index) => (
          <li key={index}>{renderInline(item, `li-${key}-${index}`)}</li>
        ))}
      </ul>,
    )
    key += 1
  }

  for (const block of blocks) {
    const lines = block.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('- ')) {
        list.push(trimmed.slice(2))
      } else {
        flushList()
        if (trimmed.length > 0) {
          nodes.push(<p key={`p-${key}`}>{renderInline(trimmed, `p-${key}`)}</p>)
          key += 1
        }
      }
    }
    flushList()
  }
  flushList()

  return <>{nodes}</>
}
