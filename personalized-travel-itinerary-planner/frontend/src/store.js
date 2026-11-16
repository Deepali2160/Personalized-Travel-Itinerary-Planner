// Saves trips, saved places and history.
//  - Signed in + Supabase configured -> stored in your Supabase database (cloud)
//  - Otherwise                       -> stored in this browser only (localStorage)
// Both stores expose the same functions, so the rest of the app doesn't care.
import { supabase } from "./supabaseClient";
import { uid } from "./utils";

const KEYS = { trips: "tp_trips_v1", places: "tp_places_v1", history: "tp_history_v1" };

function read(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Your browser storage is full or blocked, so nothing could be saved.");
  }
}

function tripRow(trip) {
  const itin = trip.itinerary;
  return {
    id: trip.id,
    title: trip.title,
    destination: itin.destination,
    vibe: trip.preferences.vibe,
    budget: trip.preferences.budget,
    start_date: trip.preferences.start_date,
    end_date: itin.days.at(-1)?.date || trip.preferences.start_date,
    duration_days: itin.days.length,
    total_per_person_inr: itin.budget.total_per_person_inr,
    preferences: trip.preferences,
    itinerary: itin,
  };
}

// ------------------------------------------------------------ local store
function localStore() {
  return {
    kind: "local",
    async listTrips() {
      return read(KEYS.trips).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    },
    async saveTrip(trip) {
      const trips = read(KEYS.trips);
      const now = new Date().toISOString();
      const existing = trips.find((t) => t.id === trip.id);
      const row = { ...tripRow(trip), created_at: existing?.created_at || now, updated_at: now };
      write(KEYS.trips, existing ? trips.map((t) => (t.id === trip.id ? row : t)) : [row, ...trips]);
      return { row, created: !existing };
    },
    async deleteTrip(id) {
      write(KEYS.trips, read(KEYS.trips).filter((t) => t.id !== id));
    },
    async listPlaces() {
      return read(KEYS.places).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async addPlace(place) {
      const places = read(KEYS.places);
      if (places.some((p) => p.name === place.name && p.destination === place.destination)) return null;
      const row = { id: uid(), created_at: new Date().toISOString(), ...place };
      write(KEYS.places, [row, ...places]);
      return row;
    },
    async removePlace(id) {
      write(KEYS.places, read(KEYS.places).filter((p) => p.id !== id));
    },
    async listHistory() {
      return read(KEYS.history);
    },
    async logHistory(action, entity_type, entity_id, details = {}) {
      const row = { id: uid(), action, entity_type, entity_id, details, created_at: new Date().toISOString() };
      write(KEYS.history, [row, ...read(KEYS.history)].slice(0, 200));
    },
    count: () => read(KEYS.trips).length,
  };
}

// ----------------------------------------------------------- cloud store
function fail(error, what) {
  if (!error) return;
  const hint =
    error.code === "42P01" || /relation .* does not exist/i.test(error.message || "")
      ? " The database tables are missing: run supabase/schema.sql in the Supabase SQL Editor."
      : error.code === "42501" || /permission denied|row-level security/i.test(error.message || "")
        ? " Permission denied: check the GRANT and RLS policies in supabase/schema.sql."
        : "";
  throw new Error(`Could not ${what}.${hint} (${error.message})`);
}

function cloudStore(user) {
  return {
    kind: "cloud",
    async listTrips() {
      const { data, error } = await supabase.from("trips").select("*").order("updated_at", { ascending: false });
      fail(error, "load your trips");
      return data;
    },
    async saveTrip(trip) {
      const row = { ...tripRow(trip), user_id: user.id, updated_at: new Date().toISOString() };
      const { data: existing } = await supabase.from("trips").select("id").eq("id", trip.id).maybeSingle();
      const { data, error } = existing
        ? await supabase.from("trips").update(row).eq("id", trip.id).select().single()
        : await supabase.from("trips").insert(row).select().single();
      fail(error, "save this trip");
      return { row: data, created: !existing };
    },
    async deleteTrip(id) {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      fail(error, "delete this trip");
    },
    async listPlaces() {
      const { data, error } = await supabase.from("saved_places").select("*").order("created_at", { ascending: false });
      fail(error, "load saved places");
      return data;
    },
    async addPlace(place) {
      const { data: dup } = await supabase
        .from("saved_places").select("id").eq("name", place.name).eq("destination", place.destination).maybeSingle();
      if (dup) return null;
      const { trip_id, ...rest } = place;
      const { data, error } = await supabase
        .from("saved_places").insert({ ...rest, user_id: user.id, trip_id: trip_id || null }).select().single();
      fail(error, "save this place");
      return data;
    },
    async removePlace(id) {
      const { error } = await supabase.from("saved_places").delete().eq("id", id);
      fail(error, "remove this place");
    },
    async listHistory() {
      const { data, error } = await supabase
        .from("history").select("*").order("created_at", { ascending: false }).limit(200);
      fail(error, "load history");
      return data;
    },
    async logHistory(action, entity_type, entity_id, details = {}) {
      const { error } = await supabase
        .from("history").insert({ user_id: user.id, action, entity_type, entity_id: entity_id || null, details });
      fail(error, "write history");
    },
  };
}

export function makeStore(user) {
  return user && supabase ? cloudStore(user) : localStore();
}

export const local = localStore();

/** Copy trips saved in this browser into the signed-in account, then clear them locally. */
export async function importLocalTrips(cloud) {
  const trips = read(KEYS.trips);
  for (const t of trips) {
    await cloud.saveTrip({ id: t.id, title: t.title, preferences: t.preferences, itinerary: t.itinerary });
  }
  write(KEYS.trips, []);
  return trips.length;
}
