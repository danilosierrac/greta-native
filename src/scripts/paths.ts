// The site only ever has two kinds of route — "/" and "/projects/<slug>" —
// so both checks below key off that instead of comparing against a literal
// "/", which breaks the moment the site is served from a subpath (GitHub
// Pages' /greta-native/, for example: its home page is "/greta-native/",
// never bare "/"). Deriving everything from the CURRENT location also means
// neither check needs to know the deployment's base path in advance.
export function isHomePath(pathname: string): boolean {
  return !/\/projects\//.test(pathname);
}

// The href to navigate to from a project page to get back home, preserving
// whatever prefix this deployment is served under.
export function getHomeHref(): string {
  const match = window.location.pathname.match(/^(.*)\/projects\/[^/]+\/?$/);
  return match ? `${match[1]}/` : "/";
}
