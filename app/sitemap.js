import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

const BASE_URL = "https://trybemarket.online";

const staticRoutes = [
  { url: "/", changeFrequency: "daily", priority: 1.0 },
  { url: "/explore-services", changeFrequency: "daily", priority: 0.9 },
  { url: "/categories", changeFrequency: "weekly", priority: 0.8 },
  { url: "/boosted-products", changeFrequency: "daily", priority: 0.7 },
  { url: "/login", changeFrequency: "monthly", priority: 0.5 },
  { url: "/signup", changeFrequency: "monthly", priority: 0.5 },
  { url: "/select-university", changeFrequency: "monthly", priority: 0.4 },
];

async function getShopSlugs() {
  try {
    const snap = await getDocs(query(collection(db, "shops"), limit(500)));
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

async function getProductIds() {
  try {
    const snap = await getDocs(query(collection(db, "products"), limit(200)));
    return snap.docs.map((d) => d.id);
  } catch {
    return [];
  }
}

export default async function sitemap() {
  const [shopSlugs, productIds] = await Promise.all([
    getShopSlugs(),
    getProductIds(),
  ]);

  const now = new Date();

  const statics = staticRoutes.map(({ url, changeFrequency, priority }) => ({
    url: `${BASE_URL}${url}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const shops = shopSlugs.map((slug) => ({
    url: `${BASE_URL}/shop/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const products = productIds.map((id) => ({
    url: `${BASE_URL}/listing/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...statics, ...shops, ...products];
}
