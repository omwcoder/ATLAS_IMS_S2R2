"use client";
// components/Sidebar.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, memo } from "react";
import {
  LayoutDashboard, Truck, Box, Users,
  Cpu, BarChart2, ShieldCheck, GitBranch,
} from "lucide-react";
import CiviAIIcon from "./CiviAIIcon";

const BASE_NAV = [
  { href: "/",                  label: "Dashboard",            icon: LayoutDashboard, adminOnly: false, viewerHidden: false },
  { href: "/raw-materials",     label: "Raw Materials",        icon: Truck,           adminOnly: false, viewerHidden: false },
  { href: "/finished-products", label: "Finished Products",    icon: Box,             adminOnly: false, viewerHidden: false },
  { href: "/bom",               label: "Bill of Materials",    icon: GitBranch,       adminOnly: false, viewerHidden: true  },
  { href: "/clients",           label: "Clients",              icon: Users,           adminOnly: false, viewerHidden: false },
  { href: "/iot-devices",       label: "IoT Devices",          icon: Cpu,             adminOnly: false, viewerHidden: false },
  { href: "/reports",           label: "Reports",              icon: BarChart2,       adminOnly: false, viewerHidden: false },
  { href: "/intelligence",      label: "Decision Intelligence",icon: LayoutDashboard, adminOnly: false, viewerHidden: true  }, // icon placeholder, handled specially
  { href: "/admin",             label: "Admin Panel",          icon: ShieldCheck,     adminOnly: true,  viewerHidden: false },
];

interface SidebarProps {
  open:      boolean;
  collapsed: boolean;
  onClose:   () => void;
}

function Sidebar({ open, collapsed, onClose }: SidebarProps) {
  const pathname = usePathname();
  // Read role immediately from localStorage (synchronous) so nav is correct on first render.
  // Falls back to "" during SSR (no window) — AppShell only renders after mount so this is safe.
  const [role, setRole] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("s2r2_role") || "";
  });

  useEffect(() => {
    // Re-read after mount in case localStorage was set between SSR and hydration
    const stored = localStorage.getItem("s2r2_role") || "";
    setRole(stored);
  }, []);

  const NAV_ITEMS = BASE_NAV.filter(item =>
    (!item.adminOnly || role === "ADMIN") &&
    (!item.viewerHidden || role === "ADMIN" || role === "EDITOR")
  );

  // Split items: first 7 centered, rest at bottom
  const centerItems = NAV_ITEMS.slice(0, Math.min(7, NAV_ITEMS.length));
  const bottomItems = NAV_ITEMS.slice(7);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={[
          "app-sidebar p-3",
          open ? "open" : "",
        ].join(" ")}
      >
        {/* Mobile close button with X animation */}
        <div className="flex justify-end mb-3 px-1 md:hidden">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition relative w-8 h-8 flex items-center justify-center"
            aria-label="Close menu"
          >
            <div className="relative w-4 h-4 flex flex-col justify-center items-center">
              <span className="block h-0.5 w-full bg-current rounded-full absolute rotate-45" />
              <span className="block h-0.5 w-full bg-current rounded-full absolute -rotate-45" />
            </div>
          </button>
        </div>

        {/* Nav items - organized layout */}
        <nav className="flex flex-col h-full">
          {/* Center items - vertically centered (7 icons including Dashboard & Raw Materials) */}
          <ul className="space-y-0.5 flex-1 flex flex-col justify-center">{centerItems.map(item => <NavItem key={item.href} item={item} pathname={pathname} onClose={onClose} collapsed={collapsed} />)}</ul>
          
          {/* Bottom items */}
          {bottomItems.length > 0 && (
            <ul className="space-y-0.5 mt-auto">{bottomItems.map(item => <NavItem key={item.href} item={item} pathname={pathname} onClose={onClose} collapsed={collapsed} />)}</ul>
          )}
        </nav>

        {/* Bottom version tag */}
        <div className="sidebar-title absolute bottom-4 left-0 right-0 px-4 transition-opacity duration-300">
          <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center truncate">
            S2R2 IMS v1.0
          </p>
        </div>
      </aside>
    </>
  );
}

// Nav Item Component - Memoized for performance
const NavItem = memo(function NavItem({ item, pathname, onClose, collapsed }: {
  item: typeof BASE_NAV[0];
  pathname: string;
  onClose: () => void;
  collapsed: boolean;
}) {
  const { href, label, icon: Icon } = item;
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const isAI = href === "/intelligence";

  return (
    <li>
      <Link
        href={href}
        onClick={onClose}
        title={label}
        className={["nav-link", active ? "active" : "", isAI ? "nav-link-ai" : ""].join(" ")}
      >
        {isAI ? (
          <CiviAIIcon 
            size={20} 
            animated 
            className="nav-icon shrink-0 mr-2.5"
          />
        ) : (
          <Icon
            size={18}
            className={`nav-icon shrink-0 mr-2.5 ${
              active ? "text-blue-600 dark:text-blue-400" : ""
            }`}
          />
        )}
        <span className="nav-label flex items-center gap-1.5">
          {label}
          {isAI && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
                             bg-purple-100 text-purple-600
                             dark:bg-purple-900/40 dark:text-purple-400
                             uppercase tracking-wide">
              AI
            </span>
          )}
        </span>
      </Link>
    </li>
  );
});

export default memo(Sidebar);
