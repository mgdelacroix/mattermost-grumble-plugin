import React from 'react';

import {FiMicOff, FiUser} from 'react-icons/fi';
import {GiSpeakerOff} from 'react-icons/gi';

import {User} from '../types';

import './UsersList.scss';

type Props = {
    users: User[];
    speakingUsers: {[key: string]: boolean};
}

const UsersList: React.FC<Props> = ({users, speakingUsers}: Props): JSX.Element => {
    return (
        <ul className='voicechat-users-list'>
            {users.map(({
                id,
                name,
                selfMute,
                selfDeaf,
                avatarUrl,
            }): JSX.Element => (
                <li key={id}>
                    {avatarUrl &&
                        <img
                            src={avatarUrl}
                            className={speakingUsers[id] ? 'avatar avatar-active' : 'avatar'}
                        />}
                    {!avatarUrl &&
                        <FiUser
                            size={24}
                            className={speakingUsers[id] ? 'avatar avatar-active' : 'avatar'}
                        />}
                    {name}
                    {selfMute && <FiMicOff size={16}/>}
                    {selfDeaf && <GiSpeakerOff size={16}/>}
                </li>
            ))}
        </ul>
    );
};

export default UsersList;
