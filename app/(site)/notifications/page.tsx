import { redirect } from "next/navigation";

export default function LegacyNotificationsRoute() {
  redirect("/dashboard/notifications");
}
