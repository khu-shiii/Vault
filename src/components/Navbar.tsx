"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldIcon, LogOutIcon, MenuIcon, XIcon, LockIcon } from "./Icons";
import { RoleBadge } from "./Badge";
import { useAuth, UserProfile } from "@/context/AuthContext";

interface NavbarProps {
  user?: UserProfile | null;
  onLogout?: () => Promise<void> | void;
}

export function Navbar({ user: propUser, onLogout: propLogout }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const auth = useAuth();

  // Use props if explicitly passed, otherwise fallback to AuthContext
  const currentUser = propUser !== undefined ? propUser : auth.user;
  const handleLogout = propLogout || auth.logout;
  const isAuthLoading = propUser === undefined && auth.loading;

  const navLinks = [
    { href: "/", label: "Overview" },
    { href: "/dashboard", label: "Document Ledger" },
    { href: "/verify", label: "Verify File" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:text-blue-300 group-hover:bg-blue-600/30 transition-all">
                <ShieldIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-wider text-base text-white flex items-center gap-1.5">
                  VAULT
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-950 animate-pulse"
                    title="System Active"
                  />
                </span>
                <span className="text-[10px] tracking-widest text-slate-400 uppercase font-medium">
                  Cryptographic Attestation
                </span>
              </div>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-2 rounded-md text-sm font-medium transition-all duration-150 min-h-[40px] flex items-center ${
                      active
                        ? "bg-slate-800 text-white font-semibold shadow-xs"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Desktop Right Side / User Auth */}
          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1.5">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[180px]">
                    {currentUser.email}
                  </span>
                  <div className="flex justify-end mt-0.5">
                    <RoleBadge role={currentUser.role} />
                  </div>
                </div>
                {handleLogout && (
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOutIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : isAuthLoading ? (
              <div className="h-9 w-28 rounded-lg bg-slate-800/60 animate-pulse border border-slate-800" />
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 min-h-[40px]"
                >
                  <LockIcon className="w-4 h-4" />
                  Sign In
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-5 space-y-3">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-base font-medium min-h-[44px] flex items-center ${
                    active
                      ? "bg-slate-800 text-white font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800">
            {currentUser ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-800">
                  <div className="truncate">
                    <p className="text-xs text-slate-400">Signed in as</p>
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {currentUser.email}
                    </p>
                  </div>
                  <RoleBadge role={currentUser.role} />
                </div>
                {handleLogout && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded-lg hover:bg-rose-950/60 transition-colors"
                  >
                    <LogOutIcon className="w-4 h-4" />
                    Sign Out
                  </button>
                )}
              </div>
            ) : isAuthLoading ? (
              <div className="h-10 w-full rounded-lg bg-slate-800/60 animate-pulse" />
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm"
              >
                <LockIcon className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
