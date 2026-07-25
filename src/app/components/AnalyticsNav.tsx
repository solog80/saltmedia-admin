'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Eye,
  Users,
  Clock,
  Activity,
  Film,
  Smartphone,
} from 'lucide-react';

const analyticsNavItems = [
  {
    title: 'Content',
    href: '/analytics',
    icon: BarChart3,
  },
  {
    title: 'Content Details',
    href: '/analytics/content',
    icon: Film,
  },
  {
    title: 'Watch Time',
    href: '/analytics/watch-time',
    icon: Clock,
  },
  {
    title: 'Users',
    href: '/analytics/users',
    icon: Users,
  },
  {
    title: 'Sessions',
    href: '/analytics/sessions',
    icon: Activity,
  },
  {
    title: 'Impressions',
    href: '/analytics/impressions',
    icon: Eye,
  },
  {
    title: 'User & Device',
    href: '/analytics/firebase',
    icon: Smartphone,
  },
];

export function AnalyticsNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-white/10 mb-6 overflow-x-auto pb-0">
      {analyticsNavItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== '/analytics' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              isActive
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-white/60 hover:text-white/80 hover:border-white/20'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </div>
  );
}