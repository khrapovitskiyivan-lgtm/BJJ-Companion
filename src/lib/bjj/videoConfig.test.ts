import { describe, it, expect } from "vitest";
import { bunnyEmbedUrl } from "./videoConfig";

describe("bunnyEmbedUrl", () => {
  it("строит embed-URL из library id и guid", () => {
    expect(bunnyEmbedUrl("abc-123", "42")).toBe(
      "https://iframe.mediadelivery.net/embed/42/abc-123",
    );
  });
});
