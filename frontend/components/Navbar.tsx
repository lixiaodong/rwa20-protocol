"use client";

import Link                   from "next/link";
import { usePathname }        from "next/navigation";
import { ConnectButton }      from "@rainbow-me/rainbowkit";
import { Leaf, BarChart3, Wallet, Rocket, Scale, Link2, Info } from "lucide-react";
import clsx                   from "clsx";

const NAV = [
  { href: "/",              label: "Dashboard",    icon: BarChart3 },
  { href: "/assets",        label: "Assets",       icon: Leaf      },
  { href: "/launch",        label: "Launch",       icon: Rocket    },
  { href: "/compliance",    label: "Compliance",   icon: Scale     },
  { href: "/attestations",  label: "Attestations", icon: Link2     },
  { href: "/portfolio",     label: "Portfolio",    icon: Wallet    },
  { href: "/protocol",      label: "Protocol",     icon: Info      },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-dark-border bg-dark-bg/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-2xl">🌳</span>
          <span className="gradient-text">RWA20</span>
          <span className="text-dark-muted text-xs font-normal hidden sm:block">
            Real World Assets
          </span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-brand-900/60 text-brand-400"
                  : "text-dark-muted hover:text-white hover:bg-dark-surface"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Wallet */}
        <ConnectButton
          showBalance={false}
          chainStatus="icon"
          accountStatus="address"
        />
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex border-t border-dark-border">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors",
              pathname === href
                ? "text-brand-400"
                : "text-dark-muted"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
