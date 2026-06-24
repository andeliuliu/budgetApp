import { describe, expect, it } from "vitest";
import {
  allocate,
  cents,
  formatMoney,
  isExactSplit,
  parseDollars,
  personalShare,
  splitEvenly,
  sumCents,
} from "./index";

describe("parseDollars", () => {
  it("parses plain and formatted strings", () => {
    expect(parseDollars("12.34")).toBe(1234);
    expect(parseDollars("$1,234.56")).toBe(123456);
    expect(parseDollars("-12.00")).toBe(-1200);
    expect(parseDollars("100")).toBe(10000);
    expect(parseDollars(".5")).toBe(50);
  });

  it("parses numbers without float drift", () => {
    expect(parseDollars(100.5)).toBe(10050);
    expect(parseDollars(0.1 + 0.2)).toBe(30); // 0.30000000000000004
  });

  it("rounds half-up on a third decimal", () => {
    expect(parseDollars("1.005")).toBe(101);
    expect(parseDollars("1.004")).toBe(100);
  });

  it("throws on garbage", () => {
    expect(() => parseDollars("abc")).toThrow();
    expect(() => parseDollars("")).toThrow();
  });
});

describe("formatMoney", () => {
  it("formats cents as currency", () => {
    expect(formatMoney(cents(123456))).toBe("$1,234.56");
    expect(formatMoney(cents(-1200))).toBe("-$12.00");
    expect(formatMoney(cents(500), { showPlusSign: true })).toBe("+$5.00");
  });
});

describe("splitEvenly", () => {
  it("distributes leftover cents and always sums to the total", () => {
    expect(splitEvenly(cents(1000), 3)).toEqual([334, 333, 333]);
    expect(sumCents(splitEvenly(cents(1000), 3))).toBe(1000);
    expect(splitEvenly(cents(1000), 4)).toEqual([250, 250, 250, 250]);
  });

  it("handles negative totals symmetrically", () => {
    expect(splitEvenly(cents(-1000), 3)).toEqual([-334, -333, -333]);
    expect(sumCents(splitEvenly(cents(-1000), 3))).toBe(-1000);
  });

  it("rejects non-positive part counts", () => {
    expect(() => splitEvenly(cents(100), 0)).toThrow();
  });
});

describe("allocate", () => {
  it("allocates by weight without losing cents", () => {
    expect(allocate(cents(10000), [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(sumCents(allocate(cents(10000), [1, 1, 1]))).toBe(10000);
    expect(allocate(cents(10000), [3, 1])).toEqual([7500, 2500]);
  });

  it("rejects negative totals and bad weights", () => {
    expect(() => allocate(cents(-1), [1])).toThrow();
    expect(() => allocate(cents(100), [])).toThrow();
    expect(() => allocate(cents(100), [0, 0])).toThrow();
  });
});

describe("split helpers", () => {
  it("validates manual splits", () => {
    expect(isExactSplit(cents(1000), [cents(600), cents(400)])).toBe(true);
    expect(isExactSplit(cents(1000), [cents(600), cents(300)])).toBe(false);
  });

  it("computes my personal share after others", () => {
    // $40 dinner, two friends owe $12.50 each -> I owe $15.00
    expect(personalShare(cents(4000), [cents(1250), cents(1250)])).toBe(1500);
  });
});
