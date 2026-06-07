import ListingPageClient from "./ListingPageClient";

const BASE_URL = "https://trybemarket.online";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return {
    alternates: {
      canonical: `${BASE_URL}/listing/${id}`,
    },
  };
}

export default function Page({ params }) {
  return <ListingPageClient params={params} />;
}
