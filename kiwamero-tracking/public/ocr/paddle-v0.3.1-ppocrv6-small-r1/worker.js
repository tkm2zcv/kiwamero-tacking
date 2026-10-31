// Kiwamero adapter for the pinned, single-threaded pure-onnx-ocr WASM build.
// Only model/runtime assets are fetched; image bytes never leave this worker.
import init, { OcrEngineBuilder } from "./pure_onnx_ocr_wasm.js";

const BASE = new URL("./", import.meta.url);
const CACHE = "kiwamero-paddle-v0.3.1-ppocrv6-small-r1";
let engine = null;
let busy = false;

async function loadEngine(progress) {
  const response = await fetch(new URL("assets.json", BASE));
  if (!response.ok) throw new Error("OCR asset manifest unavailable");
  const { files } = await response.json();
  const names = ["pure_onnx_ocr_wasm_bg.wasm", "small_det.onnx", "small_det.yml", "small_rec.onnx", "small_rec.yml"];
  const total = names.reduce((sum, name) => sum + files[name].bytes, 0);
  let completed = 0;
  let cache;
  try { cache = await globalThis.caches?.open(CACHE); } catch { /* Cache is optional in private browsing. */ }

  async function verified(bytes, metadata) {
    if (bytes.byteLength !== metadata.bytes) return false;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("") === metadata.sha256;
  }

  async function asset(name) {
    const url = new URL(name, BASE), metadata = files[name];
    let hit;
    try { hit = await cache?.match(url); } catch { /* Continue without cached data. */ }
    if (hit) {
      const bytes = new Uint8Array(await hit.arrayBuffer());
      if (await verified(bytes, metadata)) {
        completed += bytes.byteLength;
        progress(completed, total);
        return bytes;
      }
    }
    const downloaded = await fetch(url);
    if (!downloaded.ok || !downloaded.body) throw new Error("OCR asset download failed");
    const chunks = [], reader = downloaded.body.getReader();
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > metadata.bytes) { await reader.cancel(); throw new Error("Invalid OCR asset length"); }
      chunks.push(value);
      progress(completed + size, total);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (!await verified(bytes, metadata)) throw new Error("OCR asset integrity check failed");
    try { await cache?.put(url, new Response(bytes)); } catch { /* Storage quota must not prevent OCR. */ }
    completed += size;
    progress(completed, total);
    return bytes;
  }

  await init({ module_or_path: await asset("pure_onnx_ocr_wasm_bg.wasm") });
  const decoder = new TextDecoder();
  const det = await asset("small_det.onnx"), detConfig = decoder.decode(await asset("small_det.yml"));
  const rec = await asset("small_rec.onnx"), recConfig = decoder.decode(await asset("small_rec.yml"));
  engine = new OcrEngineBuilder().detModel(det, detConfig).recModel(rec, recConfig)
    .detLimitSideLen(960).build();
}

globalThis.onmessage = async ({ data }) => {
  const { id, type } = data;
  const send = (type, fields = {}) => globalThis.postMessage({ id, type, ...fields });
  if (busy) { send("error"); return; }
  busy = true;
  try {
    if (type === "load") {
      if (!engine) await loadEngine((loaded, total) => send("progress", { stage: "loading", loaded, total }));
      send("ready");
    } else if (type === "run" && engine && data.image instanceof ArrayBuffer) {
      send("progress", { stage: "reading", loaded: 0, total: 1 });
      const output = engine.runWithMetrics(new Uint8Array(data.image));
      send("result", { results: output.results.map(({ text }) => ({ text })) });
    } else {
      throw new Error("Invalid OCR request");
    }
  } catch {
    send("error");
  } finally {
    busy = false;
  }
};
