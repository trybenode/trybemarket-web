import ServicePageClient from "./ServicePageClient";

import { SITE_URL } from "@/lib/siteUrl";

const BASE_URL = SITE_URL;

export async function generateMetadata({ params }) {
  const { id } = await params;
  return {
    alternates: {
      canonical: `${BASE_URL}/view-service/${id}`,
    },
  };
}

export default function Page({ params }) {
  return <ServicePageClient params={params} />;
}
