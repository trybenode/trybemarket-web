"use client";
import React from "react";
import AppHeader from "@/components/AppHeader";

// Home-style header (logo). Kept as the import the existing pages use; the
// implementation lives in AppHeader.
export default React.memo(function ToolBar() {
  return <AppHeader />;
});
