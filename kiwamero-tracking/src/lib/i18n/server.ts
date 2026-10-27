import { cookies } from "next/headers";
import { dicts, defaultLocale, locales, type Dict, type Locale } from "./dict";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get("lang")?.value;
  return locales.includes(v as Locale) ? (v as Locale) : defaultLocale;
}

export async function getDict(): Promise<Dict> {
  return dicts[await getLocale()];
}
