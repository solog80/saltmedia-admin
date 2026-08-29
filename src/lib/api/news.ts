"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface JoomlaArticleAttributes {
  id: number
  title: string
  alias: string
  state: number
  access: number
  created: string
  created_by: number
  created_by_alias: string
  modified: string
  publish_up: string
  publish_down: string | null
  hits: number
  featured: number
  language: string
  note: string
  images: {
    image_intro?: string
    image_intro_alt?: string
    image_fulltext?: string
    image_fulltext_alt?: string
  }
  metadesc: string
  metakey: string
  text: string
  tags?: string[]
}

export interface JoomlaArticle {
  type: string
  id: string
  attributes: JoomlaArticleAttributes
  relationships?: {
    category?: { data?: { type?: string; id?: string } }
    created_by?: { data?: { type?: string; id?: string } }
    tags?: { data?: { type?: string; id?: string }[] }
  }
}

export interface JoomlaListResponse {
  data: JoomlaArticle[]
  links?: {
    self?: string
    next?: string
    last?: string
    first?: string
  }
  meta?: Record<string, unknown>
}

export interface JoomlaReferenceItem {
  type: string
  id: string
  attributes: {
    id: number
    title?: string
    name?: string
    alias?: string
    username?: string
    parent_id?: number
    level?: number
    published?: number
  }
}

export interface ArticleListParams {
  search?: string
  category?: string
  state?: string
  featured?: string
  author?: string
  limit?: number
  offset?: number
}

export interface ArticleInput {
  title: string
  alias?: string
  catid: number
  articletext?: string
  introtext?: string
  fulltext?: string
  state: number
  access?: number
  featured?: boolean
  language?: string
  created_by?: number
  created_by_alias?: string
  images?: JoomlaArticleAttributes["images"]
  publish_up?: string
  publish_down?: string | null
  metadesc?: string
  metakey?: string
}

// ---------- fetch helpers ----------

export async function fetchArticles(params: ArticleListParams = {}): Promise<JoomlaListResponse> {
  const qs = new URLSearchParams()
  if (params.search) qs.set("search", params.search)
  if (params.category) qs.set("category", params.category)
  if (params.state) qs.set("state", params.state)
  if (params.featured) qs.set("featured", params.featured)
  if (params.author) qs.set("author", params.author)
  qs.set("limit", String(params.limit ?? 20))
  qs.set("offset", String(params.offset ?? 0))

  const res = await fetch(`/api/joomla/articles?${qs.toString()}`, { cache: "no-store" })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Failed to load articles")
  return body
}

export async function fetchArticle(id: string): Promise<JoomlaArticle> {
  const res = await fetch(`/api/joomla/articles/${id}`, { cache: "no-store" })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Failed to load article")
  return body.data
}

async function fetchReference(type: string): Promise<JoomlaReferenceItem[]> {
  const res = await fetch(`/api/joomla/reference?type=${type}`, { cache: "no-store" })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Failed to load reference data")
  return body.data ?? []
}

export const fetchCategories = () => fetchReference("categories")
export const fetchAuthors = () => fetchReference("authors")
export const fetchTags = () => fetchReference("tags")

async function createArticle(input: ArticleInput): Promise<JoomlaArticle> {
  const res = await fetch("/api/joomla/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Failed to create article")
  return body.data
}

async function updateArticle(id: string, input: Partial<ArticleInput>): Promise<JoomlaArticle> {
  const res = await fetch(`/api/joomla/articles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || "Failed to update article")
  return body.data
}

async function deleteArticle(id: string): Promise<void> {
  const res = await fetch(`/api/joomla/articles/${id}`, { method: "DELETE" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || "Failed to delete article")
}

// ---------- react-query hooks ----------

const articlesKey = ["joomla", "articles"]
const referenceKey = ["joomla", "reference"]

export function useArticles(params: ArticleListParams = {}) {
  const qs = JSON.stringify([params.search, params.category, params.state, params.author, params.offset, params.limit])
  return useQuery({
    queryKey: [...articlesKey, qs],
    queryFn: () => fetchArticles(params),
    placeholderData: (prev) => prev,
  })
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: ["joomla", "article", id],
    queryFn: () => fetchArticle(id),
    enabled: !!id,
  })
}

export function useCategories() {
  return useQuery({ queryKey: [...referenceKey, "categories"], queryFn: fetchCategories })
}

export function useAuthors() {
  return useQuery({ queryKey: [...referenceKey, "authors"], queryFn: fetchAuthors })
}

export function useTags() {
  return useQuery({ queryKey: [...referenceKey, "tags"], queryFn: fetchTags })
}

export function useCreateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ArticleInput) => createArticle(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: articlesKey })
    },
  })
}

export function useUpdateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ArticleInput> }) => updateArticle(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: articlesKey })
      qc.invalidateQueries({ queryKey: ["joomla", "article", vars.id] })
    },
  })
}

export function useDeleteArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: articlesKey })
    },
  })
}