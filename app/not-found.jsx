import Link from "next/link";

export const metadata = {
  title: "Page Not Found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4 text-center">
      <div className="mb-6">
        <img
          src="/trybemarket.png"
          alt="TrybeMarket"
          className="h-16 w-16 mx-auto mb-4 opacity-60"
        />
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-3">
          Page Not Found
        </h2>
        <p className="text-gray-500 max-w-sm mx-auto">
          This listing, shop, or service may have been removed or doesn&apos;t
          exist. Browse what&apos;s available on campus.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Back to Home
        </Link>
        <Link
          href="/explore-services"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Explore Services
        </Link>
      </div>
    </div>
  );
}
