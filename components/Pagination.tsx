"use client";
export default function Pagination({ page, pages, onPage }: {
  page: number; pages: number; onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm">
      <button className="btn-ghost btn !py-1 !px-3" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
      <span className="text-slate-500">Page {page} / {pages}</span>
      <button className="btn-ghost btn !py-1 !px-3" disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}
