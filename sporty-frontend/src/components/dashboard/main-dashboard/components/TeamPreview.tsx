import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { TeamPlayer } from "@/components/dashboard/main-dashboard/types";

type TeamPreviewProps = {
  players: TeamPlayer[];
};

export function TeamPreview({ players }: TeamPreviewProps) {
  return (
    <Card className="border-border-light bg-surface-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-text-primary">Team Preview</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <div
              key={player.id}
              className="rounded-lg border border-border-light bg-white p-4 transition-colors hover:border-primary-200"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-text-primary">{player.name}</p>
                <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-text-primary">
                  {player.position}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">Points</p>
              <p className="text-xl font-semibold text-primary-700">{player.points}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
