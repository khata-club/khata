const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

/** Return the number of minor units in one major currency unit. */
export function minorUnits(currency: string): number {
  const code = currency.toUpperCase();
  if (!supportedCurrencies.has(code)) {
    throw new RangeError(`Unsupported currency: ${currency}`);
  }

  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return 10 ** digits;
}

export interface FormatAmountOptions {
  /** Integer minor units, such as paise for INR or cents for USD. */
  value: number;
  /** ISO 4217 currency code. */
  currency?: string | undefined;
  locale?: string | undefined;
  compact?: boolean | undefined;
  hideFraction?: boolean | undefined;
  /** Show a leading plus sign on positive values. */
  signed?: boolean | undefined;
}

export interface FormattedAmount {
  formatted: string;
  sign: string;
  /** Exact, signed decimal value for display and machine use. */
  exactMajor: string;
  /** @deprecated Approximate floating-point value; never use for arithmetic. */
  major: number;
  negative: boolean;
}

export function formatAmount({
  value,
  currency = "INR",
  locale = "en-IN",
  compact = false,
  hideFraction = false,
  signed = false,
}: FormatAmountOptions): FormattedAmount {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("Amount must be a safe integer in minor units");
  }

  const code = currency.toUpperCase();
  const divisor = minorUnits(code);
  const major = value / divisor;
  const currencyDigits = Math.log10(divisor);
  const digits = String(Math.abs(value)).padStart(currencyDigits + 1, "0");
  const absoluteMajor = currencyDigits
    ? `${digits.slice(0, -currencyDigits)}.${digits.slice(-currencyDigits)}`
    : digits;
  const exactMajor = value < 0 ? `-${absoluteMajor}` : absoluteMajor;
  const bounds = compact
    ? { minimumFractionDigits: 0, maximumFractionDigits: 1 }
    : {
        minimumFractionDigits: hideFraction ? 0 : currencyDigits,
        maximumFractionDigits: hideFraction ? 0 : currencyDigits,
      };

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    ...(compact ? { notation: "compact" as const } : {}),
    ...bounds,
    // Intl accepts exact decimal strings in the supported browsers, but TS's
    // older overload still omits strings. This cast does not coerce the value.
  }).format(absoluteMajor as unknown as number);

  const negative = value < 0;
  const sign = negative ? "−" : signed && value > 0 ? "+" : "";
  return { formatted, sign, exactMajor, major, negative };
}
