import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
      <div className="absolute top-5 left-5 w-full max-w-md">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft />
          Back to Home
        </Link>
      </div>
      <div className="w-full max-w-md mx-auto">{children}</div>
    </div>
  );
}
