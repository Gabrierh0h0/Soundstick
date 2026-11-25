const K = { stroke: '#2a0a50', strokeWidth: 2.5, strokeLinejoin: 'round' as const }

/** Degradados compartidos por los íconos; se monta una sola vez en la app. */
export function IconDefs() {
  const grad = (id: string, a: string, b: string, c: string) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={a} />
      <stop offset=".5" stopColor={b} />
      <stop offset="1" stopColor={c} />
    </linearGradient>
  )
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {grad('ss-b', '#9ad0ff', '#2f7be0', '#1a3fa8')}
        {grad('ss-y', '#fff59a', '#ffd200', '#e08a00')}
        {grad('ss-p', '#ffc2ee', '#e83ac8', '#9a1a9c')}
        {grad('ss-g', '#b8ffc8', '#2ec45a', '#0d7a30')}
        {grad('ss-s', '#ffffff', '#dcdcec', '#b8b8d0')}
      </defs>
    </svg>
  )
}

const shine = <ellipse cx="22" cy="12" rx="12" ry="4" fill="#fff" opacity=".55" />

export function ModeIcon({ mode }: { mode: 'video' | 'videoAudio' | 'imageAudio' | 'voice' }) {
  return (
    <svg viewBox="0 0 52 46" aria-hidden="true" focusable="false">
      {mode === 'video' && (
        <>
          <rect x="3" y="10" width="32" height="26" rx="4" fill="url(#ss-b)" {...K} />
          <path d="M35 19 L49 11 V35 L35 27 Z" fill="url(#ss-y)" {...K} />
          <circle cx="14" cy="23" r="6" fill="url(#ss-s)" {...K} />
          {shine}
        </>
      )}
      {mode === 'videoAudio' && (
        <>
          <path d="M5 17 H15 L28 6 V40 L15 29 H5 Z" fill="url(#ss-y)" {...K} />
          <path d="M34 15 Q41 23 34 31 M39 9 Q50 23 39 37" fill="none" stroke="#2a0a50" strokeWidth="3" strokeLinecap="round" />
          {shine}
        </>
      )}
      {mode === 'imageAudio' && (
        <>
          <rect x="4" y="6" width="44" height="34" rx="3" fill="url(#ss-s)" {...K} />
          <rect x="9" y="11" width="34" height="24" fill="url(#ss-b)" stroke="#2a0a50" strokeWidth="2" />
          <path d="M9 35 L21 20 L29 29 L35 23 L43 35 Z" fill="url(#ss-g)" stroke="#2a0a50" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="35" cy="17" r="4" fill="url(#ss-y)" stroke="#2a0a50" strokeWidth="2" />
        </>
      )}
      {mode === 'voice' && (
        <>
          <rect x="18" y="3" width="16" height="25" rx="8" fill="url(#ss-p)" {...K} />
          <path d="M11 21 Q11 35 26 35 Q41 35 41 21" fill="none" stroke="#2a0a50" strokeWidth="3" strokeLinecap="round" />
          <path d="M26 35 V43 M18 43 H34" stroke="#2a0a50" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="23" cy="10" rx="3" ry="4" fill="#fff" opacity=".6" />
        </>
      )}
    </svg>
  )
}

export function Heart() {
  return (
    <svg viewBox="0 0 12 11" aria-hidden="true" focusable="false">
      <path d="M6 10.5 L1 5.5 C-.5 3.5 1 .5 3.5 .8 C4.8 1 5.6 2 6 2.8 C6.4 2 7.2 1 8.5 .8 C11 .5 12.5 3.5 11 5.5 Z" fill="#fff" stroke="#8a0050" strokeWidth=".8" />
    </svg>
  )
}

export function Planet() {
  return (
    <svg viewBox="0 0 26 16" aria-hidden="true" focusable="false">
      <ellipse cx="13" cy="9" rx="12" ry="3.5" fill="none" stroke="#c9b6ff" strokeWidth="2" />
      <circle cx="13" cy="8" r="6" fill="#e9dcff" />
    </svg>
  )
}
