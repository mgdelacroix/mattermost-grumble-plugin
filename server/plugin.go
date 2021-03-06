package main

import (
	"fmt"
	"io/ioutil"
	"strconv"
	"sync"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"

	"mumble.info/grumble/grumble"
	"mumble.info/grumble/pkg/freezer"
)

// Plugin implements the interface expected by the Mattermost server to communicate between the server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration

	// the grumble server instance
	grumbleServer *grumble.Server
}

func (p *Plugin) Certs() ([]byte, []byte, *model.AppError) {
	cert, err := p.API.KVGet("cert")
	if err != nil {
		return nil, nil, err
	}

	key, err := p.API.KVGet("key")
	if err != nil {
		return nil, nil, err
	}

	return cert, key, nil
}

func (p *Plugin) SetCerts(certBytes, keyBytes []byte) *model.AppError {
	if err := p.API.KVSet("cert", certBytes); err != nil {
		return err
	}
	if err := p.API.KVSet("key", keyBytes); err != nil {
		return err
	}
	return nil
}

func (p *Plugin) OnActivate() error {
	p.API.LogInfo("Activating plugin")

	var err error
	p.grumbleServer, err = grumble.NewServer(1)
	if err != nil {
		return fmt.Errorf("cannot create grumble server: %w", err)
	}
	p.grumbleServer.Set("NoWebServer", "false")

	fs, err := p.ServerState()
	if err != nil {
		return fmt.Errorf("cannot load server state: %w", err)
	}

	if len(fs.Users) > 0 || len(fs.Channels) > 0 {
		if err := p.Unfreeze(fs); err != nil {
			p.API.LogError("cannot unfreeze server state: " + err.Error())
		}
	}

	if err := p.applyConfig(); err != nil {
		return fmt.Errorf("error applying plugin configuration: %w", err)
	}

	if err := p.API.RegisterCommand(createGrumbleCommand()); err != nil {
		return fmt.Errorf("error registering plugin command: %w", err)
	}

	return p.StartServer()
}

func (p *Plugin) OnDeactivate() error {
	p.API.LogInfo("Deactivating plugin")

	err := p.StopServer()
	p.grumbleServer = nil

	return err
}

func (p *Plugin) applyConfig() error {
	p.API.LogInfo("Applying configuration")

	p.grumbleServer.Set("Port", strconv.Itoa(p.configuration.Port))
	p.grumbleServer.Set("WebPort", strconv.Itoa(p.configuration.WebPort))

	var certBytes, keyBytes []byte
	if p.configuration.CertPath != "" && p.configuration.KeyPath != "" {
		p.API.LogDebug("Reading certificate files")
		var err error
		certBytes, err = ioutil.ReadFile(p.configuration.CertPath)
		if err != nil {
			return fmt.Errorf("error reading certificate file %q: %w", p.configuration.CertPath, err)
		}
		keyBytes, err = ioutil.ReadFile(p.configuration.KeyPath)
		if err != nil {
			return fmt.Errorf("error reading certificate key file %q: %w", p.configuration.KeyPath, err)
		}
	} else {
		var appErr *model.AppError
		certBytes, keyBytes, appErr = p.Certs()
		if appErr != nil {
			p.API.LogInfo("Certificates not found, generating")
			certBytes, keyBytes, err := grumble.GenerateSelfSignedCertBytes()
			if err != nil {
				return fmt.Errorf("cannot generate self signed certificates: %w", err)
			}

			if err := p.SetCerts(certBytes, keyBytes); err != nil {
				return fmt.Errorf("cannot save certs in the kvstore: %w", err)
			}
		}
	}

	p.grumbleServer.Set("Cert", string(certBytes))
	p.grumbleServer.Set("Key", string(keyBytes))

	return nil
}

func (p *Plugin) SaveServerState() error {
	p.API.LogInfo("Saving server state")

	fs, err := p.grumbleServer.Freeze()
	if err != nil {
		return fmt.Errorf("cannot freeze to save server state: %w", err)
	}

	if err := p.Helpers.KVSetJSON("users", fs.Users); err != nil {
		return fmt.Errorf("cannot save users: %w", err)
	}

	if err := p.Helpers.KVSetJSON("channels", fs.Channels); err != nil {
		return fmt.Errorf("cannot save channels: %w", err)
	}

	p.API.LogInfo(fmt.Sprintf("Saved server state, users=%d channels=%d", len(fs.Users), len(fs.Channels)))

	return nil
}

func (p *Plugin) ServerState() (*freezer.Server, error) {
	users := []*freezer.User{}
	if _, err := p.Helpers.KVGetJSON("users", &users); err != nil {
		return nil, fmt.Errorf("cannot load users: %w", err)
	}

	channels := []*freezer.Channel{}
	if _, err := p.Helpers.KVGetJSON("channels", &channels); err != nil {
		return nil, fmt.Errorf("cannot load channels: %w", err)
	}

	fs := &freezer.Server{
		Users:    users,
		Channels: channels,
	}

	p.API.LogInfo(fmt.Sprintf("Recovered server state, users=%d channels=%d", len(users), len(channels)))

	return fs, nil
}

func (p *Plugin) Unfreeze(fs *freezer.Server) error {
	p.API.LogInfo("Unfreezing server state")
	if err := p.grumbleServer.UnfreezeUsers(fs); err != nil {
		return fmt.Errorf("cannot unfreeze users: %w", err)
	}
	p.grumbleServer.UnfreezeChannels(fs)

	rootC := p.grumbleServer.RootChannel()
	for _, c := range p.grumbleServer.Channels {
		if c.Id != 0 {
			rootC.AddChild(c)
		}
	}

	return nil
}

func (p *Plugin) StartServer() error {
	p.API.LogInfo("Starting grumble server")
	if p.grumbleServer.IsRunning() {
		p.API.LogInfo("Server already running. Skipping start")
		return nil
	}

	return p.grumbleServer.StartWithConfig()
}

func (p *Plugin) StopServer() error {
	p.API.LogInfo("Stopping grumble server")
	if !p.grumbleServer.IsRunning() {
		p.API.LogInfo("Server already stopped. Skipping stop")
		return nil
	}

	if err := p.SaveServerState(); err != nil {
		p.API.LogError("cannot save server state: %w", err)
	}

	return p.grumbleServer.Stop()
}
