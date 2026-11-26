import { ipKeyGenerator } from "./rateLimit.ts";

describe("ipKeyGenerator", () => {
  it("normalizes IPv6 addresses into stable rate-limit keys", () => {
    expect(ipKeyGenerator("203.0.113.5")).toBe("203.0.113.5");
    expect(ipKeyGenerator("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(ipKeyGenerator("2001:db8:abcd:1234:1111:2222:3333:4444")).toBe(
      "2001:db8:abcd:1200::/56",
    );
    expect(ipKeyGenerator("2001:db8:abcd:1234:1111:2222:3333:4444")).toBe(
      ipKeyGenerator("2001:db8:abcd:12ff:aaaa:bbbb:cccc:dddd"),
    );
  });
});
