import test from "node:test";
import assert from "node:assert/strict";
import { iconData, loadFonts } from "../src/lib/watch-card.ts";

const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url);
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("iconData rejects non-https and non-allowlisted URLs without fetching", async () => {
  const calls = stubFetch(() => new Response("ok"));
  assert.equal(await iconData("http://media.valorant-api.com/agents/x/displayicon.png"), null);
  assert.equal(await iconData("https://evil.example/icon.png"), null);
  assert.equal(await iconData("https://media.valorant-api.com.evil.example/icon.png"), null);
  assert.equal(await iconData("not a url"), null);
  assert.equal(await iconData(undefined), null);
  assert.equal(calls.length, 0);
});

test("iconData rejects non-image content types and error statuses", async () => {
  stubFetch(() => new Response("<html>", { headers: { "content-type": "text/html" } }));
  assert.equal(await iconData("https://media.valorant-api.com/agents/a/displayicon.png"), null);

  stubFetch(() => new Response("nope", { status: 500 }));
  assert.equal(await iconData("https://media.valorant-api.com/agents/b/displayicon.png"), null);
});

test("iconData rejects oversized bodies via content-length and after buffering", async () => {
  // Content-Length over the cap: rejected before the body is buffered.
  stubFetch(
    () =>
      new Response(new Uint8Array(4), {
        headers: { "content-type": "image/png", "content-length": String(513 * 1024) },
      }),
  );
  assert.equal(await iconData("https://media.valorant-api.com/agents/c/displayicon.png"), null);

  // Lying/absent Content-Length: the buffered body is still capped.
  stubFetch(
    () =>
      new Response(new Uint8Array(513 * 1024), {
        headers: { "content-type": "image/png", "content-length": "10" },
      }),
  );
  assert.equal(await iconData("https://media.valorant-api.com/agents/d/displayicon.png"), null);
});

test("iconData accepts an allowlisted https image and forbids redirects", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const calls = stubFetch(
    () => new Response(png, { headers: { "content-type": "image/png; charset=binary" } }),
  );
  const data = await iconData("https://media.valorant-api.com/agents/ok/displayicon.png");
  assert.equal(data, `data:image/png;base64,${Buffer.from(png).toString("base64")}`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init?.redirect, "manual");

  // Other allowlisted asset hosts work too, keeping their real content type.
  stubFetch(() => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }));
  const jpg = await iconData("https://imgsvc.trackercdn.com/url/size/image.jpg");
  assert.equal(jpg, "data:image/jpeg;base64,AQID");
  const redirects = stubFetch(() => new Response(null, {
    status: 302, headers: { location: "https://untrusted.example/image.png" },
  }));
  assert.equal(await iconData("https://media.valorant-api.com/agents/redirect/displayicon.png"), null);
  assert.equal(redirects.length, 1, "redirect target must never be fetched");
});

test("loadFonts fetches the css2 URL without a text= subset", async () => {
  const fontCss =
    "@font-face { font-family: 'Noto Sans JP'; font-style: normal; font-weight: 400; " +
    "src: url(https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75vY0rw-oME.woff2) format('woff2'); }";
  const calls = stubFetch((url) => {
    if (url.startsWith("https://fonts.googleapis.com/")) {
      return new Response(fontCss, { headers: { "content-type": "text/css" } });
    }
    if (url.startsWith("https://fonts.gstatic.com/")) {
      return new Response(new Uint8Array([9, 8, 7]));
    }
    return new Response("nope", { status: 404 });
  });

  const fonts = await loadFonts();
  assert.equal(fonts.length, 1);
  assert.equal(fonts[0].name, "Noto Sans JP");
  assert.equal(fonts[0].weight, 400);
  assert.ok(fonts[0].data.byteLength > 0);

  // The css2 request carries no text= subset, so card text (player names)
  // never leaves for Google; the TTF/woff2 fetch stays on fonts.gstatic.com.
  const cssUrl = new URL(calls[0].url);
  assert.equal(cssUrl.host, "fonts.googleapis.com");
  assert.equal(cssUrl.pathname, "/css2");
  assert.equal(cssUrl.searchParams.get("family"), "Noto Sans JP:wght@400;700");
  assert.equal(cssUrl.searchParams.has("text"), false);
  assert.equal(new Headers(calls[0].init?.headers).get("user-agent"), "Mozilla/4.0");
  assert.equal(calls[1].url.startsWith("https://fonts.gstatic.com/"), true);
});
