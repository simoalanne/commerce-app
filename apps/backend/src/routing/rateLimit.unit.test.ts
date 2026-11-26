import assert from "node:assert";

import { describe, it } from "vitest";

import { ipKeyGenerator } from "./rateLimit.ts";

describe("ipKeyGenerator", () => {
  it("normalizes IPv6 addresses into stable rate-limit keys", () => {
    assert.equal(ipKeyGenerator("203.0.113.5"), "203.0.113.5");
    assert.equal(ipKeyGenerator("::ffff:203.0.113.5"), "203.0.113.5");
    assert.equal(
      ipKeyGenerator("2001:db8:abcd:1234:1111:2222:3333:4444"),
      "2001:db8:abcd:1200::/56",
    );
    assert.equal(
      ipKeyGenerator("2001:db8:abcd:1234:1111:2222:3333:4444"),
      ipKeyGenerator("2001:db8:abcd:12ff:aaaa:bbbb:cccc:dddd"),
    );
  });
});
