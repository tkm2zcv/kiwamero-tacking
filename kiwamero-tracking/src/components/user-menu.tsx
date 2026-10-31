"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, KeyRound, LogOut } from "lucide-react";
import { signIn, signOut } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/client";
import { DiscordIcon } from "./login-button";

export function UserMenu({
  signedIn,
  name,
  email,
  image,
  discordId,
}: {
  signedIn: boolean;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  discordId?: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function login() {
    setBusy(true);
    try {
      await signIn.social({ provider: "discord", callbackURL: "/" });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await signOut();
      setOpen(false);
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const displayName = name || t.nav.account;
  const meta = discordId ? `Discord ID ${discordId}` : email || t.nav.connected;

  return (
    <div ref={rootRef} className="kt-user-menu">
      <button
        ref={buttonRef}
        type="button"
        className="kt-user-menu__button"
        aria-label={t.nav.accountMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {signedIn && image ? (
          <Image src={image} alt="" width={36} height={36} className="kt-user-menu__button-image" />
        ) : (
          <DiscordIcon className="size-5" />
        )}
      </button>

      {open ? (
        <div className="kt-user-menu__panel" role="menu" aria-label={t.nav.accountMenu}>
          {signedIn ? (
            <div className="kt-user-menu__header">
              <div className="kt-user-menu__avatar" aria-hidden="true">
                {image ? <Image src={image} alt="" width={38} height={38} /> : <DiscordIcon className="size-5" />}
              </div>
              <div className="kt-user-menu__identity">
                <div className="kt-user-menu__name">{displayName}</div>
                <div className="kt-user-menu__meta">{meta}</div>
              </div>
            </div>
          ) : null}

          {signedIn ? (
            <>
              <Link href="/watchlist" role="menuitem" className="kt-user-menu__item" onClick={() => setOpen(false)}>
                <Eye size={17} />
                {t.nav.watchlist}
              </Link>
              <Link href="/developers" role="menuitem" className="kt-user-menu__item" onClick={() => setOpen(false)}>
                <KeyRound size={17} />
                {t.nav.developers}
              </Link>
              <button type="button" role="menuitem" className="kt-user-menu__item" disabled={busy} onClick={logout}>
                <LogOut size={17} />
                {t.nav.signOut}
              </button>
            </>
          ) : (
            <button type="button" role="menuitem" className="kt-user-menu__item" disabled={busy} onClick={login}>
              <DiscordIcon className="size-4" />
              {t.access.signIn}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
