"use client";

import { useParams } from "next/navigation";
import { CreateTeam } from "@/components/dashboard/create-team";

export default function LeagueCreateTeamPage() {
  const params = useParams<{ id: string }>();

  return <CreateTeam leagueId={params?.id ?? ""} />;
}
