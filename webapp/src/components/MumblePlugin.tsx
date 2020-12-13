import React, {useState, useEffect} from 'react';

import mumbleClient from 'mumble-client-websocket';
import audioContext from 'audio-context'
import WorkerBasedMumbleConnector from '../worker-client'


import {Channel, User} from '../types';

import ChannelList from './ChannelList';
import MumbleControlBar from './MumbleControlBar';
import {deleteChannel, createChannel} from '../client'
import './MumblePlugin.scss';

import {VADVoiceHandler, ContinuousVoiceHandler, PushToTalkVoiceHandler, VoiceHandler, initVoice} from '../voice';
let voiceHandler: VoiceHandler;

const getUserMedia = (): Promise<MediaStream> => {
    //const voiceHandler = new VADVoiceHandler(client, {vadLevel: 0.3});
    return initVoice((data: any): void => {
        if (voiceHandler) {
            voiceHandler.write(data);
        }
    });
};

type Props = {
    getCurrentUser: () => any;
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
    addingChannel: boolean;
    newChannelName: string;
};

export default class MumblePlugin extends React.PureComponent<Props, State> {
    private client: any = null;
    private inputRef = React.createRef<HTMLInputElement>();
    private webWorkerConnector = new WorkerBasedMumbleConnector();

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
            addingChannel: false,
            newChannelName: '',
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

    private updateVoiceHandler = (): void => {
        if (!this.client) {
            return
        }
        if (voiceHandler) {
            voiceHandler.end()
            voiceHandler = null
        }
        const mode = 'vad';
        if (mode === 'cont') {
            voiceHandler = new ContinuousVoiceHandler(this.client, {})
        } else if (mode === 'ptt') {
            voiceHandler = new PushToTalkVoiceHandler(this.client, {})
        } else if (mode === 'vad') {
            voiceHandler = new VADVoiceHandler(this.client, {vadLevel: 0.3})
        } else {
            return
        }
        voiceHandler.on('started_talking', (): void => {
            if (this.client.self) {
                this.client.self.talking('on')
            }
        })
        voiceHandler.on('stopped_talking', (): void => {
            if (this.client.self) {
                this.client.self.talking('off')
            }
        })
        if (this.client.self.selfMute) {
            voiceHandler.setMute(true)
        }
   
        this._micNode.disconnect()
        this._delayNode.disconnect()
        if (mode === 'vad') {
            this._micNode.connect(this._delayNode)
            this._delayNode.connect(this._delayedMicNode)
        } else {
            this._micNode.connect(this._delayedMicNode)
        }
  
        this.client.setAudioQuality(40000, 960)
   }


    private connect = async (): void => {
        this.setState({connecting: true});
        const ctx = audioContext();
        // try {
            const currentUser = this.props.getCurrentUser();
            const userMedia = await getUserMedia();

            if (!this._delayedMicNode) {
                this._micNode = ctx.createMediaStreamSource(userMedia)
                this._delayNode = ctx.createDelay()
                this._delayNode.delayTime.value = 0.15
                this._delayedMicNode = ctx.createMediaStreamDestination()
            }


            // this.client = await mumbleClient(`wss://${location.hostname}:8090`, {
            //     username: `${currentUser.username} mmid:${currentUser.id}`,
            //     password: '',
            //     webrtc: {
            //         enabled: true,
            //         required: true,
            //         mic: this._delayedMicNode.stream,
            //         audioContext: ctx,
            //     },
            //     tokens: [],
            // });
 
            this.webWorkerConnector.setSampleRate(ctx.sampleRate)
            this.client = await this.webWorkerConnector.connect(`wss://${location.hostname}:8090`, {
                username: `${currentUser.username} mmid:${currentUser.id}`,
                password: '',
                webrtc: {
                    enabled: false,
                },
                tokens: [],
            });
            const rootChannel = this.client.root;
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
            this.updateVoiceHandler();
            this.handleClientEvents();

        // } catch (e) {
        //     this.setState({
        //         connected: false,
        //         connecting: false,
        //         connectError: 'Unable to connect to the mumble server',
        //     });
        // }
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

    private handleNewChannelKey = async (e: React.KeyboardEvent): Promise<void> => {
        const ESC = 27;
        const ENTER = 13;
        if (e.keyCode === ESC) {
            this.setState({newChannelName: '', addingChannel: false});
            e.preventDefault();
        }
        if (e.keyCode === ENTER) {
            try {
                await createChannel(this.state.newChannelName)
                this.setState({newChannelName: '', addingChannel: false});
                e.preventDefault();
            } catch (e) {
                e.preventDefault();
            }
        }
    }

    private handleChannelDelete = (id: number): void => {
        deleteChannel(id);
    }

    public render(): JSX.Element {
        const currentUser = this.props.getCurrentUser();
        return (
            <div className='voicechat-plugin'>
                <div>
                    <div className='voicechat-plugin__headline'>
                        <span>{'Voice Rooms'}</span>
                        {!this.state.addingChannel && this.state.connected && currentUser.roles.indexOf('system_admin') !== -1 &&
                            <button
                                className='voicechat-plugin__add-channel'
                                onClick={(): void => {
                                    this.setState({addingChannel: true, newChannelName: ''});
                                    setTimeout((): void => {
                                        if (this.inputRef.current) {
                                            this.inputRef.current.focus();
                                        }
                                    }, 10);
                                }}
                            >
                                <i className='icon-plus'/>
                            </button>}
                    </div>
                    <input
                        className='voicechat-plugin__add-channel-input'
                        ref={this.inputRef}
                        style={{display: this.state.addingChannel ? 'block' : 'none'}}
                        type='text'
                        placeholder='New channel name'
                        value={this.state.newChannelName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>): void => this.setState({newChannelName: e.target.value})}
                        onKeyDown={this.handleNewChannelKey}
                    />
                    {this.state.connected &&
                        <>
                            <ChannelList
                                channels={Object.values(this.state.channels)}
                                setActiveVoiceChannel={this.handleSetActiveChannel}
                                activeChannel={this.state.activeChannel}
                                activeChannelUsers={this.state.activeChannelUsers}
                                speakingUsers={this.state.speakingUsers}
                                channelDelete={this.handleChannelDelete}
                                isAdmin={currentUser.roles.indexOf('system_admin') !== -1}
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
