package main

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/plugin"
)

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	url := r.URL.String()
	switch {
	case (url == "/" || url == "") && r.Method == "GET":
		fmt.Fprintf(w, "ROOT")
	case url == "/create" && r.Method == "POST":
		fmt.Fprintf(w, "CREATE")
	default:
		w.WriteHeader(404)
		fmt.Fprintf(w, "Not Found")
	}
}
