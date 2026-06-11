import { redirect } from "next/navigation";

export default async function PagePrevisionnel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cible = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) cible.append(key, item);
    } else if (value) {
      cible.set(key, value);
    }
  }

  redirect(`/statistiques${cible.size ? `?${cible.toString()}` : ""}`);
}
