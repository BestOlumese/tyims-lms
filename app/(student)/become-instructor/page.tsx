import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import PageTitle from "@/upskill/components/course-list/PageTitle";
import BecomeInstructorForm from "@/components/students/BecomeInstructorForm";

export const metadata = {
  title: "Become an Instructor | TYIMS LMS",
  description: "Apply to teach on TYIMS and share your expertise with students worldwide.",
};

const BENEFITS = [
  {
    title: "Earn money",
    body: "Set your own prices and get paid for every enrolment on your courses.",
  },
  {
    title: "Inspire students",
    body: "Reach learners who are looking for exactly the expertise you have.",
  },
  {
    title: "Join our community",
    body: "Get the tools, templates and support you need to build a course that works.",
  },
];

/**
 * The whole state machine is resolved on the server, so the correct state is in the very
 * first HTML response — no logged-out flash, no spinner while we work out who you are.
 *
 * IDLE      → application form
 * PENDING   → "under review", form hidden
 * REJECTED  → form again, prefilled, with an explanatory notice
 * APPROVED / role INSTRUCTOR|ADMIN → they already have access, send them to the dashboard
 * logged out → register first, then come straight back here
 */
export default async function BecomeInstructorPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/register?next=/become-instructor");
  }

  const [profile] = await db
    .select({
      role: users.role,
      status: users.instructorRequestStatus,
      title: users.title,
      aboutMe: users.aboutMe,
    })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "INSTRUCTOR") redirect("/instructor");
  if (profile.role === "ADMIN") redirect("/admin");

  const isPending = profile.status === "PENDING";
  const wasRejected = profile.status === "REJECTED";

  return (
    <>
      <PageTitle
        pageName="Become an Instructor"
        parentHref="/"
        parentLabel="Home"
        breadcrumbs={[{ label: "Become an Instructor" }]}
      />

      <div className="main-content pt-0">
        <section className="tf-spacing-4">
          <div className="tf-container">
            <div className="row">
              {/* Value proposition */}
              <div className="col-lg-5">
                <div className="content-inner">
                  <h2 className="font-cardo fw-7">Teach what you love</h2>
                  <p className="fs-15">
                    Top instructors from around the world teach thousands of students on
                    TYIMS. Tell us about yourself and our team will review your application.
                  </p>

                  <ul className="wrap-list-text-check1">
                    {BENEFITS.map((b) => (
                      <li key={b.title}>
                        <i className="icon-check" />
                        {b.title}
                      </li>
                    ))}
                  </ul>

                  <div className="tf-benefit-list">
                    {BENEFITS.map((b) => (
                      <div key={b.title} className="tf-benefit-item">
                        <h6 className="fw-7">{b.title}</h6>
                        <p className="fs-15">{b.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form / status */}
              <div className="col-lg-7">
                <div className="content-right">
                  {isPending ? (
                    <div className="tf-application-status">
                      <h3 className="login-title fw-7 font-cardo">
                        Your application is under review
                      </h3>
                      <p className="fs-15">
                        Thanks for applying. Our team is reviewing your details and you&apos;ll
                        be notified once a decision has been made. You can keep learning in the
                        meantime.
                      </p>
                      <div className="tf-application-actions">
                        <Link href="/dashboard" className="tf-btn">
                          Go to my dashboard
                          <i className="icon-arrow-top-right" />
                        </Link>
                        <Link href="/courses" className="tf-btn-arrow">
                          Browse courses
                          <i className="icon-arrow-top-right" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="login-title fw-7 font-cardo">
                        {wasRejected ? "Apply again" : "Apply to teach"}
                      </h3>
                      <BecomeInstructorForm
                        initialTitle={profile.title ?? ""}
                        initialAboutMe={profile.aboutMe ?? ""}
                        wasRejected={wasRejected}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
