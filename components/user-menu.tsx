"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "max-w-[200px] gap-1 px-2 text-muted-foreground",
        )}
      >
        <span className="truncate">{email}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="font-normal text-muted-foreground">Account</DropdownMenuLabel>
        <DropdownMenuItem render={<Link href="/dashboard" />}>Dashboard</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/favorites" />}>Favorites</DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="p-1">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive outline-none hover:bg-destructive/10 focus-visible:bg-destructive/10"
            >
              Log out
            </button>
          </form>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
