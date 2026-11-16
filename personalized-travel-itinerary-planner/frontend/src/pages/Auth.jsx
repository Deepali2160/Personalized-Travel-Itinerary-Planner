import { useState } from "react";
import { ArrowLeft, Database } from "lucide-react";
import { Logo } from "../components/Layout";
import { Banner, Field, Spinner } from "../components/ui";
import { supabase, supabaseEnabled } from "../supabaseClient";
import { go } from "../ctx";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {kind, text}
  const [errors, setErrors] = useState({});

  if (!supabaseEnabled) {
    return (
      <div className="auth-page">
        <Logo />
        <div className="card auth-card">
          <div className="empty-ico"><Database size={26} /></div>
          <h1>Sign-in needs Supabase</h1>
          <p className="muted">
            Supabase is not configured, so the app is running in guest mode: your trips are saved in this browser only.
            To enable accounts and cloud-saved trips, follow the Supabase section of the README, then add{" "}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>frontend/.env</code> and restart the dev server.
          </p>
          <a className="btn primary" href="#/dashboard">Continue as guest</a>
        </div>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (password.length < 6) errs.password = "Use at least 6 characters.";
    setErrors(errs);
    setMsg(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (data.session) go("/dashboard");
        else setMsg({ kind: "success", text: "Account created. Check your email and click the confirmation link, then sign in here." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        go("/dashboard");
      }
    } catch (err) {
      const text = /invalid login/i.test(err.message)
        ? "Wrong email or password. If you just signed up, confirm your email first."
        : /already registered/i.test(err.message)
          ? "That email already has an account. Try signing in."
          : err.message || "Something went wrong. Please try again.";
      setMsg({ kind: "error", text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <Logo />
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">{mode === "signin" ? "Sign in to see your saved trips from any device." : "Save trips to the cloud and reopen them anywhere."}</p>
        {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
        <Field label="Email" error={errors.email} htmlFor="email">
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" error={errors.password} htmlFor="password">
          <input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn primary block" disabled={busy}>
          {busy ? <Spinner /> : null} {mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button type="button" className="link-btn center" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); setErrors({}); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <a className="back-link" href="#/dashboard"><ArrowLeft size={14} /> Continue as guest instead</a>
      </form>
    </div>
  );
}
