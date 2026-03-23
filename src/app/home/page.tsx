import { ThemeSelector } from "../components/ThemeSelector";

export default function HomePage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background">
      <div className="absolute top-4 right-4">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-center text-foreground">Welcome to the Dashboard!</h1>
      </div>
    </div>
  );
}
