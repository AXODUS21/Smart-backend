"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Building2, Plus, X, Trash2, Search, FileText, Upload, Download, Info, Edit, Zap } from "lucide-react";

export default function PrincipalSchools() {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState({});
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [templateUrl, setTemplateUrl] = useState(null);
  const [credits, setCredits] = useState(0);
  
  const [editingId, setEditingId] = useState(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    voucher_code: "",
    amount: "",
    address: "",
    in_charge_name: "",
    in_charge_contact: "",
    school_type: "",
    file: null
  });
  
  const [adding, setAdding] = useState(false);

  const schoolTypes = [
    "Public Schools (Traditional District Schools)",
    "Title 1 Schools",
    "Charter School",
    "Magnet School",
    "Community Schools",
    "Alternative Schools",
    "Private Schools with Scholarships / Vouchers",
    "Online / Virtual Public Schools",
    "Homeschool Programs & PSPs (with Public Support)",
    "Early Childhood Programs",
    "Nonprofit & Community-Based Schools",
    "Other"
  ];

  // Fetch schools
  useEffect(() => {
    const fetchSchools = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("Schools")
          .select("*")
          .eq("principal_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setSchools(data || []);
      } catch (error) {
        console.error("Error fetching schools:", error);
        setError("Failed to load schools");
      } finally {
        setLoading(false);
      }
    };

    const fetchTemplate = async () => {
      try {
        const { data, error } = await supabase
          .from("SystemSettings")
          .select("value")
          .eq("key", "school_registration_template")
          .single();
        
        if (data?.value?.url) {
          setTemplateUrl(data.value.url);
        }
      } catch (err) {
        console.error("Error fetching template:", err);
      }
    };

    const fetchCredits = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("Principals")
          .select("credits")
          .eq("user_id", user.id)
          .single();
        
        if (data) {
          setCredits(data.credits || 0);
        }
      } catch (err) {
        console.error("Error fetching credits:", err);
      }
    };

    fetchSchools();
    fetchTemplate();
    fetchCredits();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, file: e.target.files[0] }));
    }
  };

  const uploadFile = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('school-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('school-documents')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleEditClick = (school) => {
    setEditingId(school.id);
    setFormData({
      name: school.name,
      voucher_code: school.voucher_code || "",
      amount: school.amount || "",
      address: school.address || "",
      in_charge_name: school.in_charge_name || "",
      in_charge_contact: school.in_charge_contact || "",
      school_type: school.school_type || "",
      file: null
    });
    setShowAddModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.school_type) {
      setError("School Name and Type are required");
      return;
    }

    setAdding(true);
    setError("");
    setSuccess("");

    try {
      let fileUrl = null;
      if (formData.file) {
        fileUrl = await uploadFile(formData.file);
      }

      const schoolData = {
        principal_id: user.id,
        name: formData.name,
        voucher_code: formData.voucher_code,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        address: formData.address,
        in_charge_name: formData.in_charge_name,
        in_charge_contact: formData.in_charge_contact,
        school_type: formData.school_type,
      };

      if (fileUrl) {
        schoolData.file_url = fileUrl;
      }

      if (editingId) {
        // Update existing school
        const { data, error } = await supabase
          .from("Schools")
          .update(schoolData)
          .eq("id", editingId)
          .select()
          .single();

        if (error) throw error;

        setSchools(prev => prev.map(s => s.id === editingId ? data : s));
        setSuccess(`Updated ${data.name} successfully`);
      } else {
        // Add new school
        // Only set file_url if it was uploaded, otherwise it stays undefined (good for insert) 
        // Logic check: if fileUrl is null for new school, it's just null in DB which is fine.
        const { data, error } = await supabase
          .from("Schools")
          .insert({ ...schoolData, file_url: fileUrl })
          .select()
          .single();

        if (error) throw error;

        setSchools(prev => [data, ...prev]);
        setSuccess(`Added ${data.name} successfully`);
      }

      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error("Error saving school:", err);
      setError(err.message || "Failed to save school");
    } finally {
      setAdding(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      voucher_code: "",
      amount: "",
      address: "",
      in_charge_name: "",
      in_charge_contact: "",
      school_type: "",
      file: null
    });
  };

  const handleRemoveSchool = async (schoolId, schoolName) => {
    if (!confirm(`Are you sure you want to remove ${schoolName}?`)) return;

    setRemoving(prev => ({ ...prev, [schoolId]: true }));
    try {
      const { error } = await supabase
        .from("Schools")
        .delete()
        .eq("id", schoolId);

      if (error) throw error;

      setSchools(prev => prev.filter(s => s.id !== schoolId));
      setSuccess(`Removed ${schoolName} successfully`);
    } catch (error) {
      console.error("Error removing school:", error);
      setError("Failed to remove school");
    } finally {
      setRemoving(prev => ({ ...prev, [schoolId]: false }));
    }
  };

  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    school.voucher_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">My Schools</h2>
          <p className="text-slate-600">
            Manage your schools and vouchers
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add School
        </button>
      </div>

      {/* Credits Display */}
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium">Available Credits</p>
              <p className="text-3xl font-bold">{credits}</p>
            </div>
          </div>
          <p className="text-white/80 text-sm">Credits are used to book sessions for your students</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search schools by name or voucher code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Schools List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchools.map((school) => (
          <div key={school.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditClick(school)}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    title="Edit School"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleRemoveSchool(school.id, school.name)}
                    disabled={removing[school.id]}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                    title="Remove School"
                  >
                    {removing[school.id] ? (
                      <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">{school.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{school.school_type}</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Voucher Code</span>
                  <span className="font-medium text-slate-900">{school.voucher_code || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-medium text-green-600">
                    {school.amount ? `₱${school.amount.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">In Charge</span>
                  <span className="font-medium text-slate-900">{school.in_charge_name || "—"}</span>
                </div>
              </div>
              
              {school.file_url && (
                <a 
                  href={school.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  View Document
                </a>
              )}
            </div>
          </div>
        ))}
        
        {filteredSchools.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p>No schools found. Add a school to get started.</p>
          </div>
        )}
      </div>

      {/* Add/Edit School Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-950/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white z-10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? "Edit School" : "Add School"}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    School Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter school name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Type of School *
                  </label>
                  <select
                    name="school_type"
                    value={formData.school_type}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select type</option>
                    {schoolTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Voucher Code
                  </label>
                  <input
                    type="text"
                    name="voucher_code"
                    value={formData.voucher_code}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. V-12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₱</span>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Complete Address
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="School complete address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Name in Charge
                  </label>
                  <input
                    type="text"
                    name="in_charge_name"
                    value={formData.in_charge_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Contact person name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact Info
                  </label>
                  <input
                    type="text"
                    name="in_charge_contact"
                    value={formData.in_charge_contact}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Phone or email"
                  />
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Document Upload (Excel)
                  </label>
                  
                  {/* Template Download Section */}
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-full shrink-0">
                        <Info className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Important Instruction</h4>
                        <p className="text-sm text-blue-800 mb-3">
                          Please download the official Excel form below, fill it out with the school details, and then upload the completed file here.
                        </p>
                        {templateUrl ? (
                          <a 
                            href={templateUrl}
                            download
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download Excel Form
                          </a>
                        ) : (
                          <p className="text-sm text-amber-700 font-medium italic">
                            Template file is currently unavailable. Please contact support.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 text-center hover:bg-slate-100 transition-colors">
                    <input
                      type="file"
                      id="file-upload"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-blue-600 font-medium hover:underline">Click to upload</span>
                      <span className="text-slate-500 text-sm mt-1">
                        {formData.file ? formData.file.name : "or drag and drop Excel file"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={adding}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {adding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    editingId ? "Save Changes" : "Add School"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
