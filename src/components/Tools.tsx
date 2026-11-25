import { useState } from 'react'
import { useT, type Key } from '../lib/i18n'
import { LIMITS } from '../lib/limits'
import { TEXT_COLORS, type Effects, type TextPos } from '../lib/project'
import { fmt } from '../lib/trim'
import { Planet } from './Icons'

type ToolId = 'vol' | 'speed' | 'fade' | 'text'

type Props = {
  onHelp: () => void
  fx: Effects
  onFx: (patch: Partial<Effects>) => void
  showOrig: boolean
  showAdded: boolean
  addedLabel: Key
  /** Duración final del sticker, en segundos. */
  outLen: number
}

const COLOR_NAMES: Record<(typeof TEXT_COLORS)[number], Key> = {
  '#ffffff': 'colWhite',
  '#9ccc00': 'colLime',
  '#00aeef': 'colCyan',
  '#e3008c': 'colMagenta',
  '#ffd400': 'colYellow',
}
const POSITIONS: { id: TextPos; label: Key }[] = [
  { id: 'top', label: 'posTop' },
  { id: 'center', label: 'posCenter' },
  { id: 'bottom', label: 'posBottom' },
]

function Slider({ label, value, min, max, step, shown, onChange }: { label: string; value: number; min: number; max: number; step: number; shown: string; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{shown}</output>
    </label>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function Tools({ onHelp, fx, onFx, showOrig, showAdded, addedLabel, outLen }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState<ToolId | null>(null)
  const toggle = (id: ToolId) => setOpen((cur) => (cur === id ? null : id))

  const tiles: { id: ToolId; label: Key; value: string; on: boolean }[] = [
    { id: 'vol', label: 'toolVolume', value: showOrig && showAdded ? `${Math.round(fx.volOrig * 100)}/${Math.round(fx.volAdd * 100)}` : pct(showOrig ? fx.volOrig : fx.volAdd), on: false },
    { id: 'speed', label: 'toolSpeed', value: `${fx.speed}x`, on: fx.speed !== 1 },
    { id: 'fade', label: 'toolFade', value: fx.fade > 0 ? `${fx.fade} s` : t('fadeOff'), on: fx.fade > 0 },
    { id: 'text', label: 'toolText', value: fx.text.trim() ? Array.from(fx.text.trim()).slice(0, 10).join('') : t('fadeOff'), on: !!fx.text.trim() },
  ]

  const panelFor = (id: ToolId) => open === id && (
    <div className="tool-panel" id="tool-panel">
          {id === 'vol' && (
            <>
              {showOrig && <Slider label={t('volOriginal')} value={fx.volOrig} min={0} max={1.5} step={0.05} shown={pct(fx.volOrig)} onChange={(v) => onFx({ volOrig: v })} />}
              {showAdded && <Slider label={t(addedLabel)} value={fx.volAdd} min={0} max={1.5} step={0.05} shown={pct(fx.volAdd)} onChange={(v) => onFx({ volAdd: v })} />}
            </>
          )}
          {id === 'speed' && (
            <>
              <Slider label={t('toolSpeed')} value={fx.speed} min={LIMITS.minSpeed} max={LIMITS.maxSpeed} step={0.05} shown={`${fx.speed}x`} onChange={(v) => onFx({ speed: Number(v.toFixed(2)) })} />
              <p className="hint">{t('speedHint', { s: fmt(outLen) })}</p>
            </>
          )}
          {id === 'fade' && (
            <>
              <Slider label={t('toolFade')} value={fx.fade} min={0} max={LIMITS.maxFade} step={0.1} shown={fx.fade > 0 ? `${fx.fade} s` : t('fadeOff')} onChange={(v) => onFx({ fade: Number(v.toFixed(1)) })} />
              <p className="hint">{t('fadeHint')}</p>
            </>
          )}
          {id === 'text' && (
            <>
              <input className="text-input" type="text" maxLength={60} value={fx.text} placeholder={t('textPlaceholder')} aria-label={t('toolText')} onChange={(e) => onFx({ text: e.target.value })} />
              <div className="seg" role="group" aria-label={t('textPos')}>
                {POSITIONS.map((p) => (
                  <button key={p.id} type="button" aria-pressed={fx.textPos === p.id} onClick={() => onFx({ textPos: p.id })}>{t(p.label)}</button>
                ))}
              </div>
              <div className="swatches" role="group" aria-label={t('textColor')}>
                {TEXT_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={t(COLOR_NAMES[c])} aria-pressed={fx.textColor === c} style={{ background: c }} onClick={() => onFx({ textColor: c })} />
                ))}
              </div>
              <Slider label={t('textSize')} value={fx.textSize} min={28} max={110} step={2} shown={`${fx.textSize}`} onChange={(v) => onFx({ textSize: v })} />
            </>
          )}
    </div>
  )

  return (
    <div className="tools">
      <h3 className="tools-head"><Planet />{t('ajustes')}</h3>
      <ul className="tool-list">
        {tiles.map((x) => (
          <li key={x.id} className={x.on ? 'set' : ''}>
            <button type="button" className={open === x.id ? 'open' : ''} aria-expanded={open === x.id} aria-controls="tool-panel" onClick={() => toggle(x.id)}>
              <u>{t(x.label)}</u>
              <em>{x.value}</em>
            </button>
            {panelFor(x.id)}
          </li>
        ))}
        <li className="help"><button type="button" onClick={onHelp}><u>{t('toolHelp')}</u></button></li>
      </ul>
    </div>
  )
}
