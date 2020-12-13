package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/plugin"
)

type Params map[string]interface{}

type ResponseChannel struct {
	Id int `json:"id"`
	Name string `json:"name"`
}

func DecodeParams(r *http.Request) *Params {
	p := &Params{}
	json.NewDecoder(r.Body).Decode(&p)
	return p
}

func (p *Params) String(key string) string {
	v, _ := (*p)[key].(string)
	return v
}

func JSON(i interface{}) string {
	b, _ := json.MarshalIndent(i, "", "  ")
	return string(b)
}

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	url := r.URL.String()
	switch {
	case (url == "/" || url == "") && r.Method == "GET":
		p.rootHandler(w, r)
	case url == "/channels" && r.Method == "POST":
		p.createChannelHandler(w, r)
	case url == "/channels" && r.Method == "GET":
		p.listChannelsHandler(w, r)
	case url == "/remove" && r.Method == "DELETE":
		p.removeChannelHandler(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (p *Plugin) rootHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "ROOT")
}

func (p *Plugin) createChannelHandler(w http.ResponseWriter, r *http.Request) {
	params := DecodeParams(r)
	name := params.String("name")

	if name == "" {
		http.Error(w, "Invalid parameter \"name\"", http.StatusBadRequest)
		return
	}

	c := p.grumbleServer.AddChannel(params.String("name"))

	w.WriteHeader(201)
	w.Header().Add("Content-Type", "application/json")
	fmt.Fprintf(w, JSON(&ResponseChannel{Id: c.Id, Name: c.Name}))
}

func (p *Plugin) listChannelsHandler(w http.ResponseWriter, r *http.Request) {
	channels := make([]*ResponseChannel, len(p.grumbleServer.Channels))
	for i, channel := range p.grumbleServer.Channels {
		channels[i] = &ResponseChannel{Id: channel.Id, Name: channel.Name}
	}

	fmt.Fprintf(w, JSON(channels))
}

func (p *Plugin) removeChannelHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "DELETE")
}
