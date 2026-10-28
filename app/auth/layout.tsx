import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background px-4 sm:px-6">
      <div className="flex py-4 short:py-2">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft />
          Back to Home
        </Link>
      </div>
      <main className="flex flex-1 items-center justify-center pb-8 short:pb-4">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
