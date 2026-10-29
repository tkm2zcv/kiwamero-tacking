import { cookies, headers } from "next/headers";
import { dicts, type Dict, type Locale } from "./dict";
import { resolveLocale } from "./locale";

export async function getLocale(): Promise<Locale> {
  const [store, requestHeaders] = await Promise.all([cookies(), headers()]);
  return resolveLocale(store.get("lang")?.value, requestHeaders.get("accept-language"));
}

export async function getDict(): Promise<Dict> {
  return dicts[await getLocale()];
}
