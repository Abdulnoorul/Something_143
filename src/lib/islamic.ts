export type Madhhab = 'Hanafi' | 'Shafi\'i' | 'Maliki' | 'Hanbali'
export type Prayer = { name: string; time: string }

export const METHODS = [
  { id: 1, label: 'University of Islamic Sciences, Karachi' },
  { id: 2, label: 'Islamic Society of North America (ISNA)' },
  { id: 3, label: 'Muslim World League' },
  { id: 4, label: 'Umm Al-Qura, Makkah' },
  { id: 5, label: 'Egyptian General Authority' },
]

export async function getPrayerTimes(city: string, country: string, method: number, madhhab: Madhhab): Promise<{ prayers: Prayer[]; hijri: string; readableDate: string }> {
  const school = madhhab === 'Hanafi' ? 1 : 0
  const date = new Date()
  const datePath = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`
  const url = new URL(`https://api.aladhan.com/v1/timingsByCity/${datePath}`)
  url.search = new URLSearchParams({ city, country, method: String(method), school: String(school) }).toString()
  const response = await fetch(url)
  if (!response.ok) throw new Error('Prayer-time service is currently unavailable.')
  const json = await response.json()
  if (json.code !== 200 || !json.data?.timings) throw new Error('Prayer times could not be found for this location.')
  const t = json.data.timings
  return {
    prayers: [
      { name: 'Fajr', time: t.Fajr }, { name: 'Sunrise', time: t.Sunrise }, { name: 'Dhuhr', time: t.Dhuhr },
      { name: 'Asr', time: t.Asr }, { name: 'Maghrib', time: t.Maghrib }, { name: 'Isha', time: t.Isha },
    ],
    hijri: `${json.data.date.hijri.day} ${json.data.date.hijri.month.en} ${json.data.date.hijri.year}`,
    readableDate: json.data.date.readable,
  }
}

export function qiblaBearing(lat: number, lon: number): number {
  const kaabaLat = 21.4225 * Math.PI / 180
  const kaabaLon = 39.8262 * Math.PI / 180
  const userLat = lat * Math.PI / 180
  const deltaLon = kaabaLon - lon * Math.PI / 180
  const y = Math.sin(deltaLon)
  const x = Math.cos(userLat) * Math.tan(kaabaLat) - Math.sin(userLat) * Math.cos(deltaLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}
