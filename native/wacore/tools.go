//go:build tools

package wacore

// Mantiene la dependencia de gomobile en go.mod aunque "go mod tidy" no la vea usada.
import _ "golang.org/x/mobile/bind"
