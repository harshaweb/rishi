import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import { useContent } from "../lib/content"
import { readSections } from "../../../server/shared/sections"
import type { SectionCopy } from "../../../server/shared/sections"

export function useSectionCopy(id: string) {
  const { content } = useContent()
  return readSections(content.settings.sectionContent)[id] || {}
}

// Preserve the existing layout and interactive children; override only the
// first heading and introductory paragraph, not collection cards or forms.
export function ManagedSection({
  id,
  children,
}: {
  id: string
  children: ReactElement
}) {
  const copy = useSectionCopy(id)
  if (copy.hidden) return null
  if (copy.body)
    return cloneElement(
      children as ReactElement<{ children: ReactNode }>,
      {},
      <div className="prose container">
        <ReactMarkdown>{copy.body}</ReactMarkdown>
      </div>
    )
  if (!copy.title && !copy.description) return children
  return applySectionCopy(children, copy)
}
function applySectionCopy(children: ReactElement, copy: SectionCopy) {
  let heading = false
  let paragraph = false
  function visit(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node) => {
      if (!isValidElement<Record<string, unknown>>(node)) return node
      const props = node.props
      if (
        !heading &&
        typeof props.title === "string" &&
        typeof props.eyebrow === "string"
      ) {
        heading = true
        paragraph = true
        return cloneElement(node, {
          title: copy.title || props.title,
          description: copy.description || props.description,
        })
      }
      if (!heading && (node.type === "h2" || node.type === "h1")) {
        heading = true
        if (copy.title) return cloneElement(node, {}, copy.title)
      }
      if (!paragraph && node.type === "p") {
        paragraph = true
        if (copy.description) return cloneElement(node, {}, copy.description)
      }
      return props.children
        ? cloneElement(node, {}, visit(props.children as ReactNode))
        : node
    })
  }
  return visit(children)
}
