"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, FolderSearch, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import MediaLibraryDialog from "@/app/components/news/MediaLibraryDialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import RichTextEditor from "@/app/components/news/RichTextEditor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCategories,
  useAuthors,
  useCreateArticle,
  useUpdateArticle,
  useArticle,
  type JoomlaArticle,
} from "@/lib/api/news"

interface ArticleFormProps {
  articleId?: string
}

const STATUS_LABELS: Record<number, string> = {
  1: "Published",
  0: "Unpublished",
  [-2]: "Trashed",
}

function cleanImageUrl(url?: string): string {
  if (!url) return ""
  return url.split("#")[0]
}

const READMORE = '<hr id="system-readmore" />'

function composeBody(article: JoomlaArticle | undefined): string {
  if (!article) return ""
  const intro = article.attributes.text ?? ""
  const split = intro.split(READMORE)
  if (split.length === 2) {
    return `${split[0].trim()}\n\n${READMORE}\n\n${split[1].trim()}`
  }
  return intro
}

function splitBody(body: string): { introtext: string; fulltext: string } {
  const match = body.match(/<hr[^>]*>/i)
  if (match && match.index !== undefined) {
    return {
      introtext: body.slice(0, match.index).trim(),
      fulltext: body.slice(match.index + match[0].length).trim(),
    }
  }
  return { introtext: body, fulltext: "" }
}

export default function ArticleForm({ articleId }: ArticleFormProps) {
  const router = useRouter()

  const categories = useCategories()
  const authors = useAuthors()
  const articleQuery = useArticle(articleId || "")
  const createArticle = useCreateArticle()
  const updateArticle = useUpdateArticle()

  const existing = articleQuery.data as JoomlaArticle | undefined
  const a = existing?.attributes

  const [title, setTitle] = useState(a?.title ?? "")
  const [catid, setCatid] = useState(existing ? String(existing.relationships?.category?.data?.id ?? "") : "")
  const [createdBy, setCreatedBy] = useState(a ? String(a.created_by ?? "") : "")
  const [body, setBody] = useState(composeBody(existing))
  const [introImage, setIntroImage] = useState(cleanImageUrl(a?.images.image_intro) ?? "")
  const [fullImage, setFullImage] = useState(cleanImageUrl(a?.images.image_fulltext) ?? "")
  const [featured, setFeatured] = useState(Boolean(a?.featured))
  const [state, setState] = useState(a ? String(a.state) : "1")
  const [publishUp, setPublishUp] = useState(a?.publish_up ? a.publish_up.slice(0, 16) : "")
  const [metadesc, setMetadesc] = useState(a?.metadesc ?? "")
  const [metakey, setMetakey] = useState(a?.metakey ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryTarget, setLibraryTarget] = useState<"intro" | "full" | null>(null)

  const categoryName = catid
    ? (categories.data?.find((c) => c.id === catid)?.attributes.title ?? catid)
    : ""
  const authorName = createdBy
    ? (authors.data?.find((u) => String(u.id) === createdBy)?.attributes.name ?? createdBy)
    : ""
  const statusName = state ? (STATUS_LABELS[Number(state)] ?? state) : ""

  // Populate the form when the article data arrives (async load on edit).
  useEffect(() => {
    if (!existing) return
    setTitle(existing.attributes.title ?? "")
    setCatid(String(existing.relationships?.category?.data?.id ?? ""))
    setCreatedBy(String(existing.attributes.created_by ?? ""))
    setBody(composeBody(existing))
    setIntroImage(cleanImageUrl(existing.attributes.images.image_intro) ?? "")
    setFullImage(cleanImageUrl(existing.attributes.images.image_fulltext) ?? "")
    setFeatured(Boolean(existing.attributes.featured))
    setState(String(existing.attributes.state))
    setPublishUp(existing.attributes.publish_up ? existing.attributes.publish_up.slice(0, 16) : "")
    setMetadesc(existing.attributes.metadesc ?? "")
    setMetakey(existing.attributes.metakey ?? "")
  }, [existing])

  async function handleSave() {
    if (!title.trim()) {
      setError("Title is required")
      return
    }
    if (!catid) {
      setError("Category is required")
      return
    }

    setSaving(true)
    setError(null)

    const split = splitBody(body)
    const images = {
      image_intro: introImage,
      image_intro_alt: "",
      image_fulltext: fullImage,
      image_fulltext_alt: "",
    }

    const payload = {
      title: title.trim(),
      catid: Number(catid),
      state: Number(state),
      featured,
      introtext: split.introtext,
      fulltext: split.fulltext,
      images,
      metadesc,
      metakey,
      created_by: createdBy ? Number(createdBy) : undefined,
      publish_up: publishUp ? `${publishUp}:00` : undefined,
      language: "*",
    }

    try {
      if (articleId) {
        await updateArticle.mutateAsync({ id: articleId, input: payload })
      } else {
        await createArticle.mutateAsync(payload)
      }
      router.push("/news")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save article")
      setSaving(false)
    }
  }

  if (articleId && articleQuery.isLoading) {
    return <p className="text-white/60">Loading article…</p>
  }

  if (articleId && articleQuery.isError) {
    return <p className="text-red-400">Failed to load article: {String(articleQuery.error)}</p>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="frosted-glass space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article headline" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={catid} onValueChange={(v) => setCatid(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select category">{categoryName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.data?.map((c) => (
                  <SelectItem key={c.id} value={String(c.attributes.id)}>
                    {c.attributes.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Author</Label>
            <Select value={createdBy} onValueChange={(v) => setCreatedBy(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select author">{authorName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {authors.data?.map((u) => (
                  <SelectItem key={u.id} value={String(u.attributes.id)}>
                    {u.attributes.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={state} onValueChange={(v) => setState(v ?? "1")}>
              <SelectTrigger>
                <SelectValue placeholder="Select status">{statusName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="publishUp">Publish date/time</Label>
          <Input
            id="publishUp"
            type="datetime-local"
            value={publishUp}
            onChange={(e) => setPublishUp(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="featured"
            checked={featured}
            onCheckedChange={(v) => setFeatured(Boolean(v))}
          />
          <Label htmlFor="featured" className="text-white/80">
            Featured article
          </Label>
        </div>
      </div>

      <div className="frosted-glass space-y-4 p-6">
        <Tabs defaultValue="body">
          <TabsList className="bg-white/10 text-white/70">
            <TabsTrigger value="body">Article body</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="meta">Meta</TabsTrigger>
          </TabsList>
          <TabsContent value="body" className="mt-4">
            <div className="space-y-2">
              <RichTextEditor value={body} onChange={setBody} />
              <p className="text-xs text-white/40">
                Use the toolbar to format the article. The horizontal-rule button splits the intro from the full text.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="images" className="mt-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ImageField
                label="Intro image"
                value={introImage}
                onChange={setIntroImage}
                onBrowse={() => { setLibraryTarget("intro"); setLibraryOpen(true) }}
              />
              <ImageField
                label="Full-text image"
                value={fullImage}
                onChange={setFullImage}
                onBrowse={() => { setLibraryTarget("full"); setLibraryOpen(true) }}
              />
            </div>
          </TabsContent>
          <TabsContent value="meta" className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="metadesc">Meta description</Label>
                <Textarea id="metadesc" rows={6} value={metadesc} onChange={(e) => setMetadesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metakey">Meta keywords</Label>
                <Textarea id="metakey" rows={6} value={metakey} onChange={(e) => setMetakey(e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 border-t border-white/10 pt-4">
          <Button onClick={handleSave} disabled={saving || createArticle.isPending || updateArticle.isPending}>
            {(saving || createArticle.isPending || updateArticle.isPending) && <Loader2 className="animate-spin" size={14} />}
            {articleId ? "Save changes" : "Create article"}
          </Button>
<Button variant="outline" className="text-white hover:bg-white/10" onClick={() => router.push("/news")}>
          Cancel
        </Button>
        </div>
      </div>

      <MediaLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(url) => {
          if (libraryTarget === "intro") setIntroImage(url)
          else if (libraryTarget === "full") setFullImage(url)
        }}
      />
    </div>
  )
}

function ImageField({
  label,
  value,
  onChange,
  onBrowse,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBrowse: () => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-white/10 bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-full w-full object-contain" />
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black"
            onClick={() => onChange("")}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-white/20 text-sm text-white/40">
          No image
        </div>
      )}
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… (image URL)" className="flex-1" />
        <Button variant="outline" type="button" className="text-white hover:bg-white/10" onClick={onBrowse}>
          <FolderSearch size={14} />
          Browse
        </Button>
      </div>
    </div>
  )
}