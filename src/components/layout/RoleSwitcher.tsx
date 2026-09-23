import { ChevronDown, UserCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES } from "@/lib/nav";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const { role, setRole } = useRole();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-left text-white transition-colors hover:bg-white/15">
        <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
          NA
        </span>
        <span className="hidden leading-tight md:block">
          <span className="block text-sm font-medium">Quản trị</span>
          <span className="block text-[11px] text-white/70">{role.name}</span>
        </span>
        <ChevronDown className="size-4 text-white/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2 text-navy">
          <UserCog className="size-4" /> Đổi vai trò (DEMO RBAC)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROLES.map((r) => (
          <DropdownMenuItem
            key={r.id}
            onClick={() => setRole(r.id)}
            className={cn("flex flex-col items-start gap-0.5", r.id === role.id && "bg-accent")}
          >
            <span className="text-sm font-medium">{r.name}</span>
            <span className="text-xs text-muted-foreground">{r.scope}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
