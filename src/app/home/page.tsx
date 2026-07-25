export default function HomePage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome to SaltMedia Admin Dashboard
        </h1>
        <p className="mt-2 text-white/70">
          Manage your content, analytics, and users
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div className="frosted-glass p-6">
          <h2 className="text-lg font-semibold text-white mb-2">📊 Analytics</h2>
          <p className="text-white/70">
            View detailed statistics about your platform's performance and user engagement.
          </p>
        </div>

        <div className="frosted-glass p-6">
          <h2 className="text-lg font-semibold text-white mb-2">🎥 On-Demand Videos</h2>
          <p className="text-white/70">
            Manage and upload video content for your platform.
          </p>
        </div>

        <div className="frosted-glass p-6">
          <h2 className="text-lg font-semibold text-white mb-2">👥 User Management</h2>
          <p className="text-white/70">
            Control user roles, permissions, and access levels.
          </p>
        </div>

        <div className="frosted-glass p-6">
          <h2 className="text-lg font-semibold text-white mb-2">📺 EPG</h2>
          <p className="text-white/70">
            Manage the Electronic Program Guide for your channels.
          </p>
        </div>

        <div className="frosted-glass p-6">
          <h2 className="text-lg font-semibold text-white mb-2">⚡ Events</h2>
          <p className="text-white/70">
            Track and manage platform events and activities.
          </p>
        </div>

        <div className="frosted-glass p-6">
          <h2 className="text-lg font-semibold text-white mb-2">💰 Monetization</h2>
          <p className="text-white/70">
            Monitor revenue and manage monetization settings.
          </p>
        </div>
      </div>

      <div className="frosted-glass p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Stats</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-white/60 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-white">2,543</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Videos</p>
            <p className="text-2xl font-bold text-white">486</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Active Sessions</p>
            <p className="text-2xl font-bold text-white">342</p>
          </div>
          <div>
            <p className="text-white/60 text-sm">Uptime</p>
            <p className="text-2xl font-bold text-white">99.9%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
