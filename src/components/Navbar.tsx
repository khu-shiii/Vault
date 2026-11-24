"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldIcon, LogOutIcon, MenuIcon, XIcon } from "./Icons";
import { RoleBadge } from "./Badge";
import { useAuth, UserProfile } from "@/context/AuthContext";

interface NavbarProps {
  user?: UserProfile | null;
  onLogout?: () => Promise<void> | void;
}

export function Navbar({ user: propUser, onLogout: propLogout }: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const auth = useAuth();

  const currentUser = propUser !== undefined ? propUser : auth.user;
  const handleLogout = propLogout || auth.logout;
  const isAuthLoading = propUser === undefined && auth.loading;

  const links = [
    { href: "/dashboard", label: "Ledger" },
    { href: "/verify", label: "Verify" },
    ...(currentUser ? [{ href: "/analytics", label: "Analytics" }] : []),
    ...(currentUser ? [{ href: "/operator", label: "Operator" }] : []),
    ...(currentUser?.role === "ADMIN" ? [{ href: "/admin/users", label: "Users" }] : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 rounded-md">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <ShieldIcon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">Vault</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {currentUser ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-1.5">
              <div className="flex flex-col items-end leading-tight">
                <span className="max-w-[200px] truncate text-xs font-medium text-slate-800">{currentUser.email}</span>
                <span className="mt-0.5">
                  <RoleBadge role={currentUser.role} />
                </span>
              </div>
              {handleLogout && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-600"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOutIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : isAuthLoading ? (
            <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
              >
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-5 pt-3 md:hidden">
          <nav aria-label="Mobile" className="space-y-1">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex h-11 items-center rounded-lg px-3 text-sm font-medium ${
                    active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-slate-200 pt-4">
            {currentUser ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{currentUser.email}</p>
                  <div className="mt-1">
                    <RoleBadge role={currentUser.role} />
                  </div>
                </div>
                {handleLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <LogOutIcon className="h-4 w-4" />
                    Sign out
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center justify-center rounded-lg border border-slate-200 text-sm font-medium text-slate-700"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}