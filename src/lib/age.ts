export function getPreciseAge(birthDateInput: string | Date, now: Date = new Date(), precision: number = 9): string {
  const birthDate = typeof birthDateInput === 'string' ? new Date(birthDateInput) : birthDateInput;
  const bY = birthDate.getFullYear();
  const bM = birthDate.getMonth();
  const bD = birthDate.getDate();
  const bH = birthDate.getHours();
  const bMin = birthDate.getMinutes();
  const bS = birthDate.getSeconds();
  const bMs = birthDate.getMilliseconds();
  const nY = now.getFullYear();

  const thisBday = new Date(nY, bM, bD, bH, bMin, bS, bMs);
  const hadBday = now.getTime() >= thisBday.getTime();

  const lastBday = hadBday ? thisBday : new Date(nY - 1, bM, bD, bH, bMin, bS, bMs);
  const nextBday = hadBday ? new Date(nY + 1, bM, bD, bH, bMin, bS, bMs) : thisBday;

  const years = hadBday ? nY - bY : nY - bY - 1;
  const fraction = (now.getTime() - lastBday.getTime()) / (nextBday.getTime() - lastBday.getTime());

  return (years + fraction).toFixed(precision);
}

/** Keeps the element's text at the current age, using the birth date from its `data-birth-date`. */
export function initAgeTicker(elementId: string, precision: number = 9): void {
  const el = document.getElementById(elementId);
  const birthDate = el?.dataset.birthDate;
  if (!el || !birthDate) return;

  // requestAnimationFrame pauses automatically while the tab is hidden
  const update = () => {
    el.textContent = getPreciseAge(birthDate, new Date(), precision);
    requestAnimationFrame(update);
  };
  update();
}
