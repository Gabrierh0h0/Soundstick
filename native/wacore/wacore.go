// Package wacore es el núcleo nativo de Soundstick para enviar stickers con sonido a WhatsApp.
//
// Reglas de seguridad (para no poner en riesgo la cuenta de quien usa la app):
//   - Se vincula como dispositivo acompañante por el flujo oficial de código de emparejamiento.
//   - Solo envía al propio chat del usuario ("Tú"); nunca a terceros, nunca en lote.
//   - Se conecta solo cuando hay un envío y se desconecta tras unos segundos de inactividad.
//   - Límite de frecuencia: separación mínima entre envíos y máximo por hora (persistente).
//   - No lee chats, contactos ni historial: los eventos de sincronización se ignoran.
//   - No registra el contenido de nada, solo códigos de estado.
package wacore

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

const (
	minGap         = 20 * time.Second
	maxPerHour     = 15
	idleDisconnect = 45 * time.Second
	maxAudioBytes  = 1_000_000
	maxWebpBytes   = 1_000_000
	maxSeconds     = 10
)

var (
	mu        sync.Mutex
	cli       *whatsmeow.Client
	dir       string
	connected = make(chan struct{}, 1)
	idleTimer *time.Timer
	lastEvent string
)

// Init abre el almacenamiento local de la sesión. dataDir debe ser privado de la app.
func Init(dataDir string) error {
	mu.Lock()
	defer mu.Unlock()
	if cli != nil {
		return nil
	}
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return err
	}
	dir = dataDir
	ctx := context.Background()
	addr := "file:" + filepath.ToSlash(filepath.Join(dataDir, "wa.db")) + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)"
	container, err := sqlstore.New(ctx, "sqlite", addr, waLog.Stdout("wa", "ERROR", false))
	if err != nil {
		return err
	}
	dev, err := container.GetFirstDevice(ctx)
	if err != nil {
		return err
	}
	store.SetOSInfo("Soundstick", [3]uint32{1, 0, 0})
	c := whatsmeow.NewClient(dev, waLog.Stdout("wa", "ERROR", false))
	c.AddEventHandler(onEvent)
	cli = c
	return nil
}

func onEvent(evt any) {
	switch e := evt.(type) {
	case *events.Connected:
		select {
		case connected <- struct{}{}:
		default:
		}
		lastEvent = "connected"
	case *events.PairSuccess:
		lastEvent = "paired"
		fmt.Println("wa: pair success")
	case *events.LoggedOut:
		lastEvent = "logged_out"
	case *events.Disconnected:
		lastEvent = "disconnected"
	case *events.PairError:
		lastEvent = "pair_error"
		_ = e
	}
	// Cualquier otro evento (mensajes, historial, presencia...) se ignora a propósito.
}

// State devuelve "unlinked", "linked" o "not_initialized".
func State() string {
	mu.Lock()
	defer mu.Unlock()
	if cli == nil {
		return "not_initialized"
	}
	if cli.Store.ID == nil {
		return "unlinked"
	}
	return "linked"
}

// LastEvent informa del último evento de conexión (connected, paired, logged_out...).
func LastEvent() string {
	mu.Lock()
	defer mu.Unlock()
	return lastEvent
}

// PairPhone inicia la vinculación con el código de 8 caracteres que el usuario escribe
// en WhatsApp > Dispositivos vinculados > Vincular con número de teléfono.
// phone va en formato internacional solo con dígitos (ej. 573001234567).
func PairPhone(phone string) (string, error) {
	mu.Lock()
	c := cli
	mu.Unlock()
	if c == nil {
		return "", errors.New("NOT_INITIALIZED")
	}
	if c.Store.ID != nil {
		return "", errors.New("ALREADY_LINKED")
	}
	if err := checkAndRecordPair(); err != nil {
		return "", err
	}
	if !c.IsConnected() {
		if err := c.ConnectContext(context.Background()); err != nil {
			return "", fmt.Errorf("CONNECT: %w", err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	// El servidor valida el nombre con formato "Navegador (Sistema)"; cualquier otro devuelve 400.
	time.Sleep(1500 * time.Millisecond)
	code, err := c.PairPhone(ctx, phone, true, whatsmeow.PairClientChrome, "Chrome (Linux)")
	if err != nil {
		return "", fmt.Errorf("PAIR: %w", err)
	}
	return code, nil
}

// Unlink cierra la sesión en WhatsApp y borra las credenciales locales.
func Unlink() error {
	mu.Lock()
	c := cli
	mu.Unlock()
	if c == nil || c.Store.ID == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if !c.IsConnected() {
		_ = c.ConnectContext(ctx)
	}
	err := c.Logout(ctx)
	c.Disconnect()
	return err
}

func ensureConnected(ctx context.Context) error {
	if cli.IsConnected() && cli.IsLoggedIn() {
		return nil
	}
	select {
	case <-connected:
	default:
	}
	if err := cli.ConnectContext(ctx); err != nil {
		return fmt.Errorf("CONNECT: %w", err)
	}
	select {
	case <-connected:
		return nil
	case <-ctx.Done():
		return errors.New("CONNECT_TIMEOUT")
	}
}

func armIdle() {
	if idleTimer != nil {
		idleTimer.Stop()
	}
	idleTimer = time.AfterFunc(idleDisconnect, func() {
		mu.Lock()
		defer mu.Unlock()
		if cli != nil {
			cli.Disconnect()
		}
	})
}

// ---- límite de frecuencia persistente ----

func loadSends() []time.Time {
	b, err := os.ReadFile(filepath.Join(dir, "sends.json"))
	if err != nil {
		return nil
	}
	var out []time.Time
	_ = json.Unmarshal(b, &out)
	return out
}

func checkAndRecordSend() error {
	now := time.Now()
	recent := []time.Time{}
	for _, t := range loadSends() {
		if now.Sub(t) < time.Hour {
			recent = append(recent, t)
		}
	}
	if n := len(recent); n > 0 && now.Sub(recent[n-1]) < minGap {
		return errors.New("RATE_LIMIT_GAP")
	}
	if len(recent) >= maxPerHour {
		return errors.New("RATE_LIMIT_HOUR")
	}
	recent = append(recent, now)
	b, _ := json.Marshal(recent)
	return os.WriteFile(filepath.Join(dir, "sends.json"), b, 0o600)
}

// webpSize lee el lienzo de un WebP extendido (VP8X).
func webpSize(b []byte) (w, h uint32, animated bool, err error) {
	if len(b) < 30 || string(b[0:4]) != "RIFF" || string(b[8:12]) != "WEBP" || string(b[12:16]) != "VP8X" {
		return 0, 0, false, errors.New("WEBP_INVALID")
	}
	animated = b[20]&0x02 != 0
	w = (uint32(b[24]) | uint32(b[25])<<8 | uint32(b[26])<<16) + 1
	h = (uint32(b[27]) | uint32(b[28])<<8 | uint32(b[29])<<16) + 1
	return
}

// SendSoundSticker sube el audio y el sticker y envía el mensaje al propio chat del usuario.
// El WebP debe llevar en su EXIF "sound-sha256" = base64(SHA-256 del audio); se verifica.
func SendSoundSticker(webpPath, audioPath string, seconds int, emojis string) error {
	mu.Lock()
	defer mu.Unlock()
	if cli == nil {
		return errors.New("NOT_INITIALIZED")
	}
	if cli.Store.ID == nil {
		return errors.New("NOT_LINKED")
	}
	webp, err := os.ReadFile(webpPath)
	if err != nil {
		return err
	}
	audio, err := os.ReadFile(audioPath)
	if err != nil {
		return err
	}
	if len(audio) == 0 || len(audio) > maxAudioBytes {
		return errors.New("AUDIO_SIZE")
	}
	if len(webp) == 0 || len(webp) > maxWebpBytes {
		return errors.New("WEBP_SIZE")
	}
	if seconds < 1 || seconds > maxSeconds {
		return errors.New("DURATION")
	}
	w, h, animated, err := webpSize(webp)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(audio)
	if !bytes.Contains(webp, []byte(base64.StdEncoding.EncodeToString(sum[:]))) {
		return errors.New("HASH_MISMATCH")
	}
	if err := checkAndRecordSend(); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	if err := ensureConnected(ctx); err != nil {
		return err
	}
	defer armIdle()

	upAudio, err := cli.Upload(ctx, audio, whatsmeow.MediaAudio)
	if err != nil {
		return fmt.Errorf("UPLOAD_AUDIO: %w", err)
	}
	upSticker, err := cli.Upload(ctx, webp, whatsmeow.MediaImage)
	if err != nil {
		return fmt.Errorf("UPLOAD_STICKER: %w", err)
	}
	now := time.Now().Unix()
	sticker := &waE2E.StickerMessage{
		URL:               proto.String(upSticker.URL),
		DirectPath:        proto.String(upSticker.DirectPath),
		MediaKey:          upSticker.MediaKey,
		FileEncSHA256:     upSticker.FileEncSHA256,
		FileSHA256:        upSticker.FileSHA256,
		FileLength:        proto.Uint64(upSticker.FileLength),
		Mimetype:          proto.String("image/webp"),
		Width:             proto.Uint32(w),
		Height:            proto.Uint32(h),
		IsAnimated:        proto.Bool(animated),
		MediaKeyTimestamp: proto.Int64(now),
		StickerSentTS:     proto.Int64(now * 1000),
		Emojis:            proto.String(emojis),
		Audio: &waE2E.StickerMessage_AudioMessage{
			AudioMessage: &waE2E.AudioMessage{
				URL:               proto.String(upAudio.URL),
				DirectPath:        proto.String(upAudio.DirectPath),
				MediaKey:          upAudio.MediaKey,
				FileEncSHA256:     upAudio.FileEncSHA256,
				FileSHA256:        upAudio.FileSHA256,
				FileLength:        proto.Uint64(upAudio.FileLength),
				Seconds:           proto.Uint32(uint32(seconds)),
				Mimetype:          proto.String("audio/ogg; codecs=opus"),
				MediaKeyTimestamp: proto.Int64(now),
			},
		},
	}
	msg := &waE2E.Message{
		AudioStickerMessage: &waE2E.FutureProofMessage{
			Message: &waE2E.Message{StickerMessage: sticker},
		},
	}
	self := cli.Store.ID.ToNonAD()
	if _, err := cli.SendMessage(ctx, self, msg); err != nil {
		return fmt.Errorf("SEND: %w", err)
	}
	return nil
}

// Freno para los intentos de vinculación: WhatsApp limita los códigos y insistir empeora el bloqueo temporal.
func checkAndRecordPair() error {
	const gap = 3 * time.Minute
	const perDay = 4
	path := filepath.Join(dir, "pairs.json")
	var all []time.Time
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, &all)
	}
	now := time.Now()
	recent := []time.Time{}
	for _, t := range all {
		if now.Sub(t) < 24*time.Hour {
			recent = append(recent, t)
		}
	}
	if n := len(recent); n > 0 && now.Sub(recent[n-1]) < gap {
		return errors.New("PAIR_WAIT")
	}
	if len(recent) >= perDay {
		return errors.New("PAIR_DAILY")
	}
	recent = append(recent, now)
	b, _ := json.Marshal(recent)
	return os.WriteFile(path, b, 0o600)
}
