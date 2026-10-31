"use client";

import { useEffect } from "react";
import { consumeSearchIntent, recordSearch } from "@/lib/search-history";

/** Records the view only when it fulfills a real search from a search UI. Renders nothing. */
export function ProfileViewRecorder(props: {
  name: string;
  tag: string;
  puuid: string;
  card?: string;
  rankIcon?: string;
  rankName?: string;
}) {
  const { name, tag, puuid, card, rankIcon, rankName } = props;
  useEffect(() => {
    if (consumeSearchIntent(name, tag)) {
      recordSearch({ name, tag, puuid, card, rankIcon, rankName });
    }
  }, [name, tag, puuid, card, rankIcon, rankName]);
  return null;
}
