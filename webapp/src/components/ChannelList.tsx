import React from 'react';
import {FiVolume2} from 'react-icons/fi';
import {GrClose} from 'react-icons/gr';

import {Channel, User} from '../types';

import UsersList from './UsersList';

import './ChannelList.scss';

type Props = {
    channels: Channel[];
    setActiveVoiceChannel: (channel: Channel) => void;
    activeChannel: Channel | null;
    activeChannelUsers: User[];
    speakingUsers: {[key: string]: boolean};
    channelDelete: (id: number) => void;
    isAdmin: boolean;
}

const ChannelList: React.FC<Props> = ({channels, setActiveVoiceChannel, activeChannel, activeChannelUsers, speakingUsers, channelDelete, isAdmin}: Props): JSX.Element => {
    return (
        <ul className='voicechat-channel-list'>
            {channels.map(({
                id,
                name,
            }): JSX.Element => (
                <li key={id}>
                    <button onClick={(): void => setActiveVoiceChannel({id, name})}>
                        <FiVolume2 size={16}/>
                        <span className='voicechat-channel-name'>{name}</span>
                        {isAdmin &&
                            <button
                                className='voicechat-channel-delete-button'
                                onClick={(e: React.MouseEvent): void => {
                                    e.stopPropagation();
                                    channelDelete(id);
                                }}
                            >
                                <i className='icon-close'/>
                            </button>}
                    </button>
                    {activeChannel && activeChannel.id === id &&
                        <div className='voicechat-channel-list__users'>
                            <UsersList
                                users={activeChannelUsers}
                                speakingUsers={speakingUsers}
                            />
                        </div>}
                </li>
            ))}
        </ul>
    );
};

export default ChannelList;
