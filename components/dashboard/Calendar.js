"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Calendar() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
  const [formData, setFormData] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });

  // Helper function to check if a date is in the past
  const isPastDate = (dateString) => {
    if (!dateString) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison
    const slotDate = new Date(dateString);
    slotDate.setHours(0, 0, 0, 0);
    return slotDate < today;
  };

  // Remove past dates from availability and update database
  const removePastDates = async (currentAvailability) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const filteredAvailability = currentAvailability.filter((slot) => {
      if (!slot.date) return false;
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      return slotDate >= today;
    });

    // Only update if there were past dates removed
    if (filteredAvailability.length !== currentAvailability.length) {
      try {
        const { error } = await supabase
          .from("Tutors")
          .update({ availability: filteredAvailability })
          .eq("user_id", user.id);

        if (error) {
          console.error("Error removing past dates:", error);
        } else {
          return filteredAvailability;
        }
      } catch (error) {
        console.error("Error removing past dates:", error);
      }
    }

    return filteredAvailability;
  };

  // Fetch tutor's availability
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("Tutors")
          .select("availability")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching availability:", error);
        } else {
          const currentAvailability = data?.availability || [];
          // Remove past dates and update database
          const cleanedAvailability = await removePastDates(currentAvailability);
          setAvailability(cleanedAvailability);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [user]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Add new availability slot
  const handleAddAvailability = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.startTime || !formData.endTime) return;

    setSaving(true);
    setSuccess("");

    try {
      const newSlot = {
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        id: Date.now(), // Simple ID for local state management
      };

      const updatedAvailability = [...availability, newSlot];

      const { error } = await supabase
        .from("Tutors")
        .update({ availability: updatedAvailability })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setAvailability(updatedAvailability);
      setFormData({ date: "", startTime: "", endTime: "" });
      setShowAddForm(false);
      setSuccess(
        `Added availability for ${formatDate(formData.date)} ${
          formData.startTime
        }-${formData.endTime}`
      );
    } catch (error) {
      console.error("Error adding availability:", error);
      alert("Error adding availability. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Remove availability slot by unique identifier
  const handleRemoveAvailability = async (slotToRemove) => {
    setSaving(true);
    setSuccess("");

    try {
      const updatedAvailability = availability.filter(
        (slot) =>
          !(
            slot.date === slotToRemove.date &&
            slot.startTime === slotToRemove.startTime &&
            slot.endTime === slotToRemove.endTime &&
            (slot.id === slotToRemove.id || (!slot.id && !slotToRemove.id))
          )
      );

      const { error } = await supabase
        .from("Tutors")
        .update({ availability: updatedAvailability })
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setAvailability(updatedAvailability);
      setSuccess("Availability slot removed successfully");
    } catch (error) {
      console.error("Error removing availability:", error);
      alert("Error removing availability. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Check if a date has availability (and is not in the past)
  const hasAvailability = (date) => {
    if (!date) return false;
    // Format date to YYYY-MM-DD in local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;
    
    // Check if date is in the past
    if (isPastDate(dateString)) return false;
    
    return availability.some((slot) => slot.date === dateString);
  };

  // Navigate to previous/next month
  const navigateMonth = (direction) => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const calendarDays = getCalendarDays();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-48"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              My Availability
            </h3>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Availability
          </button>
        </div>

        {/* Calendar UI */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h4 className="text-xl font-semibold text-gray-900">
              {currentMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Days of week header */}
            <div className="grid grid-cols-7 bg-gray-50">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((date, index) => {
                const isAvailable = hasAvailability(date);
                const isToday =
                  date && date.toDateString() === new Date().toDateString();

                if (!date) {
                  return (
                    <div
                      key={index}
                      className="p-2 border-r border-b border-gray-200 last:border-r-0"
                    />
                  );
                }

                return (
                  <div
                    key={index}
                    className={`p-2 border-r border-b border-gray-200 last:border-r-0 min-h-[48px] flex items-center justify-center ${
                      isToday ? "bg-blue-50" : "bg-white"
                    } ${isAvailable ? "cursor-pointer" : ""}`}
                  >
                    <div
                      className={`text-sm font-medium ${
                        isAvailable
                          ? "w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-semibold"
                          : "text-gray-900"
                      } ${
                        isToday && !isAvailable
                          ? "text-blue-600 font-semibold"
                          : ""
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-sm text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-50 border-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Today</span>
            </div>
          </div>
        </div>

        {/* Add Availability Form */}
        {showAddForm && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-md font-semibold text-gray-700 mb-4">
              Add New Availability
            </h4>
            <form onSubmit={handleAddAvailability} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    className="w-full px-3 text-gray-800 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 text-gray-800 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Add Availability
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setFormData({ date: "", startTime: "", endTime: "" });
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Current Availability */}
        <div>
          <h4 className="text-md font-semibold text-gray-700 mb-4">
            Your Availability ({availability.filter((slot) => !isPastDate(slot.date)).length} slots)
          </h4>

          {availability.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No availability added yet.</p>
              <p className="text-sm">
                Click "Add Availability" to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availability
                .filter((slot) => !isPastDate(slot.date))
                .map((slot, index) => (
                  <div
                    key={slot.id || `${slot.date}-${slot.startTime}-${index}`}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {formatDate(slot.date)}
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAvailability(slot)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mt-4 flex items-center gap-2">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
