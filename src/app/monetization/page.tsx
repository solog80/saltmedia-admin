'use client';

import React, { useState } from 'react';
import { DollarSign, TrendingUp, Users, Receipt, CheckCircle, XCircle } from 'lucide-react';
import { usePayments } from '@/lib/hooks/usePayments';

function MetricCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="frosted-glass p-4 flex items-center gap-4">
      <div className={`p-3 rounded-full ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-white/60">{title}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-white">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((h) => (
              <th key={h} className="text-left py-3 px-4 text-white/60 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-4">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MonetizationPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = usePayments(days);

  const summary: Record<string, any> = data?.summary ?? {};
  const dailyData: any[] = data?.daily ?? [];
  const byProvider: any[] = data?.byProvider ?? [];
  const topContributors: any[] = data?.topContributors ?? [];
  const byNarrative: any[] = data?.byNarrative ?? [];

  const totalRevenue = (summary.total_revenue as number) ?? 0;
  const totalTxns = (summary.total_transactions as number) ?? 0;
  const successful = (summary.successful as number) ?? 0;
  const failed = (summary.failed as number) ?? 0;
  const pending = (summary.pending as number) ?? 0;
  const avgContrib = (summary.avg_contribution as number) ?? 0;
  const uniqueContributors = (summary.unique_contributors as number) ?? 0;
  const successRate = totalTxns > 0 ? ((successful / totalTxns) * 100).toFixed(1) : '0';

  const fmt = (n: number) => new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <DollarSign size={32} className="text-green-300" />
            Payments & Contributions
          </h1>
          <p className="mt-2 text-white/70">Revenue overview and contribution breakdown</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {isLoading && <div className="text-white/50 text-center py-12">Loading payment data...</div>}
      {error && <div className="text-red-400 text-center py-12">Failed to load: {(error as Error).message}</div>}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard title="Total Revenue" value={fmt(totalRevenue)} icon={DollarSign} color="bg-green-600" />
            <MetricCard title="Transactions" value={totalTxns.toLocaleString()} icon={Receipt} color="bg-blue-600" />
            <MetricCard title="Success Rate" value={`${successRate}%`} icon={TrendingUp} color="bg-teal-600" />
            <MetricCard title="Avg Contribution" value={fmt(avgContrib)} icon={TrendingUp} color="bg-orange-600" />
            <MetricCard title="Successful" value={successful.toLocaleString()} icon={CheckCircle} color="bg-green-500" />
            <MetricCard title="Unique Contributors" value={uniqueContributors.toLocaleString()} icon={Users} color="bg-purple-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {byProvider.length > 0 && (
              <div className="frosted-glass p-4">
                <h2 className="text-lg font-semibold text-white mb-4">By Provider</h2>
                <DataTable
                  headers={['Provider', 'Status', 'Count', 'Total']}
                  rows={byProvider.map((r: any) => [r.provider ?? '', r.status ?? '', r.count ?? 0, fmt(r.total ?? 0)])}
                />
              </div>
            )}

            {byNarrative.length > 0 && (
              <div className="frosted-glass p-4">
                <h2 className="text-lg font-semibold text-white mb-4">By Reason</h2>
                <DataTable
                  headers={['Reason', 'Count', 'Total']}
                  rows={byNarrative.map((r: any) => [r.narrative ?? 'None', r.count ?? 0, fmt(r.total ?? 0)])}
                />
              </div>
            )}
          </div>

          {topContributors.length > 0 && (
            <div className="frosted-glass p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Top Contributors</h2>
              <DataTable
                headers={['Name', 'Phone', 'Contributions', 'Total Given', 'Last']}
                rows={topContributors.map((r: any) => {
                  const last = r.last_contribution ?? '';
                  const date = last ? new Date(last).toLocaleDateString() : '';
                  return [r.payer_name ?? 'Anonymous', r.phone_number ?? '', r.contributions ?? 0, fmt(r.total_given ?? 0), date];
                })}
              />
            </div>
          )}

          {dailyData.length > 0 && (
            <div className="frosted-glass p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Daily Breakdown</h2>
              <DataTable
                headers={['Date', 'Count', 'Total', 'Completed', 'Failed', 'Pending']}
                rows={dailyData.map((r: any) => [
                  r.date ?? '',
                  r.count ?? 0,
                  fmt(r.total ?? 0),
                  r.completed ?? 0,
                  r.failed ?? 0,
                  r.pending ?? 0,
                ])}
              />
            </div>
          )}

          {!isLoading && dailyData.length === 0 && byProvider.length === 0 && (
            <div className="frosted-glass p-12 text-center">
              <DollarSign size={64} className="text-white/20 mx-auto mb-4" />
              <p className="text-xl text-white/50">No payment data found for this period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
