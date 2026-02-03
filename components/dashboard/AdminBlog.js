"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  FileText,
  Plus,
  X,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Tag,
  BookOpen,
  Search,
} from "lucide-react";

export default function AdminBlog() {
  const { user } = useAuth();
  const [adminId, setAdminId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const CATEGORIES = [
    "Learning Tips",
    "Study Habits",
    "Academic Success",
    "Exam Preparation",
    "Time Management",
    "Motivation",
    "Technology",
    "News",
    "General",
  ];

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "Learning Tips",
    read_time: "5 min read",
    featured_image: "",
    is_published: true,
  });

  // Get admin ID
  useEffect(() => {
    const fetchAdminId = async () => {
      if (!user) return;

      const { data: superadminData } = await supabase
        .from("superadmins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (superadminData) {
        setAdminId(null);
        return;
      }

      const { data: adminData } = await supabase
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminData) {
        setAdminId(adminData.id);
      }
    };

    fetchAdminId();
  }, [user]);

  // Fetch blog posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { data, error } = await supabase
          .from("BlogPosts")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setPosts(data || []);
      } catch (error) {
        console.error("Error fetching blog posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (!formData.title || !formData.excerpt) {
        setError("Please fill in title and excerpt.");
        return;
      }

      // Generate slug from title
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      if (editingId) {
        const { error: updateError } = await supabase
          .from("BlogPosts")
          .update({
            title: formData.title,
            slug,
            excerpt: formData.excerpt,
            content: formData.content,
            category: formData.category,
            read_time: formData.read_time,
            featured_image: formData.featured_image,
            is_published: formData.is_published,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (updateError) throw updateError;
        setSuccess("Blog post updated successfully!");
      } else {
        const { error: insertError } = await supabase
          .from("BlogPosts")
          .insert({
            admin_id: adminId || null,
            title: formData.title,
            slug,
            excerpt: formData.excerpt,
            content: formData.content,
            category: formData.category,
            read_time: formData.read_time,
            featured_image: formData.featured_image,
            is_published: formData.is_published,
            publish_date: formData.is_published ? new Date().toISOString() : null,
          });

        if (insertError) throw insertError;
        setSuccess("Blog post created successfully!");
      }

      // Reset form
      setFormData({
        title: "",
        excerpt: "",
        content: "",
        category: "Learning Tips",
        read_time: "5 min read",
        featured_image: "",
        is_published: true,
      });
      setShowForm(false);
      setEditingId(null);

      // Refresh posts
      const { data } = await supabase
        .from("BlogPosts")
        .select("*")
        .order("created_at", { ascending: false });

      setPosts(data || []);
    } catch (error) {
      console.error("Error saving blog post:", error);
      setError(error.message || "Failed to save blog post.");
    }
  };

  // Handle edit
  const handleEdit = (post) => {
    setFormData({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content || "",
      category: post.category || "Learning Tips",
      read_time: post.read_time || "5 min read",
      featured_image: post.featured_image || "",
      is_published: post.is_published !== false,
    });
    setEditingId(post.id);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this blog post?")) return;

    try {
      const { error } = await supabase
        .from("BlogPosts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSuccess("Blog post deleted successfully!");
      setPosts(posts.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting blog post:", error);
      setError(error.message || "Failed to delete blog post.");
    }
  };

  // Toggle published status
  const handleTogglePublished = async (post) => {
    try {
      const newPublishedState = !post.is_published;
      const { error } = await supabase
        .from("BlogPosts")
        .update({
          is_published: newPublishedState,
          publish_date: newPublishedState ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      if (error) throw error;

      setPosts(
        posts.map((p) =>
          p.id === post.id
            ? { ...p, is_published: newPublishedState }
            : p
        )
      );
    } catch (error) {
      console.error("Error toggling blog post:", error);
      setError(error.message || "Failed to update blog post.");
    }
  };

  // Get category badge
  const getCategoryBadge = (category) => {
    const styles = {
      "Learning Tips": "bg-blue-100 text-blue-800",
      "Study Habits": "bg-green-100 text-green-800",
      "Academic Success": "bg-purple-100 text-purple-800",
      "Exam Preparation": "bg-orange-100 text-orange-800",
      "Time Management": "bg-yellow-100 text-yellow-800",
      "Motivation": "bg-pink-100 text-pink-800",
      "Technology": "bg-cyan-100 text-cyan-800",
      "News": "bg-red-100 text-red-800",
      "General": "bg-gray-100 text-gray-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          styles[category] || styles.General
        }`}
      >
        {category}
      </span>
    );
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "Not published";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || post.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Blog Posts
          </h2>
          <p className="text-slate-500">
            Create and manage blog content for students and parents
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({
              title: "",
              excerpt: "",
              content: "",
              category: "Learning Tips",
              read_time: "5 min read",
              featured_image: "",
              is_published: true,
            });
            setError("");
            setSuccess("");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {showForm ? "Cancel" : "New Post"}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Post" : "Create New Post"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter blog post title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Excerpt <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the blog post"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                rows={8}
                className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full blog post content (supports markdown)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Read Time
                </label>
                <input
                  type="text"
                  value={formData.read_time}
                  onChange={(e) =>
                    setFormData({ ...formData, read_time: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 5 min read"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Featured Image URL
                </label>
                <input
                  type="text"
                  value={formData.featured_image}
                  onChange={(e) =>
                    setFormData({ ...formData, featured_image: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_published}
                  onChange={(e) =>
                    setFormData({ ...formData, is_published: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-700">
                  Publish immediately
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? "Update" : "Create"} Post
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    title: "",
                    excerpt: "",
                    content: "",
                    category: "Learning Tips",
                    read_time: "5 min read",
                    featured_image: "",
                    is_published: true,
                  });
                  setError("");
                }}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search posts..."
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Posts List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            All Posts ({filteredPosts.length})
          </h3>
          {filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-sm">No blog posts yet.</p>
              <p className="text-xs">Create your first post to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className={`p-4 rounded-lg border ${
                    post.is_published
                      ? "bg-white border-slate-200"
                      : "bg-slate-50 border-slate-200 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-base font-semibold text-slate-900">
                          {post.title}
                        </h4>
                        {getCategoryBadge(post.category)}
                        {!post.is_published && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Draft
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {post.excerpt}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatDate(post.publish_date || post.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{post.read_time || "5 min read"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => handleTogglePublished(post)}
                        className={`p-2 rounded-lg transition-colors ${
                          post.is_published
                            ? "text-green-600 hover:bg-green-50"
                            : "text-gray-400 hover:bg-gray-50"
                        }`}
                        title={
                          post.is_published
                            ? "Unpublish"
                            : "Publish"
                        }
                      >
                        {post.is_published ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(post)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
