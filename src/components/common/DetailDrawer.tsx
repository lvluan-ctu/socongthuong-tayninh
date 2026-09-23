import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  widthClass = "sm:max-w-xl",
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string | undefined;
  widthClass?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("w-full overflow-y-auto", widthClass)}>
        <SheetHeader>
          <SheetTitle className="text-navy">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
