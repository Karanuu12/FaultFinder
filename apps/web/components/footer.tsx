"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { GithubIcon } from "@/components/icons/github-icon";
import { XIcon } from "@/components/icons/x-icon";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

const socialLinks = [
  {
    href: "https://x.com/icancodefyi",
    label: "X",
    icon: <XIcon className="size-4" />,
  },
  {
    href: "https://github.com/icancodefyi/",
    label: "Github",
    icon: <GithubIcon className="size-4" />,
  },
];

export function Footer() {
  const { t } = useI18n();
  const navLinks = [
    { href: "#features", label: t("nav.features") },
    { href: "#preview", label: t("nav.preview") },
    { href: "#stats", label: t("nav.stats") },
  ];

  return (
    <footer className="mx-auto max-w-5xl px-4 md:px-6">
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-lg font-bold tracking-wide hover:opacity-85 transition-opacity font-gothic"
            >
              {t("common.faultFinder")}
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {socialLinks.map(({ href, label, icon }) => (
              <Button asChild key={label} size="icon" variant="ghost">
                <a
                  aria-label={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {icon}
                </a>
              </Button>
            ))}
          </div>
        </div>

        <nav>
          <ul className="flex flex-wrap gap-4 font-medium text-muted-foreground text-sm md:gap-6">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a className="hover:text-black transition-colors" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex items-center justify-between gap-4 border-t py-4 text-muted-foreground text-sm">
        <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>

        <p className="inline-flex items-center gap-1">
          <span>{t("footer.builtBy")}</span>
          <a
            aria-label="x/twitter"
            className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground hover:underline font-semibold"
            href="https://github.com/icancodefyi"
            rel="noreferrer"
            target="_blank"
          >
            <Image
              alt="samiran"
              className="size-4 rounded-full"
              src="https://github.com/icancodefyi.png"
              width={16}
              height={16}
              unoptimized
            />
            Samiran De
          </a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
