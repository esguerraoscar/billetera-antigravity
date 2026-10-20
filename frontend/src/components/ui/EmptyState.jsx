export function EmptyState({ title, description }) {
  return (
    <div className="ui-empty-state" role="status">
      <h3 className="ui-empty-state-title">{title}</h3>
      {description && (
        <p className="ui-empty-state-description">{description}</p>
      )}
    </div>
  );
}
