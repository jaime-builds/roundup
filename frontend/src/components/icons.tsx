// Small inline SVG icons. All use currentColor so they inherit text color.

import type { ReactNode } from 'react'

type P = { size?: number; className?: string }

const svg = (children: ReactNode, size = 20, className?: string) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const IconPlus = ({ size, className }: P) => svg(<><path d="M12 5v14" /><path d="M5 12h14" /></>, size, className)
export const IconTrash = ({ size, className }: P) =>
  svg(<><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>, size, className)
export const IconCheck = ({ size, className }: P) => svg(<path d="M20 6L9 17l-5-5" />, size, className)
export const IconBack = ({ size, className }: P) => svg(<><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>, size, className)
export const IconChevron = ({ size, className }: P) => svg(<path d="M6 9l6 6 6-6" />, size, className)
export const IconLogout = ({ size, className }: P) =>
  svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>, size, className)
export const IconShare = ({ size, className }: P) =>
  svg(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>, size, className)
export const IconEdit = ({ size, className }: P) =>
  svg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>, size, className)
export const IconRestore = ({ size, className }: P) =>
  svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>, size, className)
export const IconClose = ({ size, className }: P) => svg(<><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>, size, className)
export const IconArchive = ({ size, className }: P) =>
  svg(<><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>, size, className)
export const IconUsers = ({ size, className }: P) =>
  svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>, size, className)
export const IconInstall = ({ size, className }: P) =>
  svg(<><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>, size, className)
