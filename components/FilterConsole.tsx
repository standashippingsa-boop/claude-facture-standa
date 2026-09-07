"use client";

import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

export type FilterField = {
  key: string;
  label: string;
  type?: "select" | "text" | "date" | "number";
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
  min?: number;
  step?: number;
};

/**
 * Menm kontwòl filtraj pou tout lis entèn STANDA yo. Chak paj bay kritè ki
 * gen sans pou done pa li; ba a toujou kenbe menm jan: rechèch, filtè avanse,
 * efase, kantite rezilta, epi (si paj la pèmèt) seleksyon tout rezilta yo.
 */
export default function FilterConsole({
  query, onQueryChange, queryPlaceholder = "Rechercher…", fields, onClear,
  resultCount, selection,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  queryPlaceholder?: string;
  fields: FilterField[];
  onClear: () => void;
  resultCount?: number;
  selection?: {
    selectedCount: number;
    allSelected: boolean;
    onToggleAll: () => void;
    label?: string;
    disabled?: boolean;
  };
}) {
  const activeCount = (query.trim() ? 1 : 0) + fields.filter((field) => field.value !== "").length;
  const showFields = fields.length > 0;

  return (
    <div className="card p-3 sm:p-3.5 space-y-3">
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
        <label className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input w-full !pl-9" value={query} onChange={(event) => onQueryChange(event.target.value)}
            placeholder={queryPlaceholder} />
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          {showFields && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-navy/5 text-navy px-2.5 py-2 text-xs font-bold">
              <SlidersHorizontal size={14} /> Filtres{activeCount ? ` · ${activeCount}` : ""}
            </span>
          )}
          {resultCount !== undefined && <span className="text-xs font-semibold text-mute px-1">{resultCount} résultat{resultCount > 1 ? "s" : ""}</span>}
          {activeCount > 0 && (
            <button type="button" onClick={onClear} className="btn btn-ghost !py-2 !px-2.5 text-xs" title="Effacer tous les filtres">
              <RotateCcw size={14} /> Effacer
            </button>
          )}
          {selection && (
            <button type="button" onClick={selection.onToggleAll} disabled={selection.disabled}
              className="btn btn-brand !py-2 text-xs disabled:opacity-50">
              <Filter size={14} /> {selection.allSelected ? "Désélectionner" : selection.label ?? "Sélectionner les résultats"}
              {selection.selectedCount > 0 ? ` (${selection.selectedCount})` : ""}
            </button>
          )}
        </div>
      </div>

      {showFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {fields.map((field) => (
            <label key={field.key} className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wide font-bold text-mute mb-1">{field.label}</span>
              {field.type === "select" ? (
                <select className="input w-full !py-2 text-xs" value={field.value} onChange={(event) => field.onChange(event.target.value)}>
                  <option value="">Tous</option>
                  {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input className="input w-full !py-2 text-xs" type={field.type ?? "text"} value={field.value}
                  min={field.min} step={field.step} placeholder={field.placeholder}
                  onChange={(event) => field.onChange(event.target.value)} />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
