import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  NAV_ITEMS,
  ROLES,
  type NavChild,
  type NavItem,
  type RoleDef,
  type RoleId,
} from "@/lib/nav";

interface RoleContextValue {
  role: RoleDef;
  setRole: (id: RoleId) => void;
  navItems: NavItem[];
  canAccess: (to: string) => boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [roleId, setRoleId] = useState<RoleId>("admin");

  const value = useMemo<RoleContextValue>(() => {
    const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0]!;
    const navItems = NAV_ITEMS.filter(
      (i) => i.roles.includes(roleId) && i.to !== "/trang-thong-tin",
    ).map((item) =>
      item.children
        ? {
            ...item,
            children: filterNavChildren(item.children, roleId),
          }
        : item,
    );
    return {
      role,
      setRole: setRoleId,
      navItems,
      canAccess: (to: string) => {
        const item = NAV_ITEMS.find((i) => i.to === to);
        return !item || item.roles.includes(roleId);
      },
    };
  }, [roleId]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}

function filterNavChildren(children: NavItem["children"], roleId: RoleId): NavChild[] {
  return (children ?? [])
    .filter((child) => !child.hidden && (!child.roles || child.roles.includes(roleId)))
    .map((child) =>
      child.children ? { ...child, children: filterNavChildren(child.children, roleId) } : child,
    );
}
