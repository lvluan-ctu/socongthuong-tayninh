"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { GisLayerProvider } from "@/lib/gis-layer-context";
import { RoleProvider } from "@/lib/role-context";

const theme = createTheme({
  primaryColor: "brand",
  defaultRadius: "md",
  colors: {
    brand: [
      "#eef5fb",
      "#d9e8f4",
      "#b7d2e8",
      "#8fb7d5",
      "#6397bf",
      "#3e7ba9",
      "#246493",
      "#164f78",
      "#0b3a5d",
      "#062943",
    ],
  },
  fontFamily:
    "var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname() ?? "";
  const isPublicPortal = pathname.startsWith("/trang-thong-tin");

  return (
    <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme="light">
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <GisLayerProvider>
            {isPublicPortal ? children : <AppShell>{children}</AppShell>}
          </GisLayerProvider>
        </RoleProvider>
        <Notifications position="top-right" />
        <Toaster />
      </QueryClientProvider>
    </MantineProvider>
  );
}
