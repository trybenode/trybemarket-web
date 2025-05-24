// components/ToasterProvider.jsx
"use client";

import { Toaster } from "react-hot-toast";

export default function ToasterProvider() {
  return (
    <Toaster
      position='top-center'
      toastOptions={{
        success: {
          style: {
            background: "#FFFFFF",
            color: "#808080",
          },
        },
        error: {
          style: {
            background: "#FFFFFF",
            color: "#808080",
          },
        },
        duration: 2000,
      }}
    />
  );
}