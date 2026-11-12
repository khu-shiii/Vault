import React from "react";
import { CheckIcon, AlertTriangleIcon, ShieldCheckIcon, ShieldAlertIcon } from "./Icons";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "emerald" | "rose" | "amber" | "blue" | "slate" | "navy";
  size?: "sm" | "md" | "lg";
  icon?: "check" | "alert" | "shield-check" | "shield-alert" | "dot";
  className?: string;
}

export function Badge({
  children,
  variant = "slate",
  size = "md",
  icon,
  className = "",
}: BadgeProps) {
  const variantStyles = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/90",
    rose: "bg-rose-50 text-rose-700 border-rose-200/90",
    amber: "bg-amber-50 text-amber-800 border-amber-200/90",
    blue: "bg-blue-50 text-blue-700 border-blue-200/90",
    slate: "bg-slate-100 text-slate-700 border-slate-200/90",
    navy: "bg-slate-900 text-white border-slate-800",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-medium rounded-full",
    md: "px-2.5 py-1 text-xs font-semibold rounded-md",
    lg: "px-3 py-1.5 text-sm font-semibold rounded-lg",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border tracking-tight transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon === "check" && <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />}
      {icon === "alert" && <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-600" />}
      {icon === "shield-check" && <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600" />}
      {icon === "shield-alert" && <ShieldAlertIcon className="w-3.5 h-3.5 text-rose-600" />}
      {icon === "dot" && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            variant === "emerald"
              ? "bg-emerald-500"
              : variant === "rose"
              ? "bg-rose-500"
              : variant === "amber"
              ? "bg-amber-500"
              : variant === "blue"
              ? "bg-blue-500"
              : "bg-slate-400"
          }`}
        />
      )}
      {children}
    </span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case "UPLOAD":
      return (
        <Badge variant="emerald" size="sm" icon="dot">
          UPLOAD
        </Badge>
      );
    case "VIEW":
      return (
        <Badge variant="blue" size="sm" icon="dot">
          VIEW
        </Badge>
      );
    case "SIGN":
      return (
        <Badge variant="navy" size="sm" icon="dot">
          SIGN
        </Badge>
      );
    case "PERMISSION_UPDATE":
      return (
        <Badge variant="amber" size="sm" icon="dot">
          PERMISSION
        </Badge>
      );
    default:
      return (
        <Badge variant="slate" size="sm" icon="dot">
          {action}
        </Badge>
      );
  }
}

export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "ADMIN":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-900 text-white border border-slate-700 shadow-xs">
          ADMIN
        </span>
      );
    case "SIGNER":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
          SIGNER
        </span>
      );
    case "VIEWER":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
          VIEWER
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300">
          {role}
        </span>
      );
  }
}
