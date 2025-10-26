'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { BookOpen, Plus, X, Check } from 'lucide-react';

export default function TutorHome() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Common subjects for quick selection
  const commonSubjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
    'History', 'Geography', 'Computer Science', 'Economics',
    'Psychology', 'Spanish', 'French', 'German', 'Art',
    'Music', 'Physical Education', 'Statistics', 'Calculus',
    'Algebra', 'Geometry', 'Trigonometry', 'Literature'
  ];

  // Fetch tutor's subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('Tutors')
          .select('subjects')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching subjects:', error);
        } else {
          setSubjects(data?.subjects || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [user]);

  // Add a new subject
  const handleAddSubject = async (subject) => {
    if (!subject.trim() || subjects.includes(subject.trim())) return;

    setSaving(true);
    setSuccess('');

    try {
      const updatedSubjects = [...subjects, subject.trim()];
      
      const { error } = await supabase
        .from('Tutors')
        .update({ subjects: updatedSubjects })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setSubjects(updatedSubjects);
      setNewSubject('');
      setSuccess(`Added "${subject.trim()}" to your subjects!`);
    } catch (error) {
      console.error('Error adding subject:', error);
      alert('Error adding subject. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Remove a subject
  const handleRemoveSubject = async (subjectToRemove) => {
    setSaving(true);
    setSuccess('');

    try {
      const updatedSubjects = subjects.filter(subject => subject !== subjectToRemove);
      
      const { error } = await supabase
        .from('Tutors')
        .update({ subjects: updatedSubjects })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setSubjects(updatedSubjects);
      setSuccess(`Removed "${subjectToRemove}" from your subjects.`);
    } catch (error) {
      console.error('Error removing subject:', error);
      alert('Error removing subject. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Add from common subjects
  const handleAddCommonSubject = (subject) => {
    handleAddSubject(subject);
  };

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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">My Teaching Subjects</h3>
      </div>

      {/* Current Subjects */}
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-700 mb-3">Your Subjects ({subjects.length})</h4>
        {subjects.length === 0 ? (
          <p className="text-gray-500 italic">No subjects added yet. Add some subjects to start teaching!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((subject, index) => (
              <div
                key={index}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                <span>{subject}</span>
                <button
                  onClick={() => handleRemoveSubject(subject)}
                  disabled={saving}
                  className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Subject */}
      <div className="border-t pt-6">
        <h4 className="text-md font-semibold text-gray-700 mb-3">Add New Subject</h4>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Enter subject name..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            onKeyPress={(e) => e.key === 'Enter' && handleAddSubject(newSubject)}
          />
          <button
            onClick={() => handleAddSubject(newSubject)}
            disabled={saving || !newSubject.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </div>

        {/* Common Subjects */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Quick add from common subjects:</p>
          <div className="flex flex-wrap gap-2">
            {commonSubjects
              .filter(subject => !subjects.includes(subject))
              .slice(0, 12)
              .map((subject) => (
                <button
                  key={subject}
                  onClick={() => handleAddCommonSubject(subject)}
                  disabled={saving}
                  className="bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-3 py-1 rounded-full text-sm transition-colors duration-200"
                >
                  {subject}
                </button>
              ))}
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <Check className="h-4 w-4" />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
