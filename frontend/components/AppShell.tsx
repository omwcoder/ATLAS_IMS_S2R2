"use client";
// components/AppShell.tsx — Auth guard + layout wrapper + notification popup
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/api";
import { useInactivityTimeout } from "@/lib/useInactivityTimeout";
import { fetchNotifications, StockNotification } from "@/lib/notifications";
import Header  from "./Header";
import Sidebar from "./Sidebar";
import { AlertTriangle, X, Bell, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Notification System Module
// Rectangular bottom-right popup, 10-second auto-dismiss.
// Shows CRITICAL and HIGH stock alerts to ADMIN/EDITOR users.
// ─────────────────────────────────────────────────────────────
function NotificationPopup() {
  const [alerts,    setAlerts]    = useState<StockNotification[]>([]);
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("s2r2_popup_dismissed")) return;

    fetchNotifications().then(data => {
      const urgent = data.filter(a => a.urgency === "CRITICAL" || a.urgency === "HIGH");
      if (urgent.length > 0) {
        setAlerts(urgent);
        setVisible(true);

        // Auto-dismiss after 10 seconds
        const timer = setTimeout(() => {
          setVisible(false);
          sessionStorage.setItem("s2r2_popup_dismissed", "1");
        }, 10_000);
        return () => clearTimeout(timer);
      }
    }).catch(() => {});
  }, []);

  function dismiss() {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("s2r2_popup_dismissed", "1");
  }

  if (!visible || dismissed) return null;

  const hasCritical = alerts.some(a => a.urgency === "CRITICAL");

  return (
    <div
      className="fixed bottom-5 right-5 z-[200] w-80 shadow-2xl
                 bg-white dark:bg-gray-900
                 border border-gray-200 dark:border-gray-700
                 rounded-lg overflow-hidden
                 animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* ── Header strip ─────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 py-2.5
                       ${hasCritical ? "bg-red-600" : "bg-amber-500"} text-white`}>
        <div className="flex items-center gap-2">
          <Bell size={14} />
          <span className="text-xs font-bold uppercase tracking-wide">
            {hasCritical ? "⛔ Critical Stock Alert" : "⚠️ Low Stock Alert"}
          </span>
        </div>
        <button
          onClick={dismiss}
          className="p-1 rounded hover:bg-white/20 transition"
          aria-label="Dismiss notification"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Alert list ───────────────────────────────────── */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto">
        {alerts.slice(0, 4).map(alert => (
          <div key={alert.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              alert.urgency === "CRITICAL" ? "bg-red-500" : "bg-amber-400"
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                {alert.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Stock: <span className="text-red-500 font-bold">{alert.current}</span>
                {" "}/ Min: {alert.min} {alert.unit}
              </p>
            </div>
            <AlertTriangle size={14} className={
              alert.urgency === "CRITICAL" ? "text-red-500 shrink-0" : "text-amber-500 shrink-0"
            } />
          </div>
        ))}
        {alerts.length > 4 && (
          <p className="text-xs text-gray-400 text-center py-2">
            +{alerts.length - 4} more alert{alerts.length - 4 > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5
                      border-t border-gray-100 dark:border-gray-800
                      bg-gray-50 dark:bg-gray-800/60">
        <p className="text-[11px] text-gray-400">Auto-dismisses in 10s</p>
        <a
          href="/notifications"
          onClick={dismiss}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600
                     dark:text-blue-400 hover:underline"
        >
          View all <ArrowRight size={11} />
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted,          setMounted]          = useState(false);

  // Auth guard
  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setMounted(true);
  }, [router]);

  // 5-minute inactivity logout
  useInactivityTimeout();

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem("s2r2-sidebar-collapsed") === "1");
  }, []);

  const handleCollapse = useCallback(() => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("s2r2-sidebar-collapsed", next ? "1" : "0");
  }, [sidebarCollapsed]);

  const handleMenuToggle = useCallback(() => setSidebarOpen(v => !v), []);
  const handleSidebarClose = useCallback(() => setSidebarOpen(false), []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">

      <Header
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        onMenuToggle={handleMenuToggle}
        onSidebarCollapse={handleCollapse}
      />

      <div className="flex flex-1 pt-20">
        <Sidebar
          open={sidebarOpen}
          collapsed={false}
          onClose={handleSidebarClose}
        />
        {/* Main content with dynamic margin based on sidebar state */}
        <main className={`flex-1 p-5 md:p-7 overflow-x-hidden transition-all duration-300 ${
          sidebarOpen ? 'md:ml-[15rem]' : 'md:ml-[4.5rem]'
        }`}>
          {children}
        </main>
      </div>

      {/* Popup notification (bottom-right, 10s auto-dismiss) */}
      <NotificationPopup />
    </div>
  );
}
