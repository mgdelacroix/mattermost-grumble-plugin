package main

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

const (
	grumbleCommand               = "grumble"
	grumbleStartCommand          = "start"
	grumbleStopCommand           = "stop"
	grumbleStatusCommand         = "status"
	grumbleCreateChannelCommand  = "create-channel"
	grumbleDestroyChannelCommand = "destroy-channel"
	grumbleHelpCommand           = "help"
	helpText                     = "###### Grumble Plugin - Slash Command Help\n\n" +
		"* `/grumble start` - Starts the grumble server\n" +
		"* `/grumble stop` - Stops the grumble server\n" +
		"* `/grumble status` - Shows the grumble server status\n" +
		"* `/grumble create-channel [channel-name]` - Creates a new channel\n" +
		"* `/grumble destroy-channel [channel-name]` - Destroys a channel\n" +
		"* `/grumble help` - Shows the slash command help"
)

func createGrumbleCommand() *model.Command {
	return &model.Command{
		Trigger:          grumbleCommand,
		AutoComplete:     true,
		AutoCompleteDesc: "Available commands: start, stop, status, help",
		AutoCompleteHint: "[command]",
		AutocompleteData: getAutocompleteData(),
	}
}

func getAutocompleteData() *model.AutocompleteData {
	grumble := model.NewAutocompleteData(grumbleCommand, "[command]", "Available commands: start, stop, status, help")

	start := model.NewAutocompleteData(grumbleStartCommand, "", "Starts the grumble server")
	grumble.AddCommand(start)

	stop := model.NewAutocompleteData(grumbleStopCommand, "", "Stops the grumble server")
	grumble.AddCommand(stop)

	status := model.NewAutocompleteData(grumbleStatusCommand, "", "Gets the grumble server status")
	grumble.AddCommand(status)

	createChannel := model.NewAutocompleteData(grumbleCreateChannelCommand, "", "Creates a new channel")
	grumble.AddCommand(createChannel)

	destroyChannel := model.NewAutocompleteData(grumbleDestroyChannelCommand, "", "Destroys a channel")
	grumble.AddCommand(destroyChannel)

	help := model.NewAutocompleteData(grumbleHelpCommand, "", "Get slash command help")
	grumble.AddCommand(help)

	return grumble
}

func (p *Plugin) ExecuteCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	split := strings.Fields(args.Command)
	command := split[0]

	if command != "/"+grumbleCommand {
		return &model.CommandResponse{}, nil
	}

	action := command
	if len(split) > 1 {
		action = split[1]
	}

	switch action {
	case grumbleStartCommand:
		return p.executeStartCommand(c, args)
	case grumbleStopCommand:
		return p.executeStopCommand(c, args)
	case grumbleStatusCommand:
		return p.executeStatusCommand(c, args)
	case grumbleCreateChannelCommand:
		return p.executeCreateChannelCommand(c, args)
	case grumbleDestroyChannelCommand:
		return p.executeDestroyChannelCommand(c, args)
	case grumbleCommand:
		fallthrough
	case grumbleHelpCommand:
		fallthrough
	default:
		return p.executeHelpCommand(c, args)
	}
}

func (p *Plugin) executeStartCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	text := "Grumble server started"
	p.API.LogInfo("Starting server through slash command")
	err := p.grumbleServer.StartWithConfig()
	if err != nil {
		text = fmt.Sprintf("Error starting grumble server: %s", err)
	}

	resp := &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         text,
		Type:         model.POST_DEFAULT,
	}

	return resp, nil
}

func (p *Plugin) executeStopCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	text := "Grumble server stopped"
	p.API.LogInfo("Stopping server through slash command")
	err := p.grumbleServer.Stop()
	if err != nil {
		text = fmt.Sprintf("Error stopping grumble server: %s", err)
	}

	resp := &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         text,
		Type:         model.POST_DEFAULT,
	}

	return resp, nil
}

func (p *Plugin) executeStatusCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	text := "Grumble server is not running"
	if p.grumbleServer.IsRunning() {
		text = "Grumble server is running"
	}

	resp := &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         text,
		Type:         model.POST_DEFAULT,
	}

	return resp, nil
}

func (p *Plugin) executeCreateChannelCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	text := "Channel created"
	p.API.LogInfo("Creating mumble channel")

	split := strings.Fields(args.Command)
	if len(split) <= 2 {
		text = "Channel name required"
	} else {
		newChannel := p.grumbleServer.AddChannel(strings.Join(split[2:], " "))
		p.grumbleServer.RootChannel().AddChild(newChannel)
		p.grumbleServer.BroadcastChannels()
		p.SaveServerState()
	}

	resp := &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         text,
		Type:         model.POST_DEFAULT,
	}

	return resp, nil
}

func (p *Plugin) executeDestroyChannelCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	text := "Channel destroyed"
	p.API.LogInfo("Destroying mumble channel")

	split := strings.Fields(args.Command)
	if len(split) <= 2 {
		text = "Channel name required"
	} else {
		for _, channel := range p.grumbleServer.RootChannel().AllSubChannels() {
			if channel.Name == strings.Join(split[2:], " ") {
				p.grumbleServer.RemoveChannel(channel)
				p.grumbleServer.BroadcastChannels()
				p.SaveServerState()
				break
			}
		}
	}

	resp := &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         text,
		Type:         model.POST_DEFAULT,
	}

	return resp, nil
}

func (p *Plugin) executeHelpCommand(c *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	resp := &model.CommandResponse{
		ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL,
		Text:         helpText,
		Type:         model.POST_DEFAULT,
	}

	return resp, nil
}
