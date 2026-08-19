export function cleanStopName(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/bamuevo/g, 'barnuevo')
    .replace(/franciso/g, 'francisco')
    .replace(/rotonda las casas/g, 'barrio de las casas')
    .replace(/gaya nuno \/? santa barbara/g, 'gaya nuno hospital')
    .replace(/gaya nuno \/? residencia/g, 'gaya nuno hospital')
    .replace(/\best\.?\b/g, 'estacion')
    .replace(/\be\.\s*/g, 'eduardo ')
    .replace(/\bm\.\s*/g, 'mariano ')
    .replace(/\bh\.\s*/g, 'virgen ')
    .replace(/\bdr\.?\s*/g, 'doctor ')
    .replace(/\bcam\b/g, 'camino')
    .replace(/\bd\.\s*/g, 'don ')
    .replace(/\bctra\.?\b/g, 'carretera')
    .replace(/\bpza\.?\b/g, 'plaza')
    .replace(/\bhospitales?\b/g, 'hospital')
    .replace(/\bresidencia\b/g, 'hospital')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripStopPrefix(s) {
  return s.replace(/^(calle|plaza|avenida|avda|camino|carretera)\s*/, '');
}

function extractDirectionSuffix(name) {
  const match = String(name).match(/\(([AB])\)\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Robustly checks if two stop names represent the exact same physical stop
 */
export function areStopsMatching(name1, name2) {
  const dir1 = extractDirectionSuffix(name1);
  const dir2 = extractDirectionSuffix(name2);
  if (dir1 && dir2 && dir1 !== dir2) return false;

  const norm1 = cleanStopName(name1);
  const norm2 = cleanStopName(name2);

  if (norm1 === norm2) return true;

  const s1 = stripStopPrefix(norm1);
  const s2 = stripStopPrefix(norm2);

  if (s1 === s2) return true;

  const w1 = s1.split(' ').filter(Boolean);
  const w2 = s2.split(' ').filter(Boolean);

  // Single letter/short token stops (e.g. Calle N, Calle D, Calle E, Calle H, Calle K, Calle J)
  if (w1.length === 1 && w1[0].length <= 2) {
    return w2.length === 1 && w2[0] === w1[0];
  }
  if (w2.length === 1 && w2[0].length <= 2) {
    return w1.length === 1 && w1[0] === w2[0];
  }

  const sig1 = w1.filter(w => w.length >= 3);
  const sig2 = w2.filter(w => w.length >= 3);

  const diff1 = sig1.filter(w => !sig2.includes(w));
  const diff2 = sig2.filter(w => !sig1.includes(w));

  // If both names have unique significant location words, they are distinct stops!
  if (diff1.length > 0 && diff2.length > 0) return false;
  if (sig1.length === sig2.length && diff1.length === 0) return true;

  if (s1.length >= 5 && s2.length >= 5) {
    if ((s1.includes(s2) || s2.includes(s1)) && diff1.length === 0 && diff2.length === 0) return true;
  }

  const overlap = sig1.filter(w => sig2.includes(w)).length;
  return overlap >= Math.max(sig1.length, sig2.length);
}

/**
 * Finds the best matching stop in an Avanza Schedule array
 */
export function findMatchingStopInSchedule(avanzaStops, soriaStopObj) {
  if (!avanzaStops || avanzaStops.length === 0 || !soriaStopObj) return null;

  const dir = extractDirectionSuffix(soriaStopObj.name);
  const matches = avanzaStops.filter(s => areStopsMatching(s.name, soriaStopObj.name));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  if (dir) {
    const exactDir = matches.find(s => extractDirectionSuffix(s.name) === dir);
    if (exactDir) return exactDir;
  }

  return matches[0];
}

/**
 * Resolves a schedule stop via its direct ID (for future direct matches if Avanza exposes IDs in schedules)
 */
export function resolveScheduleStopById(scheduleStops, stopId) {
  // Currently Avanza schedules don't have IDs directly, but when they do, this will be the canonical resolver.
  return scheduleStops.find(s => String(s.id) === String(stopId)) || null;
}

/**
 * Resolves a schedule stop via name-based fallback (current behavior)
 */
export function resolveScheduleStopByNameFallback(scheduleStops, soriaStopObj) {
  return findMatchingStopInSchedule(scheduleStops, soriaStopObj);
}
