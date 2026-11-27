import { useEffect, useState } from 'react'

/* Left side of the admin login page: a short slideshow of what the admin portal does (overview, provider
   verification, analytics, revenue). Slide 1 is the dashboard picture cropped from the Figma login export
   (public/login-hero.png). Slides 2-4 are drawn as inline SVG in the same floating-card style, so they stay sharp at
   any size and need no extra image files. All names and numbers in the pictures are made-up sample data. */

const GREEN = '#629c2c' // Figma green: fine for large text and drawings (3.33:1); small text uses the AA brand #4d7c22
const LIME = '#d9ecbf'
const TINT = '#eef6e3'
const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'

const SLIDE_MS = 6000 // WCAG 2.2.2: anything that moves by itself for over 5 s needs a pause control (the button below)
const ART = 'h-auto w-full max-w-[38rem] max-h-[calc(100vh-22rem)] select-none'

/* ---------- small SVG pieces shared by the drawings ---------- */

/** White rounded card with the soft shadow used in the Figma illustration. */
function Card({ x, y, w, h, children }) {
  return (
    <g className="drop-shadow-[0_8px_18px_rgba(17,24,39,0.08)]">
      <rect x={x} y={y} width={w} height={h} rx="14" fill="white" stroke={LINE} />
      {children}
    </g>
  )
}

function Chip({ x, y, w, label, bg, color }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="17" rx="8.5" fill={bg} />
      <text x={x + w / 2} y={y + 11.8} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={color}>{label}</text>
    </g>
  )
}

function Avatar({ cx, cy, initials }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="14" fill={TINT} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#4d7c22">{initials}</text>
    </g>
  )
}

function CheckBadge({ cx, cy }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="16" fill={TINT} />
      <path d={`M${cx - 6} ${cy} l4 4 l8 -8`} fill="none" stroke={GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/* ---------- slide drawings ---------- */

function ProvidersArt() {
  const rows = [
    { initials: 'MS', name: 'Dr. Miguel Santos', field: 'Endocrinologist', status: 'pending' },
    { initials: 'AV', name: 'Dr. Ana Villanueva', field: 'Internal Medicine', status: 'pending' },
    { initials: 'JR', name: 'Dr. Jose Ramos', field: 'Diabetologist', status: 'verified' },
  ]
  return (
    <svg viewBox="0 0 608 420" className={ART} aria-hidden="true">
      <Card x={110} y={78} w={390} h={250}>
        <text x="134" y="114" fontSize="15" fontWeight="700" fill={INK}>Pending Approval</text>
        <text x="134" y="131" fontSize="10" fill={MUTED}>2 doctors waiting for review</text>
        {rows.map((row, i) => {
          const top = 148 + i * 54
          return (
            <g key={row.name}>
              {i > 0 ? <line x1="134" x2="476" y1={top - 6} y2={top - 6} stroke={LINE} /> : null}
              <Avatar cx={152} cy={top + 20} initials={row.initials} />
              <text x="176" y={top + 17} fontSize="11" fontWeight="700" fill={INK}>{row.name}</text>
              <text x="176" y={top + 31} fontSize="9.5" fill={MUTED}>{row.field}</text>
              {row.status === 'pending'
                ? <Chip x={410} y={top + 11} w={66} label="Pending" bg="#fef3c7" color="#b45309" />
                : <Chip x={410} y={top + 11} w={66} label="Verified" bg={TINT} color="#4d7c22" />}
            </g>
          )
        })}
      </Card>

      <Card x={432} y={22} w={158} h={104}>
        <text x="448" y="48" fontSize="11" fontWeight="700" fill={INK}>PRC License</text>
        <text x="448" y="68" fontSize="9" fill={MUTED}>License no.</text>
        <text x="448" y="84" fontSize="12" fontWeight="700" fill={INK}>0123456</text>
        <circle cx="452" cy="106" r="3.5" fill={GREEN} />
        <text x="461" y="109" fontSize="9" fill={MUTED}>Valid until Mar 2028</text>
      </Card>

      <Card x={24} y={298} w={236} h={78}>
        <CheckBadge cx={60} cy={337} />
        <text x="88" y="324" fontSize="10.5" fill={INK}>Dr. Jose Ramos&apos;s credentials</text>
        <text x="88" y="339" fontSize="10.5" fill={INK}>were <tspan fontWeight="700">verified</tspan>.</text>
        <Chip x={88} y={348} w={82} label="Verified Doctor" bg="#ede9fe" color="#7c3aed" />
      </Card>

      <Card x={430} y={346} w={146} h={34}>
        <text x="503" y="367" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={INK}>Review Credentials</text>
      </Card>
    </svg>
  )
}

function AnalyticsArt() {
  // An illustrative week of average readings (SVG y grows downward, so a smaller y is a higher reading).
  const ys = [206, 170, 188, 140, 176, 160, 180]
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const xs = ys.map((_, i) => 150 + i * 50)
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const ring = 2 * Math.PI * 30 // donut circumference
  return (
    <svg viewBox="0 0 608 420" className={ART} aria-hidden="true">
      <Card x={110} y={60} w={400} h={246}>
        <text x="134" y="94" fontSize="15" fontWeight="700" fill={INK}>Blood Sugar Trends</text>
        <circle cx="400" cy="91" r="3" fill={GREEN} />
        <text x="408" y="94" fontSize="9" fill={MUTED}>Average reading</text>
        <rect x="134" y="150" width="352" height="72" rx="6" fill={TINT} />
        <text x="140" y="162" fontSize="8.5" fill={MUTED}>Target range</text>
        <line x1="134" x2="486" y1="270" y2="270" stroke={LINE} />
        <polyline points={points} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r="3.5" fill="white" stroke={GREEN} strokeWidth="2" />
            <text x={x} y="288" textAnchor="middle" fontSize="9" fill={MUTED}>{days[i]}</text>
          </g>
        ))}
      </Card>

      <Card x={456} y={100} w={140} h={134}>
        <circle cx="526" cy="154" r="30" fill="none" stroke={LINE} strokeWidth="10" />
        <circle
          cx="526" cy="154" r="30" fill="none" stroke={GREEN} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${ring * 0.72} ${ring}`} transform="rotate(-90 526 154)"
        />
        <text x="526" y="159" textAnchor="middle" fontSize="14" fontWeight="700" fill={INK}>72%</text>
        <text x="526" y="214" textAnchor="middle" fontSize="9.5" fill={MUTED}>Readings in range</text>
      </Card>

      <Card x={24} y={296} w={168} h={86}>
        <text x="42" y="322" fontSize="8.5" fontWeight="600" letterSpacing="0.6" fill={MUTED}>CONSULTATIONS</text>
        <text x="42" y="352" fontSize="22" fontWeight="700" fill={INK}>86</text>
        <text x="42" y="370" fontSize="9.5" fontWeight="600" fill="#4d7c22">↑ 8% this month</text>
      </Card>

      <Card x={410} y={326} w={160} h={36}>
        <path d="M436 336v10m0 0l-4-4m4 4l4-4M430 352h12" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <text x="452" y="348" fontSize="10.5" fontWeight="700" fill={INK}>Generate Report</text>
      </Card>
    </svg>
  )
}

function RevenueArt() {
  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
  const heights = [60, 78, 70, 96, 114, 142]
  return (
    <svg viewBox="0 0 608 420" className={ART} aria-hidden="true">
      <Card x={110} y={80} w={390} h={252}>
        <text x="134" y="114" fontSize="15" fontWeight="700" fill={INK}>Revenue Growth</text>
        <rect x="372" y="99" width="54" height="20" rx="10" fill="#ddf0a9" />
        <text x="399" y="112.5" textAnchor="middle" fontSize="9" fontWeight="600" fill={INK}>Monthly</text>
        <text x="454" y="112.5" textAnchor="middle" fontSize="9" fill={MUTED}>Quarterly</text>
        <line x1="134" x2="476" y1="300" y2="300" stroke={LINE} />
        {months.map((month, i) => {
          const x = 150 + i * 56
          const last = i === months.length - 1
          return (
            <g key={month}>
              <rect x={x} y={300 - heights[i]} width="28" height={heights[i]} rx="5" fill={last ? GREEN : LIME} />
              <text x={x + 14} y="317" textAnchor="middle" fontSize="9" fill={MUTED}>{month}</text>
            </g>
          )
        })}
      </Card>

      <Card x={420} y={10} w={170} h={88}>
        <text x="438" y="36" fontSize="8.5" fontWeight="600" letterSpacing="0.6" fill={MUTED}>TOTAL REVENUE</text>
        <text x="438" y="66" fontSize="20" fontWeight="700" fill={INK}>₱48,250</text>
        <text x="438" y="85" fontSize="9.5" fontWeight="600" fill="#4d7c22">↑ 15% vs last month</text>
      </Card>

      <Card x={36} y={342} w={236} h={62}>
        <circle cx="68" cy="373" r="16" fill={TINT} />
        <text x="68" y="378" textAnchor="middle" fontSize="13" fontWeight="700" fill={GREEN}>₱</text>
        <text x="96" y="368" fontSize="10.5" fontWeight="700" fill={INK}>Consultation completed</text>
        <text x="96" y="384" fontSize="9.5" fill={MUTED}>15% commission</text>
        <Chip x={176} y={373} w={38} label="Paid" bg={TINT} color="#4d7c22" />
      </Card>

      <Card x={410} y={346} w={160} h={54}>
        <text x="426" y="367" fontSize="9" fill={MUTED}>Premium Subscribers</text>
        <text x="426" y="388" fontSize="14" fontWeight="700" fill={INK}>128 active</text>
      </Card>
    </svg>
  )
}

/* ---------- slide list ---------- */

function Accent({ children }) {
  return <span className="text-[#629c2c]">{children}</span>
}

const SLIDES = [
  {
    art: (
      <img
        src="/login-hero.png"
        alt=""
        draggable="false"
        className={`${ART} object-contain`}
      />
    ),
    title: <>Oversee <Accent>Diabetes Care</Accent><br />with Clarity and Control</>,
    text: 'Review providers, monitor patient activity and keep every care team aligned from one secure admin console.',
  },
  {
    art: <ProvidersArt />,
    title: <>Verify <Accent>Every Doctor</Accent><br />Before They Consult</>,
    text: 'Check PRC licenses and credentials, approve or reject with a reason, and show patients only verified doctors.',
  },
  {
    art: <AnalyticsArt />,
    title: <>Turn <Accent>Patient Data</Accent><br />into Better Decisions</>,
    text: 'Follow blood sugar trends, consultations and engagement, then generate a printable or CSV report in one click.',
  },
  {
    art: <RevenueArt />,
    title: <>Track <Accent>Revenue</Accent> from<br />Every Consultation</>,
    text: 'See consultation commissions and premium subscriptions grow month by month, with payment details ready to review.',
  },
]

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export default function LoginSlideshow() {
  const [index, setIndex] = useState(0)
  // People who ask their OS for less motion start with the slideshow paused; they can still use the dots.
  const [paused, setPaused] = useState(prefersReducedMotion)
  // Hovering or tabbing into the slideshow holds the current slide so it can be read.
  const [holding, setHolding] = useState(false)

  // A timeout keyed on `index` (instead of an interval) restarts the countdown whenever a dot is clicked.
  useEffect(() => {
    if (paused || holding) return undefined
    const timer = setTimeout(() => setIndex((value) => (value + 1) % SLIDES.length), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [index, paused, holding])

  return (
    <section
      aria-roledescription="carousel"
      aria-label="What the admin portal does"
      className="flex flex-col items-center"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={() => setHolding(false)}
    >
      {/* Every slide sits in the same grid cell, so the box keeps the tallest slide's height and the page never
          jumps; only the visible one is opaque. */}
      <div className="grid w-full">
        {SLIDES.map((slide, i) => {
          const active = i === index
          return (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              aria-hidden={!active}
              // The old slide fades out fast and the new one fades in after a short delay, so the two never blur together.
              className={`flex flex-col items-center transition ease-out [grid-area:1/1] motion-reduce:transition-none ${
                active ? 'translate-y-0 opacity-100 delay-200 duration-700' : 'pointer-events-none translate-y-3 opacity-0 duration-300'
              }`}
            >
              <div className="flex w-full justify-center">{slide.art}</div>
              <h2 className="mt-8 text-center text-[1.75rem] font-extrabold leading-[1.2] tracking-tight text-ink">{slide.title}</h2>
              <p className="mt-4 max-w-[24rem] text-center text-sm leading-[1.6] text-gray-500">{slide.text}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show slide ${i + 1}`}
            aria-current={i === index}
            className="flex h-6 items-center"
          >
            <span className={`block h-[6px] rounded-full transition-all duration-300 ${i === index ? 'w-7 bg-[#629c2c]' : 'w-[6px] bg-gray-300 hover:bg-gray-400'}`} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
            {paused ? <path d="M8 5v14l11-7z" /> : <path d="M7 5h3v14H7zM14 5h3v14h-3z" />}
          </svg>
        </button>
      </div>
    </section>
  )
}
