"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminParentsReview() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from("Reviews")
        .select("id, parent_name, student_name, message, rating, created_at")
        .order("created_at", { ascending: false });
      if (!error) setReviews(data || []);
      setLoading(false);
    };
    fetchReviews();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Parents Review</h2>
        <p className="text-slate-500">All reviews sent by parents.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4">
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No reviews yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reviews.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-900">
                          {r.parent_name || "Unnamed Parent"}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-xs text-slate-700">{r.student_name || "Student"}</span>
                        <span className="text-xs text-amber-600 font-medium">
                          • {r.rating || "-"}/5
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 ml-3 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap line-clamp-3">
                    {r.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



