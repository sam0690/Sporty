export type FooterCtaContent = {
  title: string;
  subtitle: string;
  inputPlaceholder: string;
  buttonLabel: string;
  helperText: string;
};

export type FooterNavLink = {
  label: string;
  href: string;
};

export type FooterBottomContent = {
  brandLabel: string;
  links: FooterNavLink[];
  copyright: string;
};
