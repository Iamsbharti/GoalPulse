import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-5xl font-bold text-primary-600">
          🎯 GoalPulse
        </h1>
        <p className="text-xl text-gray-600">
          Your Personal AI Coach for Turning Resolutions into Results
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link 
            href="/chat"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Start Chatting
          </Link>
          <Link 
            href="/goals"
            className="px-6 py-3 border-2 border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition"
          >
            View Goals
          </Link>
        </div>

        <div className="pt-8 border-t">
          <p className="text-sm text-gray-500">
            Daily check-ins to keep you on track • AI-powered coaching • Progress tracking
          </p>
        </div>
      </div>
    </main>
  );
}
