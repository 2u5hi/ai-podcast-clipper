import { describe, expect, it } from "vitest";
import { creditsForPrice } from "./credit-packs";

const prices = { small: "price_s", medium: "price_m", large: "price_l" };

describe("creditsForPrice", () => {
  it("maps each pack's price to its credits", () => {
    expect(creditsForPrice("price_s", prices)).toBe(50);
    expect(creditsForPrice("price_m", prices)).toBe(150);
    expect(creditsForPrice("price_l", prices)).toBe(500);
  });

  it("returns null for a price that isn't ours", () => {
    expect(creditsForPrice("price_other", prices)).toBeNull();
    expect(creditsForPrice("", prices)).toBeNull();
  });
});
