import { SLOTS } from "./constants";

export const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

export function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", opts);
}

export function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Turn the form values into the exact JSON the backend expects. */
export function toPayload(p) {
  const cap = p.budget_cap_inr === "" || p.budget_cap_inr == null ? null : Number(p.budget_cap_inr);
  return {
    vibe: p.vibe,
    destination: p.destination?.trim() || null,
    start_date: p.start_date,
    duration_days: Number(p.duration_days),
    budget: p.budget,
    party: p.party,
    travelers: Number(p.travelers),
    pace: p.pace,
    interests: p.interests || [],
    budget_cap_inr: cap,
    notes: p.notes?.trim() || null,
    use_demo: Boolean(p.use_demo),
  };
}

/** Turn backend preferences back into form values. */
export function fromPayload(p) {
  return {
    vibe: p.vibe,
    destination: p.destination || "",
    start_date: p.start_date,
    duration_days: p.duration_days,
    budget: p.budget,
    party: p.party,
    travelers: p.travelers,
    pace: p.pace,
    interests: p.interests || [],
    budget_cap_inr: p.budget_cap_inr ?? "",
    notes: p.notes || "",
    use_demo: Boolean(p.use_demo),
  };
}

/** Returns { field: message } - empty object means valid. */
export function validatePrefs(p) {
  const e = {};
  if (!p.vibe) e.vibe = "Choose a travel vibe.";
  const days = Number(p.duration_days);
  if (!Number.isInteger(days) || days < 1 || days > 14) e.duration_days = "Choose between 1 and 14 days.";
  if (!p.start_date) e.start_date = "Pick a start date.";
  else if (p.start_date < todayISO()) e.start_date = "The start date can't be in the past.";
  const t = Number(p.travelers);
  if (!Number.isInteger(t) || t < 1 || t > 20) e.travelers = "Travellers must be between 1 and 20.";
  if ((p.destination || "").length > 80) e.destination = "Keep the destination under 80 characters.";
  if (p.budget_cap_inr !== "" && p.budget_cap_inr != null) {
    const c = Number(p.budget_cap_inr);
    if (!Number.isFinite(c) || c < 1000) e.budget_cap_inr = "Enter at least ₹1,000, or leave this empty.";
  }
  if ((p.notes || "").length > 600) e.notes = "Keep notes under 600 characters.";
  return e;
}

/** Per-day and cumulative per-person cost, ending exactly on the backend total. */
export function costTimeline(itin) {
  const b = itin.budget;
  const dayTotals = itin.days.map((d) => d.day_total_inr);
  const sumDays = dayTotals.reduce((a, c) => a + c, 0) || 1;
  const stayPerNight = itin.stays?.[0]?.price_per_night_inr || 0;
  let cumDay = 0;
  let prevMisc = 0;
  let cumulative = 0;
  return itin.days.map((d, i) => {
    cumDay += d.day_total_inr;
    const miscCum = Math.round((b.transport_misc_inr * cumDay) / sumDays);
    const misc = miscCum - prevMisc;
    prevMisc = miscCum;
    const stay = i < b.nights ? stayPerNight : 0;
    const total = d.day_total_inr + misc + stay;
    cumulative += total;
    return { day: d.day_number, date: d.date, activities: d.day_total_inr, misc, stay, total, cumulative };
  });
}

export function buildMarkdown(itin, prefs) {
  const L = [];
  const b = itin.budget;
  L.push(`# ${itin.destination}${itin.country ? ", " + itin.country : ""}`);
  if (itin.days[0]?.date) L.push(`${fmtDate(itin.days[0].date)} to ${fmtDate(itin.days.at(-1).date)} (${itin.days.length} days)`);
  L.push("", itin.summary, "", `> ${itin.disclaimer}`, "");
  L.push("## Budget estimate", "");
  L.push(`- Accommodation (${b.nights} nights): ${inr(b.accommodation_inr)}`);
  L.push(`- Food: ${inr(b.food_inr)}`);
  L.push(`- Activities: ${inr(b.activities_inr)}`);
  L.push(`- Transport and extras (rough allowance): ${inr(b.transport_misc_inr)}`);
  L.push(`- **Total per person: ${inr(b.total_per_person_inr)}**`);
  L.push(`- **Total for ${b.travelers} traveller(s): ${inr(b.total_group_inr)}**`, "");
  if (itin.stays?.length) {
    L.push("## Accommodation ideas (not bookings)", "");
    itin.stays.forEach((s) => L.push(`- ${s.name} (${s.type}), about ${inr(s.price_per_night_inr)} per person per night. ${s.note}`));
    L.push("");
  }
  itin.days.forEach((d) => {
    L.push(`## Day ${d.day_number}: ${d.theme}${d.date ? " (" + fmtDate(d.date) + ")" : ""}`, "", `Area: ${d.area_focus}. ${d.note}`, "");
    SLOTS.forEach((s) => {
      const a = d[s.id];
      const local = a.estimated_cost_local ? ` / ${a.estimated_cost_local}` : "";
      L.push(`- **${s.label}: ${a.title}** (${inr(a.estimated_cost_inr)}${local}) - ${a.description}`);
    });
    L.push("", `Day total (estimate): ${inr(d.day_total_inr)}`, "");
  });
  if (itin.tips?.length) {
    L.push("## Tips", "");
    itin.tips.forEach((t) => L.push(`- ${t}`));
  }
  return L.join("\n");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s) => (s || "trip").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";
