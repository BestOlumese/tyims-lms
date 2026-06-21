"use client";

import { useState, useMemo } from "react";
import { orpc } from "@/lib/orpc";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  Layers, 
  Search, 
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ConfirmModal } from "@/components/shared/confirm-modal";

interface CategoriesClientProps {
  initialData?: any[];
}

export default function CategoriesClient({ initialData }: CategoriesClientProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  
  // DataTable State
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [deleteCategory, setDeleteCategory] = useState<any | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const { data: categories, refetch, isLoading } = useQuery({
    ...orpc.admin.getCategories.queryOptions(),
    initialData
  });

  const createMutation = useMutation(orpc.admin.createCategory.mutationOptions());
  const updateMutation = useMutation(orpc.admin.updateCategory.mutationOptions());
  const deleteMutation = useMutation(orpc.admin.deleteCategory.mutationOptions());

  const resetForm = () => {
    setName("");
    setSlug("");
    setParentId(null);
    setIsAddOpen(false);
    setEditingCategory(null);
  };

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "")
      .replace(/--+/g, "-");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (!editingCategory) {
      setSlug(slugify(newName));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalSlug = slug.trim() || slugify(name);
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, name, slug: finalSlug, parentId });
        toast.success("Category updated successfully");
      } else {
        await createMutation.mutateAsync({ name, slug: finalSlug, parentId });
        toast.success("Category created successfully");
      }
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save category");
    }
  };

  const confirmDelete = async () => {
    if (!deleteCategory) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteCategory.id });
      toast.success("Category deleted");
      setDeleteCategory(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete category");
    }
  };

  const startEdit = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setParentId(cat.parentId);
    setIsAddOpen(true);
  };

  const processedCategories = useMemo(() => {
    if (!categories) return [];
    
    let filtered = categories.filter((c: any) => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.slug.toLowerCase().includes(search.toLowerCase())
    );

    if (sortConfig) {
      filtered.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [categories, search, sortConfig]);

  const totalPages = Math.ceil(processedCategories.length / itemsPerPage);
  const paginatedCategories = processedCategories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your course categories and hierarchy.</p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
        >
          <Plus size={18} />
          New Category
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search categories..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest px-2">
            {processedCategories.length} Total
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-50">
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-2 text-gray-400">
                    Name
                    <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer group" onClick={() => toggleSort('slug')}>
                  <div className="flex items-center gap-2 text-gray-400">
                    Slug
                    <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </th>
                <th className="px-6 py-4 text-[12px] font-bold text-gray-400 uppercase tracking-wider">Parent</th>
                <th className="px-6 py-4 text-right text-[12px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && !categories ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-4"><div className="h-10 bg-gray-50 rounded-xl w-full" /></td>
                  </tr>
                ))
              ) : paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-24 text-center">
                    <Layers size={40} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-900 font-bold">No categories found</p>
                    <p className="text-sm text-gray-500">Try adjusting your search or create a new category.</p>
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((cat: any) => (
                  <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[12px] shadow-sm">
                          {cat.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-[14px] font-bold text-gray-900">{cat.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] font-medium text-gray-500 font-mono">{cat.slug}</td>
                    <td className="px-6 py-4">
                      {cat.parentId ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                          Sub-category
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-gray-50 text-gray-400 border border-gray-100">
                          Top Level
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEdit(cat)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => setDeleteCategory(cat)}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
            <p className="text-[12px] font-bold text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={confirmDelete}
        title="Delete Category"
        description="Are you sure you want to delete this category? Associated courses will be marked as 'Uncategorized'."
        confirmationText={deleteCategory?.name}
        loading={deleteMutation.isPending}
      />

      {isAddOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={resetForm} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                {editingCategory ? "Edit Category" : "New Category"}
              </h2>
              <button onClick={resetForm} className="p-2.5 hover:bg-gray-50 rounded-xl transition-colors text-gray-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Display Name</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all"
                    placeholder="e.g. Web Development"
                    value={name}
                    onChange={handleNameChange}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">URL Slug</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-mono text-[13px]"
                    placeholder="e.g. web-development"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-700 ml-1">Parent Category</label>
                  <select 
                    className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all appearance-none text-[14px] font-semibold text-gray-700"
                    value={parentId || ""}
                    onChange={(e) => setParentId(e.target.value || null)}
                  >
                    <option value="">None (Top Level)</option>
                    {categories?.filter((c: any) => !c.parentId && c.id !== editingCategory?.id).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="flex-1 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-bold transition-all text-[15px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-[2] py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center text-[15px] active:scale-[0.98]"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
