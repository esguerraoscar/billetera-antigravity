export function Input({
  id,
  name,
  label,
  type = 'text',
  value,
  placeholder,
  required = false,
  autoComplete,
  onChange,
}) {
  return (
    <div className="ui-field">
      {label && (
        <label htmlFor={id} className="ui-label">
          {label}
        </label>
      )}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        onChange={onChange}
        className="ui-input"
      />
    </div>
  );
}
