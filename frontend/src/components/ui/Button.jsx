export function Button({
  children,
  type = 'button',
  variant = 'primary',
  disabled = false,
  onClick,
}) {
  const variantClass =
    variant === 'secondary' ? 'ui-button-secondary' : 'ui-button-primary';

  return (
    <button
      type={type}
      className={`ui-button ${variantClass}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
