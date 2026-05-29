import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants/seo";

export const metadata: Metadata = {
  title: "Home",
  description: `Welcome to ${SITE_NAME} — a blog platform for sharing thoughts, ideas, and stories that echo.`,
};

export default function Home() {
  return (
    <div>
      <h1 className="font-bold text-gray-700">INDEX PAGE</h1>
    </div>
  );
}
