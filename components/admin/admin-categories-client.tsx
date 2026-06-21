"use client";

import { useState } from "react";
import { orpc } from "@/lib/orpc";
import { Plus, Trash2, Edit2, Loader2, Layers, Search, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";

export default function AdminCategoriesClient() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories, refetch } = useQuery(orpc.admin.getCategories.queryOptions());
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, name, slug, parentId });
        toast.success("Category updated successfully");
      } else {
        await createMutation.mutateAsync({ name, slug, parentId });
        toast.success("Category created successfully");
      }
      resetForm();
      refetch();
    } catch (error) {
      toast.error("Failed to save category");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this category?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast.success("Category deleted");
        refetch();
      } catch (error) {
        toast.error("Failed to delete category");
      }
    }
  };

  const startEdit = (cat: any) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setParentId(cat.parentId);
    setIsAddOpen(true);
  };

  const filteredCategories = categories?.filter((c: any) => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const mainCategories = filteredCategories?.filter((c: any) => !c.parentId);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Categories
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium">
            Manage course categories and hierarchical taxonomies.
          </p>
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
        >
          <Plus size={20} />
          Add Category
        </button>
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-400">
          <Search size={20} />
        </div>
        <input 
          type="text" 
          placeholder="Search categories..."
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm group-hover:shadow-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {mainCategories?.length === 0 && (
            <div className="p-20 text-center text-zinc-400 italic">
              No categories found. Start by adding one!
            </div>
          )}
          {mainCategories?.map((cat) => (
            <div key={cat.id} className="group">
              <div className="p-6 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{cat.name}</h3>
                    <p className="text-xs text-zinc-400 font-mono tracking-tighter uppercase">{cat.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => startEdit(cat)}
                    className="p-2.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="p-2.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="bg-zinc-50/50 dark:bg-zinc-900/50 pl-16">
                {filteredCategories?.filter((sub: any) => sub.parentId === cat.id).map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between p-4 border-t border-zinc-100 dark:border-zinc-800 group/sub">
                    <div className="flex items-center gap-3">
                      <ChevronRight size={14} className="text-zinc-300" />
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{sub.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{sub.slug}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(sub)} className="p-2 text-zinc-400 hover:text-indigo-600 rounded-lg"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(sub.id)} className="p-2 text-zinc-400 hover:text-red-600 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black tracking-tight">
                {editingCategory ? "Edit Category" : "New Category"}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 pl-1">Name</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 pl-1">Slug</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 pl-1">Parent Category (Optional)</label>
                  <select 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none"
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

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="animate-spin" /> : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
