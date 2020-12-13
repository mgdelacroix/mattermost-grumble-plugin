package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/plugin"
)

type Params map[string]interface{}

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
		fmt.Fprintf(w, "ROOT")
	case url == "/create" && r.Method == "POST":
		params := DecodeParams(r)
		name := params.String("name")

		if name == "" {
			http.Error(w, "Invalid parameter \"name\"", http.StatusBadRequest)
			return
		}

		c := p.grumbleServer.AddChannel(params.String("name"))

		w.WriteHeader(201)
		w.Header().Add("Content-Type", "application/json")
		fmt.Fprintf(w, JSON(c))
	case url == "/remove" && r.Method == "DELETE":
		fmt.Fprintf(w, "DELETE")
	default:
		http.NotFound(w, r)
	}
}
