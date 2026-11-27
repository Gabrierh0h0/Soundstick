package wacore

import (
	"testing"
	"time"
)

func fakeVP8X(w, h uint32, animated bool) []byte {
	b := make([]byte, 30)
	copy(b[0:], "RIFF")
	copy(b[8:], "WEBP")
	copy(b[12:], "VP8X")
	if animated {
		b[20] = 0x02
	}
	w--
	h--
	b[24], b[25], b[26] = byte(w), byte(w>>8), byte(w>>16)
	b[27], b[28], b[29] = byte(h), byte(h>>8), byte(h>>16)
	return b
}

func TestWebpSize(t *testing.T) {
	w, h, anim, err := webpSize(fakeVP8X(512, 341, true))
	if err != nil || w != 512 || h != 341 || !anim {
		t.Fatalf("got %d x %d anim=%v err=%v", w, h, anim, err)
	}
	if _, _, anim, _ := webpSize(fakeVP8X(100, 100, false)); anim {
		t.Fatal("no debería marcar animación")
	}
	if _, _, _, err := webpSize([]byte("no es webp")); err == nil {
		t.Fatal("debería rechazar basura")
	}
}

func TestSendRateLimit(t *testing.T) {
	dir = t.TempDir()
	if err := checkAndRecordSend(); err != nil {
		t.Fatalf("primer envío: %v", err)
	}
	if err := checkAndRecordSend(); err == nil || err.Error() != "RATE_LIMIT_GAP" {
		t.Fatalf("segundo envío inmediato debería esperar, got %v", err)
	}
}

func TestSendHourlyCap(t *testing.T) {
	dir = t.TempDir()
	// Simula 15 envíos repartidos en la última hora, el último hace más de minGap.
	var times []time.Time
	for i := 0; i < maxPerHour; i++ {
		times = append(times, time.Now().Add(-time.Duration(40+i)*time.Second))
	}
	writeSends(t, times)
	if err := checkAndRecordSend(); err == nil || err.Error() != "RATE_LIMIT_HOUR" {
		t.Fatalf("debería llegar al tope por hora, got %v", err)
	}
}

func TestPairCooldownAndDailyCap(t *testing.T) {
	dir = t.TempDir()
	if err := checkAndRecordPair(); err != nil {
		t.Fatalf("primer intento: %v", err)
	}
	if err := checkAndRecordPair(); err == nil || err.Error() != "PAIR_WAIT" {
		t.Fatalf("segundo intento inmediato debería esperar, got %v", err)
	}
	dir = t.TempDir()
	writePairs(t, []time.Time{
		time.Now().Add(-10 * time.Hour), time.Now().Add(-8 * time.Hour),
		time.Now().Add(-6 * time.Hour), time.Now().Add(-4 * time.Hour),
	})
	if err := checkAndRecordPair(); err == nil || err.Error() != "PAIR_DAILY" {
		t.Fatalf("debería llegar al tope diario, got %v", err)
	}
}

func TestSendRejectsWhenNotInitialized(t *testing.T) {
	cli = nil
	if err := SendSoundSticker("a", "b", 3, ""); err == nil || err.Error() != "NOT_INITIALIZED" {
		t.Fatalf("got %v", err)
	}
}
