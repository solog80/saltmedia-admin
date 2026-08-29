"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Edit, Trash2, Eye, EyeOff, Star, Loader2, Newspaper } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useArticles,
  useCategories,
  useAuthors,
  useDeleteArticle,
  useUpdateArticle,
  type JoomlaArticle,
} from "@/lib/api/news"
import { categoryOptions, categoryDisplayLabel } from "@/lib/newsCategories"

const PAGE_SIZE = 10

const STATUS_BADGE: Record<number, { label: string; className: string }> = {
  1: { label: "Published", className: "bg-green-500/15 text-green-300 border-green-500/30" },
  0: { label: "Unpublished", className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  [-2]: { label: "Trashed", className: "bg-red-500/15 text-red-300 border-red-500/30" },
}

export default function NewsPage() {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [category, setCategory] = useState("")
  const [state, setState] = useState("")
  const [offset, setOffset] = useState(0)

  const articles = useArticles({ search, category, state, limit: PAGE_SIZE, offset })
  const categories = useCategories()
  const authors = useAuthors()
  const deleteArticle = useDeleteArticle()
  const updateArticle = useUpdateArticle()

  const [deleteTarget, setDeleteTarget] = useState<JoomlaArticle | null>(null)
  const [deleting, setDeleting] = useState(false)

  const authorName = (article: JoomlaArticle): string => {
    if (article.attributes.created_by_alias) return article.attributes.created_by_alias
    const id = article.attributes.created_by
    const found = authors.data?.find((u) => Number(u.id) === id)
    return found?.attributes.name || "Unknown"
  }

  const categoryTitle = (article: JoomlaArticle): string => {
    const id = article.relationships?.category?.data?.id
    if (!id) return "-"
    const found = categories.data?.find((c) => c.id === id)
    return found?.attributes.title ?? `#${id}`
  }

  async function handlePublishToggle(article: JoomlaArticle) {
    const newState = article.attributes.state === 1 ? 0 : 1
    await updateArticle.mutateAsync({ id: article.id, input: { state: newState } })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteArticle.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  function nextPage(): string | undefined {
    return articles.data?.links?.next
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">News Articles</h1>
          <p className="mt-1 text-sm text-white/60">
            Create, edit and publish articles on saltmedia.ug
          </p>
        </div>
        <Button onClick={() => router.push("/news/new")}>
          <Plus size={16} />
          New Article
        </Button>
      </div>

      <div className="frosted-glass flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <Input
            className="pl-9"
            placeholder="Search articles…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchInput)
                setOffset(0)
              }
            }}
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v === "all" ? "" : (v ?? ""))
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions(categories.data || []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {categoryDisplayLabel(c.label, c.depth)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={state}
          onValueChange={(v) => {
            setState(v === "all" ? "" : (v ?? ""))
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="1">Published</SelectItem>
            <SelectItem value="0">Unpublished</SelectItem>
            <SelectItem value="-2">Trashed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="frosted-glass overflow-hidden">
        {articles.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Hits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.data?.data?.map((article) => {
                const badge = STATUS_BADGE[article.attributes.state] ?? STATUS_BADGE[0]
                return (
                  <TableRow key={article.id}>
                    <TableCell className="max-w-[340px]">
                      <div className="flex items-center gap-3">
                        <ArticleThumb article={article} />
                        <span className="line-clamp-2 text-sm font-medium text-white">{article.attributes.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/70">{categoryTitle(article)}</TableCell>
                    <TableCell className="text-white/70">{authorName(article)}</TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {article.attributes.featured ? (
                        <Star size={15} className="text-yellow-300" />
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-white/70">{article.attributes.hits}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => router.push(`/news/${article.id}`)}>
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={article.attributes.state === 1 ? "Unpublish" : "Publish"}
                          onClick={() => handlePublishToggle(article)}
                        >
                          {article.attributes.state === 1 ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300"
                          title="Delete"
                          onClick={() => setDeleteTarget(article)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!articles.isLoading && (articles.data?.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-white/40">
                    No articles found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {!articles.isLoading && (articles.data?.data?.length ?? 0) > 0 && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>
            Showing {offset + 1}–{offset + (articles.data?.data?.length ?? 0)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!nextPage()} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete article?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.attributes.title}&quot;. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="animate-spin" size={14} />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function articleThumbUrl(article: JoomlaArticle): string {
  const images = article.attributes.images ?? {}
  const raw = images.image_intro || images.image_fulltext || ""
  return raw.split("#")[0]
}

function ArticleThumb({ article }: { article: JoomlaArticle }) {
  const url = articleThumbUrl(article)

  if (!url) {
    return (
      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
        <Newspaper size={16} className="text-white/30" />
      </div>
    )
  }

  return (
    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
    </div>
  )
}