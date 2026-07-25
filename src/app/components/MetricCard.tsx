import React from "react"

interface MetricCardProps {
  title: string
  value: string | number | React.ReactNode
  icon?: React.ReactNode
  description?: string
  trend?: number
  color?: 'blue' | 'green' | 'purple' | 'cyan'
}

export function MetricCard({ title, value, icon, description, trend, color = 'blue' }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30',
    green: 'bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30',
    purple: 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30',
    cyan: 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border-cyan-500/30',
  }

  const iconColorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  }

  return (
    <div className={`frosted-glass p-6 border rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-white/60">{title}</p>
          <div className="text-3xl font-bold text-white mt-2">{value}</div>
          {(description || trend !== undefined) && (
            <p className="text-xs text-white/40 mt-1">
              {trend !== undefined ? (
                <>
                  {trend > 0 ? "+" : ""}
                  {trend}% vs last period
                </>
              ) : (
                description
              )}
            </p>
          )}
        </div>
        {icon && <div className={`${iconColorClasses[color]} opacity-60`}>{icon}</div>}
      </div>
    </div>
  )
}
