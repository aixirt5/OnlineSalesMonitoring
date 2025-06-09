import { useState } from "react";

interface OTPVerificationProps {
  onVerify: (otp: string) => Promise<void>;
  onCancel: () => void;
}

export default function OTPVerification({
  onVerify,
  onCancel,
}: OTPVerificationProps) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate OTP format
      const cleanOtp = otp.trim();
      if (!cleanOtp || cleanOtp.length !== 6 || !/^\d+$/.test(cleanOtp)) {
        setError("Please enter a valid 6-digit OTP code");
        return;
      }

      try {
        await onVerify(cleanOtp);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Invalid OTP, Please check your email.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and limit to 6 digits
    if (/^\d*$/.test(value) && value.length <= 6) {
      setOtp(value);
      setError(""); // Clear error when user types
    }
  };

  return (
    <div className="fixed inset-0 bg-sky-100 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[32px] p-8 max-w-md w-full mx-4 shadow-lg">
        <div className="text-center mb-8">
          {/* Lock Icon */}
          <div className="mx-auto w-14 h-14 bg-sky-500 rounded-full flex items-center justify-center mb-6">
            <svg 
              className="w-7 h-7 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">
            Verify Your Device
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            Please enter the 6-digit OTP code sent to your contact email
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-red-600 text-sm font-medium flex items-center justify-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="otp"
              className="block text-sm font-medium text-gray-700"
            >
              OTP Code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={otp}
              onChange={handleOtpChange}
              className="w-full px-4 py-4 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all duration-200 text-center text-xl tracking-[0.5em] font-mono placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-base"
              placeholder="Enter 6-digit code"
              required
              disabled={loading}
              autoComplete="one-time-code"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="flex-1 py-3 px-4 rounded-xl text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verify Device
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-all duration-200 disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
