"use client";

import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";

export function ThemePreferenceControl() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="appearance">Appearance</Label>
      <select
        id="appearance"
        className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        value={theme ?? "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  );
}
