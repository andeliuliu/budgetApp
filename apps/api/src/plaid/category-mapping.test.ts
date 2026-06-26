import { describe, expect, it } from "vitest";
import { isTransferCategory, mapPlaidCategory } from "./category-mapping";

describe("mapPlaidCategory", () => {
  it("maps primary categories", () => {
    expect(mapPlaidCategory("FOOD_AND_DRINK", "FOOD_AND_DRINK_FAST_FOOD")).toBe("dining");
    expect(mapPlaidCategory("GENERAL_MERCHANDISE", null)).toBe("shopping");
    expect(mapPlaidCategory("LOAN_PAYMENTS", null)).toBe("loans");
    expect(mapPlaidCategory("RENT_AND_UTILITIES", "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY")).toBe("utilities");
  });

  it("applies detailed overrides", () => {
    expect(mapPlaidCategory("FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES")).toBe("grocery");
    expect(mapPlaidCategory("RENT_AND_UTILITIES", "RENT_AND_UTILITIES_RENT")).toBe("rent");
  });

  it("maps transfers", () => {
    expect(mapPlaidCategory("TRANSFER_IN", null)).toBe("transfers");
    expect(mapPlaidCategory("TRANSFER_OUT", null)).toBe("transfers");
  });

  it("falls back to other and is case-insensitive", () => {
    expect(mapPlaidCategory("TRAVEL", null)).toBe("other");
    expect(mapPlaidCategory(null, null)).toBe("other");
    expect(mapPlaidCategory("food_and_drink", "food_and_drink_groceries")).toBe("grocery");
  });
});

describe("isTransferCategory", () => {
  it("detects transfer categories", () => {
    expect(isTransferCategory("TRANSFER_OUT")).toBe(true);
    expect(isTransferCategory("FOOD_AND_DRINK")).toBe(false);
    expect(isTransferCategory(null)).toBe(false);
  });
});
