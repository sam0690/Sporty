import { redirect } from "next/navigation";

// No standalone index — land on the Premier League page; the in-page switcher
// covers the other competitions.
export default function CompetitionsIndex() {
  redirect("/competitions/epl");
}
