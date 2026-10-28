import type { Metadata } from "next";
import { NotificationsList } from "./_components/NotificationsList";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Likes, follows, and comments on your work.",
  robots: { index: false, follow: false },
};

export default function DashboardNotificationsRoute() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Notifications
        </h1>
      </header>
      <NotificationsList />
    </section>
  );
}
