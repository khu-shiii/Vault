"use client";

import React, { useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  title?: string;
}

export function CopyButton({ text, label, className = "", title = "Copy to clipboard" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[36px] min-w-[36px] sm:min-h-[32px] sm:min-w-[32px] rounded-md text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        copied
          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
          : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200"
      } ${className}`}
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
          <span>{label ? "Copied" : "Copied"}</span>
        </>
      ) : (
        <>
          <CopyIcon className="w-3.5 h-3.5 text-slate-500" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
}
