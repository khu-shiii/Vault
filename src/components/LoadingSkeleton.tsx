import React from "react";

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3 animate-pulse">
      <div className="h-10 bg-slate-200/70 rounded-md w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 rounded-md w-full flex items-center px-4 gap-4">
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="h-4 bg-slate-200 rounded w-1/6" />
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-1/5 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4 animate-pulse shadow-sm">
      <div className="h-6 bg-slate-200 rounded w-1/3" />
      <div className="h-4 bg-slate-100 rounded w-2/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="h-20 bg-slate-100 rounded-lg" />
        <div className="h-20 bg-slate-100 rounded-lg" />
        <div className="h-20 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}
