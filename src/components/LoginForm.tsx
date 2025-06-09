"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getDeviceInfo, isDeviceTrusted } from "@/lib/auth";
import OTPVerification from "./OTPVerification";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // First validate inputs
      if (!username || !password) {
        throw new Error("Username and password are required");
      }

      console.log("Attempting login for username:", username);

      // First, get the project credentials for this user
      const { data: projectData, error: projectError } = await supabase
        .from("myusers")
        .select("id, project_url, project_key, contact_email, active, Full_Name, password")
        .eq("username", username)
        .maybeSingle();

      // Log the response for debugging (without sensitive info)
      console.log("Login attempt processed");

      // Handle no user found case
      if (!projectData) {
        setError("Account is not registered. Please contact administrator.");
        setLoading(false);
        return;
      }

      // Verify password
      if (projectData.password !== password) {
        setError("Invalid password");
        setLoading(false);
        return;
      }

      if (!projectData.active) {
        setError("Account is inactive. Please contact administrator.");
        setLoading(false);
        return;
      }

      if (!projectData.project_url || !projectData.project_key) {
        setError("Project credentials not configured for this account");
        return;
      }

      // Get device info
      const deviceInfo = getDeviceInfo();
      console.log("Current device info:", deviceInfo);

      // Check if device is trusted
      const trusted = await isDeviceTrusted(projectData.id, deviceInfo);
      console.log("Device trust check:", trusted);

      if (trusted) {
        console.log("Device is trusted, proceeding with login");
        // Store project credentials and user ID
        localStorage.setItem("projectUrl", projectData.project_url);
        localStorage.setItem("projectKey", projectData.project_key);
        localStorage.setItem("userId", projectData.id.toString());
        router.push("/dashboard");
      } else {
        console.log("Device not trusted, initiating OTP verification");
        setUserId(projectData.id);

        // Check if email exists
        if (!projectData.contact_email) {
          setError("No registered email found. Please contact administrator.");
          setLoading(false);
          return;
        }

        // Send OTP
        const response = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: projectData.id,
            email: projectData.contact_email,
          }),
        });

        const otpData = await response.json();

        if (!response.ok) {
          if (otpData.error === "Failed to send OTP email") {
            setError("Failed to send verification code. Please contact administrator.");
          } else {
            throw new Error(otpData.error || "Failed to send OTP");
          }
          setLoading(false);
          return;
        }

        console.log("OTP sent successfully");
        setShowOTP(true);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerify = async (otp: string) => {
    try {
      if (!userId) {
        throw new Error("Session expired. Please login again.");
      }

      const deviceInfo = getDeviceInfo();

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          otp: otp.trim(),
          deviceInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid OTP, Please check your email.");
      }

      // Get project credentials
      const { data: projectData, error: projectError } = await supabase
        .from("myusers")
        .select("project_url, project_key")
        .eq("id", userId)
        .single();

      if (projectError || !projectData) {
        throw new Error("Failed to get project credentials");
      }

      // Store project credentials and user ID
      localStorage.setItem("projectUrl", projectData.project_url);
      localStorage.setItem("projectKey", projectData.project_key);
      localStorage.setItem("userId", userId.toString());

      router.push("/dashboard");
    } catch (err) {
      throw new Error("Invalid OTP, Please check your email.");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-[#005B96] mb-1"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="appearance-none relative block w-full px-4 py-3 border border-sky-100 text-gray-700 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-all duration-200"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#005B96] mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="appearance-none relative block w-full px-4 py-3 border border-sky-100 text-gray-700 rounded-xl bg-sky-50/30 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-all duration-200"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 rounded-xl text-white bg-[#0096FF] hover:bg-[#0087E5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-all duration-200 font-medium text-sm"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </div>
      </form>

      {showOTP && (
        <OTPVerification
          onVerify={handleOTPVerify}
          onCancel={() => {
            setShowOTP(false);
            setError("");
          }}
        />
      )}
    </>
  );
}
