import { useEffect, useMemo, useState } from 'react'
import { City, Country, State } from 'country-state-city'
import { Activity, ArrowDownRight, ArrowRight, BookOpen, BookText, CalendarDays, Compass, Globe2, Heart, HelpCircle, LocateFixed, MapPin, Menu, Moon, Navigation, Search, Settings2, ShieldCheck, Sun, Sunrise, Sunset, X, Info, Copy, Sparkles, LoaderCircle, ChevronRight } from 'lucide-react'
import QuranLibrary from './components/QuranLibrary'
import { getPrayerTimes, METHODS, qiblaBearing, type Madhhab, type Prayer } from './lib/islamic'

type Tab = 'Overview' | 'Qibla' | 'Learn' | 'Duas' | 'Quran'
const initialPrayers: Prayer[] = [
  { name: 'Fajr', time: '--:--' }, { name: 'Sunrise', time: '--:--' }, { name: 'Dhuhr', time: '--:--' },
  { name: 'Asr', time: '--:--' }, { name: 'Maghrib', time: '--:--' }, { name: 'Isha', time: '--:--' },
]
const navItems: { name: Tab; icon: typeof Sun }[] = [
  { name: 'Overview', icon: Sun }, { name: 'Qibla', icon: Compass }, { name: 'Learn', icon: BookOpen }, { name: 'Duas', icon: Heart }, { name: 'Quran', icon: BookText },
]
const prayerIcons: Record<string, typeof Sun> = { Fajr: Sunrise, Sunrise: Sun, Dhuhr: Sun, Asr: Sun, Maghrib: Sunset, Isha: Moon }

export default function App() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [city, setCity] = useState('Hyderabad')
  const [country, setCountry] = useState('India')
  const [countryCode, setCountryCode] = useState('IN')
  const [stateCode, setStateCode] = useState('TS')
  const countries = useMemo(() => Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name)), [])
  const states = useMemo(() => State.getStatesOfCountry(countryCode).sort((a, b) => a.name.localeCompare(b.name)), [countryCode])
  const cities = useMemo(() => stateCode ? City.getCitiesOfState(countryCode, stateCode).sort((a, b) => a.name.localeCompare(b.name)) : [], [countryCode, stateCode])
  const [method, setMethod] = useState(1)
  const [madhhab, setMadhhab] = useState<Madhhab>('Hanafi')
  const [prayers, setPrayers] = useState<Prayer[]>(initialPrayers)
  const [hijri, setHijri] = useState('Loading Hijri date…')
  const [dateLabel, setDateLabel] = useState(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activePrayer, setActivePrayer] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [dark, setDark] = useState(() => window.localStorage.getItem('noor-theme') === 'dark')
  const [bearing, setBearing] = useState<number | null>(null)
  const [locationStatus, setLocationStatus] = useState('Location not detected')
  const [showSettings, setShowSettings] = useState(false)
  const [search, setSearch] = useState('')
  const [duaResults, setDuaResults] = useState<Dua[]>(duas)
  const [duaLoading, setDuaLoading] = useState(false)
  const [duaApiError, setDuaApiError] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [selectedGuide, setSelectedGuide] = useState<GuideKey | null>(null)
  const [guideMadhhab, setGuideMadhhab] = useState<Madhhab>('Hanafi')

  async function loadTimes() {
    setLoading(true); setError('')
    try {
      const result = await getPrayerTimes(city.trim(), country.trim(), method, madhhab)
      setPrayers(result.prayers); setHijri(result.hijri); setDateLabel(result.readableDate)
      setActivePrayer(findNextPrayer(result.prayers))
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadTimes() }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; window.localStorage.setItem('noor-theme', dark ? 'dark' : 'light') }, [dark])

  function detectLocation() {
    if (!navigator.geolocation) { setLocationStatus('Location is not supported by this browser.'); return }
    setLocationStatus('Finding your location…')
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords
      setBearing(qiblaBearing(latitude, longitude)); setLocationStatus(`${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`)
      // Coordinates are used locally for Qibla; city selection remains available for prayer-time lookup.
    }, () => setLocationStatus('Permission denied. You can still use manual city selection.'), { enableHighAccuracy: true, timeout: 12000 })
  }

  const filteredDuas = useMemo(() => { const q = search.trim().toLocaleLowerCase(); const stripMarks = (value: string) => value.replace(/[\u064B-\u065F\u0670]/g, ''); const matches = duaResults.filter((dua) => { if (!q) return true; const title = stripMarks(dua.title.toLocaleLowerCase()); const roman = stripMarks(dua.transliteration.toLocaleLowerCase()); if (q.length === 1 && /^[a-z]$/.test(q)) return title.startsWith(q) || roman.startsWith(q); return stripMarks(`${dua.title} ${dua.category} ${dua.translation} ${dua.transliteration} ${dua.arabic}`.toLocaleLowerCase()).includes(stripMarks(q)) }); return matches.sort((a,b) => { if (q.length !== 1) return 0; const score = (d: Dua) => Number(d.title.toLocaleLowerCase().startsWith(q)) + Number(d.transliteration.toLocaleLowerCase().startsWith(q)); return score(b)-score(a) }) }, [search, duaResults])

  useEffect(() => {
    if (tab !== 'Duas') return
    const controller = new AbortController()
    async function loadDuaLibrary() {
      setDuaLoading(true); setDuaApiError('')
      try {
        const response = await fetch('https://ummahapi.com/api/duas', { signal: controller.signal })
        if (!response.ok) throw new Error(`Dua service returned ${response.status}`)
        const payload: unknown = await response.json()
        const records = extractDuaRecords(payload).map(normalizeDua).filter((item): item is Dua => Boolean(item))
        if (!records.length) throw new Error('Dua service returned no readable records.')
        setDuaResults(records)
      } catch (err) {
        if (controller.signal.aborted) return
        setDuaApiError('Live Dua library is temporarily unavailable. Showing the locally available sample collection.')
        setDuaResults(duas)
      } finally { if (!controller.signal.aborted) setDuaLoading(false) }
    }
    void loadDuaLibrary()
    return () => controller.abort()
  }, [tab])
  const nextPrayer = activePrayer || 'Fajr'

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" onClick={() => setTab('Overview')} aria-label="Noor home"><span className="brand-mark">ن</span><span><strong>Noor</strong><small>ISLAMIC COMPANION</small></span></a>
      <nav className={`desktop-nav ${mobileMenu ? 'open' : ''}`} aria-label="Main navigation">
        {navItems.map(({ name, icon: Icon }) => <button key={name} className={`nav-link ${tab === name ? 'selected' : ''}`} onClick={() => { setTab(name); setMobileMenu(false) }}><Icon size={17}/>{name}</button>)}
      </nav>
      <div className="top-actions"><button className="icon-button search-toggle" aria-label="Search Noor" onClick={() => setGlobalSearchOpen(!globalSearchOpen)}><Search size={18}/></button><button className="icon-button theme-toggle" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="settings-button" onClick={() => setShowSettings(!showSettings)}><Settings2 size={17}/><span>Preferences</span></button><button className="icon-button menu-toggle" aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={20}/> : <Menu size={20}/>}</button></div>
    </header>

    {globalSearchOpen && <div className="global-search-wrap"><div className="global-search-panel card"><Search size={19}/><input autoFocus value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setGlobalSearchOpen(false) }} placeholder="Search Salah, Surah, Dua, Kalima, Wudu…"/><button className="icon-button" onClick={() => { setGlobalSearch(''); setGlobalSearchOpen(false) }} aria-label="Close search"><X size={18}/></button></div><div className="search-suggestions card"><span className="eyebrow">{globalSearch ? 'MATCHING TOPICS' : 'POPULAR SEARCHES'}</span>{getSearchSuggestions(globalSearch).map((item) => <button key={item.label} onClick={() => { setTab(item.tab); if (item.guide) setSelectedGuide(item.guide); if (item.tab === 'Duas') setSearch(globalSearch || item.query); setGlobalSearchOpen(false); setGlobalSearch('') }}><span className="suggestion-icon"><item.icon size={17}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={15}/></button>)}</div></div>}
    <main id="home" className="main-content">
      <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR DAILY COMPANION</div><h1>Assalamu Alaikum<span className="gold-dot">.</span></h1><p className="muted">A little more mindful, a little closer every day.</p></div><div className="date-chip"><CalendarDays size={16}/><span>{dateLabel}</span></div></div>

      {showSettings && <section className="settings-panel card"><div className="panel-heading"><div><span className="eyebrow">PERSONALIZE NOOR</span><h3>Your preferences</h3></div><button className="icon-button" onClick={() => setShowSettings(false)} aria-label="Close preferences"><X size={18}/></button></div><div className="settings-grid location-settings-grid">
          <label>Country<select value={countryCode} onChange={(e) => { const selected = countries.find((item) => item.isoCode === e.target.value); if (!selected) return; setCountryCode(selected.isoCode); setCountry(selected.name); setStateCode(''); setCity('') }}><option value="">Select country</option>{countries.map((item) => <option key={item.isoCode} value={item.isoCode}>{item.name}</option>)}</select></label>
          <label>State / Province<select value={stateCode} disabled={!countryCode || states.length === 0} onChange={(e) => { const selected = states.find((item) => item.isoCode === e.target.value); setStateCode(selected?.isoCode || ''); setCity('') }}><option value="">{states.length ? 'Select state / province' : 'No state list available'}</option>{states.map((item) => <option key={`${item.isoCode}-${item.name}`} value={item.isoCode}>{item.name}</option>)}</select></label>
          <label>City<select value={city} disabled={!stateCode || cities.length === 0} onChange={(e) => setCity(e.target.value)}><option value="">{cities.length ? 'Select city' : 'Select a state first'}</option>{cities.map((item, index) => <option key={`${item.name}-${index}`} value={item.name}>{item.name}</option>)}</select></label>
          <label>Calculation method<select value={method} onChange={(e) => setMethod(Number(e.target.value))}>{METHODS.map((m) => <option value={m.id} key={m.id}>{m.label}</option>)}</select></label>
          <label>Asr calculation<select value={madhhab} onChange={(e) => setMadhhab(e.target.value as Madhhab)}>{['Hanafi', "Shafi'i", 'Maliki', 'Hanbali'].map((m) => <option key={m}>{m}</option>)}</select></label>
        </div><button className="primary-button small" onClick={() => { void loadTimes(); setShowSettings(false) }} disabled={!city || !country}>Update prayer times <ArrowRight size={16}/></button></section>}

      {tab === 'Overview' && <>
        <section className="hero-grid">
          <div className="prayer-hero">
            <div className="hero-top"><span className="hero-label"><span className="live-dot"/> PRAYER TIMES</span><span className="hero-hijri">{hijri}</span></div>
            <div className="hero-main"><div><p className="hero-kicker">NEXT PRAYER</p><h2>{nextPrayer}</h2><p className="hero-sub">May your prayers bring you peace.</p></div><div className="hero-time"><span>{prayers.find(p => p.name === nextPrayer)?.time || '--:--'}</span><small>LOCAL TIME</small></div></div>
            <div className="hero-bottom"><span><MapPin size={14}/>{city}, {country}</span><button onClick={() => setShowSettings(!showSettings)}>Change location <ArrowRight size={14}/></button></div>
            <div className="hero-pattern" aria-hidden="true">✳</div>
          </div>
          <div className="qibla-teaser card"><div className="teaser-icon"><Compass size={21}/></div><span className="eyebrow">FIND YOUR DIRECTION</span><h3>Face the Qibla,<br/>wherever you are.</h3><p className="muted">Find the direction of the Kaaba with your device location.</p><button className="text-button" onClick={() => { setTab('Qibla'); detectLocation() }}>Open Qibla compass <ArrowRight size={16}/></button><div className="compass-watermark"><Compass size={112}/></div></div>
        </section>

        <section className="section-block"><div className="section-heading"><div><span className="eyebrow">YOUR DAILY RHYTHM</span><h2>Prayer schedule</h2></div><button className="text-button subtle" onClick={() => setShowSettings(!showSettings)}>Adjust settings <ArrowRight size={15}/></button></div>
          {error && <div className="error-banner"><HelpCircle size={17}/><span>{error} Check your city/country or try again.</span><button onClick={() => void loadTimes()}>Retry</button></div>}
          <div className="prayer-grid">{prayers.map((prayer) => { const Icon = prayerIcons[prayer.name] || Sun; return <article className={`prayer-card card ${activePrayer === prayer.name ? 'current' : ''}`} key={prayer.name}><div className="prayer-card-top"><span className="prayer-icon"><Icon size={18}/></span>{activePrayer === prayer.name && <span className="now-tag">UP NEXT</span>}</div><span className="prayer-name">{prayer.name}</span><strong className="prayer-time">{loading ? '…' : prayer.time}</strong></article> })}</div>
          <div className="api-note"><span>{loading ? 'Updating prayer times…' : 'Prayer times provided by AlAdhan API'}</span><button onClick={() => void loadTimes()} disabled={loading}>{loading ? 'Loading' : 'Refresh times'}</button></div>
        </section>

        <section className="section-block"><div className="section-heading"><div><span className="eyebrow">EXPLORE NOOR</span><h2>Make space for what matters</h2></div></div><div className="quick-grid"><button className="quick-card card" onClick={() => setTab('Qibla')}><span className="quick-icon green"><Compass size={21}/></span><span><strong>Qibla direction</strong><small>Find your direction</small></span><ArrowDownRight size={17}/></button><button className="quick-card card" onClick={() => setTab('Learn')}><span className="quick-icon gold"><BookOpen size={21}/></span><span><strong>Learn Salah</strong><small>Build your practice</small></span><ArrowDownRight size={17}/></button><button className="quick-card card" onClick={() => setTab('Duas')}><span className="quick-icon blush"><Heart size={21}/></span><span><strong>Daily duas</strong><small>Words for every moment</small></span><ArrowDownRight size={17}/></button><button className="quick-card card" onClick={() => setTab('Learn')}><span className="quick-icon blue"><Activity size={21}/></span><span><strong>Wudu guide</strong><small>Step-by-step learning</small></span><ArrowDownRight size={17}/></button></div></section>

        <section className="reflection-card"><div className="reflection-symbol">۞</div><div><span className="eyebrow">A MOMENT OF REFLECTION</span><p className="arabic" lang="ar" dir="rtl">فَإِنَّ مَعَ الْعُسْرِ يُسْرًا</p><p className="reflection-translation">“For indeed, with hardship comes ease.”</p><small>Qur’an · Surah Ash-Sharh 94:5</small></div><BookOpen className="reflection-book" size={32}/></section>
      </>}

      {tab === 'Qibla' && <section className="page-section"><div className="section-heading"><div><span className="eyebrow">DIRECTION OF PRAYER</span><h2>Qibla compass</h2><p className="muted">Your direction to the Kaaba in Makkah.</p></div></div><div className="qibla-layout"><div className="compass-card card"><div className="compass-ring"><span className="direction north">N</span><span className="direction east">E</span><span className="direction south">S</span><span className="direction west">W</span><div className="compass-inner"><Navigation size={62} strokeWidth={1.2} style={{ transform: `rotate(${bearing ?? 0}deg)` }}/><span>{bearing === null ? '—°' : `${Math.round(bearing)}°`}</span></div></div><h3>{bearing === null ? 'Find your Qibla direction' : `Qibla bearing: ${Math.round(bearing)}°`}</h3><p className="muted">{bearing === null ? 'Allow location access to calculate the direction from your current coordinates.' : 'Bearing is measured clockwise from true north. Device compass heading is not yet connected.'}</p><button className="primary-button" onClick={detectLocation}><LocateFixed size={17}/> Use my location</button><small className="privacy-note"><ShieldCheck size={14}/> Coordinates are processed in your browser for this calculation.</small><p className="location-status">{locationStatus}</p></div><div className="qibla-info card"><span className="eyebrow">HOW IT WORKS</span><h3>Accurate by location</h3><p>Qibla direction is calculated using your latitude and longitude and the geographical coordinates of the Kaaba.</p><div className="info-row"><Globe2 size={18}/><span><strong>Global calculation</strong><small>Works wherever you are on Earth.</small></span></div><div className="info-row"><ShieldCheck size={18}/><span><strong>Privacy-conscious</strong><small>Location is requested only when you tap the button.</small></span></div><div className="info-row"><Compass size={18}/><span><strong>Compass sensor coming next</strong><small>This first web preview shows bearing, not live device orientation.</small></span></div></div></div></section>}

      {tab === 'Learn' && <section className="page-section"><div className="section-heading"><div><span className="eyebrow">GROW YOUR KNOWLEDGE</span><h2>Learn at your pace</h2><p className="muted">Detailed, structured guides: what to do, how to do it, why it matters, and where schools of law may differ.</p></div></div><div className="learning-grid">{learnItems.map((item) => <article className="learning-card card" key={item.key}><img className="learn-art-image" src={item.image} alt={item.imageAlt}/><div className="learning-copy"><span className="eyebrow">{item.label}</span><h3>{item.title}</h3><p>{item.description}</p><button className="text-button" onClick={() => setSelectedGuide(item.key)}>Read complete guide <ArrowRight size={15}/></button></div></article>)}</div><div className="learn-note card"><Info size={18}/><p><strong>About Madhhab differences</strong><br/>The guide selector lets you choose Hanafi, Shafi’i, Maliki or Hanbali. The shared steps are explained first; differences are called out rather than presented as one universal ruling. Please confirm personal rulings with a qualified local scholar.</p></div><p className="content-disclaimer"><ShieldCheck size={16}/> Educational content, not a fatwa. Arabic wording, hadith references and school-specific rulings require scholar review before public release.</p></section>}

      {tab === 'Duas' && <section className="page-section dua-library-page"><div className="section-heading"><div><span className="eyebrow">WORDS TO REMEMBER</span><h2>Dua library</h2><p className="muted">Search by the first letter, topic, English name, transliteration or Arabic text. Suggestions update as you type.</p></div></div><div className="dua-search-area"><div className="search-box dua-search-box"><Search size={19}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Try A, B, morning, travel, sleep…" aria-label="Search duas"/><span className="live-label">LIVE SEARCH</span>{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={16}/></button>}</div><div className="search-hints"><span>POPULAR:</span>{['Morning','Travel','Sleep','Food','Forgiveness'].map((term) => <button key={term} onClick={() => setSearch(term)}>{term}</button>)}</div>{search.trim() && filteredDuas.length > 0 && <div className="dua-typeahead" role="listbox" aria-label="Matching dua suggestions">{filteredDuas.slice(0, 7).map((dua, index) => <button key={`${dua.title}-suggestion-${index}`} role="option" onClick={() => setSearch(dua.title)}><span className="typeahead-letter">{dua.title.charAt(0).toUpperCase()}</span><span><strong>{dua.title}</strong><small>{dua.category} · {dua.reference}</small></span><ChevronRight size={15}/></button>)}</div>}{search.trim() && <div className="live-search-status">{duaLoading ? <><LoaderCircle className="spin" size={15}/> Searching duas…</> : <><Sparkles size={14}/> {filteredDuas.length} matching {filteredDuas.length === 1 ? 'dua' : 'duas'}</>}</div>}</div>{duaApiError && <div className="api-note">{duaApiError}</div>}<div className="duas-list">{filteredDuas.map((dua, index) => <article className="dua-card card" key={`${dua.title}-${index}`}><div className="dua-top"><span className="eyebrow">{dua.category}</span><button className="copy-arabic" onClick={() => void navigator.clipboard?.writeText(dua.arabic)}><Copy size={14}/> Copy Arabic</button></div><h3 className="dua-title">{dua.title}</h3><p className="arabic dua-arabic" lang="ar" dir="rtl">{dua.arabic}</p><p className="transliteration">{dua.transliteration}</p><p className="dua-translation">{dua.translation}</p><small>{dua.reference}</small></article>)}</div>{filteredDuas.length === 0 && !duaLoading && <div className="empty-search card"><Search size={24}/><strong>No matching dua found</strong><span>Try another letter, spelling or topic.</span></div>}<p className="content-disclaimer"><ShieldCheck size={16}/> Dua text and references are supplied by UmmahAPI; verify religious content with trusted source material before publication.</p></section>}

      {tab === 'Quran' && <QuranLibrary />}
    </main>

    {selectedGuide && <GuideModal guide={selectedGuide} madhhab={guideMadhhab} setMadhhab={setGuideMadhhab} onClose={() => setSelectedGuide(null)}/> }
    <footer className="footer"><a className="brand footer-brand" href="#home"><span className="brand-mark">ن</span><span><strong>Noor</strong><small>ISLAMIC COMPANION</small></span></a><span>Designed for a more mindful day.</span><span>© {new Date().getFullYear()} Noor</span></footer>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map(({ name, icon: Icon }) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon size={19}/><span>{name}</span></button>)}</nav>
  </div>
}

function findNextPrayer(list: Prayer[]) {
  const now = new Date(); const current = now.getHours() * 60 + now.getMinutes()
  for (const prayer of list.filter(p => p.name !== 'Sunrise')) {
    const [h, m] = prayer.time.split(':').map(Number)
    if (Number.isFinite(h) && Number.isFinite(m) && h * 60 + m > current) return prayer.name
  }
  return 'Fajr'
}

type GuideKey = 'wudu' | 'salah' | 'ghusl' | 'kalimas'
type GuideSection = { title: string; intro: string; points: { heading: string; body: string }[] }

const learnItems: { key: GuideKey; label: string; title: string; description: string; image: string; imageAlt: string }[] = [
  { key: 'wudu', label: 'PURIFICATION', title: 'Wudu (Ablution)', description: 'Understand the purpose, prerequisites, obligatory acts, Sunnah sequence and common mistakes.', image: '/images/wudu.svg', imageAlt: 'Original illustration of water and an ablution vessel' },
  { key: 'salah', label: 'WORSHIP', title: 'Salah (Prayer)', description: 'A complete walkthrough of intention, preparation, each rak’ah, recitations, prayer counts and ending the prayer.', image: '/images/salah.svg', imageAlt: 'Original illustration of a prayer mat and mihrab arch' },
  { key: 'ghusl', label: 'PURIFICATION', title: 'Ghusl (Full Bath)', description: 'Learn when Ghusl is required, its essentials, a practical method and important school differences.', image: '/images/ghusl.svg', imageAlt: 'Original illustration of flowing clean water' },
  { key: 'kalimas', label: 'FOUNDATIONS', title: 'The Six Kalimas', description: 'Explore the traditional South Asian six-kalima learning collection, meanings and how to study it.', image: '/images/kalimas.svg', imageAlt: 'Original illustration of an open book on a wooden stand' },
]

const guideContent: Record<GuideKey, { heading: string; subtitle: string; sections: GuideSection[] }> = {
  salah: {
    heading: 'Salah (Namaz) — complete guide',
    subtitle: 'A structured introduction to the five daily obligatory prayers and the method of a two-rak’ah prayer. The Hanafi sequence is used for the worked example; choose another school to see the guidance note.',
    sections: [
      { title: '1. What Salah is and why it matters', intro: 'Salah is the prescribed act of worship performed at defined times. It includes standing, Qur’an recitation, bowing, prostration and remembrance of Allah. It is not simply a set of movements: attention, humility, cleanliness and observing the prayer time are part of preparing for it.', points: [
        { heading: 'Who is responsible?', body: 'The five daily prayers are obligatory for adult Muslims who are legally accountable. A person who is ill, travelling or unable to perform the usual postures has concessions explained in Islamic law; ask a qualified scholar about an individual circumstance.' },
        { heading: 'Prepare before starting', body: 'Check that the prayer time has begun; have wudu; ensure body, clothing and place are clean; cover the required area of the body; face the Qibla; and remove distractions as much as reasonably possible.' },
        { heading: 'Niyyah (intention)', body: 'Niyyah is the intention in the heart to perform a particular prayer for Allah. Know which prayer you are about to perform. Saying a formula aloud is not a universal requirement; do not treat a particular spoken sentence as mandatory.' },
      ]},
      { title: '2. Five daily prayers and obligatory rak’ahs', intro: 'These are the obligatory (Fard) rak’ahs only. Sunnah, Witr and Nafl prayers are additional and their details can vary by school.', points: [
        { heading: 'Fajr — 2 Fard', body: 'Performed from true dawn until sunrise. In common South Asian practice, two Sunnah rak’ahs are also prayed before the two Fard rak’ahs.' },
        { heading: 'Dhuhr — 4 Fard', body: 'Performed after the sun passes its zenith and before Asr begins. Sunnah prayers before and after the Fard are commonly observed; their classification and details should be learned according to your Madhhab.' },
        { heading: 'Asr — 4 Fard', body: 'Performed in the afternoon before sunset. The start time differs between the standard (majority) and Hanafi shadow calculations; select the correct calculation setting for your school.' },
        { heading: 'Maghrib — 3 Fard', body: 'Performed after sunset. Its time continues until the twilight period ends, with definitions discussed in the schools of law.' },
        { heading: 'Isha — 4 Fard', body: 'Performed after the twilight has disappeared. Witr is prayed after Isha; in Hanafi fiqh Witr is treated as Wajib and is three rak’ahs, while other schools classify and perform Witr differently.' },
      ]},
      { title: '3. How to perform a two-rak’ah prayer', intro: 'This walkthrough explains the common Hanafi teaching sequence. Some details—hand placement, raising the hands, finger movement, basmalah recitation and other subsidiary matters—differ among Madhhabs. Follow one reliable school consistently rather than combining rulings at random.', points: [
        { heading: 'Step 1 — Stand, face Qibla and make intention', body: 'Stand upright if able, face the Qibla and form the intention in your heart for the specific prayer and number of rak’ahs. Keep your gaze lowered toward the place of prostration.' },
        { heading: 'Step 2 — Takbirat al-Ihram', body: 'Raise the hands in the manner taught by your school and say “Allahu Akbar” (الله أكبر — Allah is the Greatest). This opening takbir begins the prayer. Then place the hands in the position taught in your Madhhab and remain composed.' },
        { heading: 'Step 3 — Opening supplication (Sana)', body: 'In the common Hanafi sequence, recite the opening praise quietly: سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ وَتَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ وَلَا إِلَهَ غَيْرُكَ — “Subhanaka Allahumma wa bihamdika wa tabarakasmuka wa ta‘ala jadduka wa la ilaha ghayruk.” It is an opening supplication, not a replacement for Surah al-Fatihah.' },
        { heading: 'Step 4 — Seek refuge and recite Qur’an', body: 'In the first rak’ah, quietly say “A‘udhu billahi minash-shaytanir-rajim” and “Bismillahir-Rahmanir-Rahim”, then recite Surah al-Fatihah. Say “Amin” after al-Fatihah. In the first two rak’ahs, add another portion or short surah of the Qur’an. The exact audible/quiet recitation rules depend on the prayer and school.' },
        { heading: 'Step 5 — Ruku (bowing)', body: 'Say “Allahu Akbar” and bow with the back reasonably level, hands resting on the knees, while maintaining calmness. Recite “Subhana Rabbiyal-‘Azim” (سُبْحَانَ رَبِّيَ الْعَظِيمِ) at least three times in the common teaching practice. Do not rush.' },
        { heading: 'Step 6 — Rise from ruku (Qawmah)', body: 'Rise fully and say “Sami‘Allahu liman hamidah” (سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ). Once upright, say “Rabbana lakal-hamd” (رَبَّنَا لَكَ الْحَمْدُ). Stand still briefly before going down.' },
        { heading: 'Step 7 — First sujud (prostration)', body: 'Say “Allahu Akbar” and prostrate with the body settled. The forehead and nose, both palms, both knees and toes are placed as taught in fiqh. Recite “Subhana Rabbiyal-A‘la” (سُبْحَانَ رَبِّيَ الْأَعْلَى) at least three times in common practice.' },
        { heading: 'Step 8 — Sit between the two sujuds', body: 'Say “Allahu Akbar”, rise into a settled sitting position and pause. A commonly taught supplication is “Rabbighfir li” (رَبِّ اغْفِرْ لِي — My Lord, forgive me). Then say takbir and perform the second sujud.' },
        { heading: 'Step 9 — Second sujud and stand', body: 'Perform the second sujud as before. This completes one rak’ah. Say takbir and stand for the second rak’ah. In the second rak’ah, recite al-Fatihah and another surah/portion in the common Hanafi method.' },
        { heading: 'Step 10 — Tashahhud after the second rak’ah', body: 'After the second rak’ah, sit and recite At-Tahiyyat (التَّحِيَّاتُ). For a two-rak’ah prayer, continue with Durood Ibrahim and a suitable supplication, then finish with salam to the right and left according to the method taught by your school.' },
      ]},
      { title: '4. What to recite — essential learning list', intro: 'Learn the Arabic carefully with a teacher or trusted audio. Transliteration is only a pronunciation aid and cannot fully represent Arabic sounds.', points: [
        { heading: 'Surah al-Fatihah', body: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ ۝ مَالِكِ يَوْمِ الدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ۝ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ. Meaning: Praise belongs to Allah, Lord of all worlds; we worship Him and ask Him for help and guidance to the straight path.' },
        { heading: 'Three short surahs to learn', body: 'Surah al-Ikhlas (112): قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ. Transliteration: Qul huwa Allahu ahad; Allahu-s-samad; lam yalid wa lam yulad; wa lam yakul-lahu kufuwan ahad. Meaning: Allah is One, the Eternal Refuge; He neither begets nor is born, and none is comparable to Him.\n\nSurah al-Falaq (113): قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ. Meaning: Seek refuge in the Lord of daybreak from the harm of creation, darkness, harmful magic and envy.\n\nSurah an-Nas (114): قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ. Meaning: Seek refuge in the Lord, King and God of mankind from the whisperer who withdraws, who whispers into people’s hearts, from among jinn and people. Learn pronunciation from a verified mushaf and teacher; transliteration is only an aid.' },
        { heading: 'Ruku and sujud tasbih', body: 'Ruku: سُبْحَانَ رَبِّيَ الْعَظِيمِ — “Glory be to my Lord, the Magnificent.” Sujud: سُبْحَانَ رَبِّيَ الْأَعْلَى — “Glory be to my Lord, the Most High.”' },
        { heading: 'Tashahhud and Durood', body: 'At-Tahiyyat and Durood Ibrahim are substantial Arabic recitations. Learn the full wording and pronunciation from a reliable printed prayer text or qualified teacher before relying on memory. Their exact wording is not abbreviated here to avoid publishing an unchecked transliteration.' },
      ]},
      { title: '5. How four-rak’ah and three-rak’ah prayers continue', intro: 'The movement pattern repeats, but the sitting points and recitation details matter.', points: [
        { heading: 'Four-rak’ah Fard (Hanafi teaching pattern)', body: 'Perform the first two rak’ahs as described. After the second rak’ah, sit and recite At-Tahiyyat only, then stand for the third. In the third and fourth rak’ahs of a Fard prayer, the Hanafi method generally recites al-Fatihah without adding another surah. After the fourth rak’ah, sit for At-Tahiyyat, Durood Ibrahim and dua, then finish with salam.' },
        { heading: 'Three-rak’ah Maghrib Fard (Hanafi teaching pattern)', body: 'Perform two rak’ahs, sit for At-Tahiyyat, stand for the third rak’ah, then complete it and sit for the final recitations and salam. The third Fard rak’ah generally contains al-Fatihah without an additional surah in the Hanafi method.' },
        { heading: 'Witr', body: 'Witr is not one of the five Fard prayers. Its legal classification and number of rak’ahs vary. In Hanafi practice it is three rak’ahs, with Qunut in the third after an additional takbir. Other schools have different established methods; use the selected Madhhab guidance.' },
      ]},
      { title: '6. Common mistakes and practical checks', intro: 'Correctness includes composure (tuma’ninah), not merely completing a checklist.', points: [
        { heading: 'Rushing through postures', body: 'Pause in ruku, after rising, in each sujud and between the two prostrations. A hurried movement without settling undermines the prayer’s composure.' },
        { heading: 'Missing the prayer time or Qibla check', body: 'Use a reliable local timetable and confirm the calculation method. If you are unsure about Qibla, make a reasonable effort using reliable means and ask a scholar about unusual circumstances.' },
        { heading: 'Treating optional details as universally obligatory', body: 'Sunnah practices and subsidiary rulings differ. Do not label another recognised school’s practice invalid merely because it differs from the method you learned.' },
        { heading: 'Pronunciation and learning', body: 'Learn al-Fatihah and the required recitations carefully. If you are new to Salah, practise with a knowledgeable teacher; transliteration alone is not sufficient for accurate tajwid.' },
      ]},
    ],
  },
  wudu: {
    heading: 'Wudu (Ablution) — complete guide', subtitle: 'A practical guide to preparation, the obligatory acts, recommended sequence and what can invalidate wudu. School-specific differences are identified.',
    sections: [
      { title: '1. Purpose and preparation', intro: 'Wudu is a prescribed purification before Salah and certain acts of worship. Use clean, pure water and remove anything that prevents water reaching the skin where washing is required.', points: [
        { heading: 'Intention and beginning', body: 'Make the intention in your heart to perform wudu for worship. Begin by saying Bismillah, wash your hands and use water without waste. The legal status of the basmalah and intention differs by school.' },
        { heading: 'Remove barriers', body: 'Remove substances such as waterproof paint, thick glue or nail coating that prevent water reaching the required area. Ordinary stains that do not form a water-blocking layer are different.' },
      ]},
      { title: '2. Step-by-step Sunnah method', intro: 'This is the familiar teaching sequence. The obligatory minimum differs by Madhhab; completing the full sequence is a well-established practice.', points: [
        { heading: '1 — Wash both hands', body: 'Wash both hands up to the wrists, commonly three times. Ensure water reaches between the fingers.' },
        { heading: '2 — Rinse mouth and nose', body: 'Rinse the mouth and gently draw water into the nose, then expel it. Repeat, commonly three times. Be gentle if fasting or if medically advised.' },
        { heading: '3 — Wash the face', body: 'Wash the full face from the usual hairline to the chin and from ear to ear. Ensure water reaches the edges and any areas that are easily missed.' },
        { heading: '4 — Wash arms', body: 'Wash the right arm including the elbow, then the left, commonly three times each. Do not leave dry patches around elbows or between fingers.' },
        { heading: '5 — Wipe the head and ears', body: 'Wipe the head with wet hands as required by your school, then wipe the ears according to the taught method. The amount of head wiped is one of the recognised school differences.' },
        { heading: '6 — Wash feet', body: 'Wash the right foot then the left, including ankles and between toes. Check the heel and areas between toes so water reaches them.' },
      ]},
      { title: '3. Obligatory acts — Madhhab differences', intro: 'Do not assume that one school’s list of Fard acts is identical to another’s.', points: [
        { heading: 'Hanafi', body: 'Four Fard acts are commonly taught: washing the face; washing both arms including elbows; wiping at least one-quarter of the head; and washing both feet including ankles.' },
        { heading: 'Shafi’i', body: 'Six obligations are commonly listed: intention; washing the face; washing both arms including elbows; wiping part of the head; washing both feet including ankles; and maintaining the prescribed order.' },
        { heading: 'Maliki and Hanbali', body: 'Their obligatory lists include additional conditions such as rubbing (dalk), continuity (muwalat) and other details, with differences in the exact formulation. Consult a school-specific teacher for a full checklist.' },
      ]},
      { title: '4. What invalidates wudu?', intro: 'The details differ between schools, especially regarding touch, bleeding and other circumstances.', points: [
        { heading: 'Commonly recognised nullifiers', body: 'Passing urine, stool or wind; deep sleep that removes awareness; and loss of consciousness are widely recognised nullifiers. Other cases must be checked against the selected Madhhab.' },
        { heading: 'Touch and bleeding', body: 'Skin contact between unrelated adults and bleeding have different rulings among the schools. Do not rely on a generic online list for these cases; select your Madhhab and ask a qualified scholar.' },
        { heading: 'Doubt after completing wudu', body: 'A mere doubt does not automatically mean purification has ended. Avoid repetitive checking and learn the established legal principle from a reliable teacher.' },
      ]},
    ],
  },
  ghusl: {
    heading: 'Ghusl (Full ritual bath) — complete guide', subtitle: 'Learn when Ghusl is required, the minimum requirements and a complete practical method. Personal cases should be discussed privately with a qualified scholar.',
    sections: [
      { title: '1. What Ghusl means', intro: 'Ghusl is a full-body ritual washing required in defined states of major ritual impurity. It is distinct from an ordinary shower, although an ordinary shower can fulfil Ghusl when its requirements and intention are met according to the school.', points: [
        { heading: 'When it becomes obligatory', body: 'Examples include after marital sexual intercourse and after ejaculation. Menstruation and postnatal bleeding have their own rules: Ghusl is performed when the bleeding ends. The precise legal details and exceptions should be learned privately from a qualified scholar.' },
        { heading: 'Prepare', body: 'Use clean water, remove physical impurity, and ensure water can reach the whole body, including skin folds and hair roots as required. Remove waterproof barriers.' },
      ]},
      { title: '2. A complete practical method', intro: 'The following sequence is a widely taught Sunnah method. The minimum valid requirements differ by Madhhab.', points: [
        { heading: '1 — Intention and Bismillah', body: 'Make the intention in the heart to perform Ghusl for purification. Begin with Bismillah where appropriate.' },
        { heading: '2 — Wash hands and remove impurity', body: 'Wash the hands and clean any visible impurity from the body. Maintain privacy and use water responsibly.' },
        { heading: '3 — Perform wudu', body: 'Perform wudu as for Salah. Some methods delay washing the feet until the end if water collects where you are bathing.' },
        { heading: '4 — Wash the head', body: 'Pour water over the head so it reaches the scalp and hair roots. Ensure no dry area remains.' },
        { heading: '5 — Wash the whole body', body: 'Wash the right side then the left, and ensure water reaches all parts: underarms, navel, behind ears, between fingers and toes, and other folds. Avoid waste.' },
        { heading: '6 — Check completion', body: 'Make a calm final check that the entire required area has been washed. If you have a medical condition, wound or dressing, ask a scholar about the applicable concession.' },
      ]},
      { title: '3. Minimum requirements and school differences', intro: 'The minimum valid Ghusl is not identical across the four schools.', points: [
        { heading: 'Hanafi', body: 'Three Fard acts are commonly taught: rinsing the mouth; rinsing the nose; and washing the entire body so no required area remains dry.' },
        { heading: 'Shafi’i', body: 'The core obligations include intention and washing the entire body, including the hair. Mouth and nose rinsing are recommended rather than among the core obligations in the standard Shafi’i presentation.' },
        { heading: 'Maliki and Hanbali', body: 'Intention, rubbing, continuity and other details are treated differently. A school-specific checklist is necessary for a precise ruling.' },
      ]},
      { title: '4. After Ghusl', intro: 'Whether a separate wudu is needed depends on what occurred during or after Ghusl and the selected school.', points: [
        { heading: 'Can I pray after Ghusl?', body: 'A valid Ghusl can remove major ritual impurity. Whether it also covers minor impurity and whether anything during the bath invalidated wudu depends on the Madhhab and circumstances.' },
        { heading: 'Do not overburden yourself', body: 'Do not repeat a completed bath because of baseless doubts. Learn the minimum requirements and follow them calmly.' },
      ]},
    ],
  },
  kalimas: {
    heading: 'The Six Kalimas — learning guide', subtitle: 'The Six Kalimas are a traditional South Asian teaching collection used to help learners memorise core statements of faith, praise, tawhid and repentance. The collection and wording are not a single universally prescribed six-part liturgy.',
    sections: [
      { title: 'How to learn and revise', intro: 'The Six Kalimas are a traditional South Asian teaching collection. Wording and transliteration can vary slightly between printed editions; this page follows one documented Madani Panj Surah-style text. Learn pronunciation with a qualified teacher and do not treat the collection as a universally prescribed six-part ritual.', points: [
        { heading: 'Listen, read, repeat', body: 'Listen to a reliable reciter, follow the Arabic text, repeat one phrase slowly, then check pronunciation with a teacher. Transliteration is a support, not a substitute for Arabic learning.' },
        { heading: 'Understand the meaning', body: 'After memorising a phrase, explain its meaning in your own language. This helps prevent rote memorisation without comprehension.' },
        { heading: 'Revise gently', body: 'Review a previously learned passage before adding a new one. There is no need to attach a fabricated reward or mandatory daily count to this learning exercise.' },
      ]},
    ],
  },
}

function GuideModal({ guide, madhhab, setMadhhab, onClose }: { guide: GuideKey; madhhab: Madhhab; setMadhhab: (value: Madhhab) => void; onClose: () => void }) {
  const content = guideContent[guide]
  return <div className="guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title"><div className="guide-modal-head"><div><span className="eyebrow">NOOR LEARNING LIBRARY</span><h2 id="guide-title">{content.heading}</h2><p>{content.subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close guide"><X size={20}/></button></div>{guide !== 'kalimas' && <div className="guide-controls"><label>Fiqh school / Madhhab<select value={madhhab} onChange={(e) => setMadhhab(e.target.value as Madhhab)}><option>Hanafi</option><option>Shafi'i</option><option>Maliki</option><option>Hanbali</option></select></label><span><ShieldCheck size={15}/> Selected: {madhhab}</span></div>}{guide !== 'kalimas' && <div className="guide-school-note"><Info size={16}/><p>{madhhab === 'Hanafi' ? 'The Salah walkthrough uses a common Hanafi teaching sequence. Other recognised details may still vary by teacher and local scholarly authority.' : `You selected ${madhhab}. The core steps are shared, but this preview does not yet provide a complete school-specific walkthrough for every subsidiary ruling. Please follow a qualified ${madhhab} teacher for those details.`}</p></div>}<div className="guide-body">{guide === 'kalimas' && <div className="kalima-library">{kalimaData.map((item) => <article className="kalima-card" key={item.name}><div className="kalima-card-top"><div><span className="eyebrow">{item.number} · {item.title}</span><h3>{item.name}</h3></div><button className="copy-arabic" onClick={() => void navigator.clipboard?.writeText(item.arabic)}><Copy size={14}/> Copy Arabic</button></div><p className="kalima-arabic" lang="ar" dir="rtl">{item.arabic}</p><div className="kalima-translation-grid"><div><span>ROMAN ENGLISH · PRONUNCIATION</span><p className="kalima-roman">{item.roman}</p></div><div><span>ENGLISH MEANING</span><p>{item.english}</p></div><div><span>हिंदी अर्थ</span><p lang="hi">{item.hindi}</p></div></div></article>)}</div>}{content.sections.map((section, index) => <details className="guide-section" key={section.title} open={index === 0}><summary><span className="guide-number">{index + 1}</span><span>{section.title}</span></summary><p className="guide-intro">{section.intro}</p><div className="guide-points">{section.points.map((point) => <article className="guide-point" key={point.heading}><h4>{point.heading}</h4><p>{point.body}</p></article>)}</div></details>)}</div><div className="guide-footer"><Info size={16}/><p>School-specific rulings can depend on circumstances and recognised scholarly positions. This educational preview has not yet received formal scholar approval. Verify Arabic text and fiqh details with a qualified teacher before relying on it for worship.</p></div></section></div>
}

const getSearchSuggestions = (query: string) => {
  const all: { label: string; description: string; query: string; tab: Tab; guide?: GuideKey; icon: typeof Sun }[] = [
    { label: 'Prayer Times', description: 'Fajr, Dhuhr, Asr, Maghrib and Isha', query: 'prayer times', tab: 'Overview' as Tab, icon: CalendarDays },
    { label: 'Qibla Direction', description: 'Find the direction towards the Kaaba', query: 'qibla', tab: 'Qibla' as Tab, icon: Compass },
    { label: 'Salah / Namaz Guide', description: 'Niyyah, rak’ahs, recitations and method', query: 'salah', tab: 'Learn' as Tab, guide: 'salah' as GuideKey, icon: BookOpen },
    { label: 'Wudu / Ablution', description: 'Preparation, steps and what invalidates wudu', query: 'wudu', tab: 'Learn' as Tab, guide: 'wudu' as GuideKey, icon: Sparkles },
    { label: 'Ghusl / Full Bath', description: 'When it is required and how to perform it', query: 'ghusl', tab: 'Learn' as Tab, guide: 'ghusl' as GuideKey, icon: Activity },
    { label: 'Six Kalimas', description: 'Arabic, Roman English, English and Hindi', query: 'kalima', tab: 'Learn' as Tab, guide: 'kalimas' as GuideKey, icon: BookOpen },
    { label: 'Surah Al-Fatihah', description: 'Qur’anic recitation used in Salah', query: 'surah al-fatihah', tab: 'Learn' as Tab, guide: 'salah' as GuideKey, icon: BookOpen },
    { label: 'Daily Duas', description: 'Search everyday supplications and meanings', query: 'dua', tab: 'Duas' as Tab, icon: Heart },
    { label: 'Quran · All 114 Surahs', description: 'Search and read Arabic Quran with English meaning', query: 'quran', tab: 'Quran' as Tab, icon: BookText },
  ]
  const q = query.trim().toLowerCase()
  return (q ? all.filter((item) => `${item.label} ${item.description} ${item.query}`.toLowerCase().includes(q)) : all.slice(0, 6))
}

const kalimaData = [
  { number: '01', title: 'THE WORD OF PURITY', name: 'Kalima Tayyibah', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ', roman: 'Lā ilāha illallāhu Muhammadur-Rasūlullāh.', english: 'There is no deity worthy of worship except Allah; Muhammad is the Messenger of Allah.', hindi: 'अल्लाह के सिवा कोई इबादत के योग्य नहीं। मुहम्मद ﷺ अल्लाह के रसूल हैं।' },
  { number: '02', title: 'THE TESTIMONY', name: 'Kalima Shahadah', arabic: 'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ', roman: 'Ash-hadu an lā ilāha illallāhu waḥdahu lā sharīka lah, wa ash-hadu anna Muḥammadan ‘abduhū wa rasūluh.', english: 'I bear witness that there is no deity worthy of worship except Allah alone, without partner, and I bear witness that Muhammad is His servant and Messenger.', hindi: 'मैं गवाही देता हूँ कि अल्लाह के सिवा कोई इबादत के योग्य नहीं। वह अकेला है, उसका कोई साझी नहीं। और मैं गवाही देता हूँ कि मुहम्मद ﷺ उसके बंदे और रसूल हैं।' },
  { number: '03', title: 'THE GLORIFICATION', name: 'Kalima Tamjeed', arabic: 'سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَٰهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ', roman: 'Subḥānallāhi wal-ḥamdu lillāhi wa lā ilāha illallāhu wallāhu akbar, wa lā ḥawla wa lā quwwata illā billāhil-‘Aliyyil-‘Aẓīm.', english: 'Glory be to Allah; all praise belongs to Allah. There is no deity worthy of worship except Allah, and Allah is the Greatest. There is no might or power except through Allah, the Most High, the Most Great.', hindi: 'अल्लाह हर कमी से पाक है, सारी प्रशंसा अल्लाह के लिए है। अल्लाह के सिवा कोई इबादत के योग्य नहीं और अल्लाह सबसे महान है। नेक काम की ताकत और बुराई से बचने की शक्ति अल्लाह ही की मदद से है।' },
  { number: '04', title: 'THE ONENESS', name: 'Kalima Tauheed', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ حَيٌّ لَا يَمُوتُ أَبَدًا أَبَدًا، ذُو الْجَلَالِ وَالْإِكْرَامِ، بِيَدِهِ الْخَيْرُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', roman: 'Lā ilāha illallāhu waḥdahū lā sharīka lah, lahul-mulku wa lahul-ḥamd, yuḥyī wa yumīt, wa huwa ḥayyul-lā yamūtu abadan abadā, dhul-jalāli wal-ikrām, biyadihil-khayr, wa huwa ‘alā kulli shay’in qadīr.', english: 'There is no deity worthy of worship except Allah alone, without partner. His is the kingdom and all praise. He gives life and causes death; He is Ever-Living and never dies. He is the Possessor of majesty and honour; all good is in His hand, and He has power over everything.', hindi: 'अल्लाह के सिवा कोई इबादत के योग्य नहीं। वह अकेला है, उसका कोई साझी नहीं। बादशाही और सारी प्रशंसा उसी की है। वही जीवन और मृत्यु देता है। वह हमेशा जीवित है और कभी नहीं मरेगा। सारी भलाई उसी के हाथ में है और वह हर चीज़ पर सामर्थ्य रखता है।' },
  { number: '05', title: 'SEEKING FORGIVENESS', name: 'Kalima Istighfar', arabic: 'أَسْتَغْفِرُ اللَّهَ رَبِّي مِنْ كُلِّ ذَنْبٍ أَذْنَبْتُهُ عَمْدًا أَوْ خَطَأً، سِرًّا أَوْ عَلَانِيَةً، وَأَتُوبُ إِلَيْهِ مِنَ الذَّنْبِ الَّذِي أَعْلَمُ وَمِنَ الذَّنْبِ الَّذِي لَا أَعْلَمُ، إِنَّكَ أَنْتَ عَلَّامُ الْغُيُوبِ وَسَتَّارُ الْعُيُوبِ وَغَفَّارُ الذُّنُوبِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ', roman: 'Astaghfirullāha rabbī min kulli dhanbin adhnabtuhū ‘amdan aw khaṭa’an, sirran aw ‘alāniyah, wa atūbu ilayhi minadh-dhanbilladhī a‘lamu wa minadh-dhanbilladhī lā a‘lam. Innaka anta ‘allāmul-ghuyūbi wa sattārul-‘uyūbi wa ghaffārudh-dhunūb, wa lā ḥawla wa lā quwwata illā billāhil-‘Aliyyil-‘Aẓīm.', english: 'I seek forgiveness from Allah, my Lord, for every sin I have committed knowingly or by mistake, secretly or openly. I turn to Him for the sins I know and those I do not know. You are the Knower of the unseen, the Concealer of faults and the Forgiver of sins. There is no might or power except through Allah, the Most High, the Most Great.', hindi: 'मैं अपने रब अल्लाह से हर उस गुनाह की माफी माँगता हूँ जो मैंने जानबूझकर या भूल से, छिपकर या खुले तौर पर किया। मैं उन गुनाहों से भी तौबा करता हूँ जिन्हें मैं जानता हूँ और जिन्हें नहीं जानता। बेशक तू ग़ैब का जानने वाला, ऐबों को छिपाने वाला और गुनाहों को माफ़ करने वाला है।' },
  { number: '06', title: 'REJECTION OF DISBELIEF', name: 'Kalima Radd-e-Kufr', arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ أَنْ أُشْرِكَ بِكَ شَيْئًا وَأَنَا أَعْلَمُ بِهِ، وَأَسْتَغْفِرُكَ لِمَا لَا أَعْلَمُ بِهِ، تُبْتُ عَنْهُ وَتَبَرَّأْتُ مِنَ الْكُفْرِ وَالشِّرْكِ وَالْكَذِبِ وَالْغِيبَةِ وَالْبِدْعَةِ وَالنَّمِيمَةِ وَالْفَوَاحِشِ وَالْبُهْتَانِ وَالْمَعَاصِي كُلِّهَا، وَأَسْلَمْتُ وَأَقُولُ لَا إِلَٰهَ إِلَّا اللَّهُ مُحَمَّدٌ رَسُولُ اللَّهِ', roman: 'Allāhumma innī a‘ūdhu bika min an ushrika bika shay’an wa ana a‘lamu bih, wa astaghfiruka limā lā a‘lamu bih. Tubtu ‘anhu wa tabarra’tu minal-kufri wash-shirki wal-kidhbi wal-ghībati wal-bid‘ati wan-namīmati wal-fawāḥishi wal-buhtāni wal-ma‘āṣī kullihā, wa aslamtu wa aqūlu lā ilāha illallāhu Muhammadur-Rasūlullāh.', english: 'O Allah, I seek refuge in You from knowingly associating anything with You, and I ask Your forgiveness for what I do not know. I repent and disavow disbelief, associating partners with You, lying, backbiting, innovation, tale-bearing, indecency, slander and all sins. I submit and declare that none is worthy of worship except Allah and Muhammad is the Messenger of Allah.', hindi: 'ऐ अल्लाह! मैं तेरी पनाह माँगता हूँ कि जानबूझकर किसी को तेरा साझी बनाऊँ। और जिस बात को मैं नहीं जानता, उसके लिए तुझसे माफी माँगता हूँ। मैं उससे तौबा करता हूँ और कुफ्र, शिर्क, झूठ, ग़ीबत, बिदअत, चुगली, बेहयाई, झूठे इल्ज़ाम और तमाम गुनाहों से बरी होता हूँ। मैं तेरे सामने समर्पित होता हूँ और गवाही देता हूँ कि अल्लाह के सिवा कोई इबादत के योग्य नहीं और मुहम्मद ﷺ अल्लाह के रसूल हैं।' },
]

type Dua = { title: string; category: string; arabic: string; transliteration: string; translation: string; reference: string }
type UnknownRecord = Record<string, unknown>
function extractDuaRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  const obj = value as UnknownRecord
  for (const key of ['duas', 'results', 'items', 'data']) {
    const found = obj[key]
    if (Array.isArray(found)) return found
    if (found && typeof found === 'object') { const nested = extractDuaRecords(found); if (nested.length) return nested }
  }
  return []
}
function normalizeDua(value: unknown): Dua | null {
  if (!value || typeof value !== 'object') return null
  const item = value as UnknownRecord
  const text = (...keys: string[]) => { for (const key of keys) { const v = item[key]; if (typeof v === 'string' && v.trim()) return v.trim() } return '' }
  const title = text('title', 'name', 'title_en', 'english_title') || 'Dua'
  const arabic = text('arabic', 'arabic_text', 'text_ar', 'dua_arabic')
  const translation = text('translation', 'meaning', 'english', 'translation_en', 'text_en')
  if (!arabic && !translation) return null
  return { title, category: text('category', 'category_name') || 'DUA', arabic, transliteration: text('transliteration', 'transliteration_en', 'roman') || '', translation, reference: text('reference', 'source', 'hadith_reference') || 'Source reference not supplied by API' }
}

const duas = [
  { title: 'Dua before sleeping', category: 'DAILY LIFE', arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', transliteration: 'Bismika Allahumma amutu wa ahya', translation: 'In Your name, O Allah, I die and I live.', reference: 'Sahih al-Bukhari 6324' },
  { title: 'Dua upon waking', category: 'DAILY LIFE', arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ', transliteration: 'Alhamdu lillahil-ladhi ahyana ba’da ma amatana wa ilayhin-nushur', translation: 'All praise is for Allah who gave us life after causing us to die, and to Him is the resurrection.', reference: 'Sahih al-Bukhari 6312' },
  { title: 'Dua for beneficial knowledge', category: 'SEEKING KNOWLEDGE', arabic: 'رَبِّ زِدْنِي عِلْمًا', transliteration: 'Rabbi zidni ilma', translation: 'My Lord, increase me in knowledge.', reference: 'Qur’an 20:114' },
]
