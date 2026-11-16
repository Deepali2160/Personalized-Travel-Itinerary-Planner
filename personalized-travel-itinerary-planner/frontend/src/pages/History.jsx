import { useEffect, useState } from "react";
import { Clock, History as HistoryIcon, Search } from "lucide-react";
import { useApp } from "../ctx";
import { Banner, Empty, Skeleton } from "../components/ui";
import { fmtDateTime } from "../utils";

const LABELS = {
  CREATE_TRIP: { text: "Trip saved", tone: "mint" },
  UPDATE_TRIP: { text: "Trip updated", tone: "blue" },
  DELETE_TRIP: { text: "Trip deleted", tone: "rose" },
  GENERATE_ITINERARY: { text: "Itinerary generated", tone: "blue" },
};

export default function HistoryPage() {
  const { store } = useApp();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    setItems(null);
    setError(null);
    store.listHistory().then((l) => live && setItems(l)).catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [store]);

  const shown = (items || []).filter((i) => {
    const hay = `${LABELS[i.action]?.text || i.action} ${i.details?.destination || ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow-sm">Activity</span>
          <h1>Trip history</h1>
        </div>
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter activity" aria-label="Filter activity" />
        </label>
      </div>
      {error && <Banner kind="error" title="Could not load history">{error}</Banner>}
      {!error && items === null && <div className="stack"><Skeleton h={80} /><Skeleton h={80} /></div>}
      {items && items.length === 0 && <Empty icon={HistoryIcon} title="No activity yet">Generating, saving and deleting trips will show up here.</Empty>}
      {items && items.length > 0 && shown.length === 0 && <Empty icon={Search} title="No matches">Nothing matches “{q}”.</Empty>}
      <ol className="timeline">
        {shown.map((i) => {
          const l = LABELS[i.action] || { text: i.action, tone: "blue" };
          return (
            <li key={i.id} className="card tl-item">
              <span className={`status-tag ${l.tone}`}>{l.text}</span>
              <strong>{i.details?.destination || "Trip"}</strong>
              {i.details?.mode && <span className="mini-chip">{i.details.mode === "ai" ? "AI" : "Demo"}</span>}
              <span className="meta"><Clock size={13} /> {fmtDateTime(i.created_at)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
