'use client';

import React from 'react';
import { Eye, BarChart3, Loader, Info, RefreshCw } from 'lucide-react';
import { AnalyticsNav } from '@/app/components/AnalyticsNav';
import { useAnalytics } from '@/lib/hooks/useAnalytics';

export default function ImpressionsAnalyticsPage() {
  const { data, isLoading, error, isFetching } = useAnalytics(30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader size={48} className="animate-spin text-blue-400 mx-auto" />
          <p className="text-white/70">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 p-6">
        <AnalyticsNav />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4 p-8">
            <p className="text-red-400 font-semibold">Failed to load analytics</p>
            <p className="text-white/60 text-sm">{error instanceof Error ? error.message : 'No data available'}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AnalyticsNav />

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Impressions Analytics</h1>
          <p className="text-white/60 flex items-center gap-2">
            <Eye size={16} />
            Track content discovery and visibility
          </p>
        </div>
        {isFetching && (
          <div className="flex items-center gap-2 text-blue-400 text-sm animate-pulse">
            <RefreshCw size={14} className="animate-spin" />
            Updating...
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="frosted-glass p-6 border border-amber-500/30 bg-amber-500/10">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-amber-400 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-white mb-1">About Impressions</h3>
            <p className="text-sm text-white/70">
              Impressions are tracked when users view content in EPG listings, channel lists,
              or other discovery interfaces. Currently, your app is not explicitly tracking impressions
              yet. Add impression tracking to EPG and discovery screens to see data here.
            </p>
          </div>
        </div>
      </div>

      {/* Currently No Data */}
      <div className="frosted-glass p-6 border border-blue-500/30">
        <div className="mb-6 flex items-center gap-3">
          <Eye size={24} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Impression Tracking</h2>
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 rounded-lg p-6 text-center border border-white/10">
            <p className="text-white/60 mb-4">No impression data yet</p>
            <p className="text-sm text-white/40 mb-6">
              Impressions are tracked when users see content in discovery interfaces.
            </p>
            <div className="inline-block p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <p className="text-sm text-white/70">
                💡 Tip: Add trackImpression() calls to your EPG and discovery screens to start
                tracking impressions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Guide */}
      <div className="frosted-glass p-6 border border-green-500/30">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-green-400" />
          How to Track Impressions
        </h3>
        <div className="space-y-4 text-sm text-white/70">
          <div className="bg-white/5 rounded-lg p-4 border border-green-500/20">
            <p className="font-medium text-white mb-2">1. In EPG Screen</p>
            <code className="text-xs bg-black/40 p-2 rounded block text-cyan-300">
              trackImpression({'{'}
              <br />
              &nbsp;&nbsp;contentId: program.id,
              <br />
              &nbsp;&nbsp;impressionType: 'epg_thumbnail',
              <br />
              &nbsp;&nbsp;contentType: 'tv',
              <br />
              &nbsp;&nbsp;contentName: program.name
              <br />
              {'})'}
            </code>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-green-500/20">
            <p className="font-medium text-white mb-2">2. In Channel List</p>
            <code className="text-xs bg-black/40 p-2 rounded block text-cyan-300">
              trackImpression({'{'}
              <br />
              &nbsp;&nbsp;contentId: channel.id,
              <br />
              &nbsp;&nbsp;impressionType: 'channel_list',
              <br />
              &nbsp;&nbsp;contentType: 'tv',
              <br />
              &nbsp;&nbsp;contentName: channel.name
              <br />
              {'})'}
            </code>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-green-500/20">
            <p className="font-medium text-white mb-2">3. In On-Demand Featured</p>
            <code className="text-xs bg-black/40 p-2 rounded block text-cyan-300">
              trackImpression({'{'}
              <br />
              &nbsp;&nbsp;contentId: show.id,
              <br />
              &nbsp;&nbsp;impressionType: 'featured_carousel',
              <br />
              &nbsp;&nbsp;contentType: 'ondemand',
              <br />
              &nbsp;&nbsp;contentName: show.title
              <br />
              {'})'}
            </code>
          </div>
        </div>
      </div>

      {/* Data When Available */}
      <div className="frosted-glass p-6 border border-purple-500/30">
        <h3 className="font-semibold text-white mb-4">Once Impressions Are Tracked</h3>
        <p className="text-sm text-white/70 mb-4">
          This dashboard will show:
        </p>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-1">✓</span>
            <span>Total impressions by content type (TV, Radio, On-Demand)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-1">✓</span>
            <span>Most viewed content in discovery (which items get the most impressions)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-1">✓</span>
            <span>Conversion rates (impressions → views)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-1">✓</span>
            <span>Discovery effectiveness by screen (EPG vs Featured vs Search)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
