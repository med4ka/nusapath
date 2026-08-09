"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, Pencil, Trash2, RefreshCw, X, ImagePlus, ChevronLeft, ChevronRight, Star, ShieldCheck } from "lucide-react";
import { toast } from "../lib/toast";
import { useAuth } from "../lib/AuthContext";

type DestinationRow = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  image_url: string;
  images_count: number;
};

type DestImage = {
  id: number;
  destination_id: number;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
};

type ListResponse = {
  data: DestinationRow[];
  meta: { page: number; limit: number; total: number; total_pages: number };
};

type DeleteResponse = { message: string; mode: "soft" | "hard" };

const LIMIT = 10;
const formatPrice = (price: number) => new Intl.NumberFormat("id-ID").format(price);

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = "Terjadi kesalahan, coba lagi";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
    }
    throw new Error(message);
  }
  return res.json();
}

// Remount via key from parent so form state stays fresh — no
// useEffect needed for reset (avoids react-hooks/set-state-in-effect).

function DestinationFormModal({
  target,
  onClose,
  onSaved,
}: {
  target: DestinationRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = target !== null;

  const [name, setName] = useState(target?.name ?? "");
  const [category, setCategory] = useState(target?.category ?? "");
  const [description, setDescription] = useState(target?.description ?? "");
  const [price, setPrice] = useState(target ? String(target.price) : "");
  const [rating, setRating] = useState(target ? String(target.rating) : "");
  const [imageUrl, setImageUrl] = useState(target?.image_url ?? "");
  const [extraUrls, setExtraUrls] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Existing photos (edit mode) — fetched from GET /api/destinations/:id
  // because table list only has images_count, not the photo list.
  const [existingImages, setExistingImages] = useState<DestImage[] | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    api<{ images: DestImage[] }>(`/api/destinations/${target.id}`)
      .then((detail) => {
        if (!cancelled) setExistingImages(detail.images);
      })
      .catch(() => {
        if (!cancelled) toast.error("Gagal memuat foto existing");
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const removeExistingImage = async (image: DestImage) => {
    if (!target) return;
    setRemovingId(image.id);
    try {
      await api(`/api/admin/destinations/${target.id}/images/${image.id}`, { method: "DELETE" });
      setExistingImages((prev) => (prev ?? []).filter((img) => img.id !== image.id));
      toast.success("Foto dihapus dari tabel destination_images");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus foto");
    } finally {
      setRemovingId(null);
    }
  };

  const fieldClass =
    "w-full px-4 py-3 bg-canvas dark:bg-canvas-dark border border-transparent rounded-xl text-sm font-medium text-ink dark:text-ink-dark outline-none placeholder:text-ink/40 focus:bg-white dark:focus:bg-surface-dark focus:border-brand-orange/30 focus:ring-4 focus:ring-brand-orange/10 transition-all";
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark mb-2";

  const setUrlAt = (index: number, value: string) => {
    setExtraUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const buildImagesPayload = (destinationId: number) => {
    const urls = extraUrls.map((u) => u.trim()).filter((u) => u.length > 0);
    const ops: Promise<unknown>[] = [];
    urls.forEach((url, i) => {
      ops.push(
        api(`/api/admin/destinations/${destinationId}/images`, {
          method: "POST",
          body: JSON.stringify({ image_url: url, sort_order: i + 1, is_primary: false }),
        })
      );
    });
    return ops;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const parsedPrice = Number(price);
    const parsedRating = rating === "" ? NaN : Number(rating);

    if (!trimmedName || !trimmedCategory) {
      toast.error("Nama dan kategori wajib diisi");
      return;
    }
    if (price === "" || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error("Harga harus angka lebih dari 0");
      return;
    }
    if (!Number.isNaN(parsedRating) && (parsedRating < 0 || parsedRating > 5)) {
      toast.error("Rating harus antara 0 dan 5");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && target) {
        const payload: Record<string, unknown> = {};
        if (trimmedName !== target.name) payload.name = trimmedName;
        if (trimmedCategory !== target.category) payload.category = trimmedCategory;
        if (description !== target.description) payload.description = description;
        if (parsedPrice !== target.price) payload.price = parsedPrice;
        if (!Number.isNaN(parsedRating) && parsedRating !== target.rating) payload.rating = parsedRating;
        const trimmedImage = imageUrl.trim();
        if (trimmedImage !== "" && trimmedImage !== target.image_url) payload.image_url = trimmedImage;

        if (Object.keys(payload).length === 0) {
          toast.info("Tidak ada perubahan yang dikirim");
          return;
        }
        await api(`/api/admin/destinations/${target.id}`, { method: "PUT", body: JSON.stringify(payload) });
        const extraOps = buildImagesPayload(target.id);
        await Promise.all(extraOps);
        toast.success("Destinasi diperbarui");
      } else {
        const body: Record<string, unknown> = {
          name: trimmedName,
          category: trimmedCategory,
          description,
          price: parsedPrice,
        };
        if (!Number.isNaN(parsedRating)) body.rating = parsedRating;
        const trimmedImage = imageUrl.trim();
        if (trimmedImage !== "") body.image_url = trimmedImage;

        const created = await api<{ id: number }>("/api/admin/destinations", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const extraOps = buildImagesPayload(created.id);
        await Promise.all(extraOps);
        toast.success("Destinasi dibuat");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-surface dark:bg-surface-dark w-full max-w-lg rounded-3xl p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-canvas dark:bg-canvas-dark hover:bg-ink/10 dark:hover:bg-white/10 rounded-full transition-colors"
          aria-label="Tutup"
        >
          <X className="w-4 h-4 text-ink dark:text-ink-dark" />
        </button>

        <h2 className="font-display text-2xl text-ink dark:text-ink-dark">
          {isEdit ? "Edit Destinasi" : "Tambah Destinasi"}
        </h2>
        <p className="mt-1 text-xs text-ink-muted dark:text-ink-muted-dark">
          {isEdit ? "PUT partial — field yang tidak diubah tidak dikirim." : "Semua field baru masuk lewat endpoint admin."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className={labelClass}>Nama</label>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Candi Borobudur" maxLength={150} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Kategori</label>
              <input className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Sejarah" maxLength={50} />
            </div>
            <div>
              <label className={labelClass}>Harga (Rp)</label>
              <input className={`${fieldClass} font-mono`} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="350000" inputMode="numeric" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Rating (0–5)</label>
              <input className={`${fieldClass} font-mono`} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4.8" inputMode="decimal" />
            </div>
            <div>
              <label className={labelClass}>Foto Utama (URL)</label>
              <input className={fieldClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="/borobur.png" maxLength={255} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Deskripsi</label>
            <textarea className={`${fieldClass} min-h-[90px] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat destinasi..." maxLength={5000} />
          </div>

          {target && (
            <div>
              <label className={labelClass}>
                Foto Existing ({existingImages === null ? "memuat..." : `${existingImages.length} foto`})
              </label>
              {existingImages === null ? (
                <div className="h-12 rounded-xl bg-ink/5 animate-pulse" />
              ) : existingImages.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  Belum ada foto di tabel <span className="font-mono">destination_images</span>.
                </p>
              ) : (
                <div className="space-y-2">
                  {existingImages.map((img) => (
                    <div key={img.id} className="flex items-center gap-3 rounded-xl border border-ink/10 dark:border-white/10 bg-canvas dark:bg-canvas-dark p-2 pr-3">
                      <div
                        className="w-14 h-10 shrink-0 rounded-lg bg-cover bg-center bg-ink/10 dark:bg-white/10"
                        style={{ backgroundImage: `url(${img.image_url})` }}
                      />
                      <p className="flex-1 font-mono text-[11px] text-ink-muted dark:text-ink-muted-dark truncate">{img.image_url}</p>
                      {img.is_primary && (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-brand-orange dark:text-brand-orange-dark border border-brand-orange/30 dark:border-brand-orange-dark/30 rounded-full px-2 py-0.5">
                          utama
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img)}
                        disabled={removingId === img.id}
                        className="p-1.5 rounded-lg text-ink-muted dark:text-ink-muted-dark hover:text-status-failed dark:hover:text-status-failed-dark hover:bg-status-failed/10 dark:hover:bg-status-failed-dark/20 transition-colors disabled:opacity-40"
                        aria-label="Hapus foto"
                        title="Hapus foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>
              {target ? "Foto Baru (ditambahkan ke tabel saat simpan)" : "Foto Tambahan (URL teks — tiap baris satu foto)"}
            </label>
            <div className="space-y-2">
              {extraUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={fieldClass}
                    value={url}
                    onChange={(e) => setUrlAt(i, e.target.value)}
                    placeholder={`https://.../foto-${i + 1}.jpg`}
                    maxLength={255}
                  />
                  {extraUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExtraUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      className="px-3 rounded-xl border border-ink/15 text-ink-muted hover:text-status-failed hover:border-status-failed/40 transition-colors"
                      aria-label="Hapus baris foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExtraUrls((prev) => [...prev, ""])}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:underline"
            >
              <ImagePlus className="w-3.5 h-3.5" /> Tambah baris foto
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-ink/15 text-ink text-sm font-semibold hover:bg-ink/5 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90 active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              {isSubmitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Destinasi"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}



function DeleteConfirmModal({
  target,
  onClose,
  onDeleted,
}: {
  target: DestinationRow;
  onClose: () => void;
  onDeleted: (mode: "soft" | "hard") => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api<DeleteResponse>(`/api/admin/destinations/${target.id}`, { method: "DELETE" });
      onDeleted(res.mode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
      setIsDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-surface dark:bg-surface-dark w-full max-w-md rounded-3xl p-7 shadow-2xl">
        <h2 className="font-display text-2xl text-ink dark:text-ink-dark">Hapus Destinasi?</h2>
        <p className="mt-3 text-sm text-ink dark:text-ink-dark leading-relaxed">
          <span className="font-semibold">{target.name}</span> akan dihapus. Hasilnya tergantung
          riwayat booking:
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-ink/10 dark:border-white/10 bg-canvas dark:bg-canvas-dark p-4">
            <p className="text-xs font-bold text-ink dark:text-ink-dark uppercase tracking-wide">Ada booking terkait</p>
            <p className="mt-1 text-xs text-ink-muted dark:text-ink-muted-dark leading-relaxed">
              <span className="font-mono text-status-pending">Soft delete</span> — destinasi hilang
              dari list publik & tidak bisa di-booking, tapi data transaksi lama tetap utuh.
            </p>
          </div>
          <div className="rounded-xl border border-ink/10 dark:border-white/10 bg-canvas dark:bg-canvas-dark p-4">
            <p className="text-xs font-bold text-ink dark:text-ink-dark uppercase tracking-wide">Tidak ada booking</p>
            <p className="mt-1 text-xs text-ink-muted dark:text-ink-muted-dark leading-relaxed">
              <span className="font-mono text-status-failed">Hard delete</span> — row dihapus
              permanen, tidak bisa dikembalikan.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-ink/15 text-ink text-sm font-semibold hover:bg-ink/5 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-3 rounded-xl bg-status-failed text-white text-sm font-semibold shadow-lg shadow-status-failed/25 hover:bg-status-failed/90 active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const allowed = !isLoading && !!user && user.role === "admin";

  const [destinations, setDestinations] = useState<DestinationRow[] | null>(null);
  const [meta, setMeta] = useState<ListResponse["meta"] | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DestinationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DestinationRow | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isLoading && !allowed) router.replace("/");
  }, [isLoading, allowed, router]);

  // Fetch list — promise chain pattern (same as page.tsx home): inside
  // effect NO synchronous setState (react-hooks/set-state-in-effect).
  // loading/error state triggered from event handlers (goToPage/retry/onSaved).
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    fetch(`/api/destinations?page=${page}&limit=${LIMIT}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: ListResponse) => {
        if (cancelled) return;
        setDestinations(data.data);
        setMeta(data.meta);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, page, reloadKey]);

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), meta?.total_pages ?? 1));
    setLoading(true);
    setError(false);
  };

  const retry = () => {
    setLoading(true);
    setError(false);
    setReloadKey((k) => k + 1);
  };

  if (isLoading || !allowed) return null;

  const totalPages = meta?.total_pages ?? 1;

  return (
    <main className="bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark min-h-screen pb-24">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-12 md:pt-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
              <ShieldCheck className="w-4 h-4" /> Panel Admin — {user?.email}
            </span>
            <h1 className="mt-3 font-display text-4xl md:text-5xl text-ink dark:text-ink-dark">Kelola Destinasi</h1>
          </div>
          <button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 bg-brand-orange text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90 hover:scale-[1.02] active:scale-95 transition-all w-fit"
          >
            <Plus className="w-4 h-4" /> Tambah Destinasi
          </button>
        </div>

        <div className="mt-8 bg-surface rounded-3xl border border-ink/10 shadow-sm overflow-hidden">
          {error ? (
            <div className="p-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-status-failed">Gagal memuat daftar destinasi</p>
                <p className="text-xs text-ink-muted mt-1">Pastikan backend Golang berjalan di :8081, lalu coba lagi.</p>
              </div>
              <button
                onClick={retry}
                className="sm:ml-auto px-4 py-2.5 rounded-xl border border-status-failed/40 text-status-failed text-xs font-bold hover:bg-status-failed/10 transition-colors flex items-center gap-2 w-fit"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
              </button>
            </div>
          ) : loading ? (
            <div className="divide-y divide-ink/5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-6 px-6 py-4">
                  <div className="h-4 w-1/3 rounded bg-ink/5 animate-pulse" />
                  <div className="h-4 w-16 rounded bg-ink/5 animate-pulse" />
                  <div className="h-4 w-20 rounded bg-ink/5 animate-pulse" />
                  <div className="h-4 w-12 rounded bg-ink/5 animate-pulse" />
                  <div className="h-4 w-10 rounded bg-ink/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                    <th className="px-6 py-4 font-medium">Destinasi</th>
                    <th className="px-6 py-4 font-medium">Kategori</th>
                    <th className="px-6 py-4 font-medium text-right">Harga</th>
                    <th className="px-6 py-4 font-medium text-right">Rating</th>
                    <th className="px-6 py-4 font-medium text-center">Foto</th>
                    <th className="px-6 py-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {(destinations ?? []).map((d) => (
                    <tr key={d.id} className="hover:bg-canvas/60 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-ink">{d.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted max-w-xs truncate">{d.description || "—"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2.5 py-1 rounded-full bg-brand-orange/10 text-brand-orange font-mono text-[10px] uppercase tracking-[0.15em]">
                          {d.category || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-ink">
                        Rp {formatPrice(d.price)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-brand-orange dark:fill-brand-orange-dark text-brand-orange dark:text-brand-orange-dark" />
                          {d.rating.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-ink-muted">{d.images_count}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditTarget(d);
                              setFormOpen(true);
                            }}
                            className="p-2 rounded-lg border border-ink/15 text-ink-muted hover:text-brand-orange hover:border-brand-orange/40 transition-colors"
                            aria-label={`Edit ${d.name}`}
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(d)}
                            className="p-2 rounded-lg border border-ink/15 text-ink-muted hover:text-status-failed hover:border-status-failed/40 transition-colors"
                            aria-label={`Hapus ${d.name}`}
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!error && meta && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-ink/10 dark:border-white/10 bg-canvas/40 dark:bg-canvas-dark/40">
              <p className="text-xs text-ink-muted">
                Total <span className="font-mono text-ink font-medium">{meta.total}</span> destinasi —
                halaman <span className="font-mono text-ink font-medium">{meta.page}</span> dari{" "}
                <span className="font-mono text-ink font-medium">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-ink/15 text-ink-muted hover:text-brand-orange hover:border-brand-orange/40 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-ink/15 text-ink-muted hover:text-brand-orange hover:border-brand-orange/40 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Halaman berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <DestinationFormModal
          key={editTarget?.id ?? "new"}
          target={editTarget}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            // Reload same page — new/edited rows appear in
            // id order (new = last page).
            setLoading(true);
            setError(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(mode) => {
            setDeleteTarget(null);
            if (mode === "soft") {
              toast.success("Destinasi disembunyikan (soft delete) — transaksi lama tetap utuh");
            } else {
              toast.success("Destinasi dihapus permanen (hard delete) — tidak ada booking terkait");
            }
            if (destinations?.length === 1 && page > 1) {
              goToPage(page - 1);
            } else {
              setLoading(true);
              setError(false);
              setReloadKey((k) => k + 1);
            }
          }}
        />
      )}
    </main>
  );
}
