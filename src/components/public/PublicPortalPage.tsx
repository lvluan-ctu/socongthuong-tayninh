import { useEffect, useMemo, useState } from "react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { HeroBanner } from "@/components/public/HeroBanner";
import { FeaturedNews } from "@/components/public/FeaturedNews";
import { UpcomingEvents } from "@/components/public/UpcomingEvents";
import { InvestmentOpportunities } from "@/components/public/InvestmentOpportunities";
import { TradePromotion } from "@/components/public/TradePromotion";
import { PromotionPrograms } from "@/components/public/PromotionPrograms";
import { MarketInformation } from "@/components/public/MarketInformation";
import { IndustryCategories } from "@/components/public/IndustryCategories";
import { CategoryNews } from "@/components/public/CategoryNews";
import { Announcements } from "@/components/public/Announcements";
import { BusinessCTA } from "@/components/public/BusinessCTA";
import { InvestorCTA } from "@/components/public/InvestorCTA";
import { PublicFooter } from "@/components/public/PublicFooter";
import {
  getAnnouncements,
  getFeaturedNews,
  getMarketInfos,
  getNewsByCategory,
  getPromotions,
  getSidebarNews,
  getTradePromotions,
  getUpcomingEvents,
} from "@/lib/portal-service";

// Phát hiện lần load là reload/F5 — khi đó luôn về đầu trang thay vì nhảy tới section.
let reloadedOnLoad = false;
if (typeof window !== "undefined") {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    reloadedOnLoad = nav?.type === "reload";
  } catch {
    reloadedOnLoad = false;
  }
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.getElementById("site-header");
  const offset = (header?.offsetHeight ?? 0) + 12;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
}

export function PublicPortalPage({ muc }: { muc?: string }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const data = useMemo(() => {
    const main = getFeaturedNews(1)[0]!;
    return {
      main,
      sidebar: getSidebarNews(3),
      events: getUpcomingEvents(4),
      promotions: getPromotions(),
      tradePromotions: getTradePromotions(3),
      marketInfos: getMarketInfos(2),
      announcements: getAnnouncements(5),
    };
  }, []);

  const categoryNews = useMemo(
    () => (activeCategory ? getNewsByCategory(activeCategory, 6) : []),
    [activeCategory],
  );

  useEffect(() => {
    if (reloadedOnLoad) {
      reloadedOnLoad = false;
      const t = window.setTimeout(() => window.scrollTo(0, 0), 0);
      return () => window.clearTimeout(t);
    }
    const raf = requestAnimationFrame(() => {
      if (!muc) window.scrollTo({ top: 0, behavior: "smooth" });
      else scrollToSection(muc);
    });
    return () => cancelAnimationFrame(raf);
  }, [muc]);

  return (
    <div className="min-h-screen bg-white text-foreground antialiased">
      <PublicHeader />
      <main>
        <HeroBanner />
        <FeaturedNews main={data.main} sidebar={data.sidebar} />
        <UpcomingEvents events={data.events} />
        <InvestmentOpportunities />
        <TradePromotion items={data.tradePromotions} />
        <PromotionPrograms items={data.promotions} />
        <MarketInformation items={data.marketInfos} />
        <IndustryCategories
          active={activeCategory}
          onChange={(name) => {
            setActiveCategory((prev) => (prev === name ? null : name));
            requestAnimationFrame(() => scrollToSection("tin-theo-linh-vuc"));
          }}
        />
        {activeCategory ? <CategoryNews category={activeCategory} items={categoryNews} /> : null}
        <Announcements items={data.announcements} />
        <BusinessCTA />
        <InvestorCTA />
      </main>
      <PublicFooter />
    </div>
  );
}
