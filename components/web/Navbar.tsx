import Link from "next/link";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between w-full py-5 border border-gray-700">
      {/* Logo */}
      <div className="flex items-center gap-8">
        <Link href="/">
          <h1 className="text-3xl font-extrabold">RESONANCE</h1>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/">Home</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/create">Create</Link>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/auth/signup">Sign up</Link>
        <Link href="/auth/login">Login</Link>
      </div>
    </nav>
  );
}
