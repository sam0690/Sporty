"use client";

type SelectOption = { value: string; label: string; group?: string };

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

/** Options bucketed by `group`, in first-seen order. Ungrouped options keep
 *  their position by sitting in a leading "" bucket rendered without a label. */
function byGroup(options: SelectOption[]): [string, SelectOption[]][] {
  const buckets = new Map<string, SelectOption[]>();
  for (const option of options) {
    const key = option.group ?? "";
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(option);
    } else {
      buckets.set(key, [option]);
    }
  }
  return [...buckets];
}

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
  const option = (o: SelectOption) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  );

  const select = (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      style={{ colorScheme: "dark" }}
      className={`rounded-[3px] border border-white/12 bg-surface-1 px-4 py-3 text-sm text-fg-1 outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.some((o) => o.group)
        ? byGroup(options).map(([group, grouped]) =>
            group ? (
              <optgroup key={group} label={group}>
                {grouped.map(option)}
              </optgroup>
            ) : (
              grouped.map(option)
            ),
          )
        : options.map(option)}
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
