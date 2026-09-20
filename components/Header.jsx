'use client'
import AppHeader from './AppHeader'

// Inner-page header (back button + title). Kept as the import every existing
// page already uses; the implementation lives in AppHeader.
export default function Header({ title }) {
  return <AppHeader back title={title} />
}
