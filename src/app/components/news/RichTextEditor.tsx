"use client"

import { useEffect, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Redo2,
  Undo2,
  Link2,
  Unlink,
  RemoveFormatting,
  ImagePlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import MediaLibraryDialog from "@/app/components/news/MediaLibraryDialog"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [imageDialogOpen, setImageDialogOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Sync external content (async article load / reset) into the editor,
  // without clobbering what the user is currently typing.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value && value !== current) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  if (!editor) {
    return <div className="h-[350px] rounded-md border border-input bg-zinc-900" />
  }

  const btn = (active: boolean) =>
    cn(
      "flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40",
      active && "bg-primary/30 text-white"
    )

  const handleLink = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? ""
    const url = window.prompt("Link URL", prev || "https://")
    if (url === null) return
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  return (
    <div className="rt-editor overflow-hidden rounded-md border border-input bg-zinc-900 text-zinc-100">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-700 bg-zinc-800/80 px-2 py-1.5">
        <button type="button" title="Undo" onClick={() => editor.chain().focus().undo().run()} className={btn(false)}>
          <Undo2 size={14} />
        </button>
        <button type="button" title="Redo" onClick={() => editor.chain().focus().redo().run()} className={btn(false)}>
          <Redo2 size={14} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button
          type="button"
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold"))}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic"))}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btn(editor.isActive("underline"))}
        >
          <UnderlineIcon size={14} />
        </button>
        <button
          type="button"
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btn(editor.isActive("strike"))}
        >
          <Strikethrough size={14} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button
          type="button"
          title="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btn(editor.isActive("heading", { level: 1 }))}
        >
          <Heading1 size={14} />
        </button>
        <button
          type="button"
          title="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive("heading", { level: 2 }))}
        >
          <Heading2 size={14} />
        </button>
        <button
          type="button"
          title="Heading 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btn(editor.isActive("heading", { level: 3 }))}
        >
          <Heading3 size={14} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button
          type="button"
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive("bulletList"))}
        >
          <List size={14} />
        </button>
        <button
          type="button"
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive("orderedList"))}
        >
          <ListOrdered size={14} />
        </button>
        <button
          type="button"
          title="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btn(editor.isActive("blockquote"))}
        >
          <Quote size={14} />
        </button>
        <button
          type="button"
          title="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={btn(editor.isActive("codeBlock"))}
        >
          <Code2 size={14} />
        </button>
        <button
          type="button"
          title="Horizontal rule (read more)"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={btn(editor.isActive("horizontalRule"))}
        >
          <Minus size={14} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button
          type="button"
          title="Link"
          onClick={handleLink}
          className={btn(editor.isActive("link"))}
        >
          <Link2 size={14} />
        </button>
        <button
          type="button"
          title="Remove link"
          onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
          className={btn(false)}
        >
          <Unlink size={14} />
        </button>
        <button
          type="button"
          title="Insert image"
          onClick={() => setImageDialogOpen(true)}
          className={btn(false)}
        >
          <ImagePlus size={14} />
        </button>
        <button
          type="button"
          title="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className={btn(false)}
        >
          <RemoveFormatting size={14} />
        </button>
      </div>
      <EditorContent editor={editor} className="rt-content h-[350px] overflow-y-auto px-4 py-3 text-sm text-zinc-100" />

      <MediaLibraryDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onSelect={(url) => {
          editor.chain().focus().setImage({ src: url, alt: "" }).run()
          setImageDialogOpen(false)
        }}
      />

      <style>{`
        .rt-editor { color: #f4f4f5; }
        .rt-editor .tiptap { outline: none; min-height: 100%; color: #f4f4f5; }
        .rt-editor .tiptap p { margin: 0 0 0.75em; }
        .rt-editor .tiptap h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5em 0; }
        .rt-editor .tiptap h2 { font-size: 1.25rem; font-weight: 700; margin: 0.5em 0; }
        .rt-editor .tiptap h3 { font-size: 1.125rem; font-weight: 600; margin: 0.5em 0; }
        .rt-editor .tiptap ul { list-style: disc; padding-left: 1.5em; margin: 0 0 0.75em; }
        .rt-editor .tiptap ol { list-style: decimal; padding-left: 1.5em; margin: 0 0 0.75em; }
        .rt-editor .tiptap blockquote { border-left: 3px solid rgba(255,255,255,0.3); padding-left: 0.75em; margin: 0 0 0.75em; color: rgba(244,244,245,0.85); font-style: italic; }
        .rt-editor .tiptap pre { background: rgba(255,255,255,0.08); border-radius: 6px; padding: 0.75em; font-family: monospace; font-size: 0.8rem; margin: 0 0 0.75em; overflow-x: auto; color: #f4f4f5; }
        .rt-editor .tiptap code { background: rgba(255,255,255,0.12); border-radius: 3px; padding: 0.1em 0.3em; font-family: monospace; font-size: 0.85em; }
        .rt-editor .tiptap hr { border: none; border-top: 2px dashed rgba(255,255,255,0.25); margin: 1em 0; }
        .rt-editor .tiptap a { color: #60a5fa; text-decoration: underline; }
        .rt-editor .tiptap img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; }
        .rt-editor .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: rgba(255,255,255,0.35); float: left; height: 0; pointer-events: none; }
      `}</style>
    </div>
  )
}