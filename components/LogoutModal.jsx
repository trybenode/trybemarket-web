
import React from "react";
import { createPortal } from "react-dom";

export default React.memo( function LogoutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  // Portalled to <body>: this modal is opened from the header, whose
  // backdrop-blur makes it the containing block for `fixed` children — rendered
  // in place, the overlay was only header-sized and the dialog spilled off the top.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full mx-2 max-w-sm p-6 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Are you sure you want to logout?
        </h2>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
})
