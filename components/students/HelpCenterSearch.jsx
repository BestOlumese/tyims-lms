"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Extracted from app/(student)/help-center/page.tsx, which is a Server Component.
 * The inline `onClick={(e) => e.preventDefault()}` there crashed the production build
 * ("Event handlers cannot be passed to Client Component props"), so the whole
 * /help-center route failed to render.
 *
 * Rather than just swallowing the submit, the form now does what it looks like it
 * does and searches the catalogue, matching the header search behaviour.
 */
export default function HelpCenterSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/courses?q=${encodeURIComponent(q)}` : "/courses");
  };

  return (
    <form className="form-search-courses" onSubmit={handleSubmit}>
      <div className="icon">
        <i className="icon-keyboard" />
      </div>
      <fieldset>
        <input
          className=""
          type="text"
          placeholder="Search for answers..."
          name="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          required
        />
      </fieldset>
      <div className="button-submit">
        <button type="submit">
          <i className="icon-search fs-20" />
        </button>
      </div>
    </form>
  );
}
