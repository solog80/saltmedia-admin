import type { JoomlaReferenceItem } from "@/lib/api/news"

// Builds the Joomla category hierarchy (via parent_id) into a tree, sorts each
// level alphabetically, and flattens it into indented options for Selects.

interface CatNode {
  id: string
  title: string
  children: CatNode[]
}

// Categories that should always render as top-level regardless of their stored
// parent. INTERNATIONAL belongs at root with its own children, but Joomla's admin
// is currently unusable (white screen) so this is patched here.
const FORCE_ROOT_IDS = new Set<string>(["34"]) // INTERNATIONAL

function buildTree(cats: JoomlaReferenceItem[]): CatNode[] {
  const byId = new Map<string, CatNode>()
  for (const c of cats) {
    byId.set(c.id, { id: c.id, title: c.attributes.title || `#${c.id}`, children: [] })
  }
  const roots: CatNode[] = []
  for (const c of cats) {
    const node = byId.get(c.id)!
    const pid = c.attributes.parent_id
    const parent = pid != null && pid !== 1 && !FORCE_ROOT_IDS.has(c.id) ? byId.get(String(pid)) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sortRec = (nodes: CatNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title))
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

export interface CategoryOption {
  id: string
  label: string
  depth: number
}

export function categoryOptions(cats: JoomlaReferenceItem[]): CategoryOption[] {
  // Only published categories are selectable; unpublished (e.g. stray/menu) ones
  // are filtered out so the picker stays clean.
  const published = cats.filter((c) => c.attributes.published !== 0)
  const out: CategoryOption[] = []
  const walk = (nodes: CatNode[], depth: number) => {
    for (const n of nodes) {
      out.push({ id: n.id, label: n.title, depth })
      walk(n.children, depth + 1)
    }
  }
  walk(buildTree(published), 0)
  return out
}

export function categoryDisplayLabel(label: string, depth: number): string {
  if (depth <= 0) return label
  return "\u00A0\u00A0".repeat(depth) + "↳ " + label
}