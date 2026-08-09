"use client";

import { toast as sonner } from "sonner";
import { CheckCircle2, XCircle, Info, Loader2 } from "lucide-react";

// DESIGN.md §2 — wrapper toast Sonner via toast.custom(), BUKAN richColors.
// Warna TOAST DINETRALISIR: sukses = brand-orange penuh,
// error = ink-muted netral (abu) — sengaja BUKAN hijau/merah generik supaya
// toast tidak terkesan sistem sukses/error standar. info→status-pending,
// loading→brand-orange (bukan representasi sukses/error, tetap dipertahankan).

type ToastKind = "success" | "error" | "info" | "loading";

type ToastOptions = {
  description?: string;
  duration?: number;
};

const KINDS: Record<
  ToastKind,
  { icon: typeof CheckCircle2; box: string; iconClass: string; spin?: boolean }
> = {
  success: {
    icon: CheckCircle2,
    box: "bg-brand-orange text-white border-l-brand-orange",
    iconClass: "text-white",
  },
  error: {
    icon: XCircle,
    box: "bg-ink-muted text-white border-l-ink-muted",
    iconClass: "text-white",
  },
  info: {
    icon: Info,
    box: "bg-ink text-white border-l-status-pending",
    iconClass: "text-white",
  },
  loading: {
    icon: Loader2,
    box: "bg-ink text-white border-l-brand-orange",
    iconClass: "text-brand-orange",
    spin: true,
  },
};

function ToastShell({
  id,
  kind,
  message,
  description,
}: {
  id: string | number;
  kind: ToastKind;
  message: string;
  description?: string;
}) {
  const K = KINDS[kind];
  const Icon = K.icon;
  return (
    <div
      role="status"
      onClick={() => sonner.dismiss(id)}
      className={`pointer-events-auto flex items-start gap-3 border-l-4 ${K.box} w-full max-w-sm rounded-r-lg px-4 py-3 shadow-lg shadow-ink/15 cursor-pointer`}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-px ${K.iconClass} ${K.spin ? "animate-spin" : ""}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{message}</p>
        {description && <p className="mt-0.5 text-xs opacity-85 leading-relaxed">{description}</p>}
      </div>
    </div>
  );
}

function show(kind: ToastKind, message: string, opts?: ToastOptions) {
  return sonner.custom(
    (id) => <ToastShell id={id} kind={kind} message={message} description={opts?.description} />,
    { duration: kind === "loading" ? Infinity : opts?.duration }
  );
}

export const toast = {
  success: (message: string, opts?: ToastOptions) => show("success", message, opts),
  error: (message: string, opts?: ToastOptions) => show("error", message, opts),
  info: (message: string, opts?: ToastOptions) => show("info", message, opts),
  loading: (message: string, opts?: ToastOptions) => show("loading", message, opts),
  dismiss: (id?: number | string) => sonner.dismiss(id),
  message: (message: string, opts?: ToastOptions) => show("info", message, opts),
};

export default toast;
