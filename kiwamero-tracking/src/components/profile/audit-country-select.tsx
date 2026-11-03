"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AuditCountry } from "@/lib/report-model";

export function AuditCountrySelect({
  label,
  noneLabel,
  options,
  selected,
}: {
  label: string;
  noneLabel: string;
  options: AuditCountry[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (code: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (code) params.set("country", code); else params.delete("country");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <label className="kt-report-country">
      <span>{label}</span>
      <select value={selected} onChange={(event) => onChange(event.target.value)}>
        <option value="">{noneLabel}</option>
        {options.map((country) => (
          <option key={country.code} value={country.code}>
            {country.emoji} {country.nameJa} / {country.nameEn}
          </option>
        ))}
      </select>
    </label>
  );
}
