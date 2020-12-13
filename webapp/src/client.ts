import {Client4} from 'mattermost-redux/client';

export const createChannel = (name: string): Promise<Response> => {
    return fetch('/plugins/com.mattermost.mattermost-grumble-plugin/channels', Client4.getOptions({
        method: 'post',
        body: JSON.stringify({name}),
    }));
};

export const listChannels = (): Promise<Response> => {
    return fetch('/plugins/com.mattermost.mattermost-grumble-plugin/channels', Client4.getOptions({
        method: 'get',
    }));
};

export const deleteChannel = (id: number): Promise<Response> => {
    return fetch(`/plugins/com.mattermost.mattermost-grumble-plugin/channels/${id}`, Client4.getOptions({
        method: 'delete',
    }));
};
