"use client";

type SelectOption = { value: string; label: string };

type SelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: SelectProps) {
  const select = (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      style={{ colorScheme: "dark" }}
      className={`rounded-[3px] border border-white/12 bg-surface-1 px-4 py-3 text-sm text-fg-1 outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (!label) {
    return select;
  }

  return (
    <label className="block">
      <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
        {label}
      </span>
      {select}
    </label>
  );
}

export type { SelectOption };
