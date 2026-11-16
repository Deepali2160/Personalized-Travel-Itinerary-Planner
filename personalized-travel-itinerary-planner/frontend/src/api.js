// Talks to the FastAPI backend. The address comes from VITE_API_URL.
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { code = "error", status = 0 } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, { method = "POST", body, timeoutMs = 90000, raw = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError("The request took too long. Please try again.", { code: "timeout" });
    }
    throw new ApiError(
      `Cannot reach the backend at ${API_URL}. Is it running? (See the README, "Run the backend".)`,
      { code: "offline" }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `Something went wrong (HTTP ${res.status}).`;
    let code = "error";
    try {
      const data = await res.json();
      const d = data.detail;
      if (typeof d === "string") message = d;
      else if (d?.message) {
        message = d.message;
        code = d.code || code;
      }
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(message, { code, status: res.status });
  }
  return raw ? res : res.json();
}

export const api = {
  health: () => request("/api/health", { method: "GET", timeoutMs: 45000 }),
  // 45s: a free Render server can take about a minute to wake up after being idle
  status: () => request("/api/status", { method: "GET", timeoutMs: 45000 }),
  recommendations: (body) => request("/api/recommendations", { body }),
  generate: (prefs) => request("/api/itinerary/generate", { body: prefs }),
  regenerateDay: (preferences, itinerary, day_number) =>
    request("/api/itinerary/regenerate-day", { body: { preferences, itinerary, day_number } }),
  replaceActivity: (preferences, itinerary, day_number, slot) =>
    request("/api/itinerary/replace-activity", { body: { preferences, itinerary, day_number, slot } }),
  async exportPdf(itinerary, preferences) {
    const res = await request("/api/export/pdf", { body: { itinerary, preferences }, raw: true });
    return res.blob();
  },
};
