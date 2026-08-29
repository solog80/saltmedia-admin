import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import Home01Icon from '@hugeicons/core-free-icons/dist/esm/Home01Icon';
import UserGroupIcon from '@hugeicons/core-free-icons/dist/esm/UserGroupIcon';
import Analytics01Icon from '@hugeicons/core-free-icons/dist/esm/Analytics01Icon';
import Video01Icon from '@hugeicons/core-free-icons/dist/esm/Video01Icon';
import Tv01Icon from '@hugeicons/core-free-icons/dist/esm/Tv01Icon';
import Logout01Icon from '@hugeicons/core-free-icons/dist/esm/Logout01Icon';
import { Calendar, Zap, DollarSign, Radio, BarChart3, Play, Image as ImageIcon, RadioTower, Bell, Newspaper } from 'lucide-react';

const Sidebar = ({ role }: { role?: string | null }) => {
  const isEditor = role === 'editor';
  return (
    <div
      className="flex flex-col w-64 text-white h-screen border-r"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="flex items-center justify-center h-16 border-b"
        style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
      >
        <span className="text-xl font-bold tracking-tight text-white">SaltMedia Admin</span>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {!isEditor && (
          <>
        <Link
          href="/home"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <HugeiconsIcon icon={Home01Icon} size={20} />
          Dashboard
        </Link>
        <Link
          href="/user-management"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <HugeiconsIcon icon={UserGroupIcon} size={20} />
          User Management
        </Link>
        </>
        )}
        <Link
          href="/news"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <Newspaper size={20} />
          News
        </Link>
        {!isEditor && (
          <>
        <Link
          href="/ondemand"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <HugeiconsIcon icon={Video01Icon} size={20} />
          On-demand Videos
        </Link>
        <Link
          href="/tv"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <HugeiconsIcon icon={Tv01Icon} size={20} />
          TV
        </Link>
        <Link
          href="/radio"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <Radio size={20} />
          Radio
        </Link>
        <Link
          href="/radio/reports"
          className="flex items-center gap-3 pl-10 pr-3 py-1.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <BarChart3 size={14} />
          Reports
        </Link>
        <Link
          href="/epg"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <Calendar size={20} />
          EPG
        </Link>
        <Link
          href="/analytics"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <HugeiconsIcon icon={Analytics01Icon} size={20} />
          Analytics
        </Link>
        <Link
          href="/events"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <Zap size={20} />
          Events
        </Link>
        <Link
          href="/hero-banners"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <ImageIcon size={20} />
          Hero Banners
        </Link>
        <Link
          href="/monetization"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <DollarSign size={20} />
          Monetization
        </Link>
        <Link
          href="/broadcast"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <RadioTower size={20} />
          Broadcast
        </Link>
<Link
          href="/ads"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <Play size={20} />
          Ads
        </Link>
        <Link
          href="/notifications"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        >
          <Bell size={20} />
          Notifications
        </Link>
        </>
        )}
      </nav>
      <div
        className="p-4 border-t"
        style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
      >
        <Link
          href="/login"
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-md"
        >
          <HugeiconsIcon icon={Logout01Icon} size={20} />
          Logout
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
