export function Card({ title, action, className = '', children }) {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {(title || action) && (
        <header className="ui-card-header">
          {title && <h2 className="ui-card-title">{title}</h2>}
          {action && <div>{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
