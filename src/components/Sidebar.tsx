'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from '@/context/SidebarContext';
import { logout } from '@/lib/auth';

export default function Sidebar() {
  const { isCollapsed, toggleSidebar, setIsCollapsed } = useSidebar();
  const [isSalesReportOpen, setSalesReportOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !isCollapsed && // Only check if sidebar is open
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsCollapsed(true);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCollapsed, setIsCollapsed]);

  const isActive = (path: string) => pathname === path;

  return (
    <div
      ref={sidebarRef}
      className={`bg-gradient-to-b from-sky-100 via-white to-sky-200 border-r border-sky-100 shadow-lg fixed left-0 top-0 h-screen z-30 flex flex-col transform transition-all duration-300 ease-in-out ${
        isCollapsed ? '-translate-x-full' : 'translate-x-0 w-64'
      }`}
    >
      {/* Arrow button for toggle - always visible */}
      <button
        onClick={toggleSidebar}
        className={`absolute -right-10 top-4 p-2 rounded-lg bg-white/90 shadow-md border border-sky-100 hover:bg-sky-50 transition-colors duration-200 ${
          isCollapsed ? 'rotate-0' : 'rotate-180'
        }`}
        aria-label="Toggle Menu"
      >
        <svg className="w-6 h-6 text-sky-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="flex items-center h-16 px-4 border-b border-sky-100 bg-white/80">
        {!isCollapsed && (
          <span className="text-lg font-extrabold text-sky-700 tracking-tight">Menu</span>
        )}
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-2">
          {/* Dashboard Link */}
          <li>
            <Link
              href="/dashboard"
              className={`flex items-center space-x-2 p-2 rounded-lg font-medium transition-colors duration-200 ${
                isActive('/dashboard')
                  ? 'bg-sky-100 text-sky-700 shadow-sm'
                  : 'text-sky-700 hover:bg-sky-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                />
              </svg>
              {!isCollapsed && <span>Dashboard</span>}
            </Link>
          </li>

          {/* Sales Report Dropdown */}
          <li>
            <button
              onClick={() => setSalesReportOpen(!isSalesReportOpen)}
              className={`flex items-center justify-between w-full p-2 rounded-lg font-medium transition-colors duration-200 ${
                isActive('/dashboard/sales-report')
                  ? 'bg-sky-100 text-sky-700 shadow-sm'
                  : 'text-sky-700 hover:bg-sky-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                  />
                </svg>
                {!isCollapsed && (
                  <>
                    <span>Sales Report</span>
                    <svg
                      className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                        isSalesReportOpen ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </div>
            </button>

            {/* Submenu */}
            {!isCollapsed && isSalesReportOpen && (
              <ul className="mt-2 space-y-1 pl-6">
                <li>
                  <Link
                    href="/dashboard/sales-report"
                    className={`flex items-center space-x-2 p-2 rounded-lg font-medium transition-colors duration-200 ${
                      isActive('/dashboard/sales-report')
                        ? 'bg-sky-100 text-sky-700 shadow-sm'
                        : 'text-sky-700 hover:bg-sky-50'
                    }`}
                  >
                    <span>Detailed Report</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/sales-report/pmix-report"
                    className={`flex items-center space-x-2 p-2 rounded-lg font-medium transition-colors duration-200 ${
                      isActive('/dashboard/sales-report/pmix-report')
                        ? 'bg-sky-100 text-sky-700 shadow-sm'
                        : 'text-sky-700 hover:bg-sky-50'
                    }`}
                  >
                    <span>Menu Performance Report</span>
                  </Link>
                </li>
              </ul>
            )}
          </li>

          {/* Product Masterfile Link */}
          <li>
            <Link
              href="/dashboard/product-masterfile"
              className={`flex items-center space-x-2 p-2 rounded-lg font-medium transition-colors duration-200 ${
                isActive('/dashboard/product-masterfile')
                  ? 'bg-sky-100 text-sky-700 shadow-sm'
                  : 'text-sky-700 hover:bg-sky-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                />
              </svg>
              {!isCollapsed && <span>Product Masterfile</span>}
            </Link>
          </li>
        </ul>
      </nav>
      {/* Logout Button at the bottom */}
      <div className="mt-auto p-4 w-full">
        <button
          onClick={async () => {
            try {
              const userId = localStorage.getItem("userId");
              
              if (!userId) {
                console.error('No user ID found in localStorage');
                router.push('/');
                return;
              }

              // Use our logout function with the stored user ID
              await logout(parseInt(userId, 10));
              router.push('/');
            } catch (error) {
              console.error('Error during logout:', error);
              // Still redirect to login page even if there's an error
              router.push('/');
            }
          }}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-md transition-colors duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
          </svg>
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
} 