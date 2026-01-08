"use client";

import { Search, Bell, MessageCircle } from "lucide-react";

export default function Header({ userName, onProfileClick }) {
  return (
    <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search here..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 ml-8">
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors hidden">
          <MessageCircle size={20} className="text-slate-600" />
        </button>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative hidden">
          <Bell size={20} className="text-slate-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button
          onClick={onProfileClick}
          className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold hover:from-blue-500 hover:to-blue-700 transition-all cursor-pointer shadow-md hover:shadow-lg"
          title="View Profile"
        >
          {userName.charAt(0)}
        </button>
      </div>
    </div>
  );
}
