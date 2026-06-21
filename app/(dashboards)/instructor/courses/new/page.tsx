"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  BookOpen, 
  Sparkles,
  Loader2
} from "lucide-react";
import Link from "next/link";

const formSchema = z.object({
  title: z.string().min(3, {
    message: "Title must be at least 3 characters.",
  }),
});

export default function NewCoursePage() {
  const router = useRouter();
  const createMutation = useMutation(orpc.instructor.createCourse.mutationOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const course = await createMutation.mutateAsync(values);
      toast.success("Course created! Let's add some details.");
      router.push(`/instructor/courses/${course.id}`);
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link 
        href="/instructor/courses"
        className="flex items-center gap-2 text-[12px] font-bold text-gray-400 hover:text-gray-900 transition-colors mb-6 group w-fit uppercase tracking-wider"
      >
        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
        Back to courses
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 md:p-10 shadow-sm shadow-gray-200/5">
        <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                <BookOpen size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Name your course</h1>
                <p className="text-[13px] text-gray-500 font-medium mt-0.5">What would you like to name your course?</p>
            </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-2.5">
            <label className="text-[13px] font-bold text-gray-700 ml-1">Course Title</label>
            <div className="relative">
                <input
                    {...form.register("title")}
                    placeholder="e.g. 'Advanced Web Development'"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[14px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 focus:bg-white transition-all placeholder:text-gray-400"
                />
                <Sparkles size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-200" />
            </div>
            {form.formState.errors.title && (
              <p className="text-[11px] font-bold text-rose-500 ml-1">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link 
              href="/instructor/courses"
              className="flex-1 py-2.5 px-6 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl font-bold transition-all text-center text-[13px]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={form.formState.isSubmitting || !form.formState.isValid}
              className="flex-[2] py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-[13px] active:scale-[0.98]"
            >
              {form.formState.isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-10 p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 flex items-start gap-4">
          <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm shrink-0 border border-indigo-50">
              <Sparkles size={18} />
          </div>
          <div>
              <p className="text-[12px] font-bold text-indigo-900 uppercase tracking-wider">Pro Tip</p>
              <p className="text-[13px] text-indigo-700/70 font-medium mt-1 leading-relaxed">
                  A great title is catchy and describes exactly what the student will learn. You can always update it later!
              </p>
          </div>
      </div>
    </div>
  );
}
