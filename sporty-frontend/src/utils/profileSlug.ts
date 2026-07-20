/**
 * Human-readable profile URLs of the form `{name-slug}~{id}`, e.g.
 * `/players/erling-haaland~a1b2c3`. The segment after the last `~` is the
 * authoritative id used for lookups; the slug prefix is cosmetic (names
 * aren't unique — two players can share a name — so the id stays in the URL).
 *
 * `~` is an RFC 3986 unreserved character and never appears in our ids or
 * slugs, so it's a safe separator. Legacy id-only links (no `~`) still parse.
 */

export function profileSlug(name: string | null | undefined, id: string): string {
  const slug = (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop combining diacritics (é → e, å → a)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}~${id}` : id;
}

export function idFromSlug(param: string): string {
  return param.split("~").pop() || param;
}
