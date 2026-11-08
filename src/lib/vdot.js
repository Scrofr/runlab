/**
 * VDOT / Jack Daniels running calculations
 * Pure functions – easy to adjust later
 *
 * Reference: Daniels' Running Formula
 * Simplified tables + interpolation for practical use.
 */

const VDOT_TABLE = {
  5000: [
    { v: 30, t: 1800 }, { v: 35, t: 1560 }, { v: 40, t: 1380 },
    { v: 45, t: 1230 }, { v: 50, t: 1110 }, { v: 55, t: 1005 },
    { v: 60, t: 915 }, { v: 65, t: 840 }, { v: 70, t: 780 },
    { v: 75, t: 720 }, { v: 80, t: 675 }, { v: 85, t: 630 }
  ],
  10000: [
    { v: 30, t: 3720 }, { v: 35, t: 3240 }, { v: 40, t: 2880 },
    { v: 45, t: 2580 }, { v: 50, t: 2340 }, { v: 55, t: 2130 },
    { v: 60, t: 1950 }, { v: 65, t: 1800 }, { v: 70, t: 1650 },
    { v: 75, t: 1530 }, { v: 80, t: 1410 }, { v: 85, t: 1320 }
  ],
  21097: [
    { v: 30, t: 8280 }, { v: 35, t: 7200 }, { v: 40, t: 6360 },
    { v: 45, t: 5700 }, { v: 50, t: 5160 }, { v: 55, t: 4710 },
    { v: 60, t: 4320 }, { v: 65, t: 3960 }, { v: 70, t: 3660 },
    { v: 75, t: 3390 }, { v: 80, t: 3150 }, { v: 85, t: 2940 }
  ],
  42195: [
    { v: 30, t: 17400 }, { v: 35, t: 15120 }, { v: 40, t: 13380 },
    { v: 45, t: 12000 }, { v: 50, t: 10860 }, { v: 55, t: 9900 },
    { v: 60, t: 9120 }, { v: 65, t: 8400 }, { v: 70, t: 7800 },
    { v: 75, t: 7260 }, { v: 80, t: 6780 }, { v: 85, t: 6360 }
  ]
}

export function estimateVDOT(distanceMeters, timeSeconds) {
  if (!distanceMeters || !timeSeconds || timeSeconds <= 0) return 0
  const distances = Object.keys(VDOT_TABLE).map(Number).sort((a, b) => a - b)
  let closest = distances[0]
  let minDiff = Math.abs(distanceMeters - closest)
  for (const d of distances) {
    const diff = Math.abs(distanceMeters - d)
    if (diff < minDiff) { minDiff = diff; closest = d }
  }
  const table = VDOT_TABLE[closest]
  const ratio = distanceMeters / closest
  const adjustedTime = timeSeconds / Math.pow(ratio, 1.06)
  if (adjustedTime >= table[0].t) return table[0].v
  if (adjustedTime <= table[table.length - 1].t) return table[table.length - 1].v
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i]
    const b = table[i + 1]
    if (adjustedTime <= a.t && adjustedTime >= b.t) {
      const frac = (a.t - adjustedTime) / (a.t - b.t)
      return Math.round((a.v + frac * (b.v - a.v)) * 10) / 10
    }
  }
  return 40
}

export function pacesFromVDOT(vdot) {
  if (!vdot || vdot < 20) vdot = 30
  const E = 6.5 - (vdot - 30) * 0.055
  const M = 5.4 - (vdot - 30) * 0.048
  const T = 4.85 - (vdot - 30) * 0.045
  const I = 4.35 - (vdot - 30) * 0.042
  const R = 3.95 - (vdot - 30) * 0.04
  return {
    E: Math.max(3.5, Math.round(E * 100) / 100),
    M: Math.max(3.0, Math.round(M * 100) / 100),
    T: Math.max(2.8, Math.round(T * 100) / 100),
    I: Math.max(2.5, Math.round(I * 100) / 100),
    R: Math.max(2.3, Math.round(R * 100) / 100)
  }
}

export function predictTime(distance1m, time1s, distance2m) {
  if (!distance1m || !time1s || !distance2m) return 0
  return time1s * Math.pow(distance2m / distance1m, 1.06)
}

export function levelFromVDOT(vdot) {
  if (vdot < 30) return { level: 1, label: 'Débutant' }
  if (vdot < 35) return { level: 2, label: 'Novice' }
  if (vdot < 40) return { level: 3, label: 'Intermédiaire' }
  if (vdot < 45) return { level: 4, label: 'Confirmé' }
  if (vdot < 50) return { level: 5, label: 'Avancé' }
  if (vdot < 55) return { level: 6, label: 'Compétiteur' }
  if (vdot < 60) return { level: 7, label: 'Élite amateur' }
  if (vdot < 65) return { level: 8, label: 'Élite' }
  if (vdot < 70) return { level: 9, label: 'National' }
  return { level: 10, label: 'International' }
}

export function formatTime(sec) {
  if (!sec || sec < 0) return '—'
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatPace(minPerKm) {
  if (!minPerKm || minPerKm <= 0) return '—'
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function parseTime(str) {
  if (!str) return 0
  const parts = str.trim().split(':').map(Number)
  if (parts.some(isNaN)) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

export function trailAdjustedPace(distanceKm, elevationGainM, timeSeconds, coeff = 1.0) {
  if (!distanceKm || !timeSeconds) return { adjustedPace: 0, flatEquivPace: 0, rawPace: 0 }
  const rawPace = (timeSeconds / 60) / distanceKm
  const elevPenaltyMin = (elevationGainM / 100) * coeff
  const adjustedTimeMin = timeSeconds / 60 - elevPenaltyMin
  const flatEquivPace = adjustedTimeMin / distanceKm
  return {
    rawPace: Math.round(rawPace * 100) / 100,
    flatEquivPace: Math.round(flatEquivPace * 100) / 100,
    elevPenaltyMin: Math.round(elevPenaltyMin * 10) / 10,
    adjustedPace: Math.round(rawPace * 100) / 100
  }
}

export function trailPaceRanges(flatEquivPace) {
  return {
    climb: Math.round(flatEquivPace * 1.3 * 100) / 100,
    flat: Math.round(flatEquivPace * 100) / 100,
    descent: Math.round(flatEquivPace * 0.85 * 100) / 100
  }
}
