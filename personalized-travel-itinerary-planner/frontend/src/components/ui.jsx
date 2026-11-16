import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";

export const Spinner = ({ size = 16 }) => <Loader2 size={size} className="spin" aria-hidden="true" />;

export function Banner({ kind = "info", title, children, onClose, action }) {
  const Ico = kind === "error" || kind === "warn" ? AlertTriangle : kind === "success" ? CheckCircle2 : Info;
  return (
    <div className={`banner ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Ico size={18} className="banner-ico" aria-hidden="true" />
      <div className="banner-body">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
      {action}
      {onClose && (
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Empty({ icon: Ico, title, children, action }) {
  return (
    <div className="empty">
      {Ico && (
        <div className="empty-ico">
          <Ico size={28} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Chip({ active, onClick, children, disabled, tone = "mint" }) {
  return (
    <button
      type="button"
      className={`chip ${tone} ${active ? "on" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={Boolean(active)}
    >
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ h = 120 }) {
  return <div className="skeleton" style={{ height: h }} aria-hidden="true" />;
}
