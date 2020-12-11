import React from 'react';
import {FiMic, FiMicOff, FiPhoneOff} from 'react-icons/fi';
import {GiSpeaker, GiSpeakerOff} from 'react-icons/gi';

import './MumbleControlBar.scss';

type Props = {
    channel: {id: string; name: string} | null;
    muted?: boolean;
    deafed?: boolean;
    toggleMic: () => void;
    toggleSound: () => void;
    hangup: () => void;
}

const MumbleControlBar: React.FC<Props> = ({channel, muted, deafed, toggleMic, toggleSound, hangup}: Props): JSX.Element | null => {
    if (channel === null) {
        return null;
    }

    return (
        <div className='voicechat-control-bar'>
            <div className='voicechat-control-bar__info'>
                <div className='voicechat-control-bar__connection'>{'Voice Conntected:'}</div>
                <div className='voicechat-control-bar__channel-name'>{channel.name}</div>
            </div>
            <button
                type='button'
                onClick={toggleMic}
            >
                {muted ? <FiMicOff size={24}/> : <FiMic size={24}/>}
            </button>
            <button
                type='button'
                onClick={toggleSound}
            >
                {deafed ? <GiSpeakerOff size={24}/> : <GiSpeaker size={24}/>}
            </button>
            <button
                type='button'
                onClick={hangup}
            >
                <FiPhoneOff size={24}/>
            </button>
        </div>
    );
};

export default MumbleControlBar;
