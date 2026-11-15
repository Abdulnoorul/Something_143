import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, BookText, ChevronRight, LoaderCircle, Search, X } from 'lucide-react'

type Surah = { number: number; name: string; englishName: string; englishNameTranslation: string; numberOfAyahs: number; revelationType: string }
type Ayah = { numberInSurah: number; text: string }
type SurahContent = { metadata: Surah; arabic: Ayah[]; english: Ayah[] }
type ApiEnvelope<T> = { code?: number; status?: string; data?: T }
type Edition = { ayahs: Ayah[] }

const API = 'https://api.alquran.cloud/v1'

export default function QuranLibrary() {
  const [surahs, setSurahs] = useState<Surah[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SurahContent | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingSurah, setLoadingSurah] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API}/surah`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(`Quran API returned ${response.status}`); return response.json() as Promise<ApiEnvelope<Surah[]>> })
      .then(payload => { if (!payload.data?.length) throw new Error('The Surah list was empty.'); setSurahs(payload.data); setError('') })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load Surah list.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingList(false) })
    return () => controller.abort()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q) return surahs
    return surahs.filter(s => `${s.number} ${s.name} ${s.englishName} ${s.englishNameTranslation} ${s.revelationType}`.toLocaleLowerCase().includes(q))
  }, [query, surahs])

  async function openSurah(surah: Surah) {
    setLoadingSurah(true); setError(''); setSelected(null)
    try {
      const response = await fetch(`${API}/surah/${surah.number}/editions/quran-uthmani,en.sahih`)
      if (!response.ok) throw new Error(`Unable to load Surah ${surah.number} (${response.status}).`)
      const payload = await response.json() as ApiEnvelope<Edition[]>
      const editions = payload.data
      if (!editions || editions.length < 2) throw new Error('The Quran service returned an unexpected response.')
      setSelected({ metadata: surah, arabic: editions[0].ayahs ?? [], english: editions[1].ayahs ?? [] })
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load this Surah.') }
    finally { setLoadingSurah(false) }
  }

  return <section className="page-section quran-library-page">
    <div className="section-heading"><div><span className="eyebrow">THE NOBLE QURAN</span><h2>{selected ? selected.metadata.englishName : 'Quran · 114 Surahs'}</h2><p className="muted">{selected ? `${selected.metadata.name} · ${selected.metadata.numberOfAyahs} verses · ${selected.metadata.revelationType}` : 'Search every Surah by number, Arabic name, English name or meaning. Open any Surah to read Arabic and English verse meanings.'}</p></div></div>
    {selected ? <>
      <div className="quran-reader-toolbar"><button className="text-button" onClick={() => setSelected(null)}><ArrowLeft size={16}/> All Surahs</button><span className="quran-meta">Surah {selected.metadata.number} of 114</span></div>
      <div className="quran-verses">{selected.arabic.map((ayah, index) => <article className="quran-ayah card" key={`${selected.metadata.number}:${ayah.numberInSurah}`}><div className="ayah-number">{ayah.numberInSurah}</div><p className="quran-arabic" lang="ar" dir="rtl">{ayah.text}</p><p className="quran-translation">{selected.english[index]?.text ?? 'English meaning is unavailable for this verse.'}</p></article>)}</div>
      <p className="content-disclaimer">Arabic text: AlQuran Cloud · English meaning: Saheeh International edition (en.sahih). Translation is an interpretation of the meaning, not a replacement for the Arabic Quran.</p>
    </> : <>
      <div className="quran-search-row"><div className="search-box quran-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search: Al-Fatihah, الرحمن, mercy, 2…" aria-label="Search all 114 Surahs"/>{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={16}/></button>}</div><span className="quran-count">{filtered.length} / 114 Surahs</span></div>
      {error && <div className="error-banner">{error} <button onClick={() => window.location.reload()}>Retry</button></div>}
      {loadingList ? <div className="quran-loading"><LoaderCircle className="spin"/> Loading all 114 Surahs…</div> : <div className="surah-grid">{filtered.map(surah => <button className="surah-card card" key={surah.number} onClick={() => void openSurah(surah)}><span className="surah-index">{surah.number}</span><span className="surah-name-block"><strong>{surah.englishName}</strong><small>{surah.englishNameTranslation} · {surah.numberOfAyahs} Ayahs</small></span><span className="surah-arabic-name" lang="ar" dir="rtl">{surah.name}</span><ChevronRight size={16}/></button>)}</div>}
      {loadingSurah && <div className="quran-loading overlay"><LoaderCircle className="spin"/> Loading Surah text and translation…</div>}
      {!loadingList && filtered.length === 0 && <div className="empty-search card"><BookOpen size={24}/><strong>No Surah found</strong><span>Try the Surah number, Arabic name or English spelling.</span></div>}
    </>}
    <div className="quran-source-note"><BookText size={16}/><span>Quran text and chapter data are loaded from AlQuran Cloud API. Internet connection is required to fetch the list and verses.</span></div>
  </section>
}
