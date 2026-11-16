import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppCtx, go, useRoute } from "./ctx";
import { api } from "./api";
import { supabase, supabaseEnabled } from "./supabaseClient";
import { makeStore } from "./store";
import { fromPayload, toPayload, uid } from "./utils";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import PlanTrip from "./pages/PlanTrip";
import ItineraryView from "./pages/ItineraryView";
import Explore from "./pages/Explore";
import Places from "./pages/Places";
import HistoryPage from "./pages/History";
import exampleTrip from "./data/example-trip.json";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal">
        <h1>Something went wrong</h1>
        <p>{String(this.state.error.message || this.state.error)}</p>
        <button className="btn primary" onClick={() => { window.location.hash = "/dashboard"; window.location.reload(); }}>
          Reload the app
        </button>
      </div>
    );
  }
}

export default function App() {
  const route = useRoute();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);
  const [status, setStatus] = useState(null);
  const [current, setCurrent] = useState(null); // the trip being viewed/edited
  const [draft, setDraft] = useState({ values: {}, editing: false });
  const [toasts, setToasts] = useState([]);

  const store = useMemo(() => makeStore(user), [user]);

  // ---- sign-in state (only when Supabase is configured)
  useEffect(() => {
    if (!supabaseEnabled) return undefined;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // a trip saved in one place is "not saved yet" in the other
  useEffect(() => {
    setCurrent((c) => (c ? { ...c, saved: false } : c));
  }, [store]);

  // ---- backend status (AI mode or demo mode)
  const recheck = useCallback(() => {
    setStatus(null);
    api.status().then(setStatus).catch(() => setStatus({ offline: true }));
  }, []);
  useEffect(recheck, [recheck]);

  const toast = useCallback((message, kind = "info") => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  const logEvent = useCallback(
    async (action, type, id, details) => {
      try {
        await store.logHistory(action, type, id, details);
      } catch {
        /* history is nice-to-have; never block the user */
      }
    },
    [store]
  );

  const startPlan = useCallback((values = {}, editing = false) => {
    setDraft({ values, editing });
    go("/plan");
  }, []);

  const editPreferences = useCallback(() => {
    if (current) startPlan(fromPayload(current.preferences), true);
  }, [current, startPlan]);

  const generateTrip = useCallback(
    async (form, editing) => {
      const payload = toPayload(form);
      const itinerary = await api.generate(payload);
      const keep = Boolean(editing && current);
      const trip = {
        id: keep ? current.id : uid(),
        title: `${itinerary.destination} trip`,
        preferences: payload,
        itinerary,
        saved: keep ? current.saved : false,
        dirty: true,
      };
      setCurrent(trip);
      await logEvent("GENERATE_ITINERARY", "itinerary", trip.saved ? trip.id : null, {
        destination: itinerary.destination,
        mode: itinerary.mode,
      });
      return trip;
    },
    [current, logEvent]
  );

  const updateItinerary = useCallback((itinerary) => {
    setCurrent((c) => (c ? { ...c, itinerary, dirty: true } : c));
  }, []);

  const saveTrip = useCallback(async () => {
    if (!current) return false;
    const { created } = await store.saveTrip(current);
    setCurrent((c) => (c && c.id === current.id ? { ...c, saved: true, dirty: false } : c));
    await logEvent(created ? "CREATE_TRIP" : "UPDATE_TRIP", "trip", current.id, {
      destination: current.itinerary.destination,
    });
    return created;
  }, [current, store, logEvent]);

  const openTrip = useCallback((row) => {
    setCurrent({ id: row.id, title: row.title, preferences: row.preferences, itinerary: row.itinerary, saved: true, dirty: false });
    go("/trip");
  }, []);

  const openExample = useCallback(() => {
    setCurrent({
      id: uid(),
      title: "Example: Jaipur trip",
      preferences: exampleTrip.preferences,
      itinerary: exampleTrip.itinerary,
      saved: false,
      dirty: false,
      example: true,
    });
    go("/trip");
  }, []);

  const ctx = {
    user, store, status, recheck, current, setCurrent, draft, toast, logEvent,
    startPlan, editPreferences, generateTrip, updateItinerary, saveTrip, openTrip, openExample,
  };

  const PAGES = {
    "/dashboard": Dashboard,
    "/plan": PlanTrip,
    "/trip": ItineraryView,
    "/explore": Explore,
    "/places": Places,
    "/history": HistoryPage,
  };
  const Page = PAGES[route];

  let body;
  if (route === "/") body = <Landing />;
  else if (route === "/auth") body = <Auth />;
  else if (!authReady) body = <div className="fatal"><p>Loading…</p></div>;
  else if (Page) body = <Layout route={route}><Page /></Layout>;
  else body = <Layout route={route}><div className="empty"><h3>Page not found</h3><a className="btn primary" href="#/dashboard">Go to dashboard</a></div></Layout>;

  return (
    <ErrorBoundary>
      <AppCtx.Provider value={ctx}>
        {body}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {t.kind === "success" ? <CheckCircle2 size={18} /> : t.kind === "error" ? <AlertTriangle size={18} /> : <Info size={18} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </AppCtx.Provider>
    </ErrorBoundary>
  );
}
