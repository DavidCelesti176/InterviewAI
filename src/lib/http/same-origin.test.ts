import assert from "node:assert/strict";
import test from "node:test";

import { isSameOrigin } from "./same-origin";

function request(headers: Record<string, string>, method = "GET"): Request {
  return new Request("https://classy-bubblegum-b0d332.netlify.app/api/billing", { method, headers });
}

test("a same-site GET without an Origin header is accepted", () => {
  assert.equal(
    isSameOrigin(request({ host: "classy-bubblegum-b0d332.netlify.app", "sec-fetch-site": "same-origin" })),
    true,
  );
  assert.equal(
    isSameOrigin(
      request({
        host: "classy-bubblegum-b0d332.netlify.app",
        referer: "https://classy-bubblegum-b0d332.netlify.app/dashboard",
      }),
    ),
    true,
  );
});

test("a cross-site GET and a POST without Origin stay rejected", () => {
  assert.equal(isSameOrigin(request({ host: "classy-bubblegum-b0d332.netlify.app", "sec-fetch-site": "cross-site" })), false);
  assert.equal(isSameOrigin(request({ host: "classy-bubblegum-b0d332.netlify.app" }, "POST")), false);
  assert.equal(
    isSameOrigin(
      request({
        host: "classy-bubblegum-b0d332.netlify.app",
        origin: "https://example.com",
      }),
    ),
    false,
  );
});
