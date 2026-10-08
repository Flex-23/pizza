export type NavItem = {
  href: string;
  /** Key inside the "nav" namespace of the message files. */
  labelKey: "home" | "menu";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "home" },
  { href: "/menu", labelKey: "menu" },
];
