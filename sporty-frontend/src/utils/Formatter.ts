export class Formatter {
  static currency(value: number, currency = "USD", locale = "en-US"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  static percent(value: number, locale = "en-US"): string {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(value);
  }

  static number(value: number, locale = "en-US"): string {
    return new Intl.NumberFormat(locale).format(value);
  }
}
