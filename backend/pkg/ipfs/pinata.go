package ipfs

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type PinataResponse struct {
	IpfsHash string `json:"IpfsHash"`
}

func PinToIPFS(ticketPayload string) (string, error) {
	jwt := os.Getenv("PINATA_JWT")
	if jwt == "" {
		return "", errors.New("PINATA_JWT tidak ditemukan di .env")
	}

	url := "https://api.pinata.cloud/pinning/pinJSONToIPFS"

	payload := map[string]interface{}{
		"pinataContent": map[string]string{
			"ticket_payload": ticketPayload,
		},
		"pinataMetadata": map[string]string{
			"name": "NusaPath_Ticket",
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+jwt)

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gagal upload ke IPFS. Status: %d, Response: %s", resp.StatusCode, string(bodyBytes))
	}

	var pinataResp PinataResponse
	if err := json.NewDecoder(resp.Body).Decode(&pinataResp); err != nil {
		return "", err
	}

	return pinataResp.IpfsHash, nil
}
