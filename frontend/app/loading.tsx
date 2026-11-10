"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Overlay uses position:fixed rendered via portal to document.body with a
// mounted guard — any ancestor with transform/backdrop-filter changes the
// containing block for fixed elements.
export default function Loading() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-white/60 dark:bg-canvas-dark/80 backdrop-blur-md z-[100] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-700 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-orange-700 rounded-full animate-ping"></div>
          </div>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-sm font-bold text-gray-800 animate-pulse uppercase tracking-widest">Memproses Data...</p>
          <p className="text-[10px] text-gray-400 font-medium italic">NusaPath sedang menyiapkan rute terbaik untukmu</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 w-64 opacity-20">
          <div className="h-20 bg-gray-200 rounded-2xl animate-pulse"></div>
          <div className="h-20 bg-gray-200 rounded-2xl animate-pulse delay-75"></div>
        </div>
      </div>
    </div>,
    document.body
  );
}