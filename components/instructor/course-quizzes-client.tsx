"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Loader2, ArrowLeft, Users, ArrowRight, FolderOpen } from "lucide-react";
import Link from "next/link";
import { TableSkeleton } from "@/components/shared/skeletons";

export const CourseQuizzesClient = ({ courseId }: { courseId: string }) => {
  const { data: quizzes, isLoading } = useQuery(
    orpc.instructor.getCourseQuizzes.queryOptions({ input: { courseId } })
  );

  const { data: courses } = useQuery(
    orpc.instructor.getInstructorAssessmentsStats.queryOptions()
  );

  const course = courses?.find(c => c.id === courseId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/instructor/assessments"
          className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-all shadow-sm group shrink-0"
        >
          <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {course ? course.title : "Course Quizzes"}
          </h1>
          <p className="text-[13px] text-gray-500 font-medium mt-1">
            Select a quiz to view student attempts and scores.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-700">Quiz Title</th>
                  <th className="px-6 py-4 font-bold text-gray-700">Chapter</th>
                  <th className="px-6 py-4 font-bold text-gray-700 text-center">Passing Score</th>
                  <th className="px-6 py-4 font-bold text-gray-700 text-center">Attempts</th>
                  <th className="px-6 py-4 font-bold text-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quizzes?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <FolderOpen size={20} className="text-gray-400" />
                    </div>
                    <p className="text-[13px] font-bold text-gray-900">No quizzes found</p>
                    <p className="text-[12px] text-gray-500 mt-1">This course does not have any quizzes yet.</p>
                  </td>
                </tr>
              ) : (
                quizzes?.map((quiz) => (
                  <tr key={quiz.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{quiz.title}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 font-medium text-[11px]">
                        {quiz.chapterTitle}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-gray-700">
                        {quiz.passingScore !== null ? `${quiz.passingScore}%` : "None"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 min-w-[2rem] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-100">
                        <Users size={12} />
                        {quiz.submissionsCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/instructor/assessments/${courseId}/${quiz.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        View Attempts <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
