import { describe, it, expect } from "vitest";
import { getProxyAddress, getProxyPrefix, formatProxyInput } from "../utils/proxyHelper";

describe("Proxy Formatting Utilities", () => {
  describe("getProxyAddress", () => {
    it("should strip schemes from proxy strings", () => {
      expect(getProxyAddress("http://user:pass@127.0.0.1:8080")).toBe("user:pass@127.0.0.1:8080");
      expect(getProxyAddress("https://user:pass@127.0.0.1:8080")).toBe("user:pass@127.0.0.1:8080");
      expect(getProxyAddress("socks5://user:pass@127.0.0.1:8080")).toBe("user:pass@127.0.0.1:8080");
      expect(getProxyAddress("socks5h://user:pass@127.0.0.1:8080")).toBe("user:pass@127.0.0.1:8080");
    });

    it("should return the original string if no scheme is present", () => {
      expect(getProxyAddress("user:pass@127.0.0.1:8080")).toBe("user:pass@127.0.0.1:8080");
      expect(getProxyAddress("")).toBe("");
      expect(getProxyAddress(null)).toBe("");
      expect(getProxyAddress(undefined)).toBe("");
    });
  });

  describe("getProxyPrefix", () => {
    it("should return correct prefix for each proxy type", () => {
      expect(getProxyPrefix("http")).toBe("http://");
      expect(getProxyPrefix("https")).toBe("https://");
      expect(getProxyPrefix("socks5")).toBe("socks5://");
      expect(getProxyPrefix("socks5h")).toBe("socks5h://");
      expect(getProxyPrefix(null)).toBe("http://");
      expect(getProxyPrefix(undefined)).toBe("http://");
    });
  });

  describe("formatProxyInput", () => {
    it("should format a proxy string with prefix", () => {
      expect(formatProxyInput("127.0.0.1:8080", "http")).toBe("http://127.0.0.1:8080");
    });

    it("should not duplicate the protocol if pasted with protocol", () => {
      expect(formatProxyInput("http://127.0.0.1:8080", "http")).toBe("http://127.0.0.1:8080");
      expect(formatProxyInput("https://127.0.0.1:8080", "https")).toBe("https://127.0.0.1:8080");
      expect(formatProxyInput("socks5://127.0.0.1:8080", "socks5")).toBe("socks5://127.0.0.1:8080");
    });

    it("should normalise protocol when pasted with different protocol to globalProxyType", () => {
      // If global type is socks5, but pasted http:// proxy, we strip http:// and prepend socks5://
      expect(formatProxyInput("http://127.0.0.1:8080", "socks5")).toBe("socks5://127.0.0.1:8080");
    });
  });
});
