"use client"

import { Plus } from "lucide-react"
import ArticleForm from "@/app/components/news/ArticleForm"

export default function NewArticlePage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Plus size={32} className="text-yellow-300" />
          New Article
        </h1>
        <p className="mt-1 text-sm text-white/60">Publish a new article to saltmedia.ug</p>
      </div>
      <ArticleForm />
    </div>
  )
}