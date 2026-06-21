"use client";
import React, { useState } from "react";
import Image from "next/image";
import { signIn } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn.email(
        { email, password, callbackURL: "/" },
        {
          onSuccess: () => {
            toast.success("Welcome back!");
            router.push("/");
            router.refresh();
          },
          onError: (ctx) => {
            toast.error(ctx.error.message || "Invalid credentials");
          },
        }
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content page-login">
      <section className="section-page-login login-wrap tf-spacing-4">
        <div className="tf-container">
          <div className="row">
            <div className="col-lg-6">
              <div className="img-left wow fadeInLeft" data-wow-delay="0s">
                <Image
                  className="ls-is-cached lazyloaded"
                  data-src=""
                  alt=""
                  src="/images/page-title/page-title-home2-1.jpg"
                  width={591}
                  height={680}
                />
                <div
                  className="blockquite wow fadeInLeft"
                  data-wow-delay="0.1s"
                >
                  <p>
                    Happiness prosperous impression had conviction For every
                    delay <br />
                    in they
                  </p>
                  <p className="author">Ali Tufan</p>
                  <p className="sub-author">Founder &amp; CEO</p>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="content-right">
                <h2
                  className="login-title fw-7 wow fadeInUp"
                  data-wow-delay="0s"
                >
                  Sign In To Your Account
                </h2>
                <div className="register">
                  <p className="fw-5 fs-15 wow fadeInUp" data-wow-delay="0s">
                    Don’t have an account?
                  </p>
                  <a
                    href="/register"
                    className="fw-5 fs-15 wow fadeInUp"
                    data-wow-delay="0s"
                  >
                    Join here
                  </a>
                </div>
                <form
                  onSubmit={handleLogin}
                  className="form-login"
                >
                  <div className="cols">
                    <fieldset
                      className="tf-field field-username wow fadeInUp"
                      data-wow-delay="0s"
                    >
                      <input
                        className="tf-input style-1"
                        id="field1"
                        type="email"
                        placeholder=""
                        name="email"
                        tabIndex={1}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <label className="tf-field-label fs-15" htmlFor="field1">
                        Username Or Email
                      </label>
                    </fieldset>
                  </div>
                  <div className="cols">
                    <fieldset
                      className="tf-field field-pass wow fadeInUp"
                      data-wow-delay="0s"
                    >
                      <input
                        className="tf-input style-1"
                        id="field2"
                        type="password"
                        placeholder=""
                        name="password"
                        tabIndex={2}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <label className="tf-field-label fs-15" htmlFor="field2">
                        Password
                      </label>
                    </fieldset>
                  </div>
                  <div className="checkbox-item">
                    <label className="wow fadeInUp" data-wow-delay="0s">
                      <p className="fs-15">Remember me</p>
                      <input type="checkbox" />
                      <span className="btn-checkbox" />
                    </label>
                    <a
                      href="#"
                      className="fs-15 wow fadeInUp"
                      data-wow-delay="0.1s"
                    >
                      Forgot your password?
                    </a>
                  </div>
                  <button
                    className="button-submit tf-btn w-100 wow fadeInUp"
                    data-wow-delay="0s"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Logging in..." : "Log In"}
                    <i className="icon-arrow-top-right" />
                  </button>
                </form>
                <p className="fs-15 wow fadeInUp" data-wow-delay="0s">
                  OR
                </p>
                <ul className="login-social">
                  <li className="login-social-icon">
                    <a
                      href="#"
                      className="tf-btn wow fadeInUp"
                      data-wow-delay="0s"
                    >
                      <i className="flaticon-facebook-1" /> Facebook
                    </a>
                  </li>
                  <li className="login-social-icon">
                    <a
                      href="#"
                      className="tf-btn wow fadeInUp"
                      data-wow-delay="0.1s"
                    >
                      <i className="icon-google" />
                      Google
                    </a>
                  </li>
                  <li className="login-social-icon">
                    <a
                      href="#"
                      className="tf-btn wow fadeInUp"
                      data-wow-delay="0.2s"
                    >
                      <i className="icon-apple" />
                      Apple
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
