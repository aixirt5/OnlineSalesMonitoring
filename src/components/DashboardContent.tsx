'use client';

import Sidebar from '@/components/Sidebar';
import { useSidebar } from '@/context/SidebarContext';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed, setIsCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay with click handler */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 cursor-pointer" 
          onClick={() => setIsCollapsed(true)}
          aria-label="Close menu"
        />
      )}
      <Sidebar />
      <main className="transition-all duration-300 min-h-screen">
        {children}
      </main>
    </div>
  );
} 