import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Bed, Calendar, ChevronLeft, ChevronRight, Clock, Download, FileText, Heart, IndianRupee,
  MapPin, Pencil, RefreshCw, Save, Shuffle, Users, Wand2, Map as MapIcon,
} from "lucide-react";
import { api } from "../api";
import { useApp, go } from "../ctx";
import { SLOTS } from "../constants";
import { Banner, Empty, Spinner } from "../components/ui";
import Icon from "../components/Icon";
import { buildMarkdown, costTimeline, downloadBlob, fmtDate, inr, slug } from "../utils";

export default function ItineraryView() {
  const { current, store, updateItinerary, editPreferences, saveTrip, toast } = useApp();
  const [dayIdx, setDayIdx] = useState(0);
  const [busy, setBusy] = useState(null); // e.g. "day-2", "slot-2-lunch", "save", "pdf"
  const [placeIds, setPlaceIds] = useState({}); // "Destination|Title" -> saved place id

  const destination = current?.itinerary.destination;
  useEffect(() => {
    if (!current) return;
    let live = true;
    store
      .listPlaces()
      .then((list) => {
        if (!live) return;
        const map = {};
        list.forEach((p) => (map[`${p.destination}|${p.name}`] = p.id));
        setPlaceIds(map);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [store, destination]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeline = useMemo(() => (current ? costTimeline(current.itinerary) : []), [current]);

  if (!current) {
    return (
      <div className="page">
        <Empty icon={MapIcon} title="No trip is open" action={<div className="row center"><button className="btn primary" onClick={() => go("/plan")}>Plan a trip</button><button className="btn ghost" onClick={() => go("/dashboard")}>My trips</button></div>}>
          Create a new itinerary or open a saved one from your dashboard.
        </Empty>
      </div>
    );
  }

  const { itinerary: itin, preferences: prefs } = current;
  const idx = Math.min(dayIdx, itin.days.length - 1);
  const day = itin.days[idx];
  const isAI = itin.mode === "ai";

  async function run(key, work, okMessage) {
    setBusy(key);
    try {
      const out = await work();
      if (out) updateItinerary(out);
      if (okMessage) toast(okMessage, "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  const regenDay = () => run(`day-${day.day_number}`, () => api.regenerateDay(prefs, itin, day.day_number), `Day ${day.day_number} re-planned. Other days were not changed.`);
  const replaceSlot = (slot) => run(`slot-${day.day_number}-${slot}`, () => api.replaceActivity(prefs, itin, day.day_number, slot), "Activity replaced.");

  async function save() {
    setBusy("save");
    try {
      const created = await saveTrip();
      toast(created ? "Trip saved. Find it on your dashboard." : "Trip updated.", "success");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const blob = await api.exportPdf(itin, prefs);
      downloadBlob(blob, `itinerary-${slug(itin.destination)}.pdf`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  function exportMd() {
    downloadBlob(new Blob([buildMarkdown(itin, prefs)], { type: "text/markdown;charset=utf-8" }), `itinerary-${slug(itin.destination)}.md`);
  }

  async function togglePlace(slot, act) {
    const key = `${itin.destination}|${act.title}`;
    try {
      if (placeIds[key]) {
        await store.removePlace(placeIds[key]);
        setPlaceIds(({ [key]: _gone, ...rest }) => rest);
        toast("Removed from saved places.", "info");
      } else {
        const row = await store.addPlace({
          name: act.title,
          description: act.description,
          destination: itin.destination,
          area: act.area,
          slot,
          cost_inr: act.estimated_cost_inr,
          trip_id: current.saved ? current.id : null,
        });
        if (row) setPlaceIds((m) => ({ ...m, [key]: row.id }));
        toast(row ? "Saved to your places." : "Already in your saved places.", "success");
      }
    } catch (e) {
      toast(e.message, "error");
    }
  }

  const last = itin.days.at(-1);

  return (
    <div className="page">
      <section className="trip-hero">
        <div className="trip-hero-top">
          <button className="icon-btn dark" onClick={() => go("/dashboard")} aria-label="Back to dashboard"><ArrowLeft size={18} /></button>
          <span className={`badge ${isAI ? "ai" : "demo"}`}>{isAI ? "AI-generated" : "Demo itinerary"}</span>
          {current.example && <span className="badge demo">Example</span>}
          {!current.saved || current.dirty ? <span className="badge unsaved">Unsaved changes</span> : <span className="badge saved">Saved</span>}
        </div>
        <h1>{itin.destination}</h1>
        <p className="hero-sub">
          {itin.country && <>{itin.country} · </>}
          {fmtDate(itin.days[0].date)} – {fmtDate(last.date)} · {itin.days.length} days
        </p>
        <div className="hero-actions-row">
          <button className="btn light" onClick={editPreferences}><Pencil size={16} /> Edit preferences</button>
          <button className="btn primary" onClick={save} disabled={busy === "save"}>
            {busy === "save" ? <Spinner /> : <Save size={16} />} {current.saved ? "Update saved trip" : "Save trip"}
          </button>
          <button className="btn light" onClick={exportPdf} disabled={busy === "pdf"}>
            {busy === "pdf" ? <Spinner /> : <Download size={16} />} PDF
          </button>
          <button className="btn light" onClick={exportMd}><FileText size={16} /> Markdown</button>
        </div>
      </section>

      <div className="stack">
        <Banner kind="warn" title={isAI ? "AI-generated estimates" : "Demo data and estimates"}>{itin.disclaimer}</Banner>
        {itin.warnings?.map((w) => <Banner key={w} kind="info">{w}</Banner>)}
      </div>

      <div className="trip-layout">
        <aside className="trip-aside">
          <div className="card">
            <h3 className="card-title">Trip summary</h3>
            <p className="summary-text">{itin.summary}</p>
            <ul className="facts">
              <li><Calendar size={16} /><span>{fmtDate(itin.days[0].date)} – {fmtDate(last.date)}</span></li>
              <li><Users size={16} /><span>{prefs.travelers} traveller{prefs.travelers === 1 ? "" : "s"} · {prefs.party}</span></li>
              <li><Wand2 size={16} /><span>{prefs.vibe} · {prefs.pace} · {prefs.budget}</span></li>
              {itin.currency.code !== "INR" && (
                <li><IndianRupee size={16} /><span>1 {itin.currency.code} ≈ ₹{itin.currency.approx_inr_per_unit} <em>(rough rate)</em></span></li>
              )}
            </ul>
            {prefs.interests?.length > 0 && <div className="chips tight">{prefs.interests.map((i) => <span key={i} className="mini-chip">{i}</span>)}</div>}
          </div>

          <BudgetCard itin={itin} timeline={timeline} activeDay={idx} onPick={setDayIdx} />

          {itin.stays?.length > 0 && (
            <div className="card">
              <h3 className="card-title"><Bed size={16} /> Where to stay</h3>
              <p className="muted small">Ideas only, not bookings. Price is per person per night.</p>
              <ul className="stays">
                {itin.stays.map((s, i) => (
                  <li key={s.name + i}>
                    <strong>{s.name}</strong>
                    <span>{s.type}{s.area ? ` · ${s.area}` : ""}</span>
                    <em>≈ {inr(s.price_per_night_inr)} / night{i === 0 ? " (used in budget)" : ""}</em>
                    {s.note && <small>{s.note}</small>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {itin.tips?.length > 0 && (
            <div className="card">
              <h3 className="card-title">Tips</h3>
              <ul className="tips">{itin.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </aside>

        <section className="trip-main">
          <div className="day-tabs" role="tablist" aria-label="Days">
            {itin.days.map((d, i) => (
              <button key={d.day_number} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => setDayIdx(i)}>
                <small>Day</small><strong>{d.day_number}</strong>
              </button>
            ))}
          </div>

          <article className="card day-card">
            <header className="day-head">
              <span className="day-badge">{String(day.day_number).padStart(2, "0")}</span>
              <div className="day-title">
                <small>{fmtDate(day.date, { weekday: "long", day: "numeric", month: "short" })}</small>
                <h2>{day.theme || `Day ${day.day_number}`}</h2>
                {day.area_focus && <span className="area-chip"><MapPin size={13} /> {day.area_focus}</span>}
              </div>
              <div className="day-actions">
                <div className="day-total"><small>Day total (est.)</small><strong>{inr(day.day_total_inr)}</strong></div>
                <button className="btn ghost sm" onClick={regenDay} disabled={busy !== null}>
                  {busy === `day-${day.day_number}` ? <Spinner /> : <RefreshCw size={14} />} Regenerate day
                </button>
              </div>
            </header>
            {day.note && <p className="day-note">{day.note}</p>}

            <div className="slots">
              {SLOTS.map((s) => {
                const a = day[s.id];
                const key = `slot-${day.day_number}-${s.id}`;
                const saved = Boolean(placeIds[`${itin.destination}|${a.title}`]);
                return (
                  <div key={s.id} className={`slot ${busy === key ? "loading" : ""}`}>
                    <div className="slot-label"><Icon name={s.icon} size={16} /> {s.label}</div>
                    <h3>{a.title}</h3>
                    <p>{a.description}</p>
                    <div className="slot-meta">
                      {a.area && <span><MapPin size={13} /> {a.area}</span>}
                      {a.duration && <span><Clock size={13} /> {a.duration}</span>}
                      <span className="cost">
                        {a.estimated_cost_inr > 0 ? <>{inr(a.estimated_cost_inr)}{a.estimated_cost_local && <em> ({a.estimated_cost_local})</em>}</> : "Free / no cost estimated"}
                        <small> est.</small>
                      </span>
                    </div>
                    <div className="slot-actions">
                      <button className="btn ghost xs" onClick={() => replaceSlot(s.id)} disabled={busy !== null}>
                        {busy === key ? <Spinner size={13} /> : <Shuffle size={13} />} Replace
                      </button>
                      <button className={`btn ghost xs ${saved ? "saved" : ""}`} onClick={() => togglePlace(s.id, a)} aria-pressed={saved}>
                        <Heart size={13} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save place"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <div className="day-nav">
            <button className="btn ghost" onClick={() => setDayIdx(idx - 1)} disabled={idx === 0}><ChevronLeft size={16} /> Previous day</button>
            <button className="btn ghost" onClick={() => setDayIdx(idx + 1)} disabled={idx === itin.days.length - 1}>Next day <ChevronRight size={16} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function BudgetCard({ itin, timeline, activeDay, onPick }) {
  const b = itin.budget;
  const total = b.total_per_person_inr || 1;
  const parts = [
    { label: "Stay", value: b.accommodation_inr, cls: "p1" },
    { label: "Food", value: b.food_inr, cls: "p2" },
    { label: "Activities", value: b.activities_inr, cls: "p3" },
    { label: "Transport & extras", value: b.transport_misc_inr, cls: "p4" },
  ];
  const max = timeline.at(-1)?.cumulative || 1;
  const capPct = b.cap_inr ? Math.min(100, Math.round((b.total_group_inr / b.cap_inr) * 100)) : 0;

  return (
    <div className="card budget">
      <h3 className="card-title">Budget tracker</h3>
      <div className="budget-total">
        <small>Estimated total per person</small>
        <strong>{inr(b.total_per_person_inr)}</strong>
        {b.travelers > 1 && <span>{inr(b.total_group_inr)} for {b.travelers} travellers</span>}
      </div>

      <div className="stackbar" role="img" aria-label="Budget breakdown">
        {parts.map((p) => p.value > 0 && <span key={p.label} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${inr(p.value)}`} />)}
      </div>
      <ul className="legend">
        {parts.map((p) => (
          <li key={p.label}><i className={p.cls} />{p.label}<strong>{inr(p.value)}</strong></li>
        ))}
      </ul>

      {b.cap_inr ? (
        <div className={`cap ${b.within_cap ? "ok" : "over"}`}>
          <div className="cap-bar"><span style={{ width: `${capPct}%` }} /></div>
          <small>
            {b.within_cap
              ? `Within your ${inr(b.cap_inr)} limit (${capPct}% used)`
              : `Over your ${inr(b.cap_inr)} limit by ${inr(b.total_group_inr - b.cap_inr)}`}
          </small>
        </div>
      ) : null}

      <h4 className="mini-title">Running total per person</h4>
      <div className="bars" role="group" aria-label="Cumulative cost by day">
        {timeline.map((t, i) => (
          <button key={t.day} className={`bar ${i === activeDay ? "on" : ""}`} onClick={() => onPick(i)} title={`Day ${t.day}: ${inr(t.total)} that day · ${inr(t.cumulative)} so far`}>
            <span style={{ height: `${Math.max(6, (t.cumulative / max) * 100)}%` }} />
            <small>{t.day}</small>
          </button>
        ))}
      </div>
      <p className="muted small">Tap a bar to jump to that day. Includes a rough 12% allowance for local transport and extras.</p>
    </div>
  );
}
