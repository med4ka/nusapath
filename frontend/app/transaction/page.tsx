import { redirect } from "next/navigation";

// Old route (early project structure) — merged into /booking (Ghif's decision).
// Old links still pointing to /transaction redirect to
// /booking to avoid 404.
export default function Transaction() {
  redirect("/booking");
}
