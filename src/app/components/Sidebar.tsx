import Link from 'next/link';

const Sidebar = () => {
  return (
    <div className="flex flex-col w-64 bg-gray-800 text-white h-screen">
      <div className="flex items-center justify-center h-16 border-b border-gray-700">
        <span className="text-2xl font-semibold">Admin Panel</span>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-2">
        <Link href="/dashboard" className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md">
          Dashboard
        </Link>
        <Link href="/user-management" className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md">
          User Management
        </Link>
        <Link href="/analytics" className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md">
          Analytics
        </Link>
        <Link href="/ondemand" className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md">
          On-demand Videos Management
        </Link>
        <Link href="/live-tv" className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md">
          Live TV Management
        </Link>
        <Link href="/logout" className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md">
          Logout
        </Link>
      </nav>
    </div>
  );
};

export default Sidebar;
