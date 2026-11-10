import { redirect } from "next/navigation";

// This route redirects to /booking for backward compatibility with old links.
export default function Transaction() {
  redirect("/booking");
}
