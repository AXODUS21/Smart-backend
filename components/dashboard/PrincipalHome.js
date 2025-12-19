"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Clock,
  Zap,
  Users,
  TrendingUp,
} from "lucide-react";

export default function PrincipalHome({ setActiveTab }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    creditsAvailable: 0,
    totalSessions: 0,
  });
  const [principalName, setPrincipalName] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Get principal data
        const { data: principalData } = await supabase
          .from("Principals")
          .select("id, first_name, last_name, credits, students")
          .eq("user_id", user.id)
          .single();

        if (principalData) {
          const fullName = `${principalData.first_name || ''} ${principalData.last_name || ''}`.trim();
          setPrincipalName(fullName || user.email);
          
          const students = principalData.students || [];
          const studentIds = students.map(s => s.student_id || s.id).filter(Boolean);
          
          // Count total sessions for all students
          let totalSessions = 0;
          if (studentIds.length > 0) {
            const { data: sessions } = await supabase
              .from("Schedules")
              .select("id")
              .in("student_id", studentIds);
            
            totalSessions = sessions?.length || 0;
          }

          setMetrics({
            totalStudents: students.length,
            creditsAvailable: principalData.credits || 0,
            totalSessions: totalSessions,
          });
        }
      } catch (error) {
        console.error("Error fetching principal data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-64"></div>
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      title: "Total Students",
      value: metrics.totalStudents,
      icon: Users,
      color: "bg-blue-500",
      onClick: () => setActiveTab("students"),
    },
    {
      title: "Available Credits",
      value: metrics.creditsAvailable,
      icon: Zap,
      color: "bg-orange-500",
      onClick: () => setActiveTab("credits"),
    },
    {
      title: "Total Sessions",
      value: metrics.totalSessions,
      icon: Clock,
      color: "bg-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Welcome, {principalName}
        </h2>
        <p className="text-slate-600">
          Manage your students and credits from your dashboard
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              onClick={metric.onClick}
              className={`${metric.color} rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow ${
                metric.onClick ? "cursor-pointer" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-white/20 p-3 rounded-lg">
                  <Icon size={24} className="text-white" />
                </div>
              </div>
              <p className="text-white/80 text-sm font-medium mb-1">
                {metric.title}
              </p>
              <p className="text-3xl font-bold">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveTab("students")}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-slate-900">Manage Students</p>
              <p className="text-sm text-slate-500">Add or remove students</p>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("credits")}
            className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
          >
            <Zap className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-medium text-slate-900">Add Credits</p>
              <p className="text-sm text-slate-500">Purchase credits for your students</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

















