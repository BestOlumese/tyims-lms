"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

const ABOUT_MIN = 50;

/**
 * Application form for students who want to teach.
 *
 * The server decides which state to render (see app/(student)/become-instructor/page.tsx),
 * so this component only ever handles the two states where a submission is possible:
 * a first-time application (IDLE) and a re-application after a rejection (REJECTED).
 *
 * Markup follows the template's `form-login` / `tf-field` / `tf-input style-1` idiom so it
 * inherits the purchased styling rather than inventing its own.
 */
export default function BecomeInstructorForm({ initialTitle, initialAboutMe, wasRejected }) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle || "");
  const [aboutMe, setAboutMe] = useState(initialAboutMe || "");
  const [errors, setErrors] = useState({});

  const mutation = useMutation(orpc.student.requestInstructor.mutationOptions());

  const validate = () => {
    const next = {};
    if (title.trim().length < 3) {
      next.title = "Please enter your professional title (at least 3 characters).";
    }
    if (aboutMe.trim().length < ABOUT_MIN) {
      next.aboutMe = `Please write at least ${ABOUT_MIN} characters so we can review your application.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await mutation.mutateAsync({ title: title.trim(), aboutMe: aboutMe.trim() });
      toast.success("Application submitted — we'll review it shortly.");
      // Re-render the server component so it now shows the "under review" state.
      router.refresh();
    } catch (err) {
      toast.error(err?.message || "Could not submit your application. Please try again.");
    }
  };

  const remaining = ABOUT_MIN - aboutMe.trim().length;

  return (
    <>
      {wasRejected && (
        <div className="tf-alert-rejected">
          <p className="fs-15 fw-5">
            Your previous application wasn&apos;t approved.
          </p>
          <p className="fs-15">
            You can update your details below and apply again.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-login">
        <div className="cols">
          <fieldset className="tf-field">
            <input
              className="tf-input style-1"
              id="instructor-title"
              type="text"
              placeholder=""
              name="title"
              tabIndex={1}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
            />
            <label className="tf-field-label fs-15" htmlFor="instructor-title">
              Professional title
            </label>
          </fieldset>
          {errors.title && <p className="tf-field-error fs-15">{errors.title}</p>}
          <p className="tf-field-hint fs-15">
            For example: “Senior Full Stack Developer” or “Certified Financial Analyst”.
          </p>
        </div>

        <fieldset className="tf-field">
          <textarea
            className="tf-input style-1"
            id="instructor-about"
            name="aboutMe"
            rows={7}
            placeholder=""
            tabIndex={2}
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            maxLength={2000}
            required
          />
          <label className="tf-field-label type-textarea fs-15" htmlFor="instructor-about">
            About you
          </label>
        </fieldset>
        {errors.aboutMe && <p className="tf-field-error fs-15">{errors.aboutMe}</p>}
        <p className="tf-field-hint fs-15">
          Tell us about your experience, what you want to teach, and who it&apos;s for.{" "}
          {remaining > 0
            ? `${remaining} more character${remaining === 1 ? "" : "s"} needed.`
            : `${aboutMe.trim().length} / 2000 characters.`}
        </p>

        <button
          className="button-submit tf-btn w-100"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Submitting…" : "Submit application"}
          <i className="icon-arrow-top-right" />
        </button>
      </form>

      <p className="fs-15 tf-field-hint">
        By applying you agree to our{" "}
        <Link href="/terms">terms and conditions</Link>.
      </p>
    </>
  );
}
