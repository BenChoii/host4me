import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";

export default function SignUp() {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      await signIn("password", {
        email,
        password,
        flow: "signUp",
      });
      navigate("/dashboard/onboarding");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign up. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="w-full max-w-md px-6">
        <div className="bg-[#0a0a0f] border border-[#2a2a35] rounded-lg p-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-gray-400 mb-8">
            Join Host4Me and automate your property management
          </p>

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-[#12121a] border border-[#2a2a35] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#f27d26]"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-[#12121a] border border-[#2a2a35] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#f27d26]"
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-[#12121a] border border-[#2a2a35] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#f27d26]"
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-[#f27d26] text-white font-semibold rounded-lg hover:bg-[#e66b15] transition disabled:opacity-50 mt-6"
            >
              {isLoading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-gray-400 mt-6">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-[#f27d26] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
