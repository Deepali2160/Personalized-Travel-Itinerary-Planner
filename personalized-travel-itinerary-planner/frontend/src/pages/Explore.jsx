import { useEffect, useRef, useState } from "react";
import { ArrowRight, Calendar, Compass, IndianRupee } from "lucide-react";
import { api } from "../api";
import { useApp } from "../ctx";
import { BUDGETS, INTERESTS, VIBES } from "../constants";
import { Banner, Chip, Empty, Skeleton } from "../components/ui";
import Icon from "../components/Icon";
import { addDays, todayISO } from "../utils";

export default function Explore() {
  const { startPlan } = useApp();
  const [vibe, setVibe] = useState("");
  const [budget, setBudget] = useState("Moderate");
  const [interests, setInterests] = useState([]);
  const [start, setStart] = useState(addDays(todayISO(), 30));
  const [days, setDays] = useState(5);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);

  useEffect(() => {
    if (!vibe || !start) return undefined;
    const my = ++ticket.current;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      api
        .recommendations({ vibe, budget, interests, start_date: start, duration_days: Number(days) || 5 })
        .then((r) => my === ticket.current && setResult(r))
        .catch((e) => my === ticket.current && (setError(e.message), setResult(null)))
        .finally(() => my === ticket.current && setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [vibe, budget, interests.join(","), start, days]);

  const toggle = (id) => setInterests((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow-sm">Destination ideas</span>
          <h1>Explore</h1>
        </div>
      </div>

      <div className="card filters">
        <fieldset className="fieldset">
          <legend>Pick a vibe</legend>
          <div className="vibe-row">
            {VIBES.map((v) => (
              <button type="button" key={v.id} className={`vibe-pill ${vibe === v.id ? "on" : ""}`} onClick={() => setVibe(v.id)} aria-pressed={vibe === v.id}>
                <Icon name={v.icon} size={18} /> {v.id}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid3">
          <fieldset className="fieldset">
            <legend>Budget</legend>
            <div className="chips">
              {BUDGETS.map((b) => <Chip key={b.id} tone="blue" active={budget === b.id} onClick={() => setBudget(b.id)}>{b.id}</Chip>)}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="ex-start">Travel start date</label>
            <input id="ex-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ex-days">Days</label>
            <input id="ex-days" type="number" min={1} max={14} value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        <fieldset className="fieldset">
          <legend>Interests</legend>
          <div className="chips">
            {INTERESTS.map((i) => <Chip key={i.id} active={interests.includes(i.id)} onClick={() => toggle(i.id)}><Icon name={i.icon} size={15} /> {i.id}</Chip>)}
          </div>
        </fieldset>
      </div>

      {!vibe && <Empty icon={Compass} title="Choose a vibe to see ideas">We will suggest three destinations that fit your vibe, budget, interests and travel month.</Empty>}

      {error && <Banner kind="error" title="Could not load recommendations">{error}</Banner>}

      {vibe && loading && <div className="card-grid three"><Skeleton h={340} /><Skeleton h={340} /><Skeleton h={340} /></div>}

      {vibe && !loading && result && (
        <>
          <Banner kind={result.mode === "ai" ? "info" : "warn"} title={result.mode === "ai" ? "AI suggestions" : "Illustrative demo recommendations"}>
            {result.disclaimer}
            {result.warnings?.map((w) => <div key={w}>{w}</div>)}
          </Banner>
          <div className="card-grid three">
            {result.destinations.map((d, i) => {
              const v = VIBES.find((x) => x.id === vibe) || VIBES[0];
              return (
                <article key={d.name + i} className="dest-card">
                  <div className="dest-cover" style={{ background: `linear-gradient(135deg, ${v.from}, ${v.to})` }}>
                    <Icon name={v.icon} size={48} className="cover-ico" />
                    <span className="tag">#{i + 1} match</span>
                  </div>
                  <div className="dest-body">
                    <h3>{d.name}<small>{d.country}</small></h3>
                    <p>{d.description}</p>
                    <div className="chips tight">{d.highlights.map((h) => <span key={h} className="mini-chip">{h}</span>)}</div>
                    {d.best_for && <p className="meta strong">{d.best_for}</p>}
                    {d.season_note && <p className="meta"><Calendar size={14} /> {d.season_note}</p>}
                    <p className="budget-range">
                      <IndianRupee size={15} />
                      {d.daily_budget_min_inr.toLocaleString("en-IN")} – {d.daily_budget_max_inr.toLocaleString("en-IN")}
                      <small> est. / person / day</small>
                    </p>
                    <button
                      className="btn primary block"
                      onClick={() => startPlan({ vibe, destination: d.name, budget, interests, start_date: start, duration_days: Number(days) || 5 })}
                    >
                      Plan this trip <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
