import { useState } from 'react'
import { Editor } from './components/Editor'
import { Help } from './components/Help'
import { Library } from './components/Library'
import { Heart, IconDefs } from './components/Icons'
import { I18nProvider, useT, type Key } from './lib/i18n'

type View = 'create' | 'library' | 'help'
const VIEWS: { id: View; label: Key }[] = [
  { id: 'create', label: 'navCreate' },
  { id: 'library', label: 'navLibrary' },
  { id: 'help', label: 'navHelp' },
]

function Shell() {
  const { t, lang, setLang } = useT()
  const [view, setView] = useState<View>('create')

  return (
    <div className="app">
      <IconDefs />
      <div className="win">
        <div className="tb" aria-hidden="true">
          <span>soundstick</span>
          <span className="ctl"><i className="heart"><Heart /></i><i className="mn" /><i className="mx" /><i className="cl" /></span>
        </div>
        <header className="banner">
          <h1 className="logo" aria-label="soundstick">soundstick</h1>
        </header>
        <div className="tick" aria-hidden="true"><span>{t('ticker')}</span></div>
        <nav className="pivot" aria-label="Secciones">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-current={view === v.id ? 'page' : undefined} onClick={() => setView(v.id)}>
              {t(v.label)}
            </button>
          ))}
          <span className="lang" role="group" aria-label="Idioma / Language">
            <button type="button" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>es</button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>en</button>
          </span>
        </nav>
        <div className="body">
        {/* El editor sigue montado al cambiar de vista para no perder el trabajo en curso. */}
        <div hidden={view !== 'create'}><Editor onHelp={() => setView('help')} /></div>
        {view === 'library' && <Library />}
        {view === 'help' && <Help />}
        </div>
        <footer className="statusbar"><span>{t('ready')}</span><span>soundstick 1.0</span></footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}
