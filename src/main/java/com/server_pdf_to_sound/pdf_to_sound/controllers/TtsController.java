package com.server_pdf_to_sound.pdf_to_sound.controllers;

import com.server_pdf_to_sound.pdf_to_sound.services.TtsService;
import lombok.AllArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Base64;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/tts")
@CrossOrigin(origins = "http://localhost:3000")
@AllArgsConstructor
public class TtsController {

    private final TtsService ttsService;

    @PostMapping("/init")
    public ResponseEntity<Map<String, Integer>> initializeGeneration(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        List<String> chunks = ttsService.splitTextIntoChunks(text);
        return ResponseEntity.ok(Map.of("totalChunks", chunks.size()));
    }

    @PostMapping("/synthesize-chunk")
    public ResponseEntity<byte[]> synthesizeChunk(@RequestBody Map<String, Object> request) {
        try {
            String text = (String) request.get("text");
            Integer chunkIndex = (Integer) request.get("chunkIndex");
            String languageCode = (String) request.get("languageCode");
            String voiceName = (String) request.get("voiceName");

            // Debug logging
            System.out.println("Received parameters:");
            System.out.println("Language Code: " + languageCode);
            System.out.println("Voice Name: " + voiceName);

            // Validate parameters
            if (languageCode == null || languageCode.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("Language code is required".getBytes());
            }

            if (voiceName == null || voiceName.trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("Voice name is required".getBytes());
            }

            List<String> chunks = ttsService.splitTextIntoChunks(text);
            if (chunkIndex >= chunks.size()) {
                return ResponseEntity.badRequest().build();
            }

            byte[] audioData = ttsService.synthesize(
                chunks.get(chunkIndex),
                languageCode,
                voiceName
            );

            return ResponseEntity.ok()
                    .header("Content-Type", "audio/mp3")
                    .body(audioData);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/combine-chunks")
    public ResponseEntity<byte[]> combineChunks(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> base64Chunks = (List<String>) request.get("chunks");
            
            if (base64Chunks == null || base64Chunks.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body("No audio chunks provided".getBytes());
            }

            List<byte[]> audioChunks = new ArrayList<>();
            for (String base64Chunk : base64Chunks) {
                byte[] chunk = Base64.getDecoder().decode(base64Chunk);
                audioChunks.add(chunk);
            }

            byte[] combinedAudio = ttsService.combineAudioChunks(audioChunks);

            return ResponseEntity.ok()
                    .header("Content-Type", "audio/mp3")
                    .body(combinedAudio);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
} 