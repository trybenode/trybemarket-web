"use client";

import { useEffect } from "react";
import useUserStore from "@/lib/userStore";

export default function ClientUserLoader() {
  const { loadUser } = useUserStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return null;
}
