import { useEffect, useState } from "react";
import { Heart, MapPin, Trash2 } from "lucide-react";
import { useApp } from "../ctx";
import { Banner, Empty, Skeleton } from "../components/ui";
import { inr } from "../utils";

export default function Places() {
  const { store, toast, startPlan } = useApp();
  const [places, setPlaces] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setPlaces(null);
    setError(null);
    store.listPlaces().then((p) => live && setPlaces(p)).catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [store]);

  async function remove(p) {
    try {
      await store.removePlace(p.id);
      setPlaces((list) => list.filter((x) => x.id !== p.id));
      toast("Removed.", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow-sm">Favourites</span>
          <h1>Saved places</h1>
        </div>
      </div>
      {error && <Banner kind="error" title="Could not load saved places">{error}</Banner>}
      {!error && places === null && <div className="card-grid three"><Skeleton h={150} /><Skeleton h={150} /><Skeleton h={150} /></div>}
      {places && places.length === 0 && (
        <Empty icon={Heart} title="Nothing saved yet" action={<button className="btn primary" onClick={() => startPlan()}>Plan a trip</button>}>
          Press <strong>Save place</strong> on any activity in an itinerary to keep it here.
        </Empty>
      )}
      <div className="card-grid three">
        {places?.map((p) => (
          <article key={p.id} className="card place">
            <div className="place-top">
              <span className="mini-chip">{p.slot}</span>
              <button className="icon-btn" onClick={() => remove(p)} aria-label={`Remove ${p.name}`}><Trash2 size={16} /></button>
            </div>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <p className="meta"><MapPin size={14} /> {p.destination}{p.area ? ` · ${p.area}` : ""}</p>
            {p.cost_inr > 0 && <p className="meta">≈ {inr(p.cost_inr)} per person (estimate)</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
