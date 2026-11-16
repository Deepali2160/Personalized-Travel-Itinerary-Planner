import { createContext, useContext, useEffect, useState } from "react";

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/** Tiny hash router: "#/dashboard" -> "/dashboard". Works on Vercel with no extra config. */
const parse = () => window.location.hash.replace(/^#/, "") || "/";
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
export const go = (path) => {
  window.location.hash = path;
};
