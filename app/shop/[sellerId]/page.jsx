import ShopPageClient from "./ShopPageClient";

const BASE_URL = "https://trybemarket.online";

export async function generateMetadata({ params }) {
  const { sellerId } = await params;
  return {
    alternates: {
      canonical: `${BASE_URL}/shop/${sellerId}`,
    },
  };
}

export default function Page({ params }) {
  return <ShopPageClient params={params} />;
}
