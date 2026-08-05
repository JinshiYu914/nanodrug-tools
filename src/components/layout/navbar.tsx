"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  NAV_LINKS,
  SITE_NAME,
  TOOL_GROUPS,
} from "@/content/copy/navigation";
import { ThemeToggle } from "./theme-toggle";
import { UserNav } from "./user-nav";
import { BrandMark } from "./brand-mark";

/** `/` only matches exactly; every other prefix matches its subtree. */
function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-ink/15 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md font-display text-lg font-extrabold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark className="h-7 w-7 text-ink" />
          <span>{SITE_NAME}</span>
        </Link>

        <NavigationMenu className="hidden md:flex" viewport={false}>
          <NavigationMenuList>
            {NAV_LINKS.map((link) =>
              link.href === "/tools" ? (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuTrigger
                    className={cn(
                      "bg-transparent font-medium",
                      isActive(pathname, link.href) && "text-primary"
                    )}
                  >
                    {link.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid w-[34rem] grid-cols-2 gap-x-4 gap-y-1 p-3">
                      {TOOL_GROUPS.map((group) => (
                        <div key={group.id} className="flex flex-col">
                          <p className="px-3 pb-1 pt-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {group.label}
                          </p>
                          {group.tools.map((tool) => (
                            <NavigationMenuLink key={tool.href} asChild>
                              <Link
                                href={tool.href}
                                className="rounded-lg px-3 py-2 leading-snug hover:bg-accent"
                              >
                                <span className="block text-sm font-semibold">
                                  {tool.label}
                                </span>
                                <span className="line-clamp-2 block text-xs text-muted-foreground">
                                  {tool.blurb}
                                </span>
                              </Link>
                            </NavigationMenuLink>
                          ))}
                        </div>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ) : (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        "inline-flex h-9 w-max items-center rounded-md px-4 text-sm font-medium transition-colors hover:bg-accent",
                        isActive(pathname, link.href) && "text-primary"
                      )}
                    >
                      {link.label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )
            )}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserNav />

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[19rem]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-display">
                  <BrandMark className="h-6 w-6 text-ink" />
                  {SITE_NAME}
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 overflow-y-auto px-4 pb-6">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2.5 font-display text-base font-semibold hover:bg-accent",
                      isActive(pathname, link.href) && "text-primary"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}

                {TOOL_GROUPS.map((group) => (
                  <div key={group.id} className="mt-2">
                    <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </p>
                    {group.tools.map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm hover:bg-accent"
                      >
                        {tool.label}
                      </Link>
                    ))}
                  </div>
                ))}

                <Link
                  href="/contact"
                  onClick={() => setMobileOpen(false)}
                  className="mt-4 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
                >
                  Contact
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
