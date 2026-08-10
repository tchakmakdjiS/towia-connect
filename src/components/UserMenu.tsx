import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { useAuth, displayName, initials } from "@/lib/auth";
import { ROLE_LABELS, profilePath } from "@/lib/towia";

export function UserMenu() {
  const { user, role, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const name = displayName(profile, user?.email ?? null);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 text-left transition-colors hover:border-primary"
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Avatar de ${name}`}
            className="size-8 rounded-lg object-cover"
          />
        ) : (
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-primary text-xs font-semibold text-primary-foreground">
            {initials(name)}
          </span>
        )}
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[10rem] truncate text-sm font-medium">{name}</span>
          <span className="block text-[11px] text-muted-foreground">
            {role ? ROLE_LABELS[role] : "—"}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-elevated"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            to={profilePath(role)}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <UserIcon className="size-4" /> Mon profil
          </Link>
          <Link
            to={profilePath(role)}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-4" /> Paramètres
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4" /> Déconnexion
          </button>
        </div>
      ) : null}
    </div>
  );
}
