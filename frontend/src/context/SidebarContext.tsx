"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const syncSidebar = () => setCollapsed(mobile.matches);
    syncSidebar();
    mobile.addEventListener("change", syncSidebar);
    return () => mobile.removeEventListener("change", syncSidebar);
  }, []);
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
