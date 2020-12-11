import {id as pluginId} from './manifest';

import MumblePlugin from './components/MumblePlugin';

export default class Plugin {
    // eslint-disable-next-line no-unused-vars
    public initialize(registry: any, store: any): void {
        const getCurrentUser = (): any => {
            const state = store.getState();
            const currentUserId = state.entities.users.currentUserId;
            return state.entities.users.profiles[currentUserId];
        };
        registry.registerLeftSidebarHeaderComponent(
            (): JSX.Element => {
                return (<MumblePlugin getCurrentUser={getCurrentUser}/>)
            }
        );
    }
}

declare global {
    interface Window {
        registerPlugin(id: string, plugin: Plugin): void;
    }
}

window.registerPlugin(pluginId, new Plugin());
