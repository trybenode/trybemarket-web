import ServicePageClient from "./ServicePageClient";

const BASE_URL = "https://trybemarket.online";

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
