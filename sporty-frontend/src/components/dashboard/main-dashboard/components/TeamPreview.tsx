import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { TeamPlayer } from "@/components/dashboard/main-dashboard/types";

type TeamPreviewProps = {
  players: TeamPlayer[];
};

export function TeamPreview({ players }: TeamPreviewProps) {
  return (
    <Card className="rounded-2xl border border-gray-100 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-medium text-gray-900">Team Preview</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <div
              key={player.id}
              className="rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{player.name}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {player.position}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Points</p>
              <p className="text-xl font-medium text-primary-600">{player.points}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
