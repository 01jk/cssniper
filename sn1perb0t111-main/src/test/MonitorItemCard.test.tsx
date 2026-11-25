import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonitorItemCard } from "../components/live-monitor/MonitorItemCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from "react";

import { MonitorItem } from "../components/live-monitor/monitorTypes";

// Mock dependencies to avoid loading errors
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockItem: MonitorItem = {
  id: "test-id-123",
  name: "AK-47 | Redline",
  rarity: "classified",
  price: 100,
  priceChange: 0,
  priceChangePercent: 0,
  bidPrice: 90,
  askPrice: 110,
  float: 0.15,
  paintSeed: 123,
  listedAgo: "1m",
  isOnline: true,
  imageUrl: "https://example.com/image.png",
  cs2ScreenshotId: "test-screenshot-id-abc",
  weaponType: "AK-47",
  skinName: "Redline",
  wear: "Field-Tested",
  isStatTrak: false,
  isSouvenir: false,
};

describe("MonitorItemCard Screenshot Button", () => {
  it("renders the screenshot gallery button automatically when a new item with cs2ScreenshotId arrives", () => {
    render(
      <TooltipProvider>
        <MonitorItemCard
          item={mockItem}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
        />
      </TooltipProvider>
    );

    const btn = screen.getByRole("button", { name: /Open screenshot gallery/i });
    expect(btn).toBeInTheDocument();
  });

  it("does not render the screenshot gallery button when cs2ScreenshotId is absent", () => {
    const itemWithoutScreenshot = { ...mockItem, cs2ScreenshotId: undefined };
    render(
      <TooltipProvider>
        <MonitorItemCard
          item={itemWithoutScreenshot}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
        />
      </TooltipProvider>
    );

    const btn = screen.queryByRole("button", { name: /Open screenshot gallery/i });
    expect(btn).not.toBeInTheDocument();
  });
});

describe("MonitorItemCard Price Difference Calculation", () => {
  it("calculates difference by Ask by default and supports toggling to Bid", () => {
    const itemWithPrices = {
      ...mockItem,
      price: 100,
      bidPrice: 95,
      hasRealBid: true,
      askPrice: 110,
      hasRealAsk: true,
    };

    const { rerender } = render(
      <TooltipProvider>
        <MonitorItemCard
          item={itemWithPrices}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
          priceDiffRef="ask"
        />
      </TooltipProvider>
    );

    // Under ask (110), difference is 100 - 110 = -10.00$ (-9.1%)
    expect(screen.getByText(/-9.1%/i)).toBeInTheDocument();

    // Rerender with priceDiffRef="bid"
    rerender(
      <TooltipProvider>
        <MonitorItemCard
          item={itemWithPrices}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
          priceDiffRef="bid"
        />
      </TooltipProvider>
    );

    // Under bid (95), difference is 100 - 95 = +5.00$ (+5.3%)
    expect(screen.getByText(/\+5.3%/i)).toBeInTheDocument();
  });

  it("factors in the charm price in difference calculations when enabled", () => {
    const itemWithCharm = {
      ...mockItem,
      price: 100,
      bidPrice: 95,
      hasRealBid: true,
      askPrice: 110,
      hasRealAsk: true,
      charm: {
        name: "Test Charm",
        imageUrl: "https://example.com/charm.png",
        pattern: 123,
        referencePrice: 20.0,
      },
    };

    const { rerender } = render(
      <TooltipProvider>
        <MonitorItemCard
          item={itemWithCharm}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
          priceDiffRef="bid"
          includeCharmPrice={true}
        />
      </TooltipProvider>
    );

    // With charm included: Bid (95) + Charm (20) = 115.
    // Main badge: 100 - 115 = -15.00$ (discount of 13.0%, displayed without sign)
    // Buy overlay profit: 115 - 100 = +15.00$ (15.0%)
    expect(screen.getByText(/13.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/15.0%/i)).toBeInTheDocument();

    // Rerender with includeCharmPrice={false}
    rerender(
      <TooltipProvider>
        <MonitorItemCard
          item={itemWithCharm}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
          priceDiffRef="bid"
          includeCharmPrice={false}
        />
      </TooltipProvider>
    );

    // With charm disabled: Bid (95).
    // Difference: 100 - 95 = +5.00$ (+5.3%)
    expect(screen.getByText(/\+5.3%/i)).toBeInTheDocument();
  });

  it("caps percentage difference and dollar difference at 9999 when greater than 10000", () => {
    const extremeItem = {
      ...mockItem,
      price: 15000,
      askPrice: 1,
      hasRealAsk: true,
    };

    render(
      <TooltipProvider>
        <MonitorItemCard
          item={extremeItem}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
          priceDiffRef="ask"
        />
      </TooltipProvider>
    );

    // Dollar diff: 15000 - 1 = 14999 > 10000 => capped to 9999.00$
    // Percent diff: (14999 / 1) * 100 = 1499900% > 10000 => capped to 9999.0%
    expect(screen.getAllByText(/9999\.0%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/9999\.00\$/i).length).toBeGreaterThan(0);
  });

  it("rerenders and displays Frozen badge when isFrozen prop changes to true", () => {
    const { rerender } = render(
      <TooltipProvider>
        <MonitorItemCard
          item={mockItem}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
          isFrozen={false}
        />
      </TooltipProvider>
    );

    expect(screen.queryByText(/Frozen/i)).not.toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <MonitorItemCard
          item={mockItem}
          isWatchlisted={false}
          onToggleWatchlist={vi.fn()}
          isFrozen={true}
        />
      </TooltipProvider>
    );

    expect(screen.getByText(/Frozen/i)).toBeInTheDocument();
  });
});

