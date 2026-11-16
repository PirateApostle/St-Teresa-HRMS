import React, { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function ActivateAccount() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!token) {
      setMessage("Activation token is missing from this link.");
      return;
    }

    if (password.length < 12) {
      setMessage("Password must contain at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/activate-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, password }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Activation failed.");
      }

      setSuccess(true);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="activation-page">
      <div className="activation-card">
        <div className="activation-logo">ST</div>

        <h1>St Teresa Hospital</h1>
        <p className="activation-subtitle">Employee Account Activation</p>

        {success ? (
          <div className="activation-success">
            <h2>Account Activated!</h2>
            <p>{message}</p>
            <a href="/">Proceed to Login</a>
          </div>
        ) : (
          <>
            <h2>Create Your Password</h2>
            <p>
              Set a secure password to access the Employee Self-Service Portal.
            </p>

            <form onSubmit={handleSubmit}>
              <label>New Password</label>

              <div className="activation-password">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={12}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <label>Confirm Password</label>

              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
              />

              <p className="activation-hint">Use at least 12 characters.</p>

              {message && <div className="activation-message">{message}</div>}

              <button
                type="submit"
                disabled={loading}
                className="activation-submit"
              >
                {loading ? "Activating Account..." : "Activate Account"}
              </button>
            </form>
          </>
        )}

        <footer>© {new Date().getFullYear()} St Teresa Hospital</footer>
      </div>
    </div>
  );
}
