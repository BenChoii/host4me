import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: "#f27d26",
            colorBackground: "#0a0a0f",
            colorText: "#ffffff",
            colorInputBackground: "#12121a",
            colorInputText: "#ffffff",
            borderRadius: "8px",
          },
          elements: {
            card: "bg-[#0a0a0f] border border-[#2a2a35]",
            headerTitle: "text-white",
            headerSubtitle: "text-gray-400",
          },
        }}
      />
    </div>
  );
}
