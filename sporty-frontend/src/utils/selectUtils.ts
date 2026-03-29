export interface SelectOption<T = string> {
  label: string;
  value: T;
}

export function toSelectOptions<T>(
  items: T[],
  getLabel: (item: T) => string,
  getValue: (item: T) => string,
): SelectOption<string>[] {
  return items.map((item) => ({
    label: getLabel(item),
    value: getValue(item),
  }));
}
