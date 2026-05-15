package lib

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"log"

	"github.com/gomodule/redigo/redis"
	"github.com/gorilla/sessions"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type appAdapter struct {
	App *App
	fn  func(*Ctx)
}

var FileComponentLookOk = regexp.MustCompile(`^[a-zA-Z0-9-_]+$`).MatchString

var endpoints = map[string]func(*Ctx){}

func (ah appAdapter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		r := recover()
		if r != nil {
			switch r.(type) {
			case *Ctx:
			default:
				panic(r)
			}
		}
	}()
	ctx := ah.App.NewContext(w, r)
	go func() {
		<-r.Context().Done()
		if !ctx.noAutoCleanup {
			ctx.Cleanup()
		}
	}()
	ah.fn(ctx)
}

func Endpoint(endpoint string, f func(*Ctx)) {
	endpoints[endpoint] = f
}

func EndpointName() string {
	_, fpath, _, ok := runtime.Caller(1)
	if !ok {
		err := errors.New("failed to get filename")
		panic(err)
	}
	filename := filepath.Base(fpath)
	return "/" + strings.TrimSuffix(filename, filepath.Ext(filename))
}

type App struct {
	RedisPool    *redis.Pool
	DB           *gorm.DB
	SessionStore *sessions.CookieStore
	Logger       *log.Logger
	ServeMux     *http.ServeMux
	Config       Config
}

func (app *App) ConnectEndpoints() {
	for endpoint, handler := range endpoints {
		app.Connect(endpoint, handler)
	}
}

func (app *App) NewContext(w http.ResponseWriter, r *http.Request) *Ctx {
	return &Ctx{W: w, R: r, App: app}
}

func (app *App) CtxHandlerToHandler(fn func(*Ctx)) http.Handler {
	return appAdapter{app, fn}
}

func (app *App) Connect(path string, f func(*Ctx)) {
	app.ServeMux.Handle(path, app.CtxHandlerToHandler(f))
}

func NewApp() *App {

	config := NewConfigFromEnv()

	redisPool := &redis.Pool{
		//MaxIdle:     0,
		//IdleTimeout: 240 * time.Second,
		//MaxActive: 10,
		Dial: func() (redis.Conn, error) {
			return redis.DialURL(config.RedisUrl)
		},
	}

	sessionStore := sessions.NewCookieStore(config.CookieSecret)

	logFile, err := os.OpenFile("log", os.O_RDWR|os.O_CREATE|os.O_APPEND, 0744)
	if err != nil {
		panic(fmt.Sprintf("error opening file: %v", err))
	}
	logger := log.New(io.MultiWriter(os.Stdout, logFile), "", log.LstdFlags|log.Lshortfile)

	db, err := gorm.Open(sqlite.Open(config.ArchiveDatabase), &gorm.Config{})
	if err != nil {
		panic("failed to connect sqlite3 database")
	}

	serveMux := http.NewServeMux()
	app := &App{
		RedisPool:    redisPool,
		SessionStore: sessionStore,
		Logger:       logger,
		ServeMux:     serveMux,
		Config:       config,
		DB:           db,
	}
	serveMux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "ok")
	})
	serveMux.HandleFunc("/api/session", func(w http.ResponseWriter, r *http.Request) {
		ctx := app.NewContext(w, r)
		defer ctx.Cleanup()
		userId := ctx.GetUserId()
		resp := map[string]interface{}{
			"authenticated": userId != "",
			"user":          userId,
			"site_links":    map[string]int{},
		}
		if userId != "" {
			links, err := ctx.User(userId).GetPreferredSiteLinks()
			if err != nil {
				app.Logger.Printf("session site links error: %v", err)
			} else {
				resp["site_links"] = links
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})
	serveMux.HandleFunc("/app-next", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/app-next/", http.StatusTemporaryRedirect)
	})
	if config.FrontendRoot != "" {
		serveMux.HandleFunc("/app-next/", func(w http.ResponseWriter, r *http.Request) {
			serveSPAFile(w, r, config.FrontendRoot, "/app-next/")
		})
	}
	//fs := http.FileServer(http.Dir("./static"))
	serveMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		var prefix string
		if config.StaticRoot != "" && hostAllowed(r.Host, config.AllowedHosts) {
			prefix = config.StaticRoot
		} else if r.Host == "localhost:8080" {
			if strings.HasPrefix(r.URL.Path, "/blog/") ||
				r.URL.Path == "/blog" ||
				strings.HasPrefix(r.URL.Path, "/pages/") ||
				strings.HasPrefix(r.URL.Path, "/help/") ||
				r.URL.Path == "/blog" {
				prefix = "./out"
			} else {
				prefix = "./static"
			}
		} else if r.Host == "counter.dev" || r.Host == "counter" || r.Host == "simple-web-analytics.com" {
			prefix = "/state/static/master"
		} else if r.Host == "www.counter.dev" || r.Host == "www.simple-web-analytics.com" {
			prefix = "/state/static/master"
		} else if strings.HasSuffix(r.Host, ".counter.dev") {
			branch := strings.TrimSuffix(r.Host, ".counter.dev")
			if !FileComponentLookOk(branch) {
				w.WriteHeader(http.StatusForbidden)
			}
			prefix = "/state/static/" + branch
		} else {
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, "Bad Host")
			return
		}
		http.ServeFile(w, r, prefix+r.URL.Path)
	})
	return app
}

func serveSPAFile(w http.ResponseWriter, r *http.Request, root string, routePrefix string) {
	relPath := strings.TrimPrefix(r.URL.Path, routePrefix)
	relPath = filepath.Clean("/" + relPath)
	if relPath == "/" {
		relPath = "/index.html"
	}
	filePath := filepath.Join(root, relPath)
	info, err := os.Stat(filePath)
	if err != nil || info.IsDir() {
		filePath = filepath.Join(root, "index.html")
	}
	http.ServeFile(w, r, filePath)
}

func hostAllowed(host string, allowedHosts []string) bool {
	if len(allowedHosts) == 0 {
		return true
	}
	for _, allowedHost := range allowedHosts {
		if host == allowedHost {
			return true
		}
	}
	return false
}

func (app App) Serve() {
	srv := &http.Server{
		Addr:        app.Config.Bind,
		ReadTimeout: 5 * time.Second,

		// we cant have write a write timeout because of the streaming response
		WriteTimeout: 0,

		IdleTimeout: 120 * time.Second,
		Handler:     app.ServeMux,
	}
	fmt.Println("Listening at", app.Config.Bind)
	err := srv.ListenAndServe()
	if err != nil {
		panic(fmt.Sprintf("ListenAndServe: %s", err))
	}
}
