"use client";

import { useEffect } from "react";
import { recordSearch } from "@/lib/search-history";

/** Records the viewed profile into localStorage search history. Renders nothing. */
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
    recordSearch({ name, tag, puuid, card, rankIcon, rankName });
  }, [name, tag, puuid, card, rankIcon, rankName]);
  return null;
}
