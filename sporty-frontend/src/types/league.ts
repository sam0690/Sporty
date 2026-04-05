import { TUser } from "./index";
import { TPlayerBrief } from "./player";

export type TLeagueStatus = "setup" | "drafting" | "active" | "completed";

export type TSportBrief = {
    id: string;
    name: string;
    display_name: string;
};

export type TSeasonBrief = {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
};

export type TSeason = TSeasonBrief & {
    sport_id: string;
    is_active: boolean;
};

export type TSport = TSportBrief & {
    is_active: boolean;
};

export type TLeagueSport = {
    sport: TSportBrief;
    created_at: string;
};

export type TLeague = {
    id: string;
    name: string;
    owner: TUser;
    sports: TLeagueSport[];
    member_count: number;
    invite_code?: string;
    status: string;
    squad_size: number;
    team_count?: number;
    memberships?: TMembership[];
    teams?: TFantasyTeam[];
    season?: TSeasonBrief;
    lineup_slots?: TLineupSlot[];
    my_team?: {
        id: string;
        name: string;
        rank: number | null;
        points: number | null;
    };
};

export type TLineupEntry = {
    player_id: string;
    is_captain: boolean;
    is_vice_captain: boolean;
    player: TPlayerBrief;
};

export type TLineupResponse = {
    fantasy_team_id: string;
    transfer_window_id: string;
    entries: TLineupEntry[];
};

export type TLineupUpdateRequest = {
    player_ids: string[];
    captain_id: string;
    vice_captain_id: string;
};

export type TLeaderboardEntry = {
    team_id: string;
    team_name: string;
    owner_name: string;
    points: number;
    rank: number | null;
};

export type TLeaderboardResponse = {
    league_id: string;
    transfer_window_id: string | null;
    entries: TLeaderboardEntry[];
};

export type TMembership = {
    id: string;
    user: TUser;
    draft_position: number | null;
    joined_at: string;
};

export type TLineupSlot = {
    id: string;
    sport: TSportBrief;
    position: string;
    min_count: number;
    max_count: number;
};

export type TDraftPick = {
    id: string;
    round_number: number;
    pick_number: number;
    player: any; // Will replace with TPlayerBrief later
    fantasy_team: any;
    picked_at: string;
};

export type TTeamPlayer = {
    player: any; // Ideally TPlayerBrief, but avoiding circular dep for now
    joined_at: string;
};

export type TTransferWindow = {
    id: string;
    season_id: string;
    number: number;
    total_number: number;
    start_at: string;
    end_at: string;
    lineup_deadline_at: string;
    lineup_locked: boolean;
};

export type TFantasyTeam = {
    id: string;
    name: string;
    current_budget: number;
    user: TUser;
    created_at: string;
    players: TTeamPlayer[];
};
