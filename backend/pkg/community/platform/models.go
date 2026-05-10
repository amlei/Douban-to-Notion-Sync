package platform

const (
	PlatformDouban = 1
	PlatformWeread = 2
	PlatformFlomo  = 3
)

func SupportedPlatforms() []string {
	return []string{"douban", "weread", "flomo"}
}

func PlatformNameToID(name string) int {
	switch name {
	case "douban":
		return PlatformDouban
	case "weread":
		return PlatformWeread
	case "flomo":
		return PlatformFlomo
	default:
		return 0
	}
}
