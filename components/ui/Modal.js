import React from "react";
import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-4xl" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className={`bg-white rounded-lg shadow-xl border border-slate-200 w-full ${maxWidth} max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 shrink-0">
          <h3 className="text-xl font-semibold text-slate-900">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
