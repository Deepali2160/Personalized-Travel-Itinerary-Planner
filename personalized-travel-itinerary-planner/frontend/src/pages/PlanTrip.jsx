import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, Sparkles } from "lucide-react";
import { useApp, go } from "../ctx";
import { BUDGETS, INTERESTS, PACES, PARTIES, VIBES, MAX_DAYS } from "../constants";
import { Banner, Chip, Field, Spinner } from "../components/ui";
import Icon from "../components/Icon";
import { addDays, fmtDate, todayISO, validatePrefs } from "../utils";

const DEFAULTS = () => ({
  vibe: "",
  destination: "",
  start_date: addDays(todayISO(), 14),
  duration_days: 4,
  budget: "Moderate",
  party: "Solo",
  travelers: 1,
  pace: "Moderate",
  interests: [],
  budget_cap_inr: "",
  notes: "",
  use_demo: false,
});

const STEPS = [
  { label: "Basics", fields: ["destination", "start_date", "duration_days"] },
  { label: "Preferences", fields: ["vibe"] },
  { label: "Logistics", fields: ["travelers", "budget_cap_inr", "notes"] },
];

export default function PlanTrip() {
  const { draft, generateTrip, status } = useApp();
  const editing = draft.editing;
  const [form, setForm] = useState(() => ({ ...DEFAULTS(), ...draft.values }));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleInterest = (id) =>
    set({ interests: form.interests.includes(id) ? form.interests.filter((i) => i !== id) : [...form.interests, id] });

  function check(fields) {
    const all = validatePrefs(form);
    const mine = Object.fromEntries(Object.entries(all).filter(([k]) => fields.includes(k)));
    setErrors(mine);
    return Object.keys(mine).length === 0;
  }

  const next = () => check(STEPS[step].fields) && setStep(step + 1);

  async function submit() {
    const all = validatePrefs(form);
    setErrors(all);
    if (Object.keys(all).length) {
      const firstBad = STEPS.findIndex((s) => s.fields.some((f) => all[f]));
      if (firstBad >= 0) setStep(firstBad);
      return;
    }
    setBusy(true);
    setApiError(null);
    try {
      const trip = await generateTrip(form, editing);
      go("/trip");
    } catch (e) {
      setApiError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const aiOff = status && !status.offline && !status.ai_configured;

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <span className="eyebrow-sm">{editing ? "Editing preferences" : "New trip"}</span>
          <h1>{editing ? "Update your trip" : "Plan a new trip"}</h1>
        </div>
      </div>

      <ol className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.label} className={i === step ? "cur" : i < step ? "done" : ""}>
            <span className="step-dot">{i < step ? <Check size={16} /> : i + 1}</span>
            <span className="step-label">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="card wizard">
        {status?.offline && (
          <Banner kind="warn" title="Backend not reachable">
            Start the FastAPI backend (see README), then press Generate again. The form keeps your answers.
          </Banner>
        )}

        {step === 0 && (
          <>
            <h2>Essential details</h2>
            <p className="muted">Tell us where and when you want to go.</p>
            <Field label="Destination (optional)" error={errors.destination} htmlFor="dest" hint="Leave empty and we will suggest a destination that matches your vibe.">
              <div className="input-ico">
                <MapPin size={18} />
                <input id="dest" value={form.destination} maxLength={80} placeholder="e.g. Goa, Jaipur, Phuket" onChange={(e) => set({ destination: e.target.value })} />
              </div>
            </Field>
            <div className="grid2">
              <Field label="Start date" error={errors.start_date} htmlFor="start">
                <input id="start" type="date" min={todayISO()} value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
              </Field>
              <Field label="Duration (days)" error={errors.duration_days} htmlFor="days" hint={form.start_date && form.duration_days >= 1 ? `Ends ${fmtDate(addDays(form.start_date, Math.max(Number(form.duration_days) - 1, 0)))}` : undefined}>
                <input id="days" type="number" min={1} max={MAX_DAYS} value={form.duration_days} onChange={(e) => set({ duration_days: e.target.value })} />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Vibe &amp; interests</h2>
            <p className="muted">Personalise your journey.</p>
            <fieldset className="fieldset">
              <legend>Travel vibe</legend>
              <div className="option-grid five">
                {VIBES.map((v) => (
                  <button type="button" key={v.id} className={`option ${form.vibe === v.id ? "on" : ""}`} onClick={() => set({ vibe: v.id })} aria-pressed={form.vibe === v.id}>
                    <Icon name={v.icon} size={22} />
                    <strong>{v.id}</strong>
                    <small>{v.blurb}</small>
                  </button>
                ))}
              </div>
              {errors.vibe && <p className="field-error" role="alert">{errors.vibe}</p>}
            </fieldset>

            <div className="grid2">
              <fieldset className="fieldset">
                <legend>Budget</legend>
                <div className="option-col">
                  {BUDGETS.map((b) => (
                    <button type="button" key={b.id} className={`option row ${form.budget === b.id ? "on" : ""}`} onClick={() => set({ budget: b.id })} aria-pressed={form.budget === b.id}>
                      <strong>{b.id}</strong><small>{b.blurb}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="fieldset">
                <legend>Pace</legend>
                <div className="option-col">
                  {PACES.map((p) => (
                    <button type="button" key={p.id} className={`option row ${form.pace === p.id ? "on" : ""}`} onClick={() => set({ pace: p.id })} aria-pressed={form.pace === p.id}>
                      <strong>{p.id}</strong><small>{p.blurb}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <fieldset className="fieldset">
              <legend>Interests (select any)</legend>
              <div className="chips">
                {INTERESTS.map((i) => (
                  <Chip key={i.id} active={form.interests.includes(i.id)} onClick={() => toggleInterest(i.id)}>
                    <Icon name={i.icon} size={15} /> {i.id}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Final logistics</h2>
            <p className="muted">The little things that make it fit.</p>
            <fieldset className="fieldset">
              <legend>Travelling as</legend>
              <div className="option-grid four">
                {PARTIES.map((p) => (
                  <button type="button" key={p.id} className={`option ${form.party === p.id ? "on" : ""}`} onClick={() => set({ party: p.id, travelers: p.travelers })} aria-pressed={form.party === p.id}>
                    <Icon name={p.icon} size={20} /><strong>{p.id}</strong>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid2">
              <Field label="Number of travellers" error={errors.travelers} htmlFor="trav">
                <input id="trav" type="number" min={1} max={20} value={form.travelers} onChange={(e) => set({ travelers: e.target.value })} />
              </Field>
              <Field label="Total budget limit in ₹ (optional)" error={errors.budget_cap_inr} htmlFor="cap" hint="For the whole group. We will tell you if the estimate goes over.">
                <input id="cap" type="number" min={1000} step={500} placeholder="e.g. 50000" value={form.budget_cap_inr} onChange={(e) => set({ budget_cap_inr: e.target.value })} />
              </Field>
            </div>
            <Field label="Special requirements or preferences (optional)" error={errors.notes} htmlFor="notes" hint={`${form.notes.length}/600 · e.g. vegetarian food, wheelchair access, travelling with a toddler`}>
              <textarea id="notes" rows={3} maxLength={600} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={form.use_demo} onChange={(e) => set({ use_demo: e.target.checked })} />
              <span>Use demo mode (built-in sample data, no AI)</span>
            </label>
            {aiOff && !form.use_demo && <p className="field-hint">No AI key is set on the backend, so demo mode is used automatically.</p>}
            {form.use_demo && form.notes && <p className="field-hint">Demo mode cannot act on notes. Turn it off and add an AI key to use them.</p>}
          </>
        )}

        {apiError && <Banner kind="error" title="Could not generate the itinerary" onClose={() => setApiError(null)}>{apiError}</Banner>}

        <div className="wizard-foot">
          {step > 0 ? (
            <button className="btn ghost" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={16} /> Previous</button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn primary" onClick={next}>Next step <ArrowRight size={16} /></button>
          ) : (
            <button className="btn accent" onClick={submit} disabled={busy}>
              {busy ? <><Spinner /> Planning your trip…</> : <><Sparkles size={16} /> {editing ? "Regenerate itinerary" : "Generate itinerary"}</>}
            </button>
          )}
        </div>
        {busy && <p className="field-hint center-text">AI mode can take 10–30 seconds. Please keep this tab open.</p>}
      </div>
    </div>
  );
}
