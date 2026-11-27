package wacore

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeSends(t *testing.T, times []time.Time) { t.Helper(); writeTimes(t, "sends.json", times) }
func writePairs(t *testing.T, times []time.Time) { t.Helper(); writeTimes(t, "pairs.json", times) }

func writeTimes(t *testing.T, name string, times []time.Time) {
	t.Helper()
	b, _ := json.Marshal(times)
	if err := os.WriteFile(filepath.Join(dir, name), b, 0o600); err != nil {
		t.Fatal(err)
	}
}
