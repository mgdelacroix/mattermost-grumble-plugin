import React, {useState, useEffect} from 'react';

import mumbleClient from 'mumble-client-websocket';

import {Channel, User} from '../types';

import ChannelList from './ChannelList';
import MumbleControlBar from './MumbleControlBar';
import './MumblePlugin.scss';

import {VADVoiceHandler, ContinuousVoiceHandler, initVoice} from '../voice';

const getUserMedia = async (client): Promise<MediaStream> => {
    //const voiceHandler = new VADVoiceHandler(client, {vadLevel: 0.3});
    const voiceHandler = new ContinuousVoiceHandler(client, {vadLevel: 0.3});
    console.log(voiceHandler);
    const userMedia = await initVoice((data: any): void => {
        voiceHandler.write(data);
    });
    client.connectVoiceStream(userMedia);
    console.log('promise', userMedia);
    return userMedia;
}

type Props = {
    getCurrentUser: () => any
};

type State = {
    activeChannel: Channel | null;
    activeChannelUsers: User[];
    speakingUsers: {[key: string]: boolean};
    channels: {[key: string]: Channel};
    mute: boolean;
    deafed: boolean;
    connected: boolean;
    connecting: boolean;
    connectError: string;
};

export default class MumblePlugin extends React.PureComponent<Props, State> {
    client: mumbleClient = null

    public constructor(props: Props) {
        super(props);
        this.state = {
            activeChannel: null,
            activeChannelUsers: [],
            speakingUsers: {},
            channels: {},
            mute: false,
            deafed: false,
            connected: false,
            connectError: '',
        };
    }

    private updateUsers = (): void => {
        const channel = this.client.getChannelById(this.state.activeChannel ? this.state.activeChannel.id : this.client.root._id)
        if (channel) {
            this.setState({
                activeChannelUsers: channel.users.map((u) => ({
                    id: u._id,
                    name: u._username.split(' mmid:')[0],
                    active: false,
                    avatarUrl: u._username.split(' mmid:')[1] ? `/api/v4/users/${u._username.split(' mmid:')[1]}/image?_=0` : '',
                    selfDeaf: u._selfDeaf,
                    selfMute: u._selfMute,
                })),
            });

            const currentUser = this.props.getCurrentUser()
            for (const u of channel.users) {
                if (u._username === `${currentUser.username} mmid:${currentUser.id}`) {
                    this.setState({
                        mute: u._selfMute,
                        deafed: u._selfDeaf,
                    });
                }
            }
        }
    }

    private updateChannels = (): void => {
        const channel = this.client.getChannelById(this.state.activeChannel ? this.state.activeChannel.id : this.client.root._id)
        if (channel) {
            this.setState({
                channels: this.client.channels.reduce((acc: {[key: string]: {id: string, name: string}}, chan: any): {[key: string]: {id: string, name: string}} => {
                    acc[chan._id] = {id: chan._id, name: chan.name};
                    return acc;
                }, {}),
                activeChannel: {id: channel._id, name: channel._name},
            });
        }
    }

    private handleClientEvents = (): void => {
        this.client.users.forEach((user: any): void => {
            user.on('voice', (stream: any): void => {
                this.setState({speakingUsers: {...this.state.speakingUsers, [user._id]: true}});
                console.log(stream);
                stream.on('data', () => {}).on('end', (): void => {
                    this.setState({speakingUsers: {...this.state.speakingUsers, [user._id]: false}});
                });
            });
            user.on('update', (): void => {
                this.updateUsers();
                this.updateChannels();
            });
        });

        this.client.channels.forEach((channel: any): void => {
            channel.on('update', this.updateChannels);
        });

        this.client.on('newChannel', (channel: any): void => {
            this.updateChannels();
            channel.on('update', this.updateChannels);
        });

        this.client.on('newUser', (user: any): void => {
            this.updateUsers();
            this.updateChannels();
            user.on('voice', (stream: any): void => {
                this.setState({speakingUsers: {...this.state.speakingUsers, [user._id]: true}});
                stream.on('data', () => {}).on('end', (): void => {
                    this.setState({speakingUsers: {...this.state.speakingUsers, [user._id]: false}});
                });
            });
            user.on('update', (): void => {
                this.updateUsers();
                this.updateChannels();
            });
        });
    }

    private handleSetActiveChannel = (channel: {id: string, name: string}): void => {
        this.client.self.setChannel({_id: channel.id});
        this.setState({activeChannel: channel});
        setTimeout(this.updateChannels, 0);
    }

    private hangupHandler = (): void => {
        this.setState({});
        if (this.client) {
            this.client.disconnect();
        }
        this.client = null;
        this.setState({
            activeChannel: null,
            activeChannelUsers: [],
            speakingUsers: {},
            channels: {},
            mute: false,
            deafed: false,
            connected: false,
            connectError: '',
        });
    };

    private connect = async (): void => {
        this.setState({connecting: true});
        try {
            const currentUser = this.props.getCurrentUser()
            this.client = await mumbleClient(`wss://${location.hostname}:8090`, {
                username: `${currentUser.username} mmid:${currentUser.id}`,
                password: '',
                tokens: [],
            });
            const rootChannel = this.client.root
            this.setState({
                channels: this.client.channels.reduce((acc: {[key: string]: {id: string, name: string}}, chan: any): {[key: string]: {id: string, name: string}} => {
                    acc[chan._id] = {id: chan._id, name: chan.name};
                    return acc;
                }, {}),
                activeChannel: {id: rootChannel._id, name: rootChannel._name},
                activeChannelUsers: rootChannel.users.map((u) => ({id: u._id, name: u._username.split(' mmid:')[0], active: false, avatarUrl: u._username.split(' mmid:')[1] ? `/api/v4/users/${u._username.split(' mmid:')[1]}/image?_=0` : ''})),
                connected: true,
                connecting: false,
                connectError: '',
            });
            this.handleClientEvents();

            getUserMedia(this.client);
        } catch (e) {
            this.setState({
                connected: false,
                connecting: false,
                connectError: 'Unable to connect to the mumble server',
            });
        }
    }

    private handleToggleAudio = (): void => {
        this.client.setSelfDeaf(!this.state.deafed);
        this.setState({deafed: !this.state.deafed});
    }

    private handleToggleMic = (): void => {
        this.client.setSelfMute(!this.state.mute);
        this.setState({mute: !this.state.mute});
    }

    public componentDidMount(): void {}

    public componentWillUnmount(): void {
        if (this.client) {
            this.client.disconnect();
        }
        this.setState({
            connected: false,
            connecting: false,
            connectError: '',
        });
    }

    public render(): JSX.Element {
        return (
            <div className='voicechat-plugin'>
                <div>
                    <div className='voicechat-plugin__headline'>{'Voice Rooms'}</div>
                    {this.state.connected &&
                        <>
                            <ChannelList
                                channels={Object.values(this.state.channels)}
                                setActiveVoiceChannel={this.handleSetActiveChannel}
                                activeChannel={this.state.activeChannel}
                                activeChannelUsers={this.state.activeChannelUsers}
                                speakingUsers={this.state.speakingUsers}
                            />
                            <MumbleControlBar
                                channel={this.state.activeChannel}
                                toggleSound={this.handleToggleAudio}
                                toggleMic={this.handleToggleMic}
                                muted={this.state.mute}
                                deafed={this.state.deafed}
                                hangup={this.hangupHandler}
                            />
                        </>
                    }
                    {!this.state.connected && this.state.connecting && <span className='connecting'>{'Connecting'}</span>}
                    {!this.state.connected && !this.state.connecting && this.state.connectError && 
                        <>
                            <span className='error'>{this.state.connectError}</span>
                            <button
                                className='connect-button'
                                onClick={this.connect}
                            >
                                {'Try again'}
                            </button>
                        </>}
                    {!this.state.connected && !this.state.connecting && !this.state.connectError &&
                        <button
                            className='connect-button'
                            onClick={this.connect}
                        >
                            {'Connect'}
                        </button>}
                </div>
            </div>
        );
    }
}
