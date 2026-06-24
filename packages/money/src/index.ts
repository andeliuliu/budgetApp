/**
 * Money utilities for budgetApp.
 *
 * Rule #1 of money in software: never store or do arithmetic in floating-point
 * dollars. Everything here is integer **cents**. Floats are only ever touched at
 * the parse/format boundary, and even then carefully.
 */

/** An integer number of cents. Branded so a raw `number` can't be passed by accident. */
export type Cents = number & { readonly __brand: "Cents" };

/** Assert/brand a raw number as Cents (must be a whole number). */
export function cents(n: number): Cents {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Cents must be an integer, received ${n}`);
  }
  return n as Cents;
}

export const ZERO: Cents = 0 as Cents;

/**
 * Parse a human/dollar value into integer cents without float drift.
 * Accepts numbers ("100.5") and strings ("$1,234.56", "-12.005").
 * A third decimal digit rounds half-up (1.005 -> 101¢).
 */
export function parseDollars(input: string | number): Cents {
  const str = typeof input === "number" ? input.toString() : input;
  const cleaned = str.trim().replace(/[$,\s]/g, "");
  const match = /^(-)?(\d+)?(?:\.(\d+))?$/.exec(cleaned);
  if (!match || (match[2] === undefined && match[3] === undefined)) {
    throw new RangeError(`Cannot parse money value: "${input}"`);
  }
  const negative = match[1] === "-";
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? "";

  const centDigits = fraction.padEnd(3, "0");
  let fracCents = Number(centDigits.slice(0, 2));
  if (Number(centDigits[2]) >= 5) fracCents += 1; // round half-up on the 3rd digit

  const total = Number(whole) * 100 + fracCents;
  return cents(negative ? -total : total);
}

/** Format integer cents as a currency string, e.g. 123456 -> "$1,234.56". */
export function formatMoney(
  value: Cents,
  opts: { currency?: string; showPlusSign?: boolean } = {},
): string {
  const { currency = "USD", showPlusSign = false } = opts;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Math.abs(value) / 100);
  const sign = value < 0 ? "-" : showPlusSign && value > 0 ? "+" : "";
  return `${sign}${formatted}`;
}

export function add(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtract(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function sumCents(values: Cents[]): Cents {
  return cents(values.reduce<number>((acc, v) => acc + v, 0));
}

/**
 * Split a total evenly into `parts` shares. The leftover cent(s) are handed to
 * the first shares so the parts always sum back to the exact total.
 * e.g. splitEvenly(1000, 3) -> [334, 333, 333]
 */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`parts must be a positive integer, received ${parts}`);
  }
  const base = Math.trunc(total / parts);
  const sign = total < 0 ? -1 : 1;
  let remainder = Math.abs(total - base * parts);

  const result: Cents[] = [];
  for (let i = 0; i < parts; i++) {
    let share = base;
    if (remainder > 0) {
      share += sign;
      remainder -= 1;
    }
    result.push(share as Cents);
  }
  return result;
}

/**
 * Allocate a (non-negative) total across weighted shares using the
 * largest-remainder method, so every cent is accounted for and nothing is lost
 * to rounding. e.g. allocate(10000, [1, 1, 1]) -> [3334, 3333, 3333]
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  if (total < 0) throw new RangeError("allocate expects a non-negative total");
  if (weights.length === 0) throw new RangeError("weights must not be empty");
  if (weights.some((w) => w < 0)) {
    throw new RangeError("weights must be non-negative");
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    throw new RangeError("weights must sum to a positive number");
  }

  const raw = weights.map((w) => (total * w) / totalWeight);
  const result = raw.map((r) => Math.floor(r));
  let remainder = total - result.reduce((a, b) => a + b, 0);

  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  let k = 0;
  while (remainder > 0) {
    result[byFraction[k % byFraction.length].i] += 1;
    remainder -= 1;
    k += 1;
  }
  return result as Cents[];
}

/** True when the manual shares exactly reconstruct the total. */
export function isExactSplit(total: Cents, shares: Cents[]): boolean {
  return sumCents(shares) === total;
}

/** What I personally owe after others' shares are subtracted from the total. */
export function personalShare(total: Cents, othersShares: Cents[]): Cents {
  return subtract(total, sumCents(othersShares));
}
