import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(content: string): string {
  if (!content) return ''
  const rawHtml = marked.parse(content) as string
  return DOMPurify.sanitize(rawHtml)
}

export function extractTitle(content: string): string {
  const lines = content.split('\n')
  // Find first heading
  for (const line of lines) {
    const match = line.match(/^#+\s+(.+)$/)
    if (match) return match[1]
  }
  // Return first non-empty line or default
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return trimmed.slice(0, 50)
  }
  return 'Untitled Note'
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) {
      const minutes = Math.floor(diff / 60000)
      return minutes < 1 ? 'Just now' : `${minutes}m ago`
    }
    return `${hours}h ago`
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days}d ago`
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
