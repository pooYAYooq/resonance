import { redirect } from "next/navigation";

export default function LegacyFeedRoute() {
  redirect("/dashboard/feed");
}
