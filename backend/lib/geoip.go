package lib

import (
	"log"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/oschwald/maxminddb-golang"
)

type GeoIPResolver struct {
	db *maxminddb.Reader
}

type geoIPRecord struct {
	Country struct {
		ISOCode string `maxminddb:"iso_code"`
	} `maxminddb:"country"`
}

func NewGeoIPResolver(dbPath string, logger *log.Logger) *GeoIPResolver {
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		logger.Printf("GeoIP DB not found at %s; country resolution via GeoIP will be unavailable", dbPath)
		return nil
	}

	db, err := maxminddb.Open(dbPath)
	if err != nil {
		logger.Printf("Failed to open GeoIP DB at %s: %v", dbPath, err)
		return nil
	}

	logger.Printf("GeoIP DB loaded from %s", dbPath)
	return &GeoIPResolver{db: db}
}

func (g *GeoIPResolver) LookupCountry(ipStr string) string {
	if g == nil || g.db == nil {
		return ""
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return ""
	}

	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() {
		return ""
	}

	var record geoIPRecord
	err := g.db.Lookup(ip, &record)
	if err != nil {
		return ""
	}

	return record.Country.ISOCode
}

func (g *GeoIPResolver) Close() {
	if g != nil && g.db != nil {
		g.db.Close()
	}
}

// RealIP extracts the visitor IP from the request by checking
// X-Forwarded-For, X-Real-IP, then falling back to RemoteAddr.
func RealIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For may contain multiple IPs; the first is the client.
		ips := strings.SplitN(xff, ",", 2)
		return strings.TrimSpace(ips[0])
	}
	if rip := r.Header.Get("X-Real-IP"); rip != "" {
		return strings.TrimSpace(rip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
