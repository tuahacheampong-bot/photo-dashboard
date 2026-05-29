'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Gigs', href: '/gigs', icon: '📸' },
  { name: 'Workers', href: '/workers', icon: '👥' },
  { name: 'Payments', href: '/payments', icon: '💰' },
  { name: 'Expenses', href: '/expenses', icon: '📋' },
  { name: 'Invoices', href: '/invoices', icon: '🧾' },
  { name: 'Reports', href: '/reports', icon: '📈' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-2">
          <span className="text-white text-lg">📷</span>
          <span className="font-bold text-white">Photo Dashboard</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 text-white rounded-lg hover:bg-gray-800">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-800">
            <span className="text-xl">📷</span>
            <div>
              <h1 className="font-bold text-white text-sm">Photo Dashboard</h1>
              <p className="text-xs text-gray-400">Business Manager</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map(item => {
              const active = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <div key={item.name}>
                  <Link href={item.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                      active ? 'bg-white text-gray-900' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}>
                    <span className="text-lg">{item.icon}</span>
                    {item.name}
                  </Link>
                  {item.href === '/gigs' && active && (
                    <Link href="/gigs/open" onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition ml-4 mt-0.5 ${
                        pathname === '/gigs/open' ? 'bg-green-100 text-green-800' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}>
                      <span className="text-sm">🟢</span>
                      Open Gigs
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-white">{session?.user?.name?.charAt(0) || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{session?.user?.name || 'User'}</p>
                <p className="text-xs text-gray-400 truncate">{(session?.user as any)?.role || 'worker'}</p>
              </div>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800" title="Sign out">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
