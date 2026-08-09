module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // DESIGN.md §2.1 — Base "Kertas Peta"
        canvas: "#F5F4F1",
        "canvas-dark": "#1C1A16",
        ink: "#22201B",
        "ink-dark": "#F5F4F1",
        "ink-muted": "#7A7568",
        "ink-muted-dark": "#A39C8E",
        surface: "#FFFFFF",
        "surface-dark": "#262420",
        // Brand — #ea580c di kedua mode
        "brand-orange": "#ea580c",
        // Dark mode — oranye lebih terang supaya "hidup" di background gelap
        // (dipakai khusus untuk teks/ikon/border oranye: dark:text-brand-orange-dark).
        // Tombol solid brand-orange tidak diubah (teks putih di atas oranye sudah
        // kontras cukup). DESIGN.md §2.2a.
        "brand-orange-dark": "#FB923C",
        // Status booking (dengan varian dark mode ber-kontras WCAG AA)
        "status-pending": "#A16207",
        "status-pending-dark": "#FACC15",
        "status-paid": "#2F7A4D",
        "status-paid-dark": "#4ADE80",
        "stamp-red": "#A5342A",
        "status-failed": "#B3261E",
        "status-failed-dark": "#F87171",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
}