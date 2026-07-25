import { useState, useMemo } from "react"

export interface PaginationResult<T> {
  currentItems: T[]
  currentPage: number
  totalPages: number
  setCurrentPage: (page: number) => void
  hasNextPage: boolean
  hasPreviousPage: boolean
  goToNextPage: () => void
  goToPreviousPage: () => void
}

export function usePagination<T>(items: T[], itemsPerPage: number = 10): PaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1)

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(items.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentItems = items.slice(startIndex, endIndex)

    return {
      totalPages,
      startIndex,
      endIndex,
      currentItems,
    }
  }, [items, currentPage, itemsPerPage])

  const { totalPages, currentItems } = paginationData
  const hasNextPage = currentPage < totalPages
  const hasPreviousPage = currentPage > 1

  return {
    currentItems,
    currentPage,
    totalPages,
    setCurrentPage,
    hasNextPage,
    hasPreviousPage,
    goToNextPage: () => {
      if (hasNextPage) setCurrentPage((prev) => prev + 1)
    },
    goToPreviousPage: () => {
      if (hasPreviousPage) setCurrentPage((prev) => prev - 1)
    },
  }
}