package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// resolveAPIKey reads + sanitizes GEMINI_API_KEY from env. Trim quotes
// so values with quote wrappers in .env do not leak into header.
func resolveAPIKey() (string, error) {
	rawKey := os.Getenv("GEMINI_API_KEY")

	apiKey := strings.TrimSpace(rawKey)
	apiKey = strings.ReplaceAll(apiKey, "\"", "")
	apiKey = strings.ReplaceAll(apiKey, "'", "")

	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY IS MISSING IN .ENV")
	}
	return apiKey, nil
}

// generateContent — single HTTP call to Gemini. New auth key format
// (AQ.Ab...) sent via x-goog-api-key header, NOT query param ?key=
// (more reliable and current Google standard). Timeout 60s (gemini-3-flash-preview
// model takes ±15-24s due to many thought tokens).
// Error from Google itself is wrapped as "AI service unavailable"
// (handler + log record original status & body).
func generateContent(client *http.Client, systemPrompt string) (string, error) {
	apiKey, err := resolveAPIKey()
	if err != nil {
		return "", err
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{"parts": []map[string]interface{}{{"text": systemPrompt}}},
		},
	}

	jsonData, _ := json.Marshal(reqBody)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", apiKey)
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		log.Printf("gemini: Google nolak request (status %d): %s", resp.StatusCode, string(bodyBytes))
		return "", fmt.Errorf("layanan AI tidak tersedia, coba lagi nanti")
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	json.Unmarshal(bodyBytes, &geminiResp)

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		rawText := geminiResp.Candidates[0].Content.Parts[0].Text
		rawText = strings.ReplaceAll(rawText, "```json", "")
		rawText = strings.ReplaceAll(rawText, "```", "")
		return strings.TrimSpace(rawText), nil
	}

	return "", fmt.Errorf("AI sedang pusing, coba lagi")
}

// GenerateSmartTrip — structured itinerary for /api/smart-trip & itinerary
// flow in Gari chat. Single source of itinerary prompt (don't duplicate in
// GenerateChat). Returns RAW JSON array (not yet parsed).
func GenerateSmartTrip(budget string, style string, days int, focus string) (string, error) {
	focusLine := ""
	if strings.TrimSpace(focus) != "" {
		focusLine = fmt.Sprintf("Focus on destination: %s.\n", strings.TrimSpace(focus))
	}

	systemPrompt := fmt.Sprintf(`You are a Smart Tourism AI Planner.
Make a travel itinerary for %d days.
Budget level: %s.
Travel style: %s.
%sInclude cultural/local events and weather-aware suggestions.
IMPORTANT: You must respond ONLY with a valid RAW JSON array of objects. Do not use markdown blocks.
Example format: [{"day": 1, "theme": "...", "activities": ["morning: ...", "afternoon: ..."]}]`, days, budget, style, focusLine)

	client := &http.Client{Timeout: 60 * time.Second}
	return generateContent(client, systemPrompt)
}

// ChatResult — structured response for POST Gari chat. SuggestedDestination
// is populated by service based on catalog (ids that actually exist in DB),
// not fabricated by Gemini.
type ChatResult struct {
	Reply string `json:"reply"`
	WantItinerary bool `json:"itinerary_requested"`
	// RecommendedIDs — catalog destination ids the user is suggested (can be empty
	// if question does not ask for recommendations). Mapped by service to full data.
	RecommendedIDs []uint `json:"recommended_destination_ids"`
	// DestinationID the user clearly refers to (actual destination id), 0 = none.
	IntendedDestinationID uint   `json:"intended_destination_id,omitempty"`
	Budget                string `json:"budget,omitempty"`
	Style                 string `json:"style,omitempty"`
	Days                  int    `json:"days,omitempty"`
}

// GenerateChat — single user message to Gari. System prompt locks Gemini to
// mention destination names ONLY from the given catalog (destinationCatalog
// built from GET /api/destinations/trending via service), must not fabricate.
// If user asks for full itinerary, Gemini sets WantItinerary=true and
// service later calls GenerateSmartTrip (not GenerateChat making the itinerary
// — don't duplicate itinerary prompt).
func GenerateChat(message string, destinationCatalog string) (*ChatResult, error) {
	systemPrompt := fmt.Sprintf(`You are Gari, a travel assistant for NusaPath (a real Indonesian tourism platform).

The user sends you a message. Always reply in the user's language.
Use ONLY destination ids from the KNOWN catalog below — never invent destination ids or names.

KNOWN DESTINATION CATALOG (id — name):
%s

Rules:
- reply: a friendly, helpful, concise answer to the user. If they ask which places to visit,
  pick recommended spots ONLY from the catalog above, mention them by name in the reply,
  and PUT their ids into recommended_destination_ids.
- recommended_destination_ids: array of catalog ids you are recommending/suggesting. Empty array
  when you are not recommending specific places (e.g. answering a greeting or general question).
- itinerary_requested: set to true ONLY when the user asks you to build a full itinerary AND
  enough details are present (budget + style + number of days). Otherwise false.
- intended_destination_id: catalog id if the user clearly refers to one destination (0 when none/ambiguous).
- budget: one of "Hemat", "Menengah", "Mewah" (only when itinerary_requested). Use "Menengah" if unspecified.
- style: one of "Budaya & Sejarah", "Alam & Petualangan", "Kuliner & Santai" (only when itinerary_requested).
- days: integer 1-14 (only when itinerary_requested).

User message: "%s"

Respond ONLY with a valid RAW JSON object (no markdown fences) exactly matching this schema:
{"reply":"...","recommended_destination_ids":[1],"itinerary_requested":false,"intended_destination_id":0,"budget":"","style":"","days":0}`,
		destinationCatalog, message)

	client := &http.Client{Timeout: 60 * time.Second}
	rawText, err := generateContent(client, systemPrompt)
	if err != nil {
		return nil, err
	}

	var out ChatResult
	// Fallback: if Gemini replies with non-JSON (e.g. plain text), store it in Reply.
	var loose struct {
		Reply string `json:"reply"`
	}
	if jerr := json.Unmarshal([]byte(rawText), &out); jerr != nil {
		_ = json.Unmarshal([]byte(rawText), &loose)
		return &ChatResult{Reply: loose.Reply}, nil
	}
	return &out, nil
}