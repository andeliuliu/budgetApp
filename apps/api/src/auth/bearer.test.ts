import { describe, expect, it } from "vitest";
import { parseBearer } from "./bearer";

describe("parseBearer", () => {
  it("extracts a bearer token (case-insensitive scheme)", () => {
    expect(parseBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearer("bearer xyz")).toBe("xyz");
  });

  it("rejects missing, malformed, or non-bearer headers", () => {
    expect(parseBearer(undefined)).toBeNull();
    expect(parseBearer("")).toBeNull();
    expect(parseBearer("abc")).toBeNull();
    expect(parseBearer("Bearer")).toBeNull();
    expect(parseBearer("Basic abc")).toBeNull();
    expect(parseBearer("Bearer a b")).toBeNull();
  });
});
