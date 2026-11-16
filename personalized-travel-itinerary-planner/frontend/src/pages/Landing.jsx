import { ArrowRight, IndianRupee, Route, Sparkles, SlidersHorizontal, ShieldCheck, Save, Wand2 } from "lucide-react";
import { Logo } from "../components/Layout";
import { supabaseEnabled } from "../supabaseClient";
import { useApp } from "../ctx";

const FEATURES = [
  { Icon: Sparkles, title: "AI-powered planning", text: "Tell us your vibe, budget, pace and interests. Get a full day-by-day plan in seconds." },
  { Icon: Route, title: "Nearby stops, grouped", text: "Each day focuses on one area so you spend more time exploring and less time in transit." },
  { Icon: IndianRupee, title: "Budget in INR", text: "Rough cost estimates per activity and per day, with local currency shown for trips abroad." },
  { Icon: SlidersHorizontal, title: "Edit without starting over", text: "Regenerate one day or swap a single activity and leave the rest of your trip untouched." },
];

const STEPS = [
  { n: "1", title: "Describe your trip", text: "Pick a vibe, dates, budget, who is travelling and what you enjoy." },
  { n: "2", title: "Generate the plan", text: "Morning, lunch, afternoon and evening for every day, plus stay ideas and a budget." },
  { n: "3", title: "Refine, save, export", text: "Swap activities, track the budget, save the trip and download a PDF." },
];

export default function Landing() {
  const { startPlan, openExample } = useApp();
  return (
    <div className="landing">
      <header className="l-nav">
        <Logo />
        <nav className="l-links" aria-label="Sections">
          <a href="#features" onClick={(e) => scrollTo(e, "features")}>Features</a>
          <a href="#how" onClick={(e) => scrollTo(e, "how")}>How it works</a>
          <a href="#honest" onClick={(e) => scrollTo(e, "honest")}>About estimates</a>
        </nav>
        <div className="l-cta">
          {supabaseEnabled && <a className="link-btn" href="#/auth">Sign in</a>}
          <a className="btn primary sm" href="#/dashboard">Open app</a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow"><span className="dot" /> AI-powered exploration</span>
          <h1>Plan your next <em>adventure</em> in seconds.</h1>
          <p>
            A travel planner built for students and young travellers. Describe the trip you want and get a clear,
            editable, day-by-day itinerary with costs in rupees.
          </p>
          <div className="hero-actions">
            <button className="btn primary lg" onClick={() => startPlan()}>Start planning free <ArrowRight size={18} /></button>
            <button className="btn ghost lg" onClick={openExample}>See an example trip</button>
          </div>
          <p className="fine">No sign-up needed. Works in demo mode even without an AI key.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="mock">
            <div className="mock-bar" />
            <div className="mock-row">
              <div className="mock-card g" /><div className="mock-card b" /><div className="mock-card o" />
            </div>
            <div className="mock-day">
              <strong>Day 2 · Amer &amp; Nahargarh</strong>
              <span>Morning · Nahargarh Fort Viewpoint</span>
              <span>Lunch · Rajasthani thali</span>
              <span>Evening · Fort light-and-sound show</span>
            </div>
            <div className="mock-float f1"><small>ESTIMATED / PERSON</small><strong>₹18,060</strong></div>
            <div className="mock-float f2"><small>NEARBY STOPS</small><strong>Grouped by area</strong></div>
          </div>
        </div>
      </section>

      <section id="features" className="l-section">
        <h2>Built for the modern traveller</h2>
        <p className="sub">Everything you need to organise a trip, in one clean interface.</p>
        <div className="feature-grid">
          {FEATURES.map(({ Icon: Ico, title, text }) => (
            <article key={title} className="feature">
              <div className="feature-ico"><Ico size={22} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="l-section tint">
        <h2>How it works</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <article key={s.n} className="step">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="honest" className="l-section">
        <div className="honest">
          <ShieldCheck size={28} />
          <div>
            <h2>Estimates, not quotes</h2>
            <p>
              Prices, opening hours and distances shown in this app are rough estimates (or demo data) and are never
              verified, live or bookable. Every itinerary is labelled so you can check details before you travel.
            </p>
          </div>
        </div>
      </section>

      <section className="l-section">
        <div className="cta-band">
          <h2>Your next story starts here.</h2>
          <p>Build a trip in under a minute. Save it, edit it, take it with you as a PDF.</p>
          <button className="btn primary lg" onClick={() => startPlan()}><Wand2 size={18} /> Create my itinerary</button>
        </div>
      </section>

      <footer className="l-foot">
        <Logo />
        <span><Save size={14} /> Capstone project · React, FastAPI, Supabase and Groq</span>
      </footer>
    </div>
  );
}

function scrollTo(e, id) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
