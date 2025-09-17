package main

import (
	"file-vault/internal/config"
	"net/http"
)

func chainHandlers(mux http.Handler, handlers ...func(http.Handler) http.Handler) http.Handler {
	for _, handler := range handlers {
		mux = handler(mux)
	}
	return mux
}

func main() {
	config := config.Load()

	http.ListenAndServe(config.Host + ":" + config.Port, nil)
}
