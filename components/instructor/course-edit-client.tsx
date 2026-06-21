"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Layout, 
  ListChecks, 
  CircleDollarSign, 
  Eye, 
  Settings2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { DynamicList } from "./dynamic-list";
import { UploadButton } from "@/lib/uploadthing-utils";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/shared/skeletons";

const Editor = dynamic(() => import("@/components/shared/editor").then(mod => mod.Editor), { 
  ssr: false, 
  loading: () => <Skeleton className="w-full h-64" /> 
});
const CurriculumBuilder = dynamic(() => import("./curriculum-builder").then(mod => mod.CurriculumBuilder), { 
  ssr: false,
  loading: () => <Skeleton className="w-full h-96" />
});
import { ImageIcon, Trash2, UploadCloud, RefreshCw } from "lucide-react";
import { UploadArea } from "@/components/shared/upload-area";

const formSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).optional().or(z.literal("")),
  price: z.number().min(0),
  discountPrice: z.number().min(0).optional().nullable(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  whatYouWillLearn: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  inclusions: z.array(z.string()).optional(),
  thumbnailUrl: z.string().optional().nullable(),
});

interface CourseEditClientProps {
  initialCourse: any;
  categories: any[];
}

export default function CourseEditClient({ initialCourse, categories }: CourseEditClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"setup" | "chapters" | "pricing">("setup");
  const [lastEdited, setLastEdited] = useState<string>("");
  const [isReplacingThumbnail, setIsReplacingThumbnail] = useState(false);

  useEffect(() => {
    setLastEdited(new Date().toLocaleTimeString());
  }, []);
  
  const updateMutation = useMutation(orpc.instructor.updateCourse.mutationOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialCourse.title,
      description: initialCourse.description || "",
      price: initialCourse.price || 0,
      discountPrice: initialCourse.discountPrice,
      categoryId: initialCourse.categoryId,
      status: initialCourse.status,
      whatYouWillLearn: initialCourse.whatYouWillLearn || [],
      requirements: initialCourse.requirements || [],
      inclusions: initialCourse.inclusions || [],
      thumbnailUrl: initialCourse.thumbnailUrl,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await updateMutation.mutateAsync({
        id: initialCourse.id,
        ...values,
      });
      toast.success("Changes saved successfully");
      setLastEdited(new Date().toLocaleTimeString());
      router.refresh();
    } catch (error) {
      toast.error("Failed to save changes");
    }
  };

  const publishCourse = async () => {
    try {
        await updateMutation.mutateAsync({
            id: initialCourse.id,
            status: "PUBLISHED"
        });
        toast.success("Course published!");
        router.refresh();
    } catch (error) {
        toast.error("Failed to publish");
    }
  };

  const tabs = [
    { id: "setup", label: "General Setup", icon: Layout },
    { id: "chapters", label: "Curriculum", icon: ListChecks },
    { id: "pricing", label: "Pricing", icon: CircleDollarSign },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
            <Link 
                href="/instructor/courses"
                className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-900 transition-all shadow-sm group"
            >
                <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
            </Link>
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">{initialCourse.title}</h1>
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border",
                        initialCourse.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                        {initialCourse.status}
                    </span>
                </div>
                <p className="text-[13px] text-gray-500 font-medium mt-0.5">Manage your course content and settings.</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <Link 
                href={`/courses/${initialCourse.id}`}
                target="_blank"
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 text-gray-600 rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
                <Eye size={18} />
                Preview
            </Link>
            {initialCourse.status === "DRAFT" ? (
                <button 
                    onClick={publishCourse}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-indigo-100"
                >
                    <CheckCircle2 size={18} />
                    Publish Course
                </button>
            ) : (
                <button className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-gray-200/50">
                    Unpublish
                </button>
            )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Tabs */}
        <div className="lg:col-span-3 space-y-1.5">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 group",
                        activeTab === tab.id 
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                            : "bg-white border border-gray-50 text-gray-500 hover:border-gray-200 hover:text-gray-900"
                    )}
                >
                    <tab.icon size={18} className={cn(
                        "transition-colors",
                        activeTab === tab.id ? "text-white" : "text-gray-400 group-hover:text-gray-600"
                    )} />
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Form Content Area */}
        <div className="lg:col-span-9 bg-white border border-gray-100 rounded-2xl p-8 md:p-10 shadow-sm shadow-gray-200/5">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                
                {activeTab === "setup" && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Settings2 className="text-indigo-600" size={20} />
                                    Basic Information
                                </h2>
                                <div className="grid grid-cols-1 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-bold text-gray-700 ml-1">Course Title</label>
                                        <input
                                            {...form.register("title")}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:bg-white transition-all"
                                        />
                                        {form.formState.errors.title && (
                                            <p className="text-[11px] text-rose-500 font-bold ml-1">{form.formState.errors.title.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[13px] font-bold text-gray-700 ml-1">Category</label>
                                        <select
                                            {...form.register("categoryId")}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:bg-white transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">Select a category</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[13px] font-bold text-gray-700 ml-1">Course Thumbnail</label>
                                        {form.watch("thumbnailUrl") && !isReplacingThumbnail ? (
                                            <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-100 group shadow-lg">
                                                <img 
                                                    src={form.watch("thumbnailUrl")!} 
                                                    alt="Thumbnail" 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsReplacingThumbnail(true)}
                                                        className="p-3 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-all transform hover:scale-110 shadow-xl"
                                                        title="Change Image"
                                                    >
                                                        <RefreshCw size={20} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => form.setValue("thumbnailUrl", null, { shouldDirty: true })}
                                                        className="p-3 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-all transform hover:scale-110 shadow-xl"
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {isReplacingThumbnail && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setIsReplacingThumbnail(false)}
                                                        className="text-[12px] font-bold text-gray-400 hover:text-gray-900 flex items-center gap-1 transition-colors"
                                                    >
                                                        <ArrowLeft size={14} /> Cancel replacement
                                                    </button>
                                                )}
                                                <UploadArea
                                                    endpoint="courseImage"
                                                    onClientUploadComplete={(res) => {
                                                        form.setValue("thumbnailUrl", res[0].url, { shouldDirty: true });
                                                        toast.success("Thumbnail uploaded");
                                                        setIsReplacingThumbnail(false);
                                                    }}
                                                    onUploadError={(error: Error) => {
                                                        toast.error(`ERROR! ${error.message}`);
                                                        console.error("Upload error:", error);
                                                    }}
                                                    accent="indigo"
                                                    icon={ImageIcon}
                                                    label="Upload course thumbnail"
                                                    sublabel="16:9 aspect ratio recommended (Max 4MB)"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[13px] font-bold text-gray-700 ml-1">Description</label>
                                        <Editor 
                                            value={form.getValues("description") || ""}
                                            onChange={(val) => form.setValue("description", val, { shouldDirty: true })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gray-50" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <DynamicList 
                                    label="What you will learn"
                                    placeholder="e.g. Master React Hooks"
                                    items={form.watch("whatYouWillLearn") || []}
                                    onChange={(val) => form.setValue("whatYouWillLearn", val, { shouldDirty: true })}
                                />
                                <DynamicList 
                                    label="Requirements"
                                    placeholder="e.g. Basic JavaScript knowledge"
                                    items={form.watch("requirements") || []}
                                    onChange={(val) => form.setValue("requirements", val, { shouldDirty: true })}
                                />
                                <DynamicList 
                                    label="Inclusions"
                                    placeholder="e.g. 10 Downloadable resources"
                                    items={form.watch("inclusions") || []}
                                    onChange={(val) => form.setValue("inclusions", val, { shouldDirty: true })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "pricing" && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <CircleDollarSign className="text-emerald-600" size={20} />
                                Pricing Strategy
                            </h2>
                            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-start gap-3">
                                <AlertCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                                <p className="text-[12px] text-emerald-800 font-medium leading-relaxed">
                                    Set a fair price for your course. Set it to 0 to make it free. If you set a discount price, students will see both the original and discounted price.
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[13px] font-bold text-gray-700 ml-1">Regular Price (₦)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-[14px]">₦</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            {...form.register("price", { valueAsNumber: true })}
                                            className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[13px] font-bold text-gray-700 ml-1">Discount Price (₦) - Optional</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-[14px]">₦</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            {...form.register("discountPrice", { valueAsNumber: true })}
                                            className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[15px] font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "chapters" && (
                    <CurriculumBuilder 
                        courseId={initialCourse.id} 
                        initialChapters={initialCourse.chapters}
                    />
                )}

                {/* Bottom Action Bar */}
                {activeTab !== "chapters" && (
                    <div className="pt-8 border-t border-gray-50 flex items-center justify-between gap-4">
                        <div className="text-[11px] text-gray-400 font-medium italic">
                            Last edited: {lastEdited || "Just now"}
                        </div>
                        <div className="flex items-center gap-3">
                            {initialCourse.status === "PUBLISHED" && (
                                <button
                                    type="button"
                                    onClick={() => onSubmit({ ...form.getValues(), status: "DRAFT" })}
                                    className="px-6 py-2.5 bg-white border border-gray-100 text-gray-600 rounded-xl text-[13px] font-bold hover:bg-gray-50 transition-all"
                                >
                                    Save as Draft
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={updateMutation.isPending || !form.formState.isDirty}
                                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-[0.98]"
                            >
                                {updateMutation.isPending ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </div>
      </div>
    </div>
  );
}
