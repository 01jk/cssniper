import React, { useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Copy, Trash2, Crosshair,
  Check, Pause, Play, Search, Download, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { toast } from "@/hooks/use-toast";
import { WatchlistEntry } from "./watchlistTypes";
import { getWearLabel } from "../monitorTypes";
import { getWearShort } from "../monitorTypes";

const columnHelper = createColumnHelper<WatchlistEntry>();

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast({ title: "Copied", description: text, duration: 1500 });
};

interface WatchlistTableProps {
  data: WatchlistEntry[];
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onSnipe: (id: string) => void;
  globalFilter: string;
}

export const WatchlistTable: React.FC<WatchlistTableProps> = ({
  data, onDelete, onToggleStatus, onSnipe, globalFilter,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => [
    columnHelper.accessor('icon_url', {
      header: 'Icon',
      size: 60,
      enableSorting: false,
      cell: ({ row }) => (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-10 w-14 rounded bg-secondary/40 flex items-center justify-center group cursor-pointer overflow-hidden">
                  <img
                    src={row.original.icon_url}
                    alt={row.original.name}
                    className="h-8 w-auto object-contain opacity-70 group-hover:scale-150 transition-transform duration-200"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="p-0">
                <img src={row.original.icon_url} alt={row.original.name} className="h-32 w-auto" />
              </TooltipContent>
            </Tooltip>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      size: 240,
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">
              {row.original.is_stattrak && <span className="text-cs-orange">ST™ </span>}
              {row.original.is_souvenir && <span className="text-cs-yellow">Souv </span>}
              {row.original.market_hash_name}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {getWearLabel(row.original.float_value)}
            </p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{row.original.paint_seed}</span>
        </div>
      ),
    }),
    columnHelper.accessor('float_value', {
      header: 'Float',
      size: 90,
      cell: ({ getValue }) => {
        const f = getValue();
        const pct = Math.min(f * 100, 100);
        return (
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono text-muted-foreground">{f.toFixed(5)}</span>
            <div className="relative h-1.5 w-full rounded-full wear-gradient overflow-hidden">
              <div
                className="absolute top-[-1px] w-[2px] h-[calc(100%+2px)] bg-foreground rounded-full shadow-sm"
                style={{ left: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor('id', {
      header: 'Listing ID',
      size: 120,
      cell: ({ getValue }) => {
        const id = getValue();
        const short = id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
        return (
          <button
            onClick={() => copyToClipboard(id)}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span>{short}</span>
            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        );
      },
    }),
    columnHelper.accessor('price_usd', {
      header: 'Price',
      size: 100,
      cell: ({ row }) => {
        const positive = row.original.delta_percent >= 0;
        const oldPrice = row.original.prev_price_usd;
        const newPrice = row.original.price_usd;
        return (
          <HoverCard openDelay={100} closeDelay={180}>
            <HoverCardTrigger asChild>
              <span
                className={`inline-block px-1 -ml-1 text-xs font-bold font-mono cursor-help ${positive ? 'text-accent' : 'text-destructive'}`}
              >
                ${newPrice.toFixed(2)}
              </span>
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              sideOffset={10}
              align="start"
              className="w-auto text-xs font-mono space-y-1 p-2 bg-secondary/95 border-border/50"
            >
              <div className="text-muted-foreground">Old listing: <span className="text-foreground">${oldPrice.toFixed(2)}</span></div>
              <div className="text-muted-foreground">New listing: <span className="text-foreground">${newPrice.toFixed(2)}</span></div>
            </HoverCardContent>
          </HoverCard>
        );
      },
    }),
    columnHelper.accessor('delta_percent', {
      header: 'ΔPrice',
      size: 80,
      cell: ({ getValue, row }) => {
        const delta = getValue();
        const positive = delta >= 0;
        const absDelta = Math.abs(row.original.price_usd - row.original.prev_price_usd);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono font-bold border ${
                  positive
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-destructive/40 bg-destructive/10 text-destructive'
                }`}
              >
                {positive ? '+' : ''}{delta.toFixed(1)}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={10}
              className="text-xs font-mono"
            >
              {positive ? '+' : '-'}${absDelta.toFixed(2)} from ${row.original.prev_price_usd.toFixed(2)}
            </TooltipContent>
          </Tooltip>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      size: 80,
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const active = getValue() === 'active';
        return (
          <button
            onClick={() => onToggleStatus(row.original.id)}
            className="group"
          >
            <Badge
              variant="outline"
              className={`text-[9px] font-semibold cursor-pointer transition-colors ${
                active
                  ? 'border-accent/50 bg-accent/15 text-accent hover:bg-accent/25'
                  : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {active ? (
                <><Check className="h-2.5 w-2.5 mr-0.5" /> Active</>
              ) : (
                <><Pause className="h-2.5 w-2.5 mr-0.5" /> Paused</>
              )}
            </Badge>
          </button>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      size: 150,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-accent hover:text-accent hover:bg-accent/15"
                onClick={() => onSnipe(row.original.id)}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Snipe</TooltipContent>
          </Tooltip>


          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(row.original.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Delete</TooltipContent>
          </Tooltip>
        </div>
      ),
    }),
  ], [onDelete, onToggleStatus, onSnipe]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
    getRowId: (row) => row.id,
  });

  return (
    <TooltipProvider delayDuration={80} skipDelayDuration={0} disableHoverableContent={false}>
      <div className="rounded-lg border border-border/40 overflow-hidden bg-card/40">
      {/* Table */}
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-sm">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none"
                      style={{ width: header.getSize() }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className={`flex items-center gap-1 ${canSort ? 'cursor-pointer hover:text-foreground transition-colors' : ''}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          sorted === 'asc' ? <ArrowUp className="h-3 w-3 text-primary" /> :
                          sorted === 'desc' ? <ArrowDown className="h-3 w-3 text-primary" /> :
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-20">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center mb-4">
                      <Crosshair className="h-7 w-7 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">Watchlist is empty</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">
                      Добавь первый скин кнопкой Like на listings странице
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2" style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-secondary/40 border-t border-border/20 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">
          {table.getFilteredRowModel().rows.length} / {data.length} items
        </span>
      </div>
    </div>
    </TooltipProvider>
  );
};
