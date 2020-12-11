package main

import (
	"github.com/mattermost/mattermost-server/v5/plugin"

	"mumble.info/grumble/grumble"
)

func main() {
	grumbleServer, err := grumble.NewServer(1)
	if err != nil {
		panic(err)
	}
	grumbleServer.Set("NoWebServer", "false") // ToDo: required?
	grumbleServer.Set("WebPort", "8065")
	// grumbleServer.Set("Port", "4444")
	// err = grumbleServer.Start()
	// if err != nil {
	// 	panic(err)
	// }

	plugin.ClientMain(&Plugin{grumbleServer: grumbleServer})
}
