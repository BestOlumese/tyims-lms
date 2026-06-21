"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchModal() {
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    const term = searchValue.trim();

    // Close the offcanvas via Bootstrap's API before navigating
    const el = document.getElementById("canvasSearch");
    if (el && window.bootstrap) {
      window.bootstrap.Offcanvas.getInstance(el)?.hide();
    }

    router.push(term ? `/courses?q=${encodeURIComponent(term)}` : "/courses");
    setSearchValue("");
  };

  return (
    <div className="offcanvas offcanvas-top offcanvas-search" id="canvasSearch">
      <i
        className="flaticon-close-1 btn-close"
        type="button"
        data-bs-dismiss="offcanvas"
        aria-label="Close"
      />
      <div className="tf-container">
        <div className="row">
          <div className="col-12">
            <div className="offcanvas-body">
              <form onSubmit={handleSubmit} className="form-search-courses">
                <div className="icon">
                  <i className="icon-keyboard" />
                </div>
                <fieldset>
                  <input
                    type="text"
                    placeholder="Search for anything"
                    name="text"
                    tabIndex={2}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    aria-required="true"
                  />
                </fieldset>
                <div className="button-submit">
                  <button type="submit">
                    <i className="icon-search fs-20" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
