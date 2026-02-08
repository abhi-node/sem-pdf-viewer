import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { SocialButtons } from "@/components/auth/social-buttons";

export default function LoginPage() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-center text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 text-center text-sm text-gray-500">
        Sign in to your account
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

      <LoginForm />

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-gray-900 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
