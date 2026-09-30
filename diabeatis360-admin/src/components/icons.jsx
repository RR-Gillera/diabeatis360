// Inline SVG icons (no icon-library dependency). One 24x24 stroke path per icon, matching the sidebar
// icons in FIGMA/ADMIN. Pass className to control size/color (defaults to currentColor, 20px via the caller).
function Icon({ children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  )
}

export function HomeIcon(props) {
  return <Icon {...props}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9" /></Icon>
}

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15.5 14.2c2.4.4 4.5 2.5 4.5 5.8" />
    </Icon>
  )
}

export function StethoscopeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 4v5.5a4.5 4.5 0 0 0 9 0V4" />
      <path d="M6 4h-1.5" /><path d="M15 4h1.5" />
      <path d="M15 9.5V12a5 5 0 0 1-10 0" />
      <circle cx="19" cy="9" r="2" />
      <path d="M17 12.5a3 3 0 0 0 3-3" />
    </Icon>
  )
}

export function ContentIcon(props) {
  return <Icon {...props}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9h17" /><path d="M8 4.5v4.5" /></Icon>
}

export function ChartIcon(props) {
  return <Icon {...props}><path d="M4 19h16" /><path d="M7 19v-6" /><path d="M12 19V7" /><path d="M17 19v-9" /></Icon>
}

export function RevenueIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M7 14h4" />
    </Icon>
  )
}

export function SettingsIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.2a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6v-.2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </Icon>
  )
}

export function LogoutIcon(props) {
  return <Icon {...props}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M15 8l4 4-4 4" /><path d="M19 12H9" /></Icon>
}

export function SearchIcon(props) {
  return <Icon {...props}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icon>
}

export function CloseIcon(props) {
  return <Icon {...props}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Icon>
}

export function ChevronLeftIcon(props) {
  return <Icon {...props}><path d="M15 6l-6 6 6 6" /></Icon>
}

export function ChevronRightIcon(props) {
  return <Icon {...props}><path d="M9 6l6 6-6 6" /></Icon>
}

export function BellIcon(props) {
  return <Icon {...props}><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" /><path d="M10 19a2 2 0 0 0 4 0" /></Icon>
}

export function DownloadIcon(props) {
  return <Icon {...props}><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></Icon>
}

export function PlusIcon(props) {
  return <Icon {...props}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>
}

export function CheckCircleIcon(props) {
  return <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.3 2.3L16 10" /></Icon>
}

export function EyeIcon(props) {
  return <Icon {...props}><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Icon>
}

export function LockIcon(props) {
  return <Icon {...props}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Icon>
}

export function MailIcon(props) {
  return <Icon {...props}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></Icon>
}

export function TrashIcon(props) {
  return <Icon {...props}><path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12" /><path d="M10 11v5M14 11v5" /></Icon>
}

/** Brand mark from FIGMA/ADMIN: a heart with a drop inside a dashed ring. Fixed brand colours, not currentColor. */
export function LogoMark(props) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <circle cx="24" cy="24" r="21" fill="none" stroke="#8ec63f" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
      <path d="M24 35C11 27 12 15.5 18.5 15.5c3 0 5.5 2 5.5 4.5 0-2.5 2.5-4.5 5.5-4.5C36 15.5 37 27 24 35z" fill="#629c2c" />
      <path d="M24 21c-2.2 3-3.2 4.5-3.2 6.2a3.2 3.2 0 0 0 6.4 0c0-1.7-1-3.2-3.2-6.2z" fill="#fff" />
    </svg>
  )
}
