import { redirect } from "next/navigation";

/** Manual headlines were removed — Daily News is a live GTA feed only. */
export default function NewNewsRedirect() {
  redirect("/studio/news");
}
