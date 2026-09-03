"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { WorkspaceNavigation } from "./WorkspaceSidebar";
import { WorkspaceUtilities } from "./WorkspaceUtilities";

export function WorkspaceMobileDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open workspace menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Workspace navigation</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 px-4 pb-4">
          <WorkspaceUtilities onNavigate={() => setOpen(false)} />
          <WorkspaceNavigation onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
