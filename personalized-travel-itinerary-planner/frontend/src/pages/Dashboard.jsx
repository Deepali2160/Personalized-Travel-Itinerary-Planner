import { useEffect, useMemo, useState } from "react";
import { Calendar, Compass, IndianRupee, MapPin, Plus, Search, Trash2, Users, Upload, Luggage } from "lucide-react";
import { useApp } from "../ctx";
import { local, importLocalTrips } from "../store";
import { VIBES } from "../constants";
import { Banner, Empty, Skeleton } from "../components/ui";
import Icon from "../components/Icon";
import { fmtDate, todayISO } from "../utils";

export default function Dashboard() {
  const { store, user, openTrip, openExample, startPlan, toast, logEvent } = useApp();
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let live = true;
    setTrips(null);
    setError(null);
    store.listTrips().then((t) => live && setTrips(t)).catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [store, tick]);

  const stats = useMemo(() => {
    const list = trips || [];
    return {
      total: list.length,
      destinations: new Set(list.map((t) => t.destination)).size,
      upcoming: list.filter((t) => t.start_date >= todayISO()).length,
    };
  }, [trips]);

  const shown = (trips || []).filter((t) => t.destination.toLowerCase().includes(q.trim().toLowerCase()));
  const localCount = user ? local.count() : 0;

  async function remove(trip) {
    if (!window.confirm(`Delete your ${trip.destination} trip? This cannot be undone.`)) return;
    try {
      await store.deleteTrip(trip.id);
      await logEvent("DELETE_TRIP", "trip", trip.id, { destination: trip.destination });
      toast("Trip deleted.", "success");
      setTick((n) => n + 1);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function importTrips() {
    setImporting(true);
    try {
      const n = await importLocalTrips(store);
      toast(`Imported ${n} trip${n === 1 ? "" : "s"} to your account.`, "success");
      setTick((x) => x + 1);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow-sm">Workspace</span>
          <h1>Overview</h1>
        </div>
        <button className="btn primary" onClick={() => startPlan()}><Plus size={18} /> Start new trip</button>
      </div>

      {localCount > 0 && (
        <Banner
          kind="info"
          title={`You have ${localCount} trip${localCount === 1 ? "" : "s"} saved in this browser`}
          action={<button className="btn ghost sm" disabled={importing} onClick={importTrips}><Upload size={14} /> Import to my account</button>}
        >
          Import them to keep them in your cloud account.
        </Banner>
      )}

      <div className="stat-grid">
        <Stat icon={<Compass size={20} />} label="Total trips" value={stats.total} tone="blue" />
        <Stat icon={<MapPin size={20} />} label="Destinations" value={stats.destinations} tone="mint" />
        <Stat icon={<Calendar size={20} />} label="Upcoming" value={stats.upcoming} tone="peach" />
      </div>

      <div className="section-head">
        <h2>Your itineraries</h2>
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by destination" aria-label="Search trips" />
        </label>
      </div>

      {error && (
        <Banner kind="error" title="Could not load your trips" action={<button className="btn ghost sm" onClick={() => setTick((n) => n + 1)}>Retry</button>}>
          {error}
        </Banner>
      )}

      {!error && trips === null && (
        <div className="trip-grid"><Skeleton h={250} /><Skeleton h={250} /><Skeleton h={250} /></div>
      )}

      {trips && trips.length === 0 && (
        <Empty
          icon={Luggage}
          title="No trips yet"
          action={
            <div className="row center">
              <button className="btn primary" onClick={() => startPlan()}><Plus size={16} /> Plan my first trip</button>
              <button className="btn ghost" onClick={openExample}>Open the example trip</button>
            </div>
          }
        >
          Create a trip, generate an itinerary and press <strong>Save trip</strong>. It will appear here.
        </Empty>
      )}

      {trips && trips.length > 0 && shown.length === 0 && (
        <Empty icon={Search} title="No matches">No saved trip matches “{q}”.</Empty>
      )}

      <div className="trip-grid">
        {shown.map((t) => {
          const vibe = VIBES.find((v) => v.id === t.vibe) || VIBES[0];
          return (
            <article key={t.id} className="trip-card">
              <div className="trip-cover" style={{ background: `linear-gradient(135deg, ${vibe.from}, ${vibe.to})` }}>
                <Icon name={vibe.icon} size={56} className="cover-ico" />
                <span className="tag">{t.budget}</span>
                <button className="icon-btn float" onClick={() => remove(t)} aria-label={`Delete ${t.destination} trip`}><Trash2 size={16} /></button>
              </div>
              <div className="trip-body">
                <h3>{t.destination}</h3>
                <p className="meta"><Calendar size={14} /> {fmtDate(t.start_date)} – {fmtDate(t.end_date)}</p>
                <p className="meta"><Users size={14} /> {t.preferences?.travelers || 1} traveller{(t.preferences?.travelers || 1) === 1 ? "" : "s"} · {t.duration_days} days</p>
                <div className="trip-foot">
                  <span className="price"><IndianRupee size={14} />{Math.round(t.total_per_person_inr || 0).toLocaleString("en-IN")}<small> est. / person</small></span>
                  <button className="btn ghost sm" onClick={() => openTrip(t)}>Open</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }) {
  return (
    <div className="stat">
      <div className={`stat-ico ${tone}`}>{icon}</div>
      <div><span className="stat-label">{label}</span><strong>{value}</strong></div>
    </div>
  );
}

