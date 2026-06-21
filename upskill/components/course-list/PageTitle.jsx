import React from "react";
import Link from "next/link";

export default function PageTitle({
  pageName = "Courses",
  parentClass = "page-title style-2 no-border has-bg4 py-60",
  breadcrumbs = [],
  parentHref = "/courses",
  parentLabel = "Courses",
}) {
  return (
    <div className={parentClass}>
      <div className="tf-container">
        <div className="row">
          <div className="col-12">
            <div className="content">
              <ul className="breadcrumbs flex items-center justify-start gap-10 mb-60">
                <li>
                  <Link href="/" className="flex">
                    <i className="icon-home" />
                  </Link>
                </li>
                <li>
                  <i className="icon-arrow-right" />
                </li>
                <li>
                  <Link href={parentHref}>{parentLabel}</Link>
                </li>
                {breadcrumbs.map((crumb, i) => (
                  <React.Fragment key={i}>
                    <li>
                      <i className="icon-arrow-right" />
                    </li>
                    <li>
                      {crumb.href ? (
                        <Link href={crumb.href}>{crumb.label}</Link>
                      ) : (
                        crumb.label
                      )}
                    </li>
                  </React.Fragment>
                ))}
              </ul>
              <h2 className="font-cardo fw-7">{pageName}</h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
