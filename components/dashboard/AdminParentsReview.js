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

      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        {reviews.length === 0 ? (
          <div className="text-center text-slate-500">No reviews yet.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {reviews.map((r) => (
              <div key={r.id} className="py-4 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="text-slate-900 font-medium">
                    {r.parent_name || "Unnamed Parent"}
                    <span className="text-slate-400 font-normal"> → </span>
                    <span className="text-slate-700">{r.student_name || "Student"}</span>
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-amber-600 text-sm">Rating: {r.rating || "-"}/5</div>
                <div className="text-slate-700 whitespace-pre-wrap">{r.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



