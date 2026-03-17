import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between w-full py-5">
      {/* Logo */}
      <div className="flex items-center gap-8">
        <Link href="/">
          <h1 className="text-3xl font-extrabold">RESONANCE</h1>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-2">
          <Link className={buttonVariants({ variant: "ghost" })} href="/">
            Home
          </Link>
          <Link className={buttonVariants({ variant: "ghost" })} href="/blog">
            Blog
          </Link>
          <Link className={buttonVariants({ variant: "ghost" })} href="/create">
            Create
          </Link>
        </div>
      </div>

      {/* Auth Buttons */}
      <div className="flex items-center gap-2">
        <Link
          className={buttonVariants({ variant: "default" })}
          href="/auth/signup"
        >
          Sign up
        </Link>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href="/auth/login"
        >
          Login
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
