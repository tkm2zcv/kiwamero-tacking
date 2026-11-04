import Image from "next/image";
import { serverCountryCode } from "@/lib/server-country";

export function ServerLabel({ cluster }: { cluster: string }) {
  const cc = serverCountryCode(cluster);
  return (
    <span className="inline-flex min-w-0 items-center gap-1 align-middle">
      {cc ? <Image src={`https://flagcdn.com/w20/${cc}.png`} alt="" aria-hidden="true"
        width={14} height={10} className="v3-flag shrink-0 object-contain" loading="lazy" unoptimized /> : null}
      <span>{cluster}</span>
    </span>
  );
}
