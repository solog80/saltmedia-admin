"use client"

import { use } from "react"
import { Edit } from "lucide-react"
import ArticleForm from "@/app/components/news/ArticleForm"

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Edit size={32} className="text-yellow-300" />
          Edit Article
        </h1>
        <p className="mt-1 text-sm text-white/60">Update article #{id}</p>
      </div>
      <ArticleForm articleId={id} />
    </div>
  )
}