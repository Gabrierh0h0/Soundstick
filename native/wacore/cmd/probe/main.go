// Prueba de diagnóstico: abre la conexión previa al login (sin vincular nada) y mide cuánto dura.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	_ "modernc.org/sqlite"
)

func main() {
	dir, _ := os.MkdirTemp("", "probe")
	defer os.RemoveAll(dir)
	ctx := context.Background()
	c, err := sqlstore.New(ctx, "sqlite", "file:"+filepath.ToSlash(filepath.Join(dir, "p.db"))+"?_pragma=foreign_keys(1)", waLog.Noop)
	if err != nil {
		panic(err)
	}
	dev, _ := c.GetFirstDevice(ctx)
	cli := whatsmeow.NewClient(dev, waLog.Stdout("wa", "INFO", false))
	t0 := time.Now()
	cli.AddEventHandler(func(e any) {
		switch e.(type) {
		case *events.QR:
			fmt.Printf("%5.1fs QR\n", time.Since(t0).Seconds())
		case *events.Disconnected:
			fmt.Printf("%5.1fs DISCONNECTED\n", time.Since(t0).Seconds())
		default:
			fmt.Printf("%5.1fs %T\n", time.Since(t0).Seconds(), e)
		}
	})
	if err := cli.ConnectContext(ctx); err != nil {
		fmt.Println("connect:", err)
		return
	}
	fmt.Printf("%5.1fs connected\n", time.Since(t0).Seconds())
	for i := 0; i < 45; i++ {
		time.Sleep(2 * time.Second)
		if !cli.IsConnected() {
			fmt.Printf("%5.1fs SOCKET CLOSED\n", time.Since(t0).Seconds())
			return
		}
	}
	fmt.Printf("%5.1fs still connected after 90s\n", time.Since(t0).Seconds())
	cli.Disconnect()
}
