import { Cloud, CloudOff, Globe, Heart, History, LayoutDashboard, LogIn, LogOut, PlusCircle, Compass, RefreshCw } from "lucide-react";
import { useApp } from "../ctx";
import { supabase, supabaseEnabled } from "../supabaseClient";
import { Spinner } from "./ui";

export const Logo = ({ to = "#/" }) => (
  <a className="logo" href={to} aria-label="TravelPlanner home">
    <span className="logo-mark"><Globe size={20} /></span>
    <span>Travel<em>Planner</em></span>
  </a>
);

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/plan", label: "Plan New Trip", Icon: PlusCircle },
  { to: "/explore", label: "Explore", Icon: Compass },
  { to: "/places", label: "Saved Places", Icon: Heart },
  { to: "/history", label: "Trip History", Icon: History },
];

function ModePill() {
  const { status, recheck } = useApp();
  if (!status) return <span className="pill" title="On free hosting the first request after idle can take about a minute"><Spinner size={12} /> Checking backend…</span>;
  if (status.offline)
    return (
      <button className="pill bad" onClick={recheck} title="Click to retry">
        <CloudOff size={14} /> Backend offline · retry <RefreshCw size={12} />
      </button>
    );
  return status.mode === "ai" ? (
    <span className="pill ok" title={`Model: ${status.model}`}><Cloud size={14} /> AI mode</span>
  ) : (
    <span className="pill demo" title="No GROQ_API_KEY set on the backend">Demo mode (no AI key)</span>
  );
}

export default function Layout({ route, children }) {
  const { user, store, toast } = useApp();

  async function signOut() {
    await supabase.auth.signOut();
    toast("Signed out.", "success");
    window.location.hash = "/";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo to="#/dashboard" />
        <nav aria-label="Main">
          {NAV.map(({ to, label, Icon: Ico }) => (
            <a key={to} href={"#" + to} className={route === to || (to === "/plan" && route === "/trip") ? "nav-link active" : "nav-link"}>
              <Ico size={20} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="store-note">
            {store.kind === "cloud" ? (
              <><Cloud size={14} /> Saved to your Supabase account</>
            ) : (
              <><CloudOff size={14} /> Saved in this browser only</>
            )}
          </div>
          {supabaseEnabled ? (
            user ? (
              <button className="nav-link" onClick={signOut}>
                <LogOut size={20} /><span title={user.email}>Sign out</span>
              </button>
            ) : (
              <a className="nav-link" href="#/auth"><LogIn size={20} /><span>Sign in</span></a>
            )
          ) : null}
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title">{user ? user.email : "Guest mode"}</div>
          <ModePill />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
