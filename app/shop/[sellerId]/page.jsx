import ShopPageClient from "./ShopPageClient";

import { SITE_URL } from "@/lib/siteUrl";

const BASE_URL = SITE_URL;

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
