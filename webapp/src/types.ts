export type Channel = {
    id: number;
    name: string;
    membersCount: number;
}

export type User = {
    id: number;
    name: string;
    avatarUrl: string;
    selfMute: boolean;
    selfDeaf: boolean;
}
