// ISO-8601 week numbering: Monday–Sunday weeks, week 1 is the week
// containing the year's first Thursday. This is how Recess names weeks
// ("W35", "W36", ...) everywhere -- rosters, production planning, stock
// ordering, and the revenue sheet -- so it's the one place that
// computes a week number from a date; everything that needs a "W37"
// label should go through this rather than re-deriving its own.

export function isoWeekInfo(dateStr) {
  const d = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const dayNum = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - dayNum + 3); // Thursday of this ISO week
  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const firstThursdayDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNum + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return { week, isoYear };
}

export function isoWeekLabel(dateStr) {
  return `W${isoWeekInfo(dateStr).week}`;
}
