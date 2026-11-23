import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses, ORDER_STATUSES, restocksOn } from "../src/services/orderStatus.js";

describe("order status machine", () => {
  it("follows the happy path", () => {
    expect(canTransition("pending", "processing")).toBe(true);
    expect(canTransition("processing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("allows cancelling only before shipping", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("processing", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });

  it("does not allow skipping steps or going backwards", () => {
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("shipped", "processing")).toBe(false);
  });

  it("treats delivered and cancelled as terminal", () => {
    for (const s of ORDER_STATUSES) {
      expect(canTransition("delivered", s)).toBe(false);
      expect(canTransition("cancelled", s)).toBe(false);
    }
    expect(nextStatuses("delivered")).toEqual([]);
  });

  it("restocks only on cancel", () => {
    expect(restocksOn("cancelled")).toBe(true);
    expect(restocksOn("shipped")).toBe(false);
  });
});
