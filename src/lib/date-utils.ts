/** French weekday abbreviations (index = getDay(), 0=Sunday) */
const FR_WEEKDAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const FR_WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const FR_MONTHS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Deterministic French short date format (timezone-independent).
 * Returns e.g. "sam. 2" — same result on server and client.
 */
export function formatFrShort(date: Date): string {
  const day = FR_WEEKDAYS_SHORT[date.getDay()];
  const num = date.getDate();
  return `${day} ${num}`;
}

/**
 * Deterministic French long date format (timezone-independent).
 * Returns e.g. "samedi 2 mai" — same result on server and client.
 */
export function formatFrLong(date: Date): string {
  const weekday = FR_WEEKDAYS_LONG[date.getDay()];
  const num = date.getDate();
  const month = FR_MONTHS_LONG[date.getMonth()];
  return `${weekday} ${num} ${month}`;
}
