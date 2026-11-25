import { useState, KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Ban, Maximize2, Search, Trash2, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { MonitorFilters } from "../monitorFilterTypes";

interface Props {
  filters: MonitorFilters;
  onFiltersChange: (f: MonitorFilters) => void;
}

const MAX_KEYWORD_LENGTH = 30;
const MAX_KEYWORDS = 100;
const NO_FOCUS_FLASH = "focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0";

const sanitizeKeyword = (raw: string): string =>
  raw
    .replace(/[\u0000-\u001F\u007F<>"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, MAX_KEYWORD_LENGTH);

export const KeywordsFilterSection = ({ filters, onFiltersChange }: Props) => {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Force block-list mode (allow-list removed).
  useEffect(() => {
    if (filters.keywordMode !== 'block') {
      onFiltersChange({ ...filters, keywordMode: 'block' });
    }
  }, [filters.keywordMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const addKeyword = (rawValue?: string) => {
    const source = rawValue ?? draft;
    const v = sanitizeKeyword(source).trim();
    if (!v) {
      setError(source.trim() ? "Invalid characters" : null);
      return;
    }
    if (v.length < 2) {
      setError("Min 2 characters");
      return;
    }
    if (filters.keywords.length >= MAX_KEYWORDS) {
      setError(`Limit ${MAX_KEYWORDS} keywords`);
      return;
    }
    if (filters.keywords.some(k => k.toLowerCase() === v.toLowerCase())) {
      setError("Already in list");
      if (!rawValue) setDraft("");
      return;
    }
    onFiltersChange({ ...filters, keywords: [...filters.keywords, v], keywordMode: 'block' });
    if (!rawValue) setDraft("");
    setError(null);
  };

  const removeKeyword = (k: string) => {
    onFiltersChange({ ...filters, keywords: filters.keywords.filter(x => x !== k) });
  };

  const clearAll = () => {
    onFiltersChange({ ...filters, keywords: [] });
  };

  // Double-click to confirm clear: first click arms, second within 2s clears
  const armRef = useRef<number | null>(null);
  const [armed, setArmed] = useState(false);

  const handleClearClick = () => {
    if (filters.keywords.length === 0) return;
    if (armed) {
      clearAll();
      setArmed(false);
      if (armRef.current) window.clearTimeout(armRef.current);
      armRef.current = null;
      return;
    }
    setArmed(true);
    if (armRef.current) window.clearTimeout(armRef.current);
    armRef.current = window.setTimeout(() => setArmed(false), 2000);
  };

  useEffect(() => () => { if (armRef.current) window.clearTimeout(armRef.current); }, []);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  const sanitizedDraft = sanitizeKeyword(draft);
  const remaining = MAX_KEYWORD_LENGTH - sanitizedDraft.length;
  const atLimit = filters.keywords.length >= MAX_KEYWORDS;
  const filledPercent = (filters.keywords.length / MAX_KEYWORDS) * 100;

  const filteredKeywords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filters.keywords;
    return filters.keywords.filter(k => k.toLowerCase().includes(q));
  }, [filters.keywords, search]);

  const totalPages = Math.max(1, Math.ceil(filteredKeywords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [safePage, page]);
  useEffect(() => { setPage(0); }, [search]);
  const pageStart = safePage * PAGE_SIZE;
  const pageItems = filteredKeywords.slice(pageStart, pageStart + PAGE_SIZE);


  // Compact mode: when many keywords, switch from chip-list to summary button
  // Compact mode: chips fit ~3 per row at 402px, so >6 means 3+ rows starting
  // Compact mode: chips ≈2 per row in 402px panel → >4 = 3rd row starting
  const compactMode = filters.keywords.length > 4;

  const Chip = ({ k }: { k: string }) => (
    <span className="group inline-flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/25 hover:border-destructive/50 hover:bg-destructive/15 transition-colors">
      <span className="max-w-[140px] truncate">{k}</span>
      <button
        onClick={() => removeKeyword(k)}
        className={`inline-flex items-center justify-center h-4 w-4 rounded-sm opacity-60 hover:opacity-100 hover:bg-destructive/30 transition-all ${NO_FOCUS_FLASH}`}
        aria-label={`Remove ${k}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded border border-destructive/50 bg-destructive/15 text-destructive shadow-[0_0_8px_-2px_hsl(var(--destructive)/0.4)]">
          <Ban className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-none">Blocklist</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Hide items containing these keywords</p>
        </div>
        {/* Capacity meter + count */}
        <div className="flex items-center gap-1.5">
          <div className="relative h-1 w-10 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 transition-all ${
                filledPercent >= 90 ? 'bg-destructive' : filledPercent >= 60 ? 'bg-amber-500' : 'bg-destructive/60'
              }`}
              style={{ width: `${filledPercent}%` }}
            />
          </div>
          <span className={`text-[10px] tabular-nums font-medium ${atLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {filters.keywords.length}/{MAX_KEYWORDS}
          </span>
        </div>
      </div>

      {/* Add row */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Input
              value={draft}
              onChange={(e) => { setDraft(sanitizeKeyword(e.target.value)); setError(null); }}
              onKeyDown={onKey}
              placeholder='Type keyword to block…'
              maxLength={MAX_KEYWORD_LENGTH}
              className="h-8 text-xs pr-9 border-border/60 focus-visible:ring-destructive/40 focus-visible:border-destructive/50"
              disabled={atLimit}
            />
            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] tabular-nums pointer-events-none font-medium ${remaining <= 5 ? 'text-destructive' : 'text-muted-foreground/50'}`}>
              {remaining}
            </span>
          </div>
          <Button
            onClick={() => addKeyword()}
            size="sm"
            variant="destructive"
            className="h-8 px-3"
            disabled={!sanitizedDraft.trim() || atLimit}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {error && <p className="text-[10px] text-destructive pl-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
      </div>

      {/* List area */}
      {filters.keywords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4 px-3 rounded-md border border-dashed border-border/40 bg-muted/5">
          <Ban className="h-4 w-4 text-muted-foreground/30 mb-1" />
          <p className="text-[10px] text-muted-foreground/70">No blocked keywords</p>
        </div>
      ) : compactMode ? (
        // Many keywords → compact summary with preview + open full
        <div className="rounded-md border border-destructive/25 bg-destructive/5 overflow-hidden">
          <div className="px-2.5 py-2 flex items-center gap-1.5 border-b border-destructive/20 min-w-0">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden flex-nowrap [mask-image:linear-gradient(to_right,black_85%,transparent)]">
              {filters.keywords.map(k => (
                <span
                  key={k}
                  data-filter-key={`kw-${k}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-destructive/10 text-destructive border border-destructive/25 max-w-[110px] shrink-0"
                >
                  <span className="truncate">{k}</span>
                </span>
              ))}
            </div>
            <span className="text-[10px] text-destructive/80 font-medium px-1.5 py-0.5 rounded bg-destructive/15 border border-destructive/25 shrink-0">
              +{filters.keywords.length} total
            </span>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-destructive hover:bg-destructive/10 transition-colors ${NO_FOCUS_FLASH}`}
          >
            <Maximize2 className="h-3 w-3" />
            Open full list ({filters.keywords.length})
          </button>
        </div>
      ) : (
        // Few keywords → single row, no wrap, fade if overflow
        <div className="flex items-center gap-1 p-2 rounded-md border border-destructive/25 bg-destructive/5 overflow-hidden flex-nowrap [mask-image:linear-gradient(to_right,black_90%,transparent)]">
          {filters.keywords.map(k => (
            <span key={k} data-filter-key={`kw-${k}`} className="shrink-0"><Chip k={k} /></span>
          ))}
        </div>
      )}

      {/* Footer actions */}
      {filters.keywords.length > 0 && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            onClick={handleClearClick}
            onMouseLeave={() => { if (armed) { setArmed(false); if (armRef.current) window.clearTimeout(armRef.current); } }}
            className={`text-[10px] px-2 py-1 rounded border transition-colors select-none inline-flex items-center gap-1 ${
              armed
                ? 'border-destructive bg-destructive/20 text-destructive shadow-[0_0_8px_-2px_hsl(var(--destructive)/0.6)] animate-pulse'
                : 'border-destructive/30 text-destructive/80 hover:text-destructive hover:border-destructive/60'
            } ${NO_FOCUS_FLASH}`}
            title={armed ? 'Click again to confirm' : 'Double-click to clear all'}
          >
            <Trash2 className="h-2.5 w-2.5" />
            {armed ? 'Click to confirm' : 'Clear all'}
          </button>
          <Dialog open={expanded} onOpenChange={setExpanded}>
            <DialogTrigger asChild>
              <button className={`text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors inline-flex items-center gap-1 ${NO_FOCUS_FLASH}`}>
                <Settings2 className="h-2.5 w-2.5" />
                Manage
              </button>
            </DialogTrigger>
            <DialogContent
              className="blocklist-manage-dialog max-w-[640px] p-0 gap-0 border-destructive/30 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-destructive/20 overflow-hidden focus:outline-none focus-visible:outline-none focus:ring-0"
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-destructive/20 bg-destructive/5">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded border border-destructive/50 bg-destructive/15 text-destructive shadow-[0_0_10px_-2px_hsl(var(--destructive)/0.4)]">
                  <Ban className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-none">Blocklist · Manage</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {filters.keywords.length} of {MAX_KEYWORDS} keywords
                  </p>
                </div>
              </div>

              {/* Add row */}
              <div className="p-4 space-y-2 border-b border-border/40">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={draft}
                      onChange={(e) => { setDraft(sanitizeKeyword(e.target.value)); setError(null); }}
                      onKeyDown={onKey}
                      placeholder='Add keyword to block'
                      maxLength={MAX_KEYWORD_LENGTH}
                      className="h-9 text-xs pr-10 border-border/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border/40"
                    />
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] tabular-nums pointer-events-none ${remaining <= 5 ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                      {remaining}
                    </span>
                  </div>
                  <Button onClick={() => addKeyword()} size="sm" variant="destructive" className={`h-9 ${NO_FOCUS_FLASH}`} disabled={!sanitizedDraft.trim() || atLimit}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
                {error && <p className="text-[10px] text-destructive pl-1">{error}</p>}

                {filters.keywords.length > 6 && (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter list…"
                      className="h-8 text-[11px] pl-7 border-border/40 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border/40"
                    />
                  </div>
                )}
              </div>

              {/* List */}
              <div className="max-h-[55vh] min-h-[180px] overflow-y-auto scrollbar-thin p-4 bg-muted/5">
                {filteredKeywords.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-10">
                    {search ? `No matches for "${search}"` : 'No blocked keywords'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pageItems.map(k => <Chip key={k} k={k} />)}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-2 border-t border-border/40 bg-muted/5 flex items-center justify-center gap-1">
                  {totalPages > 2 && (
                    <button
                      onClick={() => setPage(0)}
                      disabled={safePage === 0}
                      className={`text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:pointer-events-none ${NO_FOCUS_FLASH}`}
                    >
                      « First
                    </button>
                  )}
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className={`text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:pointer-events-none ${NO_FOCUS_FLASH}`}
                  >
                    ‹ Prev
                  </button>
                  <span className="text-[10px] text-muted-foreground tabular-nums px-2">
                    Page {safePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className={`text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:pointer-events-none ${NO_FOCUS_FLASH}`}
                  >
                    Next ›
                  </button>
                  {totalPages > 2 && (
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      disabled={safePage >= totalPages - 1}
                      className={`text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:pointer-events-none ${NO_FOCUS_FLASH}`}
                    >
                      Last »
                    </button>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {filteredKeywords.length === 0
                    ? `0 of ${filters.keywords.length}`
                    : `${pageStart + 1}–${pageStart + pageItems.length} of ${filteredKeywords.length}${search ? ` (filtered from ${filters.keywords.length})` : ''}`}
                </span>
                <button
                  onClick={handleClearClick}
                  onMouseLeave={() => { if (armed) { setArmed(false); if (armRef.current) window.clearTimeout(armRef.current); } }}
                  className={`text-[10px] px-2.5 py-1 rounded border transition-colors select-none inline-flex items-center gap-1 ${
                    armed
                      ? 'border-destructive bg-destructive/20 text-destructive shadow-[0_0_8px_-2px_hsl(var(--destructive)/0.6)] animate-pulse'
                      : 'border-destructive/30 text-destructive hover:border-destructive/60'
                  } ${NO_FOCUS_FLASH}`}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  {armed ? 'Click to confirm' : 'Clear all'}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};
