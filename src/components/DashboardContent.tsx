'use client';

import Sidebar from '@/components/Sidebar';
import { useSidebar } from '@/context/SidebarContext';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className={`transition-all duration-300 min-h-screen ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  );
} 