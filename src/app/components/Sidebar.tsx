'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import Home01Icon from '@hugeicons/core-free-icons/dist/esm/Home01Icon';
import UserGroupIcon from '@hugeicons/core-free-icons/dist/esm/UserGroupIcon';
import Analytics01Icon from '@hugeicons/core-free-icons/dist/esm/Analytics01Icon';
import Video01Icon from '@hugeicons/core-free-icons/dist/esm/Video01Icon';
import { Calendar, Zap, DollarSign, Radio, BarChart3, Play, Image as ImageIcon, RadioTower, Bell, Newspaper, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import LogoutButton from './LogoutButton';

const Sidebar = ({ role, open, onClose }: { role?: string | null; open?: boolean; onClose?: () => void }) => {
  const isEditor = role === 'editor';
  const isModerator = role === 'moderator';

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const handleNavClick = () => {
    onClose?.();
  };

  const sidebarContent = (
    <div
      className="flex flex-col text-white h-screen border-r transition-all duration-200"
      style={{
        width: collapsed ? 68 : 256,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center h-16 border-b px-3"
        style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
      >
        {!collapsed && (
          <span className="flex-1 text-xl font-bold tracking-tight text-white text-center">SaltMedia Admin</span>
        )}
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {!isEditor && (
          <SidebarLink href="/home" collapsed={collapsed} tooltip="Dashboard" onClick={handleNavClick}>
            <HugeiconsIcon icon={Home01Icon} size={20} />
            <span className={collapsed ? 'hidden' : ''}>Dashboard</span>
          </SidebarLink>
        )}
        {!isEditor && !isModerator && (
          <SidebarLink href="/user-management" collapsed={collapsed} tooltip="User Management" onClick={handleNavClick}>
            <HugeiconsIcon icon={UserGroupIcon} size={20} />
            <span className={collapsed ? 'hidden' : ''}>User Management</span>
          </SidebarLink>
        )}
        <SidebarLink href="/news" collapsed={collapsed} tooltip="News" onClick={handleNavClick}>
          <Newspaper size={20} />
          <span className={collapsed ? 'hidden' : ''}>News</span>
        </SidebarLink>
        {!isEditor && (
          <SidebarLink href="/ondemand" collapsed={collapsed} tooltip="On-demand Videos" onClick={handleNavClick}>
            <HugeiconsIcon icon={Video01Icon} size={20} />
            <span className={collapsed ? 'hidden' : ''}>On-demand Videos</span>
          </SidebarLink>
        )}
        {!isEditor && !isModerator && (
          <>
            <SidebarLink href="/radio" collapsed={collapsed} tooltip="Radio" onClick={handleNavClick}>
              <Radio size={20} />
              <span className={collapsed ? 'hidden' : ''}>Radio</span>
            </SidebarLink>
            <SidebarLink href="/radio/reports" collapsed={collapsed} sub tooltip="Reports" onClick={handleNavClick}>
              <BarChart3 size={14} />
              <span className={collapsed ? 'hidden' : ''}>Reports</span>
            </SidebarLink>
            <SidebarLink href="/epg" collapsed={collapsed} tooltip="EPG" onClick={handleNavClick}>
              <Calendar size={20} />
              <span className={collapsed ? 'hidden' : ''}>EPG</span>
            </SidebarLink>
            <SidebarLink href="/analytics" collapsed={collapsed} tooltip="Analytics" onClick={handleNavClick}>
              <HugeiconsIcon icon={Analytics01Icon} size={20} />
              <span className={collapsed ? 'hidden' : ''}>Analytics</span>
            </SidebarLink>
            <SidebarLink href="/events" collapsed={collapsed} tooltip="Events" onClick={handleNavClick}>
              <Zap size={20} />
              <span className={collapsed ? 'hidden' : ''}>Events</span>
            </SidebarLink>
            <SidebarLink href="/hero-banners" collapsed={collapsed} tooltip="Hero Banners" onClick={handleNavClick}>
              <ImageIcon size={20} />
              <span className={collapsed ? 'hidden' : ''}>Hero Banners</span>
            </SidebarLink>
            <SidebarLink href="/monetization" collapsed={collapsed} tooltip="Monetization" onClick={handleNavClick}>
              <DollarSign size={20} />
              <span className={collapsed ? 'hidden' : ''}>Monetization</span>
            </SidebarLink>
            <SidebarLink href="/broadcast" collapsed={collapsed} tooltip="Broadcast" onClick={handleNavClick}>
              <RadioTower size={20} />
              <span className={collapsed ? 'hidden' : ''}>Broadcast</span>
            </SidebarLink>
            <SidebarLink href="/ads" collapsed={collapsed} tooltip="Ads" onClick={handleNavClick}>
              <Play size={20} />
              <span className={collapsed ? 'hidden' : ''}>Ads</span>
            </SidebarLink>
            <SidebarLink href="/notifications" collapsed={collapsed} tooltip="Notifications" onClick={handleNavClick}>
              <Bell size={20} />
              <span className={collapsed ? 'hidden' : ''}>Notifications</span>
            </SidebarLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div
        className="p-3 border-t"
        style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <LogoutButton />
          </div>
        ) : (
          <LogoutButton />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <div className="absolute left-0 top-0 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

function SidebarLink({ href, collapsed, sub, tooltip, onClick, children }: {
  href: string;
  collapsed: boolean;
  sub?: boolean;
  tooltip?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center justify-center gap-3 px-2 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md"
        title={tooltip || href}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white rounded-md ${sub ? 'pl-10 text-white/60 py-1.5' : ''}`}
    >
      {children}
    </Link>
  );
}

export default Sidebar;
