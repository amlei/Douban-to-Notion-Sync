package config

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"sync"

	"gopkg.in/yaml.v3"
)

var (
	data     map[string]any
	loadOnce sync.Once
)

func Load() {
	loadOnce.Do(func() {
		data = make(map[string]any)
		raw, err := os.ReadFile("config.yaml")
		if err == nil {
			yaml.Unmarshal(raw, &data)
		}
		if GetString("jwt_secret") == "" {
			b := make([]byte, 32)
			rand.Read(b)
			data["jwt_secret"] = hex.EncodeToString(b)
			Save()
		}
	})
}

func Get() map[string]any {
	if data == nil {
		Load()
	}
	return data
}

func GetString(key string) string {
	v, ok := data[key]
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}

// Unmarshal extracts a top-level section and unmarshals it into out.
func Unmarshal(key string, out any) {
	section, ok := data[key]
	if !ok {
		return
	}
	b, _ := yaml.Marshal(section)
	yaml.Unmarshal(b, out)
}

func Save() {
	if data == nil {
		return
	}
	out, _ := yaml.Marshal(data)
	os.WriteFile("config.yaml", out, 0644)
}
