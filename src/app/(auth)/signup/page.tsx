import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { SocialButtons } from "@/components/auth/social-buttons";

export default function SignupPage() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-center text-2xl font-bold">Create an account</h1>
      <p className="mb-6 text-center text-sm text-gray-500">
        Get started with PDF Viewer
      </p>

      <SocialButtons />

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">or</span>
        </div>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-gray-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
